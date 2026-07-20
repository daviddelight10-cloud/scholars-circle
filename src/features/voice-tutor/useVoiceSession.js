import { useState, useRef, useCallback, useEffect } from "react";
import { API_BASE } from "../../lib/constants.js";
import { VOICE_STATES, AUDIO_CONFIG, SESSION_TIMEOUT_SEC, WS_MESSAGE_TYPES, VAD_CONFIG } from "./voiceConfig.js";

function getAuthToken() {
  try {
    const authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
    return authData.authToken || null;
  } catch {
    return null;
  }
}

function getWsBase() {
  if (API_BASE.startsWith("https://")) {
    return API_BASE.replace("https://", "wss://");
  }
  if (API_BASE.startsWith("http://")) {
    return API_BASE.replace("http://", "ws://");
  }
  return `ws://${API_BASE}`;
}

export function useVoiceSession() {
  const [state, setState] = useState(VOICE_STATES.IDLE);
  const [error, setError] = useState(null);
  const [transcript, setTranscript] = useState([]);
  const [materials, setMaterials] = useState(null);
  const [concepts, setConcepts] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [handsFreeMode, setHandsFreeMode] = useState(false);
  const [vadState, setVadState] = useState("idle");

  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const processorRef = useRef(null);
  const playbackContextRef = useRef(null);
  const timerRef = useRef(null);
  const sessionStartRef = useRef(0);
  const transcriptRef = useRef([]);
  const isListeningRef = useRef(false);
  const stateRef = useRef(VOICE_STATES.IDLE);
  const endSessionRef = useRef(null);
  const nextPlayTimeRef = useRef(0);
  const pendingAudioChunksRef = useRef(0);
  const activeSourceNodesRef = useRef([]);
  const micAnalyserRef = useRef(null);
  const tutorAnalyserRef = useRef(null);
  const handsFreeRef = useRef(false);
  const speechStateRef = useRef("idle");
  const speechOnsetTimeRef = useRef(0);
  const speechSilenceTimeRef = useRef(0);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const stopMic = useCallback(() => {
    isListeningRef.current = false;
    speechStateRef.current = "idle";
    speechOnsetTimeRef.current = 0;
    speechSilenceTimeRef.current = 0;
    setVadState("idle");
    if (micAnalyserRef.current) {
      try { micAnalyserRef.current.disconnect(); } catch {}
      micAnalyserRef.current = null;
    }
    if (processorRef.current) {
      try { processorRef.current.disconnect(); } catch {}
      processorRef.current = null;
    }
    if (mediaRecorderRef.current) {
      try { mediaRecorderRef.current.disconnect(); } catch {}
      mediaRecorderRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch {}
      audioContextRef.current = null;
    }
    setMicLevel(0);
  }, []);

  const stopPlayback = useCallback(() => {
    for (const node of activeSourceNodesRef.current) {
      try { node.stop(); } catch {}
    }
    activeSourceNodesRef.current = [];
    pendingAudioChunksRef.current = 0;
    nextPlayTimeRef.current = 0;
  }, []);

  const startMic = useCallback(async () => {
    if (isListeningRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: AUDIO_CONFIG.channels,
          sampleRate: AUDIO_CONFIG.sampleRate,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      const audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: AUDIO_CONFIG.sampleRate,
      });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      mediaRecorderRef.current = source;

      const micAnalyser = audioContext.createAnalyser();
      micAnalyser.fftSize = 128;
      micAnalyser.smoothingTimeConstant = 0.6;
      micAnalyserRef.current = micAnalyser;

      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (!isListeningRef.current) return;
        const inputData = e.inputBuffer.getChannelData(0);

        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);
        setMicLevel(Math.min(1, rms * 5));

        if (handsFreeRef.current) {
          const now = Date.now();
          const isLoud = rms > VAD_CONFIG.speechThreshold;

          if (isLoud) {
            speechSilenceTimeRef.current = 0;

            if (speechStateRef.current !== "speaking") {
              if (speechOnsetTimeRef.current === 0) {
                speechOnsetTimeRef.current = now;
              }
              if (now - speechOnsetTimeRef.current > VAD_CONFIG.speechOnsetMs) {
                speechStateRef.current = "speaking";
                setVadState("speaking");
                setState(VOICE_STATES.LISTENING);
                stopPlayback();
                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                  wsRef.current.send(JSON.stringify({ type: WS_MESSAGE_TYPES.INTERRUPT }));
                }
              }
            }
          } else {
            speechOnsetTimeRef.current = 0;

            if (speechStateRef.current === "speaking") {
              if (speechSilenceTimeRef.current === 0) {
                speechSilenceTimeRef.current = now;
              }
              if (now - speechSilenceTimeRef.current > VAD_CONFIG.silenceOffsetMs) {
                speechStateRef.current = "silence";
                setVadState("silence");
                setState(VOICE_STATES.READY);
                speechSilenceTimeRef.current = 0;
              }
            }
          }
        }

        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        const base64 = arrayBufferToBase64(pcm16.buffer);

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: WS_MESSAGE_TYPES.AUDIO,
            data: base64,
          }));
        }
      };

      source.connect(micAnalyser);
      micAnalyser.connect(processor);
      processor.connect(audioContext.destination);

      isListeningRef.current = true;
      if (handsFreeRef.current) {
        setState(VOICE_STATES.READY);
      } else {
        setState(VOICE_STATES.LISTENING);
      }
    } catch (err) {
      console.error("Mic access failed:", err);
      setError("Microphone access denied. Please allow microphone permissions and try again.");
      setState(VOICE_STATES.ERROR);
    }
  }, [stopPlayback]);

  const playAudioChunk = useCallback((base64Audio) => {
    try {
      const binaryStr = atob(base64Audio);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      const int16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 0x8000;
      }

      if (!playbackContextRef.current) {
        playbackContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: AUDIO_CONFIG.sampleRate,
        });
        nextPlayTimeRef.current = 0;
      }
      const ctx = playbackContextRef.current;

      if (!tutorAnalyserRef.current) {
        tutorAnalyserRef.current = ctx.createAnalyser();
        tutorAnalyserRef.current.fftSize = 128;
        tutorAnalyserRef.current.smoothingTimeConstant = 0.7;
        tutorAnalyserRef.current.connect(ctx.destination);
      }

      const audioBuffer = ctx.createBuffer(1, float32.length, AUDIO_CONFIG.sampleRate);
      audioBuffer.copyToChannel(float32, 0);

      const sourceNode = ctx.createBufferSource();
      sourceNode.buffer = audioBuffer;
      sourceNode.connect(tutorAnalyserRef.current || ctx.destination);

      // Schedule chunks back-to-back instead of overlapping them, so streamed
      // TTS audio plays sequentially rather than garbling.
      const startAt = Math.max(ctx.currentTime, nextPlayTimeRef.current);
      nextPlayTimeRef.current = startAt + audioBuffer.duration;

      pendingAudioChunksRef.current += 1;
      activeSourceNodesRef.current.push(sourceNode);
      sourceNode.onended = () => {
        pendingAudioChunksRef.current = Math.max(0, pendingAudioChunksRef.current - 1);
        activeSourceNodesRef.current = activeSourceNodesRef.current.filter((n) => n !== sourceNode);
        if (pendingAudioChunksRef.current === 0 && stateRef.current === VOICE_STATES.SPEAKING) {
          setState(VOICE_STATES.READY);
        }
      };
      sourceNode.start(startAt);

      setState(VOICE_STATES.SPEAKING);
    } catch (err) {
      console.error("Audio playback failed:", err);
    }
  }, []);

  const addToTranscript = useCallback((role, text) => {
    const entry = { role, text, ts: Date.now() };
    transcriptRef.current = [...transcriptRef.current, entry];
    setTranscript(transcriptRef.current);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    sessionStartRef.current = Date.now();
    setElapsedSec(0);
    stopTimer();
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - sessionStartRef.current) / 1000);
      setElapsedSec(elapsed);
      if (elapsed >= SESSION_TIMEOUT_SEC) {
        endSessionRef.current?.();
      }
    }, 1000);
  }, [stopTimer]);

  const endSession = useCallback(async () => {
    stopPlayback();
    stopMic();
    stopTimer();

    if (wsRef.current) {
      try { wsRef.current.close(); } catch {}
      wsRef.current = null;
    }

    if (playbackContextRef.current) {
      try { playbackContextRef.current.close(); } catch {}
      playbackContextRef.current = null;
    }

    if (sessionId) {
      const token = getAuthToken();
      try {
        await fetch(`${API_BASE}/api/voice-session/${sessionId}/end`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
      } catch {}
    }

    setState(VOICE_STATES.ENDED);
  }, [sessionId, stopMic, stopPlayback, stopTimer]);

  useEffect(() => {
    endSessionRef.current = endSession;
  }, [endSession]);

  const startSession = useCallback(async (resourceId, mode = "teach") => {
    setError(null);
    setTranscript([]);
    transcriptRef.current = [];
    setMaterials(null);
    setConcepts([]);
    setFallbackMode(false);
    setState(VOICE_STATES.CONNECTING);

    const token = getAuthToken();
    if (!token) {
      setError("Please log in to use the Voice Tutor.");
      setState(VOICE_STATES.ERROR);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/voice-session/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ resourceId, mode }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to start voice session");
      }

      setSessionId(data.sessionId);
      setMaterials(data.materials);
      setConcepts(data.concepts || []);
      startTimer();

      const wsBase = getWsBase();
      const wsUrl = `${wsBase}/api/voice-session/${data.sessionId}/ws?token=${encodeURIComponent(token)}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("Voice tutor WebSocket connected");
      };

      ws.onmessage = (event) => {
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }

        switch (msg.type) {
          case WS_MESSAGE_TYPES.SETUP_COMPLETE:
            setState(VOICE_STATES.READY);
            if (handsFreeRef.current) {
              startMic();
            }
            break;

          case WS_MESSAGE_TYPES.SERVER_CONTENT:
            const sc = msg.data;
            if (sc.inputTranscription) {
              addToTranscript("user", sc.inputTranscription.text);
            }
            if (sc.outputTranscription) {
              addToTranscript("tutor", sc.outputTranscription.text);
            }
            if (sc.modelTurn?.parts) {
              for (const part of sc.modelTurn.parts) {
                if (part.inlineData) {
                  playAudioChunk(part.inlineData.data);
                }
              }
            }
            break;

          case WS_MESSAGE_TYPES.SESSION_ENDED:
            setState(VOICE_STATES.ENDED);
            stopMic();
            stopTimer();
            break;

          case WS_MESSAGE_TYPES.SESSION_TIMEOUT:
            setError("Session ended after 10 minutes.");
            setState(VOICE_STATES.ENDED);
            stopMic();
            stopTimer();
            break;

          case WS_MESSAGE_TYPES.ERROR:
            setError(msg.message || "Voice tutor error occurred.");
            setState(VOICE_STATES.ERROR);
            break;
        }
      };

      ws.onerror = (err) => {
        console.error("Voice tutor WebSocket error:", err);
        setError("Connection error. Switching to text mode.");
        setFallbackMode(true);
        setState(VOICE_STATES.READY);
      };

      ws.onclose = () => {
        console.log("Voice tutor WebSocket closed");
        stopPlayback();
        if (stateRef.current !== VOICE_STATES.ENDED && stateRef.current !== VOICE_STATES.ERROR) {
          setState(VOICE_STATES.IDLE);
        }
        stopMic();
      };
    } catch (err) {
      console.error("Voice session start failed:", err);
      setError(err.message || "Failed to start voice session.");
      setState(VOICE_STATES.ERROR);
    }
  }, [addToTranscript, playAudioChunk, startMic, startTimer, stopMic, stopPlayback, stopTimer]);

  const toggleListening = useCallback(() => {
    if (state === VOICE_STATES.LISTENING) {
      stopMic();
      setState(VOICE_STATES.READY);
    } else if (state === VOICE_STATES.READY || state === VOICE_STATES.SPEAKING) {
      stopPlayback();
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: WS_MESSAGE_TYPES.INTERRUPT }));
      }
      startMic();
    }
  }, [state, startMic, stopMic, stopPlayback]);

  const sendText = useCallback((text) => {
    if (!text.trim()) return;
    if (fallbackMode) {
      addToTranscript("user", text);
      return;
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: WS_MESSAGE_TYPES.TEXT,
        text,
      }));
      addToTranscript("user", text);
    }
  }, [fallbackMode, addToTranscript]);

  useEffect(() => {
    return () => {
      stopPlayback();
      stopMic();
      stopTimer();
      if (wsRef.current) {
        try { wsRef.current.close(); } catch {}
      }
      if (playbackContextRef.current) {
        try { playbackContextRef.current.close(); } catch {}
      }
    };
  }, [stopMic, stopPlayback, stopTimer]);

  const toggleHandsFree = useCallback(() => {
    const next = !handsFreeRef.current;
    handsFreeRef.current = next;
    setHandsFreeMode(next);

    if (next) {
      if (stateRef.current === VOICE_STATES.READY || stateRef.current === VOICE_STATES.SPEAKING) {
        stopPlayback();
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: WS_MESSAGE_TYPES.INTERRUPT }));
        }
        startMic();
      }
    } else {
      if (stateRef.current === VOICE_STATES.LISTENING) {
        stopMic();
        setState(VOICE_STATES.READY);
      }
    }
  }, [startMic, stopMic, stopPlayback]);

  const getAudioData = useCallback(() => {
    const micData = new Uint8Array(64);
    const tutorData = new Uint8Array(64);
    if (micAnalyserRef.current) {
      micAnalyserRef.current.getByteFrequencyData(micData);
    }
    if (tutorAnalyserRef.current) {
      tutorAnalyserRef.current.getByteFrequencyData(tutorData);
    }
    return { micData, tutorData };
  }, []);

  return {
    state,
    error,
    transcript,
    materials,
    concepts,
    sessionId,
    elapsedSec,
    fallbackMode,
    micLevel,
    handsFreeMode,
    vadState,
    startSession,
    endSession,
    toggleListening,
    toggleHandsFree,
    sendText,
    setError,
    stopPlayback,
    getAudioData,
  };
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}
