import { useCallback, useEffect, useRef, useState } from "react";
import { getWsUrl, refreshTicket } from "./liveQuizApi";
import { sounds } from "./sounds";

const PING_MS = 20000;
const RECONNECT_DELAY_MS = 1500;
const MAX_RECONNECTS = 8;

const initialState = {
  phase: "connecting", // connecting | lobby | transition | question | reveal | teachback | complete | ended | error
  roomId: null,
  code: null,
  title: "",
  isHost: false,
  settings: { timePerQuestion: 30, numQuestions: 5 },
  maxQuestions: 20,
  poolSize: 0,
  participants: [],
  question: null,
  reveal: null,
  ready: { ready: [], needed: [] },
  teachBack: null,
  poll: null,
  chat: [],
  unread: 0,
  groupStreak: 0,
  talkedThrough: 0,
  complete: null,
  nextIndex: 0,
  endReason: null,
  error: null,
  serverOffset: 0, // serverNow - clientNow, for deadline countdowns
};

export function useLiveQuiz(roomId, initialTicket, { onReaction, onChat } = {}) {
  const [state, setState] = useState({ ...initialState, roomId });
  const stateRef = useRef(state);
  const wsRef = useRef(null);
  const ticketRef = useRef(initialTicket);
  const reconnectsRef = useRef(0);
  const pingRef = useRef(null);
  const closedRef = useRef(false);
  const connectRef = useRef(null);
  const callbacksRef = useRef({ onReaction, onChat });

  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    callbacksRef.current = { onReaction, onChat };
  }, [onReaction, onChat]);

  const patch = useCallback((p) => setState((s) => ({ ...s, ...p })), []);

  const send = useCallback((msg) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  const handleEvent = useCallback((msg) => {
    switch (msg.type) {
      case "room_state": {
        const offset = msg.serverNow ? msg.serverNow - Date.now() : 0;
        setState((s) => ({
          ...s,
          phase: msg.phase,
          roomId: msg.roomId,
          code: msg.code,
          title: msg.title,
          isHost: msg.isHost,
          settings: msg.settings,
          maxQuestions: msg.maxQuestions,
          poolSize: msg.poolSize,
          participants: msg.participants,
          talkedThrough: msg.talkedThrough,
          groupStreak: msg.groupStreak,
          chat: msg.chatLog || [],
          question: msg.question || null,
          reveal: msg.reveal || null,
          ready: msg.ready || s.ready,
          teachBack: msg.teachBack || null,
          complete: msg.complete || null,
          serverOffset: offset,
        }));
        break;
      }
      case "lobby_state":
        patch({ participants: msg.participants, ...(msg.settings ? { settings: msg.settings } : {}) });
        break;
      case "player_joined":
      case "player_left":
        patch({ participants: msg.participants });
        break;
      case "phase":
        if (msg.phase === "transition") {
          patch({ phase: "transition", nextIndex: msg.nextIndex, reveal: null, ready: { ready: [], needed: [] }, teachBack: null, poll: null });
        }
        break;
      case "question":
        patch({ phase: "question", question: msg, reveal: null, poll: null, teachBack: null, ready: { ready: [], needed: [] } });
        break;
      case "lock_update":
        setState((s) => s.question ? { ...s, question: { ...s.question, lockedCount: msg.locked, totalCount: msg.total } } : s);
        break;
      case "reveal":
        sounds.reveal();
        patch({ phase: "reveal", reveal: msg, talkedThrough: (msg.index ?? 0) + 1, groupStreak: msg.groupStreak });
        break;
      case "teachback_prompt":
        patch({ phase: "teachback", teachBack: { teacherId: msg.teacherId, teacherName: msg.teacherName, text: null } });
        break;
      case "teachback":
        sounds.teach();
        setState((s) => ({ ...s, phase: "reveal", teachBack: { ...(s.teachBack || {}), teacherId: msg.userId, teacherName: msg.name, text: msg.text, xpBonus: msg.xpBonus } }));
        break;
      case "teachback_skipped":
        setState((s) => ({ ...s, phase: "reveal", teachBack: { ...(s.teachBack || {}), teacherId: msg.userId, skipped: true } }));
        break;
      case "ready_update":
        patch({ ready: { ready: msg.ready, needed: msg.needed } });
        break;
      case "poll":
        setState((s) => ({
          ...s,
          poll: { votes: msg.votes, basedOn: msg.basedOn },
          question: s.question ? { ...s.question, lifelineUsed: true } : s.question,
        }));
        break;
      case "lifeline_denied":
        patch({ poll: { denied: msg.reason } });
        break;
      case "wager_ack":
        setState((s) => s.question ? { ...s, question: { ...s.question, wagerActive: msg.accepted } } : s);
        break;
      case "chat":
        setState((s) => ({ ...s, chat: [...s.chat, msg] }));
        callbacksRef.current.onChat?.(msg);
        break;
      case "reaction":
        callbacksRef.current.onReaction?.(msg);
        break;
      case "complete":
        sounds.victory();
        patch({ phase: "complete", complete: msg });
        break;
      case "session_ended":
        patch({ phase: "ended", endReason: msg.reason });
        break;
      case "pong":
        break;
      default:
        break;
    }
  }, [patch]);

  const connect = useCallback(async () => {
    if (closedRef.current) return;
    let ticket = ticketRef.current;
    if (reconnectsRef.current > 0) {
      try {
        const t = await refreshTicket(roomId);
        ticket = t.ticket;
      } catch {
        // keep trying with whatever we have
      }
    }
    const ws = new WebSocket(getWsUrl(roomId, ticket));
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectsRef.current = 0;
      pingRef.current = setInterval(() => {
        send({ type: "ping", t: Date.now() });
      }, PING_MS);
    };
    ws.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      handleEvent(msg);
    };
    ws.onclose = () => {
      clearInterval(pingRef.current);
      if (closedRef.current) return;
      if (["ended", "error", "complete"].includes(stateRef.current.phase)) return;
      if (reconnectsRef.current < MAX_RECONNECTS) {
        reconnectsRef.current++;
        setTimeout(() => connectRef.current?.(), RECONNECT_DELAY_MS * reconnectsRef.current);
      } else {
        patch({ phase: "error", error: "Lost connection to the session" });
      }
    };
    ws.onerror = () => {};
  }, [roomId, send, handleEvent, patch]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    closedRef.current = false;
    connect();
    return () => {
      closedRef.current = true;
      clearInterval(pingRef.current);
      try { wsRef.current?.close(); } catch {}
    };
  }, [connect]);

  // Timer tick for countdown UIs — derived from question deadline
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (state.phase !== "question" && state.phase !== "teachback") return;
    const iv = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(iv);
  }, [state.phase]);

  const timeLeft = state.question?.deadline
    ? Math.max(0, Math.ceil((state.question.deadline - (now + state.serverOffset)) / 1000))
    : null;

  const setUnread = useCallback((n) => setState((s) => ({ ...s, unread: typeof n === "function" ? n(s.unread) : n })), []);

  return {
    ...state,
    timeLeft,
    setUnread,
    actions: {
      lobbyReady: (ready) => send({ type: "lobby_ready", ready }),
      updateSettings: (timePerQuestion, numQuestions) => send({ type: "settings", timePerQuestion, numQuestions }),
      start: () => send({ type: "start" }),
      answer: (option, confidence) => {
        send({ type: "answer", option, confidence });
        setState((s) => s.question ? { ...s, question: { ...s.question, answered: { option, confidence } } } : s);
      },
      wager: (accept) => send({ type: "wager", accept }),
      useLifeline: () => send({ type: "use_lifeline" }),
      submitTeachBack: (text) => send({ type: "teachback", text }),
      readyNext: () => send({ type: "ready_next" }),
      sendChat: (text) => send({ type: "chat", text }),
      react: (emoji) => send({ type: "reaction", emoji }),
      clearPoll: () => patch({ poll: null }),
      leave: () => send({ type: "leave" }),
      end: () => send({ type: "end" }),
    },
  };
}
