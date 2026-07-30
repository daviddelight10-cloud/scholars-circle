import { useState, useEffect, useCallback, useRef } from "react";
import { API_BASE } from "../../lib/constants.js";
import { useVoiceSession } from "./useVoiceSession.js";
import VoiceOrb from "./VoiceOrb.jsx";
import MaterialsDrawer from "./MaterialsDrawer.jsx";
import ConceptsDrawer from "./ConceptsDrawer.jsx";
import TranscriptOverlay from "./TranscriptOverlay.jsx";
import { COLORS, FONTS, VOICE_STATES, VOICE_MODES, SESSION_TIMEOUT_SEC, hexToRgba } from "./voiceConfig.js";

const VOICE_OPTIONS = ["Aoede", "Puck", "Charon", "Kore", "Fenrir"];

const ICONS = {
  mic: '<rect x="9" y="2" width="6" height="12" rx="3" fill="currentColor"/><path d="M5 11a7 7 0 0014 0M12 18v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  doc: '<path d="M6 2h9l5 5v13a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2z" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M15 2v5h5" stroke="currentColor" stroke-width="1.5" fill="none"/>',
  chev: '<path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  close: '<path d="M6 18L18 6M6 6l12 12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  share: '<path d="M12 3v10M12 3l-4 4M12 3l4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  addDoc: '<path d="M6 2h9l5 5v13a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2z" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M15 2v5h5" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M12 11v6M9 14h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  search: '<circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M21 21l-4.3-4.3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  materials: '<path d="M6 2h9l5 5v13a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2z" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M15 2v5h5" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M8 12h8M8 16h6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
  concepts: '<path d="M9 18h6M10 21h4M12 3a6 6 0 014 10.5c-.6.5-1 1.2-1 2V16H9v-.5c0-.8-.4-1.5-1-2A6 6 0 0112 3z" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
};

function SvgIcon({ name, size = 18, viewBox = "0 0 24 24" }) {
  return (
    <svg width={size} height={size} viewBox={viewBox} fill="none" dangerouslySetInnerHTML={{ __html: ICONS[name] }} />
  );
}

function ModeIcon({ svgPath, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" dangerouslySetInnerHTML={{ __html: svgPath }} />
  );
}

function getAuthToken() {
  try {
    const authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
    return authData.authToken || null;
  } catch {
    return null;
  }
}

