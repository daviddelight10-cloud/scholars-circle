import { useState, useEffect, useCallback } from "react";
import { API_BASE } from "../../lib/constants.js";
import { useVoiceSession } from "./useVoiceSession.js";
import VoiceOrb from "./VoiceOrb.jsx";
import MaterialsDrawer from "./MaterialsDrawer.jsx";
import ConceptsDrawer from "./ConceptsDrawer.jsx";
import TranscriptDrawer from "./TranscriptDrawer.jsx";
import { COLORS, FONTS, VOICE_STATES, VOICE_MODES, SESSION_TIMEOUT_SEC } from "./voiceConfig.js";

function getAuthToken() {
  try {
    const authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
    return authData.authToken || null;
  } catch {
    return null;
  }
}

export default function VoiceTutor({ preselectedResourceId = null, onExit }) {
  const [resources, setResources] = useState([]);
  const [selectedResourceId, setSelectedResourceId] = useState(preselectedResourceId);
  const [mode, setMode] = useState("teach");
  const [loadingResources, setLoadingResources] = useState(true);
  const [showMaterials, setShowMaterials] = useState(false);
  const [showConcepts, setShowConcepts] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [textInput, setTextInput] = useState("");

  const voice = useVoiceSession();

  useEffect(() => {
    if (preselectedResourceId) {
      setSelectedResourceId(preselectedResourceId);
    }
  }, [preselectedResourceId]);

  useEffect(() => {
    async function fetchResources() {
      const token = getAuthToken();
      if (!token) { setLoadingResources(false); return; }
      try {
        const res = await fetch(`${API_BASE}/api/resources?mine=true&limit=50`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : (data.resources || data.items || []);
          const fileBased = list.filter(
            (r) => r.fileUrl && ["pdf", "docx", "pptx", "txt", "doc"].includes(
              (r.contentType || r.fileName || "").toLowerCase().split(".").pop()
            )
          );
          setResources(fileBased.length > 0 ? fileBased : list);
        }
      } catch (err) {
        console.error("Failed to fetch resources:", err);
      } finally {
        setLoadingResources(false);
      }
    }
    fetchResources();
  }, []);

  const handleStart = useCallback(() => {
    if (!selectedResourceId) return;
    voice.startSession(selectedResourceId, mode);
  }, [selectedResourceId, mode, voice]);

  const handleEnd = useCallback(() => {
    voice.endSession();
  }, [voice]);

  const handleOrbClick = useCallback(() => {
    if (voice.state === VOICE_STATES.IDLE || voice.state === VOICE_STATES.ENDED || voice.state === VOICE_STATES.ERROR) {
      if (selectedResourceId) handleStart();
    } else if (voice.state === VOICE_STATES.READY || voice.state === VOICE_STATES.LISTENING || voice.state === VOICE_STATES.SPEAKING) {
      voice.toggleListening();
    }
  }, [voice, selectedResourceId, handleStart]);

  const handleSendText = useCallback(() => {
    if (!textInput.trim()) return;
    voice.sendText(textInput);
    setTextInput("");
  }, [textInput, voice]);

  const handleConceptClick = useCallback((concept) => {
    voice.sendText(`Tell me about: ${concept}`);
    setShowConcepts(false);
  }, [voice]);

  const remainingSec = SESSION_TIMEOUT_SEC - voice.elapsedSec;
  const remainingMin = Math.floor(remainingSec / 60);
  const remainingSecDisp = remainingSec % 60;

  const isActive = [
    VOICE_STATES.CONNECTING, VOICE_STATES.READY,
    VOICE_STATES.LISTENING, VOICE_STATES.SPEAKING,
    VOICE_STATES.THINKING,
  ].includes(voice.state);

  return (
    <div style={{
      minHeight: "100%",
      background: COLORS.ink,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "20px 16px",
      fontFamily: FONTS.body,
      color: COLORS.text,
      position: "relative",
    }}>
      <style>{`
        @keyframes scVtPulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
        .sc-vt-pulse { animation: scVtPulse 2s ease-in-out infinite; }
      `}</style>

      {/* Top bar */}
      <div style={{
        width: "100%",
        maxWidth: 640,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 24,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>🎙️</span>
          <div>
            <h1 style={{
              margin: 0, fontSize: 18, fontWeight: 700,
              fontFamily: FONTS.display, color: COLORS.text,
            }}>Voice Tutor</h1>
            <p style={{
              margin: "2px 0 0", fontSize: 11,
              color: COLORS.textDim, fontFamily: FONTS.body,
            }}>Study with your documents — powered by Gemini Live</p>
          </div>
        </div>
        {onExit && (
          <button
            onClick={onExit}
            style={{
              background: COLORS.inkLight,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 10,
              padding: "8px 14px",
              color: COLORS.textDim,
              fontSize: 13,
              cursor: "pointer",
              fontFamily: FONTS.body,
            }}
          >Exit</button>
        )}
      </div>

      {/* Resource selector */}
      {!isActive && (
        <div style={{
          width: "100%",
          maxWidth: 480,
          marginBottom: 20,
        }}>
          <label style={{
            display: "block",
            fontSize: 11,
            color: COLORS.textDim,
            fontFamily: FONTS.mono,
            textTransform: "uppercase",
            letterSpacing: 1,
            marginBottom: 8,
          }}>Select Document</label>
          {loadingResources ? (
            <div style={{
              padding: "14px 16px",
              background: COLORS.inkLight,
              borderRadius: 10,
              border: `1px solid ${COLORS.border}`,
              fontSize: 13,
              color: COLORS.textDim,
              textAlign: "center",
            }}>Loading your resources...</div>
          ) : resources.length === 0 ? (
            <div style={{
              padding: "14px 16px",
              background: COLORS.inkLight,
              borderRadius: 10,
              border: `1px solid ${COLORS.border}`,
              fontSize: 13,
              color: COLORS.textDim,
              textAlign: "center",
            }}>
              No documents found. Upload a PDF, DOCX, or PPTX in My Circle to get started.
            </div>
          ) : (
            <select
              value={selectedResourceId || ""}
              onChange={(e) => setSelectedResourceId(e.target.value)}
              style={{
                width: "100%",
                padding: "12px 14px",
                background: COLORS.inkLight,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 10,
                color: COLORS.text,
                fontSize: 13,
                fontFamily: FONTS.body,
                outline: "none",
                cursor: "pointer",
              }}
            >
              <option value="">Choose a document...</option>
              {resources.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Mode selector */}
      {!isActive && (
        <div style={{
          display: "flex",
          gap: 8,
          marginBottom: 24,
        }}>
          {Object.entries(VOICE_MODES).map(([key, m]) => (
            <button
              key={key}
              onClick={() => setMode(key)}
              style={{
                padding: "10px 16px",
                background: mode === key ? hexToRgba(COLORS.electric, 0.15) : COLORS.inkLight,
                border: `1px solid ${mode === key ? COLORS.electric : COLORS.border}`,
                borderRadius: 10,
                color: mode === key ? COLORS.electric : COLORS.textDim,
                fontSize: 12,
                fontFamily: FONTS.body,
                fontWeight: mode === key ? 600 : 400,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                transition: "all 0.15s",
              }}
            >
              <span style={{ fontSize: 14 }}>{m.icon}</span>
              {m.label}
            </button>
          ))}
        </div>
      )}

      {/* Orb */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        minHeight: 280,
      }}>
        <VoiceOrb
          state={voice.state}
          micLevel={voice.micLevel}
          onClick={selectedResourceId || isActive ? handleOrbClick : undefined}
          size={220}
          getAudioData={voice.getAudioData}
        />

        {/* Status text */}
        <div style={{
          textAlign: "center",
          minHeight: 40,
        }}>
          {voice.state === VOICE_STATES.IDLE && (
            <p style={{
              margin: 0, fontSize: 13, color: COLORS.textDim,
              fontFamily: FONTS.body,
            }}>
              {selectedResourceId ? "Tap the orb to start your voice session" : "Select a document to begin"}
            </p>
          )}
          {voice.state === VOICE_STATES.CONNECTING && (
            <p style={{
              margin: 0, fontSize: 13, color: COLORS.gold,
              fontFamily: FONTS.body,
            }} className="sc-vt-pulse">Connecting to Gemini Live...</p>
          )}
          {voice.state === VOICE_STATES.READY && (
            <p style={{
              margin: 0, fontSize: 13, color: COLORS.electric,
              fontFamily: FONTS.body,
            }}>{voice.handsFreeMode ? "Listening... just start talking" : "Ready — tap to speak"}</p>
          )}
          {voice.state === VOICE_STATES.LISTENING && (
            <p style={{
              margin: 0, fontSize: 13, color: COLORS.green,
              fontFamily: FONTS.body,
            }}>{voice.handsFreeMode ? "Listening... speak naturally" : "Listening... tap to stop"}</p>
          )}
          {voice.state === VOICE_STATES.SPEAKING && (
            <p style={{
              margin: 0, fontSize: 13, color: COLORS.gold,
              fontFamily: FONTS.body,
            }}>Tutor is speaking...</p>
          )}
          {voice.state === VOICE_STATES.ERROR && (
            <p style={{
              margin: 0, fontSize: 13, color: COLORS.coral,
              fontFamily: FONTS.body,
            }}>{voice.error || "An error occurred"}</p>
          )}
          {voice.state === VOICE_STATES.ENDED && (
            <p style={{
              margin: 0, fontSize: 13, color: COLORS.textDim,
              fontFamily: FONTS.body,
            }}>Session ended</p>
          )}
        </div>

        {/* Timer + Hands-free toggle */}
        {isActive && (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}>
            <span style={{
              fontSize: 11,
              color: COLORS.textFaint,
              fontFamily: FONTS.mono,
            }}>
              {String(remainingMin).padStart(2, "0")}:{String(remainingSecDisp).padStart(2, "0")} remaining
            </span>
            <button
              onClick={voice.toggleHandsFree}
              style={{
                padding: "6px 14px",
                background: voice.handsFreeMode ? hexToRgba(COLORS.green, 0.15) : COLORS.inkLight,
                border: `1px solid ${voice.handsFreeMode ? hexToRgba(COLORS.green, 0.4) : COLORS.border}`,
                borderRadius: 8,
                color: voice.handsFreeMode ? COLORS.green : COLORS.textDim,
                fontSize: 11,
                fontFamily: FONTS.body,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span style={{ fontSize: 13 }}>{voice.handsFreeMode ? "🎙️" : "🎤"}</span>
              {voice.handsFreeMode ? "Hands-Free ON" : "Hands-Free"}
            </button>
            <button
              onClick={handleEnd}
              style={{
                padding: "6px 14px",
                background: hexToRgba(COLORS.coral, 0.15),
                border: `1px solid ${hexToRgba(COLORS.coral, 0.3)}`,
                borderRadius: 8,
                color: COLORS.coral,
                fontSize: 11,
                fontFamily: FONTS.body,
                cursor: "pointer",
              }}
            >End Session</button>
          </div>
        )}
      </div>

      {/* Bottom toolbar */}
      {isActive && (
        <div style={{
          width: "100%",
          maxWidth: 480,
          display: "flex",
          gap: 8,
          padding: "12px 0",
        }}>
          <button
            onClick={() => setShowMaterials(true)}
            style={toolbarBtnStyle}
          >📄 Materials</button>
          <button
            onClick={() => setShowConcepts(true)}
            style={toolbarBtnStyle}
          >💡 Concepts</button>
          <button
            onClick={() => setShowTranscript(true)}
            style={toolbarBtnStyle}
          >💬 Transcript</button>
        </div>
      )}

      {/* Fallback text input */}
      {voice.fallbackMode && isActive && (
        <div style={{
          width: "100%",
          maxWidth: 480,
          display: "flex",
          gap: 8,
          padding: "8px 0 16px",
        }}>
          <input
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendText()}
            placeholder="Type your question..."
            style={{
              flex: 1,
              padding: "10px 14px",
              background: COLORS.inkLight,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 10,
              color: COLORS.text,
              fontSize: 13,
              fontFamily: FONTS.body,
              outline: "none",
            }}
          />
          <button
            onClick={handleSendText}
            style={{
              padding: "10px 18px",
              background: COLORS.electric,
              border: "none",
              borderRadius: 10,
              color: "#fff",
              fontSize: 13,
              fontFamily: FONTS.body,
              cursor: "pointer",
            }}
          >Send</button>
        </div>
      )}

      {/* Drawers */}
      <MaterialsDrawer
        open={showMaterials}
        onClose={() => setShowMaterials(false)}
        materials={voice.materials}
      />
      <ConceptsDrawer
        open={showConcepts}
        onClose={() => setShowConcepts(false)}
        concepts={voice.concepts}
        onConceptClick={handleConceptClick}
      />
      <TranscriptDrawer
        open={showTranscript}
        onClose={() => setShowTranscript(false)}
        transcript={voice.transcript}
      />
    </div>
  );
}

const toolbarBtnStyle = {
  flex: 1,
  padding: "10px 8px",
  background: COLORS.inkLight,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 10,
  color: COLORS.textDim,
  fontSize: 11,
  fontFamily: FONTS.body,
  cursor: "pointer",
  transition: "border-color 0.15s, color 0.15s",
};

function hexToRgba(hex, alpha) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
