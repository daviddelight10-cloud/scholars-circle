import { useState, useRef, useCallback, useEffect } from "react";
import { API_BASE } from "../../lib/constants.js";
import { VOICE_STATES, AUDIO_CONFIG, SESSION_TIMEOUT_SEC, WS_MESSAGE_TYPES, VAD_CONFIG, BUFFER_CONFIG, RECONNECT_CONFIG } from "./voiceConfig.js";

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
  const [connectionQuality, setConnectionQuality] = useState("good");
  const [isBuffering, setIsBuffering] = useState(false);

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

  // Audio pre-buffering refs
  const audioQueueRef = useRef([]);
  const isBufferingRef = useRef(false);
  const bufferTargetRef = useRef(BUFFER_CONFIG.initialChunks);
  const chunkArrivalTimesRef = useRef([]);
  const chunksSinceJitterEvalRef = useRef(0);
  const lastChunkTimeRef = useRef(0);
  const isPlayingRef = useRef(false);

  // Reconnection refs
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef(null);
  const wsUrlRef = useRef(null);
  const isReconnectingRef = useRef(false);
  const pingIntervalRef = useRef(null);
  const pongTimeoutRef = useRef(null);
  const lastPongTimeRef = useRef(0);
  const pingRttRef = useRef([]);

  // Thinking timeout ref
  const thinkingTimeoutRef = useRef(null);

  // Ref to break circular dependency between playAudioChunk and drainAudioQueue
  const drainAudioQueueRef = useRef(null);

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
    audioQueueRef.current = [];
    isBufferingRef.current = false;
    isPlayingRef.current = false;
    setIsBuffering(false);
    if (thinkingTimeoutRef.current) {
      clearTimeout(thinkingTimeoutRef.current);
      thinkingTimeoutRef.current = null;
    }
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

      await audioContext.audioWorklet.addModule("/audio-processor.js");

      const source = audioContext.createMediaStreamSource(stream);
      mediaRecorderRef.current = source;

      const micAnalyser = audioContext.createAnalyser();
      micAnalyser.fftSize = 128;
      micAnalyser.smoothingTimeConstant = 0.6;
      micAnalyserRef.current = micAnalyser;

      const workletNode = new AudioWorkletNode(audioContext, "mic-processor");
      processorRef.current = workletNode;

      workletNode.port.onmessage = (e) => {
        if (!isListeningRef.current) return;
        const inputData = e.data;

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
                setState(VOICE_STATES.THINKING);
                speechSilenceTimeRef.current = 0;
                // Revert to READY if no audio arrives within 8s
                if (thinkingTimeoutRef.current) clearTimeout(thinkingTimeoutRef.current);
                thinkingTimeoutRef.current = setTimeout(() => {
                  if (stateRef.current === VOICE_STATES.THINKING) {
                    setState(VOICE_STATES.READY);
                  }
                  thinkingTimeoutRef.current = null;
                }, 8000);
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
      micAnalyser.connect(workletNode);
      workletNode.connect(audioContext.destination);

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
        if (pendingAudioChunksRef.current === 0) {
          // All scheduled chunks finished — check if more are queued
          if (audioQueueRef.current.length > 0) {
            drainAudioQueueRef.current?.();
          } else if (stateRef.current === VOICE_STATES.SPEAKING) {
            isPlayingRef.current = false;
            setState(VOICE_STATES.READY);
          }
        }
      };
      sourceNode.start(startAt);

      setState(VOICE_STATES.SPEAKING);
    } catch (err) {
      console.error("Audio playback failed:", err);
    }
  }, []);

  // Drain queued audio chunks — called when buffer threshold is met or underrun recovers
  const drainAudioQueue = useCallback(() => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      return;
    }

    isBufferingRef.current = false;
    setIsBuffering(false);
    isPlayingRef.current = true;

    // Play all queued chunks in order
    while (audioQueueRef.current.length > 0) {
      const chunk = audioQueueRef.current.shift();
      playAudioChunk(chunk);
    }
  }, [playAudioChunk]);

  // Keep drainAudioQueueRef in sync
  useEffect(() => {
    drainAudioQueueRef.current = drainAudioQueue;
  }, [drainAudioQueue]);

  // Enqueue an audio chunk for buffered playback
  const enqueueAudioChunk = useCallback((base64Audio) => {
    const now = Date.now();

    // Track chunk arrival times for jitter calculation
    if (lastChunkTimeRef.current > 0) {
      const interval = now - lastChunkTimeRef.current;
      chunkArrivalTimesRef.current.push(interval);
      if (chunkArrivalTimesRef.current.length > 30) {
        chunkArrivalTimesRef.current.shift();
      }
    }
    lastChunkTimeRef.current = now;
    chunksSinceJitterEvalRef.current += 1;

    // Clear thinking timeout — audio has arrived
    if (thinkingTimeoutRef.current) {
      clearTimeout(thinkingTimeoutRef.current);
      thinkingTimeoutRef.current = null;
    }

    // If already playing, just play the chunk directly (no need to buffer mid-stream)
    if (isPlayingRef.current) {
      playAudioChunk(base64Audio);
      return;
    }

    // Add to queue and check if we have enough to start playback
    audioQueueRef.current.push(base64Audio);

    if (!isBufferingRef.current) {
      isBufferingRef.current = true;
      setIsBuffering(true);
    }

    if (audioQueueRef.current.length >= bufferTargetRef.current) {
      drainAudioQueue();
    }

    // Adaptive buffer sizing — re-evaluate every N chunks
    if (chunksSinceJitterEvalRef.current >= BUFFER_CONFIG.jitterEvalInterval) {
      chunksSinceJitterEvalRef.current = 0;
      evaluateBufferTarget();
    }
  }, [drainAudioQueue, playAudioChunk]);

  // Adjust buffer target based on network jitter
  const evaluateBufferTarget = useCallback(() => {
    const times = chunkArrivalTimesRef.current;
    if (times.length < 4) return;

    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    const variance = times.reduce((a, b) => a + (b - mean) ** 2, 0) / times.length;
    const jitter = Math.sqrt(variance);

    // High jitter → increase buffer; low jitter → decrease
    if (jitter > mean * 0.5 && bufferTargetRef.current < BUFFER_CONFIG.maxChunks) {
      bufferTargetRef.current = Math.min(BUFFER_CONFIG.maxChunks, bufferTargetRef.current + 1);
    } else if (jitter < mean * 0.2 && bufferTargetRef.current > BUFFER_CONFIG.minChunks) {
      bufferTargetRef.current = Math.max(BUFFER_CONFIG.minChunks, bufferTargetRef.current - 1);
    }

    // Update connection quality based on jitter and ping RTT
    const avgRtt = pingRttRef.current.length > 0
      ? pingRttRef.current.reduce((a, b) => a + b, 0) / pingRttRef.current.length
      : 0;

    if (jitter > mean * 0.8 || avgRtt > 1000) {
      setConnectionQuality("poor");
    } else if (jitter > mean * 0.4 || avgRtt > 400) {
      setConnectionQuality("fair");
    } else {
      setConnectionQuality("good");
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

    // Clean up reconnection and keepalive timers
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (pongTimeoutRef.current) {
      clearTimeout(pongTimeoutRef.current);
      pongTimeoutRef.current = null;
    }
    reconnectAttemptsRef.current = 0;
    isReconnectingRef.current = false;

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

  const startSession = useCallback(async (resourceId, mode = "teach", voiceName = "Aoede", currentPage = null, pageText = "") => {
    setError(null);
    setTranscript([]);
    transcriptRef.current = [];
    setMaterials(null);
    setConcepts([]);
    setFallbackMode(false);
    setConnectionQuality("good");
    setState(VOICE_STATES.CONNECTING);

    // Reset buffering state
    audioQueueRef.current = [];
    isBufferingRef.current = false;
    isPlayingRef.current = false;
    bufferTargetRef.current = BUFFER_CONFIG.initialChunks;
    chunkArrivalTimesRef.current = [];
    chunksSinceJitterEvalRef.current = 0;
    lastChunkTimeRef.current = 0;
    setIsBuffering(false);

    // Reset reconnection state
    reconnectAttemptsRef.current = 0;
    isReconnectingRef.current = false;

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
        body: JSON.stringify({ resourceId, mode, voiceName, currentPage, pageText }),
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
      wsUrlRef.current = wsUrl;

      // Local function to set up WS handlers — reused for reconnection
      const setupWs = (ws) => {
        ws.onopen = () => {
          console.log("Voice tutor WebSocket connected");
          isReconnectingRef.current = false;

          // Start ping/pong keepalive
          if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = setInterval(() => {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              const pingStart = Date.now();
              wsRef.current.send(JSON.stringify({ type: WS_MESSAGE_TYPES.PING, t: pingStart }));

              // Set pong timeout
              if (pongTimeoutRef.current) clearTimeout(pongTimeoutRef.current);
              pongTimeoutRef.current = setTimeout(() => {
                console.warn("Voice tutor WebSocket pong timeout — connection may be dead");
                // Force close to trigger reconnection
                try { wsRef.current?.close(); } catch {}
              }, RECONNECT_CONFIG.pongTimeoutMs);
            }
          }, RECONNECT_CONFIG.pingIntervalMs);
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
                    enqueueAudioChunk(part.inlineData.data);
                  }
                }
              }
              break;

            case WS_MESSAGE_TYPES.PONG:
              // Clear pong timeout and record RTT
              if (pongTimeoutRef.current) {
                clearTimeout(pongTimeoutRef.current);
                pongTimeoutRef.current = null;
              }
              lastPongTimeRef.current = Date.now();
              if (msg.t) {
                const rtt = Date.now() - msg.t;
                pingRttRef.current.push(rtt);
                if (pingRttRef.current.length > 10) {
                  pingRttRef.current.shift();
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
          // Don't switch to fallback immediately — let onclose handle reconnection
        };

        ws.onclose = () => {
          console.log("Voice tutor WebSocket closed");
          // Clean up ping interval
          if (pingIntervalRef.current) {
            clearInterval(pingIntervalRef.current);
            pingIntervalRef.current = null;
          }
          if (pongTimeoutRef.current) {
            clearTimeout(pongTimeoutRef.current);
            pongTimeoutRef.current = null;
          }

          // Don't reconnect if session was intentionally ended or errored
          if (stateRef.current === VOICE_STATES.ENDED || stateRef.current === VOICE_STATES.ERROR) {
            stopPlayback();
            stopMic();
            return;
          }

          // Attempt reconnection
          if (reconnectAttemptsRef.current < RECONNECT_CONFIG.maxAttempts) {
            const attempt = reconnectAttemptsRef.current + 1;
            const delay = Math.min(
              RECONNECT_CONFIG.baseDelayMs * Math.pow(2, reconnectAttemptsRef.current),
              RECONNECT_CONFIG.maxDelayMs
            );
            console.log(`Voice tutor attempting reconnect ${attempt}/${RECONNECT_CONFIG.maxAttempts} in ${delay}ms`);
            setState(VOICE_STATES.CONNECTING);
            isReconnectingRef.current = true;
            reconnectAttemptsRef.current = attempt;

            reconnectTimerRef.current = setTimeout(() => {
              if (stateRef.current === VOICE_STATES.ENDED || stateRef.current === VOICE_STATES.ERROR) return;
              try {
                const newWs = new WebSocket(wsUrlRef.current);
                wsRef.current = newWs;
                setupWs(newWs);
              } catch (reconnectErr) {
                console.error("Voice tutor reconnection failed:", reconnectErr);
              }
            }, delay);
          } else {
            // Max reconnection attempts exceeded — fall back to text mode
            console.warn("Voice tutor max reconnection attempts exceeded, switching to text mode");
            stopPlayback();
            stopMic();
            setFallbackMode(true);
            setError("Connection lost. Switched to text mode.");
            setState(VOICE_STATES.READY);
          }
        };
      };

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      setupWs(ws);
    } catch (err) {
      console.error("Voice session start failed:", err);
      setError(err.message || "Failed to start voice session.");
      setState(VOICE_STATES.ERROR);
    }
  }, [addToTranscript, enqueueAudioChunk, startMic, startTimer, stopMic, stopPlayback, stopTimer]);

  const toggleListening = useCallback(() => {
    if (state === VOICE_STATES.LISTENING) {
      stopMic();
      setState(VOICE_STATES.READY);
    } else if (state === VOICE_STATES.READY || state === VOICE_STATES.SPEAKING || state === VOICE_STATES.THINKING) {
      stopPlayback();
      if (thinkingTimeoutRef.current) {
        clearTimeout(thinkingTimeoutRef.current);
        thinkingTimeoutRef.current = null;
      }
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
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      if (pongTimeoutRef.current) {
        clearTimeout(pongTimeoutRef.current);
        pongTimeoutRef.current = null;
      }
      if (thinkingTimeoutRef.current) {
        clearTimeout(thinkingTimeoutRef.current);
        thinkingTimeoutRef.current = null;
      }
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
      if (stateRef.current === VOICE_STATES.READY || stateRef.current === VOICE_STATES.SPEAKING || stateRef.current === VOICE_STATES.THINKING) {
        stopPlayback();
        if (thinkingTimeoutRef.current) {
          clearTimeout(thinkingTimeoutRef.current);
          thinkingTimeoutRef.current = null;
        }
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

  const sendPageChange = useCallback((page, text) => {
    if (!page) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: WS_MESSAGE_TYPES.PAGE_CHANGE,
        page,
        text: text || "",
      }));
    }
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
    connectionQuality,
    isBuffering,
    startSession,
    endSession,
    toggleListening,
    toggleHandsFree,
    sendText,
    sendPageChange,
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