export default function VoiceTutor({ preselectedResourceId = null, onExit, onSessionActiveChange }) {
  const [resources, setResources] = useState([]);
  const [selectedResourceId, setSelectedResourceId] = useState(preselectedResourceId);
  const [mode, setMode] = useState("teach");
  const [loadingResources, setLoadingResources] = useState(true);
  const [showMaterials, setShowMaterials] = useState(false);
  const [showConcepts, setShowConcepts] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [voiceName, setVoiceName] = useState("Aoede");
  const [showVoicePicker, setShowVoicePicker] = useState(false);
  const [showDocPicker, setShowDocPicker] = useState(false);
  const [docSearch, setDocSearch] = useState("");
  const docPickerRef = useRef(null);
  const [orbSize, setOrbSize] = useState(220);

  const voice = useVoiceSession();

  useEffect(() => {
    function updateSize() {
      const w = window.innerWidth;
      if (w < 640) {
        setOrbSize(160);
      } else if (w < 980) {
        setOrbSize(200);
      } else {
        setOrbSize(220);
      }
    }
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

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
    voice.startSession(selectedResourceId, mode, voiceName);
  }, [selectedResourceId, mode, voiceName, voice]);

  const handleEnd = useCallback(() => {
    voice.endSession();
  }, [voice]);

  const handleOrbClick = useCallback(() => {
    if (voice.state === VOICE_STATES.IDLE || voice.state === VOICE_STATES.ENDED || voice.state === VOICE_STATES.ERROR) {
      if (selectedResourceId) handleStart();
    } else if (voice.state === VOICE_STATES.READY || voice.state === VOICE_STATES.LISTENING || voice.state === VOICE_STATES.SPEAKING || voice.state === VOICE_STATES.THINKING) {
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

  useEffect(() => {
    if (onSessionActiveChange) onSessionActiveChange(isActive);
  }, [isActive, onSessionActiveChange]);

  // Determine glow color based on state
  let glowColor = "transparent";
  if (voice.state === VOICE_STATES.LISTENING) glowColor = hexToRgba(COLORS.green, 0.12);
  else if (voice.state === VOICE_STATES.SPEAKING || voice.state === VOICE_STATES.THINKING) glowColor = hexToRgba(COLORS.gold, 0.12);
  else if (voice.state === VOICE_STATES.READY) glowColor = hexToRgba(COLORS.electric, 0.12);

  const selectedResource = resources.find((r) => String(r.id) === String(selectedResourceId));

  const handleDocSelect = useCallback(() => {
    if (loadingResources || resources.length === 0) return;
    setShowDocPicker((v) => !v);
    setDocSearch("");
  }, [loadingResources, resources]);

  useEffect(() => {
    if (!showDocPicker) return;
    function handleClickOutside(e) {
      if (docPickerRef.current && !docPickerRef.current.contains(e.target)) {
        setShowDocPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showDocPicker]);

  const filteredResources = resources.filter((r) =>
    (r.title || "").toLowerCase().includes(docSearch.toLowerCase())
  );

  const getFileType = (r) => {
    const ext = (r.contentType || r.fileName || "").toLowerCase().split(".").pop();
    return ext || "file";
  };

  const handleTalkClick = useCallback(() => {
    if (!selectedResourceId) return;
    if (voice.state === VOICE_STATES.IDLE || voice.state === VOICE_STATES.ENDED || voice.state === VOICE_STATES.ERROR) {
      handleStart();
    } else if (voice.state === VOICE_STATES.READY || voice.state === VOICE_STATES.SPEAKING || voice.state === VOICE_STATES.THINKING) {
      voice.toggleListening();
    } else if (voice.state === VOICE_STATES.LISTENING) {
      voice.toggleListening();
    }
  }, [selectedResourceId, voice, handleStart]);

  let statusText = "Awaiting document selection to initialize session";
  if (voice.state === VOICE_STATES.IDLE && selectedResourceId) statusText = "Tap the talk button to start your session";
  else if (voice.state === VOICE_STATES.CONNECTING) statusText = "Connecting to Gemini Live...";
  else if (voice.state === VOICE_STATES.READY) statusText = voice.handsFreeMode ? "Listening — just start talking" : "Ready — tap to speak";
  else if (voice.state === VOICE_STATES.LISTENING) statusText = voice.handsFreeMode ? "Listening — speak naturally" : "Listening — tap to stop";
  else if (voice.state === VOICE_STATES.SPEAKING) statusText = voice.isBuffering ? "Tutor is speaking (buffering...)" : "Tutor is speaking...";
  else if (voice.state === VOICE_STATES.THINKING) statusText = "Thinking...";
  else if (voice.state === VOICE_STATES.ERROR) statusText = voice.error || "An error occurred";
  else if (voice.state === VOICE_STATES.ENDED) statusText = "Session ended";

  const statusColor = voice.state === VOICE_STATES.LISTENING ? COLORS.green
    : voice.state === VOICE_STATES.SPEAKING || voice.state === VOICE_STATES.THINKING || voice.state === VOICE_STATES.CONNECTING ? COLORS.gold
    : voice.state === VOICE_STATES.READY ? COLORS.electric
    : voice.state === VOICE_STATES.ERROR ? COLORS.coral
    : COLORS.textDim;

  return (
    <div className="sc-vt-root">
      <div className="sc-vt-mesh" />
      <div className="sc-vt-grid" />

      <div className="sc-vt-shell">
        {/* Top bar */}
        <div className="sc-vt-topbar">
          <div className="sc-vt-topbar-left">
            <div className="sc-vt-mic-badge">
              <SvgIcon name="mic" size={22} />
            </div>
            <div>
              <h1>Voice Tutor</h1>
              <p>Study with your documents — powered by Gemini Live</p>
            </div>
          </div>
          <div className="sc-vt-topbar-right">
            {isActive && (
              <span className="sc-vt-timer">
                {String(remainingMin).padStart(2, "0")}:{String(remainingSecDisp).padStart(2, "0")} left
              </span>
            )}
            {isActive && voice.connectionQuality && (
              <span
                title={`Connection: ${voice.connectionQuality}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 11,
                  fontFamily: FONTS.body,
                  color: COLORS.textDim,
                  padding: "4px 10px",
                  borderRadius: 20,
                  background: "rgba(255,255,255,0.05)",
                }}
              >
                <span style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: voice.connectionQuality === "good" ? COLORS.green
                    : voice.connectionQuality === "fair" ? COLORS.gold
                    : COLORS.coral,
                  boxShadow: `0 0 6px ${
                    voice.connectionQuality === "good" ? COLORS.green
                    : voice.connectionQuality === "fair" ? COLORS.gold
                    : COLORS.coral
                  }`,
                }} />
                {voice.connectionQuality === "good" ? "Good" : voice.connectionQuality === "fair" ? "Fair" : "Poor"}
              </span>
            )}
            {onExit && (
              <button className="sc-vt-btn-exit" onClick={onExit}>Exit Session</button>
            )}
          </div>
        </div>

        <div className="sc-vt-session-grid">
          {/* Left panel: controls (doc picker, mode tabs, voice picker) */}
          <div className="sc-vt-controls">
            <span className="sc-vt-field-label">1. Select Source Material</span>
            {loadingResources ? (
              <div className="sc-vt-glass sc-vt-doc-select" style={{ cursor: "default" }}>
                <div className="sc-vt-doc-icon"><SvgIcon name="doc" size={18} /></div>
                <div className="sc-vt-doc-text">
                  <p>Loading your resources...</p>
                  <span>Fetching from your library</span>
                </div>
              </div>
            ) : resources.length === 0 ? (
              <div className="sc-vt-glass sc-vt-doc-select" style={{ cursor: "default" }}>
                <div className="sc-vt-doc-icon"><SvgIcon name="doc" size={18} /></div>
                <div className="sc-vt-doc-text">
                  <p>No documents found</p>
                  <span>Upload a PDF, DOCX, or PPTX in My Circle</span>
                </div>
              </div>
            ) : (
              <div className="sc-vt-doc-picker-wrap" ref={docPickerRef}>
                <div
                  className={`sc-vt-glass sc-vt-doc-select ${showDocPicker ? "open" : ""}`}
                  onClick={handleDocSelect}
                >
                  <div className="sc-vt-doc-icon"><SvgIcon name="doc" size={18} /></div>
                  <div className="sc-vt-doc-text">
                    <p>{selectedResource ? selectedResource.title : "Choose a document\u2026"}</p>
                    <span>{selectedResource ? `${getFileType(selectedResource).toUpperCase()} \u00b7 Tap to change` : "PDF, slides, or notes from your library"}</span>
                  </div>
                  <SvgIcon name="chev" size={18} />
                </div>

                {showDocPicker && (
                  <div className="sc-vt-doc-dropdown">
                    <div className="sc-vt-doc-search-wrap">
                      <SvgIcon name="search" size={16} />
                      <input
                        className="sc-vt-doc-search"
                        type="text"
                        placeholder="Search documents..."
                        value={docSearch}
                        onChange={(e) => setDocSearch(e.target.value)}
                        autoFocus
                      />
                    </div>

                    <div className="sc-vt-doc-list">
                      {filteredResources.length === 0 ? (
                        <div className="sc-vt-doc-empty">No documents match "{docSearch}"</div>
                      ) : (
                        filteredResources.map((r) => {
                          const isSelected = String(r.id) === String(selectedResourceId);
                          const fileType = getFileType(r);
                          return (
                            <button
                              key={r.id}
                              className={`sc-vt-doc-item ${isSelected ? "selected" : ""}`}
                              onClick={() => {
                                setSelectedResourceId(r.id);
                                setShowDocPicker(false);
                              }}
                            >
                              <div className="sc-vt-doc-item-icon">
                                <SvgIcon name="doc" size={16} />
                              </div>
                              <div className="sc-vt-doc-item-text">
                                <span className="sc-vt-doc-item-title">{r.title}</span>
                                <span className="sc-vt-doc-item-type">{fileType.toUpperCase()}</span>
                              </div>
                              {isSelected && (
                                <div className="sc-vt-doc-item-check">
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                    <path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
                                  </svg>
                                </div>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>

                    <div className="sc-vt-doc-dropdown-footer">
                      {filteredResources.length} document{filteredResources.length !== 1 ? "s" : ""}
                    </div>
                  </div>
                )}
              </div>
            )}

            <span className="sc-vt-field-label" style={{ marginTop: 20 }}>2. Interaction Mode</span>
            <div className="sc-vt-glass sc-vt-mode-row">
              {Object.entries(VOICE_MODES).map(([key, m]) => (
                <button
                  key={key}
                  className={`sc-vt-mode-btn ${mode === key ? "active" : ""}`}
                  onClick={() => {
                    setMode(key);
                    if (isActive && voice.switchMode) {
                      voice.switchMode(key);
                    }
                  }}
                >
                  <ModeIcon svgPath={m.icon} size={16} />
                  {m.label}
                </button>
              ))}
            </div>

            <div
              className="sc-vt-glass sc-vt-voice-select"
              onClick={() => setShowVoicePicker((v) => !v)}
              style={{ position: "relative" }}
            >
              <span className="sc-vt-voice-dot" />
              Voice: {voiceName}
              <SvgIcon name="chev" size={14} />
              {showVoicePicker && (
                <div style={{
                  position: "absolute",
                  bottom: "calc(100% + 8px)",
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "linear-gradient(160deg, #0A0D14, #050608)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 14,
                  padding: 6,
                  boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
                  zIndex: 200,
                  minWidth: 140,
                }}>
                  {VOICE_OPTIONS.map((v) => (
                    <button
                      key={v}
                      onClick={(e) => { e.stopPropagation(); setVoiceName(v); setShowVoicePicker(false); }}
                      style={{
                        display: "block",
                        width: "100%",
                        padding: "10px 16px",
                        background: v === voiceName ? "rgba(79,142,247,0.15)" : "transparent",
                        border: "none",
                        borderRadius: 10,
                        color: v === voiceName ? COLORS.electricLight : COLORS.textDim,
                        fontSize: 12.5,
                        fontFamily: FONTS.body,
                        fontWeight: 600,
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "color 0.15s ease, background 0.15s ease",
                      }}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right column: orb stage + bottom controls */}
          <div className="sc-vt-stage-col">
            {/* Orb stage */}
            <div className="sc-vt-orb-stage">
              {isActive ? (
                <>
                  <div className="sc-vt-orb-glow" style={{
                    background: `radial-gradient(circle, ${glowColor}, transparent 65%)`,
                  }} />
                  <VoiceOrb
                    state={voice.state}
                    micLevel={voice.micLevel}
                    onClick={handleOrbClick}
                    size={orbSize}
                    getAudioData={voice.getAudioData}
                  />
                </>
              ) : (
                <>
                  <div className="sc-vt-orb-glow" />
                  <div className="sc-vt-orb-wrap">
                    <div className="sc-vt-orb-ring" />
                    <div className="sc-vt-orb-ring d2" />
                    <div
                      className="sc-vt-orb"
                      onClick={selectedResourceId ? handleStart : undefined}
                      style={{ cursor: selectedResourceId ? "pointer" : "default" }}
                    />
                  </div>
                </>
              )}

              <div className="sc-vt-stage-status" style={{ color: statusColor }}>
                {statusText}
              </div>

              {isActive && (
                <TranscriptOverlay transcript={voice.transcript} />
              )}
            </div>

            {/* Fallback text input */}
            {voice.fallbackMode && isActive && (
              <div className="sc-vt-text-fallback">
                <input
                  className="sc-vt-text-input"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendText()}
                  placeholder="Type your question..."
                />
                <button className="sc-vt-send-btn" onClick={handleSendText}>Send</button>
              </div>
            )}

            {/* Bottom controls — idle state */}
            {!isActive && (
              <div className="sc-vt-control-bar">
                <button
                  className="sc-vt-ctrl-btn end"
                  title="End Session"
                  onClick={onExit}
                >
                  <SvgIcon name="close" size={20} />
                </button>
                <button
                  className="sc-vt-ctrl-btn talk"
                  disabled={!selectedResourceId}
                  title="Tap to Speak"
                  onClick={handleTalkClick}
                >
                  <SvgIcon name="mic" size={26} />
                </button>
                <button
                  className="sc-vt-ctrl-btn"
                  title="Add Document"
                  onClick={handleDocSelect}
                  disabled={loadingResources || resources.length === 0}
                >
                  <SvgIcon name="addDoc" size={20} />
                </button>
              </div>
            )}

            {/* Active session: floating action bar */}
            {isActive && (
              <div className="sc-vt-action-bar">
                <div className="sc-vt-action-pill">
                  <button
                    className="sc-vt-action-icon-btn"
                    onClick={() => setShowMaterials(true)}
                    title="Materials"
                  >
                    <SvgIcon name="materials" size={18} />
                  </button>
                  <button
                    className="sc-vt-action-icon-btn"
                    onClick={() => setShowConcepts(true)}
                    title="Concepts"
                  >
                    <SvgIcon name="concepts" size={18} />
                  </button>

                  <div className="sc-vt-action-divider" />

                  <button
                    className={`sc-vt-handsfree-btn ${voice.handsFreeMode ? "active" : ""}`}
                    onClick={voice.toggleHandsFree}
                  >
                    <SvgIcon name="mic" size={14} />
                    {voice.handsFreeMode ? "Hands-Free" : "Tap-to-Talk"}
                  </button>

                  <div className="sc-vt-action-divider" />

                  <button className="sc-vt-end-btn" onClick={handleEnd}>
                    <SvgIcon name="close" size={14} />
                    End
                  </button>
                </div>
              </div>
            )}

            {!isActive && (
              <div className="sc-vt-note">// Transcript appears once a document is loaded</div>
            )}
          </div>
        </div>
      </div>

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
    </div>
  );
}

