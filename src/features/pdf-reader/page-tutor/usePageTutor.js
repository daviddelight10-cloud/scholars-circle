// Page Tutor state: lesson per page (memory-cached), audio polling, the
// single <audio> element that keeps playing across scrolls/page turns, and
// the device-voice fallback engine for sections whose hosted audio failed.
import { useRef, useState, useCallback, useEffect } from "react";
import { explainPage, getAudio, getLessonPages, retryAudio, reportLesson, logEvent } from "./pageTutorApi.js";
import { playableSections, SPEEDS } from "./lessonUtils.js";
import { SpeechEngine, chunkNarration, speechSupported } from "./speech.js";
import { openPremium } from "../../../lib/premium.js";

const POLL_MS = 3000;
const SPEECH_FLAG = speechSupported() ? "failed" : false;

export function usePageTutor({ resourceId, onLessonDone, onPlayFailed } = {}) {
  const cacheRef = useRef(new Map()); // page -> { lessonId, lesson, audioStatus, generationSource }
  const pollRef = useRef(null);
  const elRef = useRef(null); // the one <audio> element
  const speechRef = useRef(null); // SpeechEngine for failed sections
  const playedRef = useRef(new Set()); // lessonId:sectionId already logged
  const speechLoggedRef = useRef(new Set()); // lessonId already logged tts_speech
  const [lesson, setLesson] = useState(null);       // { lessonId, lesson, audioStatus, generationSource, page, cached }
  const [status, setStatus] = useState("idle");     // idle | loading | ready | error | premium
  const [error, setError] = useState("");
  const [audioSections, setAudioSections] = useState([]);
  const [player, setPlayer] = useState({ idx: -1, playing: false, time: 0, dur: 0, speed: 1, mode: null, chunk: 0, chunks: 0 });
  const [regenerating, setRegenerating] = useState(false);
  const [lessonPages, setLessonPages] = useState(new Set()); // pages with a cached lesson — thumbnail dots
  const [reviewItems, setReviewItems] = useState([]);        // flattened recall Qs — chapter review
  const cbRef = useRef({});                                  // lecture-mode callbacks (latest props)
  useEffect(() => { cbRef.current = { onLessonDone, onPlayFailed }; }, [onLessonDone, onPlayFailed]);

  useEffect(() => {
    let live = true;
    const p = resourceId ? getLessonPages(resourceId).catch(() => ({ pages: [], items: [] })) : Promise.resolve({ pages: [], items: [] });
    p.then((d) => { if (live) { setLessonPages(new Set(d.pages || [])); setReviewItems(d.items || []); } });
    return () => { live = false; };
  }, [resourceId]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  const refreshAudio = useCallback(async (lessonId) => {
    try {
      const data = await getAudio(lessonId);
      setAudioSections(data.sections || []);
      setLesson((l) => (l && l.lessonId === lessonId ? { ...l, audioStatus: data.audioStatus } : l));
      return data.audioStatus;
    } catch {
      return null;
    }
  }, []);

  const startPolling = useCallback((lessonId) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      const st = await refreshAudio(lessonId);
      if (st && st !== "pending" && st !== "partial") stopPolling();
    }, POLL_MS);
  }, [refreshAudio, stopPolling]);

  const adopt = useCallback((page, data) => {
    const entry = {
      lessonId: data.lessonId, lesson: data.lesson, audioStatus: data.audioStatus,
      generationSource: data.generationSource || "gemini",
      page, cached: !!data.cached,
    };
    cacheRef.current.set(page, entry);
    setLesson(entry);
    setStatus("ready");
    setLessonPages((s) => (s.has(page) ? s : new Set([...s, page])));
    logEvent(data.lessonId, "open");
    if (data.audioStatus === "pending" || data.audioStatus === "partial") {
      refreshAudio(data.lessonId).then(() => startPolling(data.lessonId));
    } else if (data.audioStatus === "ready") {
      refreshAudio(data.lessonId);
    } else {
      setAudioSections([]);
    }
  }, [refreshAudio, startPolling]);

  // explain(page, { snapshot }) — snapshot is an optional promise/value
  // { pageImage, pageText } used only when a fresh generation happens (GLM
  // fallback input + scanned-page OCR text). Cache hits ignore it.
  const explain = useCallback(async (page, { autoIfCached = false, snapshot } = {}) => {
    if (!resourceId) return;
    const hit = cacheRef.current.get(page);
    if (hit) { adopt(page, { ...hit, cached: true }); return; }
    if (autoIfCached) return; // never auto-generate — cost control is tap-only
    setStatus("loading");
    setError("");
    setLesson(null);
    setAudioSections([]);
    setPlayer((p) => ({ ...p, idx: -1, playing: false, time: 0, mode: null }));
    if (elRef.current) { elRef.current.pause(); elRef.current.src = ""; }
    speechRef.current?.cancel();
    try {
      const snap = snapshot ? await Promise.resolve(snapshot).catch(() => ({})) : {};
      const data = await explainPage(resourceId, page, snap);
      adopt(page, data);
    } catch (err) {
      if (err.code === "premium_required" || err.status === 403) {
        setStatus("premium");
        openPremium?.("Page Tutor");
      } else {
        setStatus("error");
      }
      setError(err.message || "Could not explain this page");
    }
  }, [resourceId, adopt]);

  // Re-run a glm-produced lesson through the real engine once it recovers.
  // Server keeps the old lesson if regeneration fails.
  const regenerate = useCallback(async (page, { snapshot } = {}) => {
    if (!resourceId || regenerating) return;
    setRegenerating(true);
    setError("");
    try {
      const snap = snapshot ? await Promise.resolve(snapshot).catch(() => ({})) : {};
      const data = await explainPage(resourceId, page, { ...snap, regenerate: true });
      if (data.regenFailed) {
        setError("Full engine is still busy — kept the current lesson.");
        return;
      }
      adopt(page, data);
    } catch (err) {
      if (err.code === "premium_required") openPremium?.("Page Tutor");
      setError(err.message || "Could not regenerate the lesson");
    } finally {
      setRegenerating(false);
    }
  }, [resourceId, adopt, regenerating]);

  // Refs so the element listeners see fresh state without rebinding.
  const lessonRef = useRef(lesson);
  const audioSectionsRef = useRef(audioSections);
  const playIdxRef = useRef(null);
  const lastIdxRef = useRef(-1);
  useEffect(() => { lessonRef.current = lesson; }, [lesson]);
  useEffect(() => { audioSectionsRef.current = audioSections; }, [audioSections]);

  const ensureSpeech = useCallback(() => {
    if (!speechRef.current) speechRef.current = new SpeechEngine();
    return speechRef.current;
  }, []);

  // Advance to the next playable section — shared by file "ended" and speech
  // engine completion so auto-advance works across mixed modes.
  const advance = useCallback((fromIdx) => {
    const list = playableSections(lessonRef.current?.lesson, audioSectionsRef.current, { speech: SPEECH_FLAG });
    const next = list.findIndex((s, i) => i > fromIdx && s.playable);
    setPlayer((p) => {
      if (next >= 0) {
        playIdxRef.current?.(next);
        return { ...p, idx: next, playing: true };
      }
      if (lessonRef.current?.lessonId) logEvent(lessonRef.current.lessonId, "audio_finish");
      return { ...p, playing: false };
    });
    // Lesson finished — notify outside the updater (updaters must stay pure and
    // may run twice under StrictMode).
    if (next < 0) setTimeout(() => cbRef.current.onLessonDone?.(), 0);
  }, []);

  const playSpeech = useCallback((idx, item, section) => {
    elRef.current?.pause();
    const text = String(section?.narration || "").trim() || String(section?.explanation || "").trim();
    const chunks = chunkNarration(text);
    if (!chunks.length) return;
    const engine = ensureSpeech();
    engine.start(chunks, {
      rate: player.speed,
      onChunk: (i, count) => setPlayer((p) => ({ ...p, chunk: i, chunks: count, time: i, dur: count })),
      onEnd: () => advance(idx),
    });
    setPlayer((p) => ({ ...p, idx, playing: true, mode: "speech", chunk: 0, chunks: chunks.length, time: 0, dur: chunks.length }));
    if (lessonRef.current?.lessonId && !speechLoggedRef.current.has(lessonRef.current.lessonId)) {
      speechLoggedRef.current.add(lessonRef.current.lessonId);
      logEvent(lessonRef.current.lessonId, "tts_speech");
    }
    if (lessonRef.current?.lessonId && !playedRef.current.has(`${lessonRef.current.lessonId}:${item.sectionId}`)) {
      playedRef.current.add(`${lessonRef.current.lessonId}:${item.sectionId}`);
      logEvent(lessonRef.current.lessonId, "section_play");
    }
  }, [player.speed, ensureSpeech, advance]);

  const ensureEl = useCallback(() => {
    if (!elRef.current) {
      elRef.current = new Audio();
      elRef.current.preload = "auto";
      elRef.current.addEventListener("timeupdate", () => {
        setPlayer((p) => (p.mode === "file" ? { ...p, time: elRef.current.currentTime, dur: elRef.current.duration || 0 } : p));
      });
      elRef.current.addEventListener("ended", () => advance(lastIdxRef.current));
      elRef.current.addEventListener("pause", () => setPlayer((p) => (p.mode === "file" ? { ...p, playing: false } : p)));
      elRef.current.addEventListener("play", () => setPlayer((p) => ({ ...p, playing: true })));
    }
    return elRef.current;
  }, [advance]);

  const playIdx = useCallback((idx) => {
    const list = playableSections(lessonRef.current?.lesson, audioSectionsRef.current, { speech: SPEECH_FLAG });
    const item = list[idx];
    if (!item?.playable) return;
    lastIdxRef.current = idx;
    const section = lessonRef.current?.lesson?.sections?.[idx];
    if (item.mode === "speech") {
      playSpeech(idx, item, section);
      return;
    }
    speechRef.current?.cancel();
    const el = ensureEl();
    el.src = item.audio.url;
    el.playbackRate = player.speed;
    el.play().catch(() => { cbRef.current.onPlayFailed?.(); });
    if (lessonRef.current?.lessonId && !playedRef.current.has(`${lessonRef.current.lessonId}:${item.sectionId}`)) {
      playedRef.current.add(`${lessonRef.current.lessonId}:${item.sectionId}`);
      logEvent(lessonRef.current.lessonId, "section_play");
    }
    setPlayer((p) => ({ ...p, idx, playing: true, mode: "file" }));
    if ("mediaSession" in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: item.heading || "Page lesson",
          artist: "Scholar's Circle Page Tutor",
        });
      } catch {}
    }
  }, [player.speed, ensureEl, playSpeech]);

  useEffect(() => { playIdxRef.current = playIdx; }, [playIdx]);

  const playSection = useCallback((idx) => {
    if (player.idx === idx && player.playing) {
      if (player.mode === "speech") speechRef.current?.pause();
      else elRef.current?.pause();
      return;
    }
    playIdx(idx);
  }, [player.idx, player.playing, player.mode, playIdx]);

  const playAll = useCallback(() => {
    const list = playableSections(lesson?.lesson, audioSections, { speech: SPEECH_FLAG });
    const first = list.findIndex((s) => s.playable);
    if (first >= 0) playIdx(first);
  }, [lesson, audioSections, playIdx]);

  const toggle = useCallback(() => {
    if (player.idx < 0) { playAll(); return; }
    if (player.mode === "speech") {
      const engine = speechRef.current;
      if (!engine) return;
      if (player.playing) { engine.pause(); setPlayer((p) => ({ ...p, playing: false })); }
      else { engine.resume(); setPlayer((p) => ({ ...p, playing: true })); }
      return;
    }
    const el = elRef.current;
    if (!el) { playAll(); return; }
    if (player.playing) el.pause(); else el.play().catch(() => {});
  }, [player.idx, player.playing, player.mode, playAll]);

  const seekBy = useCallback((delta) => {
    if (player.mode === "speech") { speechRef.current?.skipBy(delta > 0 ? 2 : -2); return; }
    const el = elRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, Math.min((el.duration || 0), el.currentTime + delta));
  }, [player.mode]);

  const cycleSpeed = useCallback(() => {
    setPlayer((p) => {
      const next = SPEEDS[(SPEEDS.indexOf(p.speed) + 1) % SPEEDS.length];
      if (elRef.current) elRef.current.playbackRate = next;
      speechRef.current?.setRate(next);
      return { ...p, speed: next };
    });
  }, []);

  const seekTo = useCallback((frac) => {
    if (player.mode === "speech") { speechRef.current?.seekTo(frac); return; }
    const el = elRef.current;
    if (!el || !el.duration) return;
    el.currentTime = frac * el.duration;
  }, [player.mode]);

  const retry = useCallback(async () => {
    if (!lesson?.lessonId) return;
    try {
      await retryAudio(lesson.lessonId);
      setLesson((l) => (l ? { ...l, audioStatus: "pending" } : l));
      startPolling(lesson.lessonId);
    } catch (err) {
      if (err.code === "premium_required") openPremium?.("Page Tutor");
      setError(err.message || "Audio retry failed");
    }
  }, [lesson, startPolling]);

  const report = useCallback(async (reason, note) => {
    if (!lesson?.lessonId) return;
    try { await reportLesson(lesson.lessonId, reason, note); } catch {}
  }, [lesson]);

  const logRecall = useCallback(() => {
    if (lesson?.lessonId) logEvent(lesson.lessonId, "recall_answer");
  }, [lesson]);

  // Page changed: keep audio playing; if the new page has a memory-cached
  // lesson adopt it, else reset to idle so the panel shows the explain CTA.
  const onPageChanged = useCallback((page) => {
    const hit = cacheRef.current.get(page);
    if (hit) adopt(page, { ...hit, cached: true });
    else if (lesson && lesson.page !== page) { setLesson(null); setStatus("idle"); setAudioSections([]); }
  }, [lesson, adopt]);

  useEffect(() => () => {
    stopPolling();
    if (elRef.current) { elRef.current.pause(); elRef.current.src = ""; }
    speechRef.current?.cancel();
  }, [stopPolling]);

  return {
    lesson, status, error, setError,
    audioSections, player, regenerating, lessonPages, reviewItems,
    explain, regenerate, onPageChanged, playSection, playAll, toggle, seekBy, seekTo, cycleSpeed,
    retry, report, logRecall, speechSupported: SPEECH_FLAG === "failed",
  };
}
