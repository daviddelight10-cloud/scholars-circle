import { useState, useRef, useCallback, useEffect } from "react";
import { API_BASE } from "../../lib/constants.js";

function getAuthToken() {
  try {
    return JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}").authToken || null;
  } catch {
    return null;
  }
}

function getUsername() {
  try {
    const u = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}").authUser;
    return u?.username || u?.name || "Student";
  } catch {
    return "Student";
  }
}

function getWsBase() {
  if (API_BASE.startsWith("https://")) return API_BASE.replace("https://", "wss://");
  if (API_BASE.startsWith("http://")) return API_BASE.replace("http://", "ws://");
  return `ws://${API_BASE}`;
}

async function api(path, opts = {}) {
  const token = getAuthToken();
  const res = await fetch(`${API_BASE}/api/osce-rooms${path}`, {
    method: opts.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

/**
 * Group-practice room client. State is driven by `room_state` pushes from the
 * server; events (say/tick/bell) apply on top for immediacy.
 */
export function useOsceRoom() {
  const [room, setRoom] = useState(null);      // last room_state payload
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [bellAt, setBellAt] = useState(0);     // increments each bell → ring feedback
  const wsRef = useRef(null);
  const roomIdRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const attemptsRef = useRef(0);
  const connectRef = useRef(null); // self-ref so onclose can re-arm without a forward ref

  const cleanup = useCallback(() => {
    if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
    if (wsRef.current) { try { wsRef.current.close(); } catch {} wsRef.current = null; }
  }, []);

  const connectWs = useCallback((roomId, ticket) => {
    cleanup();
    const url = `${getWsBase()}/api/osce-rooms/${roomId}/ws?ticket=${encodeURIComponent(ticket)}&name=${encodeURIComponent(getUsername())}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;
    roomIdRef.current = roomId;

    ws.onopen = () => { setConnected(true); setError(null); attemptsRef.current = 0; };
    ws.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      if (msg.type === "room_state") {
        setRoom(msg);
      } else if (msg.type === "member_update") {
        setRoom((r) => (r ? { ...r, participants: msg.participants } : r));
      } else if (msg.type === "say") {
        setRoom((r) => (r ? { ...r, transcript: [...(r.transcript || []), msg.line].slice(-400) } : r));
      } else if (msg.type === "tick") {
        setRoom((r) => {
          if (!r) return r;
          const ticks = new Set(r.ticks || []);
          if (msg.on) ticks.add(msg.idx); else ticks.delete(msg.idx);
          return { ...r, ticks: [...ticks] };
        });
      } else if (msg.type === "global_rating") {
        setRoom((r) => (r ? { ...r, globalRating: msg.rating } : r));
      } else if (msg.type === "examiner_note") {
        setRoom((r) => (r ? { ...r, examinerNote: msg.text } : r));
      } else if (msg.type === "bell") {
        setBellAt(Date.now());
      } else if (msg.type === "room_closed") {
        setRoom(null);
        setConnected(false);
        setError("The host ended the room.");
      } else if (msg.type === "error") {
        setError(msg.message || "Room error");
      }
    };
    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
      // Auto-rejoin with a fresh ticket (room keeps your seat for ~30s)
      if (roomIdRef.current && attemptsRef.current < 3) {
        attemptsRef.current += 1;
        reconnectTimerRef.current = setTimeout(async () => {
          try {
            const { ticket } = await api(`/${roomIdRef.current}/ticket`, { method: "POST" });
            connectRef.current?.(roomIdRef.current, ticket);
          } catch {
            setError("Lost connection to the room.");
          }
        }, 1500 * attemptsRef.current);
      }
    };
    ws.onerror = () => {};
  }, [cleanup]);

  useEffect(() => { connectRef.current = connectWs; }, [connectWs]);

  const createRoom = useCallback(async (station) => {
    setError(null);
    const data = await api("/", { method: "POST", body: { station } });
    connectWs(data.roomId, data.ticket);
    return data;
  }, [connectWs]);

  const joinRoom = useCallback(async (code) => {
    setError(null);
    const data = await api("/join", { method: "POST", body: { code } });
    connectWs(data.roomId, data.ticket);
    return data;
  }, [connectWs]);

  const send = useCallback((msg) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
      return true;
    }
    return false;
  }, []);

  const leave = useCallback(() => {
    roomIdRef.current = null;
    cleanup();
    setRoom(null);
    setConnected(false);
  }, [cleanup]);

  useEffect(() => cleanup, [cleanup]);

  return { room, connected, error, bellAt, createRoom, joinRoom, send, leave, setError };
}
