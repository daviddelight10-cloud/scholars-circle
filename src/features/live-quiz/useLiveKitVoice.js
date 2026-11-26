import { useCallback, useEffect, useRef, useState } from "react";
import { getVoiceToken } from "./liveQuizApi";

/**
 * LiveKit voice chat for a live-quiz room.
 * Returns { voiceAvailable, connected, muted, speakingIds, toggleMic }.
 * If the server has no LiveKit credentials, voiceAvailable stays false and
 * the mic button degrades to a disabled state.
 */
export function useLiveKitVoice(roomId, enabled) {
  const [voiceAvailable, setVoiceAvailable] = useState(true);
  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(true);
  const [speakingIds, setSpeakingIds] = useState(new Set());
  const roomRef = useRef(null);
  const audioElsRef = useRef([]);

  useEffect(() => {
    if (!roomId || !enabled) return;
    let cancelled = false;

    (async () => {
      try {
        // The SDK (~430kB min) stays out of the page chunk — it only loads when
        // a room actually enables voice, in parallel with the token fetch.
        const [{ Room, RoomEvent, Track }, { token, url }] = await Promise.all([
          import("livekit-client"),
          getVoiceToken(roomId),
        ]);
        if (cancelled) return;
        const room = new Room();
        roomRef.current = room;

        const attachTrack = (track) => {
          if (track.kind !== Track.Kind.Audio) return;
          const el = track.attach();
          el.autoplay = true;
          document.body.appendChild(el);
          audioElsRef.current.push(el);
        };

        room.on(RoomEvent.TrackSubscribed, attachTrack);
        room.on(RoomEvent.TrackUnsubscribed, (track) => {
          track.detach().forEach((el) => el.remove());
        });
        room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
          setSpeakingIds(new Set(speakers.map((s) => s.identity)));
        });
        room.on(RoomEvent.Disconnected, () => setConnected(false));

        await room.connect(url, token);
        if (cancelled) { room.disconnect(); return; }
        setConnected(true);
        // Join muted; user taps the mic to unmute
        await room.localParticipant.setMicrophoneEnabled(false);
      } catch (err) {
        // premium_required = free-hosted room; voice_unavailable = no LiveKit
        // credentials. Either way the mic just stays off.
        if (err?.code !== "premium_required" && !String(err?.message).includes("voice_unavailable")) {
          console.warn("LiveKit connect failed:", err.message);
        }
        setVoiceAvailable(false);
      }
    })();

    return () => {
      cancelled = true;
      audioElsRef.current.forEach((el) => el.remove());
      audioElsRef.current = [];
      try { roomRef.current?.disconnect(); } catch {}
      roomRef.current = null;
    };
  }, [roomId, enabled]);

  const setMicMuted = useCallback(async (shouldMute) => {
    const room = roomRef.current;
    if (!room || !connected) return;
    try {
      await room.localParticipant.setMicrophoneEnabled(!shouldMute);
      setMuted(shouldMute);
    } catch (err) {
      console.warn("Mic mute failed:", err.message);
    }
  }, [connected]);

  const toggleMic = useCallback(async () => {
    const room = roomRef.current;
    if (!room || !connected) return;
    const next = muted; // currently muted → enable
    try {
      await room.localParticipant.setMicrophoneEnabled(next);
      setMuted(!next);
    } catch (err) {
      console.warn("Mic toggle failed:", err.message);
    }
  }, [connected, muted]);

  return { voiceAvailable, connected, muted, speakingIds, toggleMic, setMicMuted };
}
