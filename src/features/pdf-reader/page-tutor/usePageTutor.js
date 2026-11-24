// Page Tutor state: lesson per page (memory-cached), audio polling, and the
// single <audio> element that keeps playing across scrolls and page turns.
import { useRef, useState, useCallback, useEffect } from "react";
import { explainPage, getAudio, retryAudio, saveFlashcards, reportLesson, logEvent } from "./pageTutorApi.js";
import { playableSections, SPEEDS } from "./lessonUtils.js";
import { openPremium } from "../../../lib/premium.js";

const POLL_MS = 3000;

export function usePageTutor({ resourceId } = {}) {
  const cacheRef = useRef(new Map()); // page -> { lessonId, lesson, audioStatus }
  const pollRef = useRef(null);
  const elRef = useRef(null); // the one <audio> element
  const playedRef = useRef(new Set()); // lessonId:sectionId already logged
  const [lesson, setLesson] = useState(null);       // { lessonId, lesson, audioStatus, page, cached }
  const [status, setStatus] = useState("idle");     // idle | loading | ready | error | premium
  const [error, setError] = useState("");
  const [audioSections, setAudioSections] = useState([]);
  const [player, setPlayer] = useState({ idx: -1, playing: false, time: 0, dur: 0, speed: 1 });
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(null);

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
    const entry = { lessonId: data.lessonId, lesson: data.lesson, audioStatus: data.audioStatus, page, cached: !!data.cached };
    cacheRef.current.set(page, entry);
    setLesson(entry);
    setStatus("ready");
    setSavedCount(null);
    logEvent(data.lessonId, "open");
    if (data.audioStatus === "pending" || data.audioStatus === "partial") {
      refreshAudio(data.lessonId).then(() => startPolling(data.lessonId));
    } else if (data.audioStatus === "ready") {
      refreshAudio(data.lessonId);
    } else {
      setAudioSections([]);
    }
  }, [refreshAudio, startPolling]);

  // explain(page) — cache-hit first (free), otherwise POST which either serves
  // the shared cache or generates fresh (premium-gated server-side).
  const explain = useCallback(async (page, { autoIfCached = false } = {}) => {
    if (!resourceId) return;
    const hit = cacheRef.current.get(page);
    if (hit) { adopt(page, { ...hit, cached: true }); return; }
    if (autoIfCached) return; // never auto-generate — cost control is tap-only
    setStatus("loading");
    setError("");
    setLesson(null);
    setAudioSections([]);
    setPlayer((p) => ({ ...p, idx: -1, playing: false, time: 0 }));
    if (elRef.current) { elRef.current.pause(); elRef.current.src = ""; }
    try {
      const data = await explainPage(resourceId, page);
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

  // Refs so the element listeners see fresh state without rebinding.
  const lessonRef = useRef(lesson);
  const audioSectionsRef = useRef(audioSections);
  const playIdxRef = useRef(null);
  useEffect(() => { lessonRef.current = lesson; }, [lesson]);
  useEffect(() => { audioSectionsRef.current = audioSections; }, [audioSections]);

  // ── Audio player ───────────────────────────────────────────────────────────
  const ensureEl = useCallback(() => {
    if (!elRef.current) {
      elRef.current = new Audio();
      elRef.current.preload = "auto";
      elRef.current.addEventListener("timeupdate", () => {
        setPlayer((p) => ({ ...p, time: elRef.current.currentTime, dur: elRef.current.duration || 0 }));
      });
      elRef.current.addEventListener("ended", () => {
        setPlayer((p) => {
          const list = playableSections(lessonRef.current?.lesson, audioSectionsRef.current);
          const next = list.findIndex((s, i) => i > p.idx && s.playable);
          if (next >= 0) {
            playIdxRef.current?.(next);
            return { ...p, idx: next, playing: true };
          }
          if (lessonRef.current?.lessonId) logEvent(lessonRef.current.lessonId, "audio_finish");
          return { ...p, playing: false };
        });
      });
      elRef.current.addEventListener("pause", () => setPlayer((p) => ({ ...p, playing: false })));
      elRef.current.addEventListener("play", () => setPlayer((p) => ({ ...p, playing: true })));
    }
    return elRef.current;
  }, []);

  const playIdx = useCallback((idx) => {
    const list = playableSections(lessonRef.current?.lesson, audioSectionsRef.current);
    const item = list[idx];
    if (!item?.playable) return;
    const el = ensureEl();
    el.src = item.audio.url;
    el.playbackRate = player.speed;
    el.play().catch(() => {});
    if (lessonRef.current?.lessonId && !playedRef.current.has(`${lessonRef.current.lessonId}:${item.sectionId}`)) {
      playedRef.current.add(`${lessonRef.current.lessonId}:${item.sectionId}`);
      logEvent(lessonRef.current.lessonId, "section_play");
    }
    setPlayer((p) => ({ ...p, idx, playing: true }));
    if ("mediaSession" in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: item.heading || "Page lesson",
          artist: "Scholar's Circle Page Tutor",
        });
      } catch {}
    }
  }, [player.speed, ensureEl]);

  useEffect(() => { playIdxRef.current = playIdx; }, [playIdx]);

  const playSection = useCallback((idx) => {
    if (player.idx === idx && player.playing) { elRef.current?.pause(); return; }
    playIdx(idx);
  }, [player.idx, player.playing, playIdx]);

  const playAll = useCallback(() => {
    const list = playableSections(lesson?.lesson, audioSections);
    const first = list.findIndex((s) => s.playable);
    if (first >= 0) playIdx(first);
  }, [lesson, audioSections, playIdx]);

  const toggle = useCallback(() => {
    const el = elRef.current;
    if (!el || player.idx < 0) { playAll(); return; }
    if (player.playing) el.pause(); else el.play().catch(() => {});
  }, [player.idx, player.playing, playAll]);

  const seekBy = useCallback((delta) => {
    const el = elRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, Math.min((el.duration || 0), el.currentTime + delta));
  }, []);

  const cycleSpeed = useCallback(() => {
    setPlayer((p) => {
      const next = SPEEDS[(SPEEDS.indexOf(p.speed) + 1) % SPEEDS.length];
      if (elRef.current) elRef.current.playbackRate = next;
      return { ...p, speed: next };
    });
  }, []);

  const seekTo = useCallback((frac) => {
    const el = elRef.current;
    if (!el || !el.duration) return;
    el.currentTime = frac * el.duration;
  }, []);

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

  const makeFlashcards = useCallback(async () => {
    if (!lesson?.lessonId || saving) return;
    setSaving(true);
    try {
      const r = await saveFlashcards(lesson.lessonId, resourceId);
      setSavedCount(r.created ?? 0);
    } catch (err) {
      setError(err.message || "Could not save flashcards");
    } finally {
      setSaving(false);
    }
  }, [lesson, resourceId, saving]);

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
  }, [stopPolling]);

  return {
    lesson, status, error, setError,
    audioSections, player, saving, savedCount,
    explain, onPageChanged, playSection, playAll, toggle, seekBy, seekTo, cycleSpeed,
    retry, makeFlashcards, report, logRecall,
  };
}
