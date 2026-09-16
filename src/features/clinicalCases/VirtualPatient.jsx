import React, { useState, useEffect, useRef, useMemo } from "react";
import { callAIChat, extractJSON } from "../../lib/aiClient";
import { CASES, EXAM_LABELS, EXAM_ICONS, INV_QUICK, ACHIEVEMENT_LABELS, DEFAULT_PROFILE, SPECIALTY_META, PACE_OPTIONS } from "./caseData";
import "./virtualPatient.css";

const ACTIVE_CONSULT_KEY = "scc_active_consult";
const GAME_MODE_KEY = "scc_game_mode";
const CLINICAL_PROFILE_KEY = "scc_clinical_profile";
const PACE_KEY = "scc_pace_sec";
const ONBOARD_KEY = "scc_onboarded_v1";
const OB_STEPS = 4;

function getStorageKey(base) {
  try {
    const u = JSON.parse(localStorage.getItem("scholars-circle-auth"))?.authUser;
    const uid = u?.id || u?.username;
    return `${base}::${uid || localStorage.getItem("scholars-circle-current-user") || "guest"}`;
  } catch {
    return `${base}::guest`;
  }
}

function loadLocal(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch {}
  return fallback;
}

function saveLocal(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

function levelFor(xp) { return Math.floor(xp / 100) + 1; }

function scoreColor(s) {
  if (s >= 8) return "var(--vp-green)";
  if (s >= 5) return "var(--vp-gold)";
  return "var(--vp-coral)";
}

function computeInvStats(invOrdered, caseObj) {
  const relevantKeys = Object.keys(caseObj.investigations).filter(k => caseObj.investigations[k].indicated);
  const orderedRelevant = new Set();
  let irrelevantCount = 0;
  invOrdered.forEach(i => {
    const key = i.name.toLowerCase();
    if (i.relevant) orderedRelevant.add(key);
    else if (!i.duplicate) irrelevantCount++;
  });
  const totalRelevant = relevantKeys.length;
  const coverage = totalRelevant ? orderedRelevant.size / totalRelevant : 1;
  let score = Math.round(coverage * 10) - Math.min(irrelevantCount, 4);
  score = Math.max(0, Math.min(10, score));
  return { score, orderedRelevantCount: orderedRelevant.size, totalRelevant, irrelevantCount };
}

function evaluateAchievements(profile, grade, mode) {
  const unlocked = [];
  const has = id => profile.achievements.includes(id);
  if (!has("first_case")) unlocked.push("first_case");
  if (grade.history_score === 10 && grade.efficiency_penalty === 0 && !has("efficient_historian")) unlocked.push("efficient_historian");
  if ((profile.casesCompleted + 1) >= 5 && !has("five_cases")) unlocked.push("five_cases");
  if (mode !== "foundations") {
    if (grade.diagnosis_score >= 9 && !has("sharp_diagnosis")) unlocked.push("sharp_diagnosis");
    if (grade.inv_stats.totalRelevant > 0 && grade.inv_stats.irrelevantCount === 0 && grade.inv_stats.orderedRelevantCount === grade.inv_stats.totalRelevant && !has("good_steward")) unlocked.push("good_steward");
  }
  return unlocked;
}

function seedReviewDeck(profile, grade, caseObj) {
  const now = new Date().toISOString();
  const missed = [...(grade.history_missed || []), ...(grade.management_missed || [])];
  missed.forEach(text => {
    const exists = profile.reviewDeck.some(it => it.text === text && it.caseDx === caseObj.diagnosis);
    if (!exists) {
      profile.reviewDeck.push({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        text, caseDx: caseObj.diagnosis, addedAt: now, due: now, interval: 1
      });
    }
  });
  if (profile.reviewDeck.length > 60) {
    profile.reviewDeck = profile.reviewDeck.slice(profile.reviewDeck.length - 60);
  }
}

function getDueItems(profile) {
  const now = Date.now();
  return (profile.reviewDeck || []).filter(it => new Date(it.due).getTime() <= now);
}

export default function VirtualPatient({ aiConfig, stats, updateStats }) {
  const [screen, setScreen] = useState("select");
  const [gameMode, setGameMode] = useState(() => loadLocal(getStorageKey(GAME_MODE_KEY), "osce"));
  const [paceSec, setPaceSec] = useState(() => {
    const v = loadLocal(getStorageKey(PACE_KEY), null);
    return v && PACE_OPTIONS.some(p => p.min * 60 === v) ? v : 600;
  });
  const [specialtyFilter, setSpecialtyFilter] = useState("All");
  const [profile, setProfile] = useState(() => loadLocal(getStorageKey(CLINICAL_PROFILE_KEY), DEFAULT_PROFILE));
  const [resumeSnapshot, setResumeSnapshot] = useState(null);
  const [reviewQueue, setReviewQueue] = useState([]);
  const [showReviewPanel, setShowReviewPanel] = useState(false);

  // Consult state
  const [activeCase, setActiveCase] = useState(null);
  const [messages, setMessages] = useState([]);
  const [examinerMessages, setExaminerMessages] = useState([]);
  const [invOrdered, setInvOrdered] = useState([]);
  const [examViewed, setExamViewed] = useState([]);
  const [dx1, setDx1] = useState("");
  const [dx2, setDx2] = useState("");
  const [dx3, setDx3] = useState("");
  const [mgmt, setMgmt] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [examInput, setExamInput] = useState("");
  const [invCustomInput, setInvCustomInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isExamTyping, setIsExamTyping] = useState(false);
  const [isGrading, setIsGrading] = useState(false);
  const [grade, setGrade] = useState(null);
  const [gradeError, setGradeError] = useState(false);
  const [progressInfo, setProgressInfo] = useState(null);
  const [toolsDrawerOpen, setToolsDrawerOpen] = useState(false);
  const [vitalsDrawerOpen, setVitalsDrawerOpen] = useState(false);
  const [saveIndicator, setSaveIndicator] = useState(false);

  // Live vitals
  const [elapsedSec, setElapsedSec] = useState(0);
  const [currentHr, setCurrentHr] = useState(88);
  const [vitalAlert, setVitalAlert] = useState("");
  const [monitorDeteriorating, setMonitorDeteriorating] = useState(false);
  const [deterPct, setDeterPct] = useState(0);
  const [patientStatus, setPatientStatus] = useState("stable");

  // Onboarding wizard
  const [ob, setOb] = useState({ open: false, step: 0, mode: "osce", specialty: "Any", pace: 15, caseIdx: null });

  // Confirm modal
  const [modal, setModal] = useState(null);

  const [isFullscreen, setIsFullscreen] = useState(false);

  // Refs
  const startTimeRef = useRef(Date.now());
  const timerIntervalRef = useRef(null);
  const stabilizedAtSecRef = useRef(null);
  const chatLogRef = useRef(null);
  const examLogRef = useRef(null);
  const snapshotTimerRef = useRef(null);
  const saveIndicatorTimerRef = useRef(null);
  const consultScreenRef = useRef(null);

  // Mirror of latest state for interval callbacks (avoids stale closures)
  const latest = useRef({});
  latest.current = { screen, gameMode, paceSec, activeCase, messages, examinerMessages, invOrdered, examViewed, dx1, dx2, dx3, mgmt, ob, modal };

  const specialties = useMemo(() => ["All", ...Array.from(new Set(CASES.map(c => c.specialty)))], []);
  const filteredIndices = useMemo(() =>
    CASES.map((c, i) => i).filter(i => specialtyFilter === "All" || CASES[i].specialty === specialtyFilter),
    [specialtyFilter]
  );

  const dueItems = useMemo(() => getDueItems(profile), [profile]);

  const isF = gameMode === "foundations";
  const timerM = String(Math.floor(elapsedSec / 60)).padStart(2, "0");
  const timerS = String(elapsedSec % 60).padStart(2, "0");
  const paceTarget = paceSec || 600;
  const paceFrac = Math.min(1, elapsedSec / paceTarget);
  const paceOver = elapsedSec > paceTarget;
  const examKeys = activeCase ? Object.keys(EXAM_LABELS).filter(k => activeCase.exam[k]) : [];
  const totalExams = examKeys.length;
  const remainingExams = Math.max(0, totalExams - examViewed.length);
  const examsPct = totalExams ? Math.round((examViewed.length / totalExams) * 100) : 0;
  const questionsAsked = messages.filter(m => m.role === "doc").length;

  // Load resume snapshot on mount; auto-open onboarding for first-time users
  useEffect(() => {
    const snap = loadLocal(getStorageKey(ACTIVE_CONSULT_KEY), null);
    if (snap && CASES[snap.caseIndex]) {
      setResumeSnapshot(snap);
      return;
    }
    if (profile.casesCompleted === 0 && !loadLocal(getStorageKey(ONBOARD_KEY), null)) {
      openOnboarding();
      saveLocal(getStorageKey(ONBOARD_KEY), "1");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    if (chatLogRef.current) chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
  }, [messages, isTyping]);

  useEffect(() => {
    if (examLogRef.current) examLogRef.current.scrollTop = examLogRef.current.scrollHeight;
  }, [examinerMessages, isExamTyping]);

  // Timer tick — consult clock keeps running on the assessment sheet too
  useEffect(() => {
    const running = screen === "consult" || screen === "assess";
    if (!running) {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      return;
    }
    timerIntervalRef.current = setInterval(() => {
      const secs = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsedSec(secs);
      updateVitals(secs);
      if (secs > 0 && secs % 15 === 0) doSnapshot();
    }, 1000);
    return () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  // Keyboard: F toggles fullscreen on consult, Escape closes modal/wizard/drawers
  useEffect(() => {
    function onKeyDown(e) {
      if ((e.key === "f" || e.key === "F") && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const t = e.target;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
        if (latest.current.screen === "consult") toggleConsultFullscreen();
      }
      if (e.key === "Escape") {
        if (latest.current.modal) setModal(null);
        else if (latest.current.ob.open) setOb(o => ({ ...o, open: false }));
        else closeAllDrawers();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  function updateVitals(secs) {
    const L = latest.current;
    const vp = L.activeCase?.vitalsProfile;
    if (!vp) {
      setCurrentHr(88);
      setVitalAlert("");
      setMonitorDeteriorating(false);
      setDeterPct(0);
      setPatientStatus("stable");
      return;
    }
    if (stabilizedAtSecRef.current == null) {
      const key = (vp.stabilizing_action || "").toLowerCase();
      const done = L.invOrdered.some(i => i.name.toLowerCase() === key);
      if (done) stabilizedAtSecRef.current = secs;
    }
    const anchorSecs = stabilizedAtSecRef.current != null ? stabilizedAtSecRef.current : secs;
    const span = Math.max(1, vp.decompensate_full - vp.decompensate_start);
    const t = Math.min(1, Math.max(0, (anchorSecs - vp.decompensate_start) / span));
    const jitter = Math.floor(Math.random() * 5) - 2;
    const hr = Math.round(vp.baseline_hr + (vp.critical_hr - vp.baseline_hr) * t) + jitter;
    setCurrentHr(hr);
    setDeterPct(Math.round(t * 100));

    const deteriorating = t > 0.05 && stabilizedAtSecRef.current == null;
    const recognizedRecently = stabilizedAtSecRef.current != null && (secs - stabilizedAtSecRef.current) < 6;
    setMonitorDeteriorating(deteriorating);
    setPatientStatus(deteriorating ? "deteriorating" : stabilizedAtSecRef.current != null ? "stabilised" : "stable");
    setVitalAlert(deteriorating ? "⚠ DETERIORATING" : recognizedRecently ? "✓ RECOGNIZED" : "");
  }

  function doSnapshot() {
    const L = latest.current;
    if (!L.activeCase) return;
    const idx = CASES.indexOf(L.activeCase);
    if (idx < 0) return;
    const snap = {
      caseIndex: idx,
      mode: L.gameMode,
      messages: L.messages,
      examinerMessages: L.examinerMessages,
      invOrdered: L.invOrdered,
      examViewed: L.examViewed,
      elapsedMs: Date.now() - startTimeRef.current,
      stabilizedElapsedMs: stabilizedAtSecRef.current != null ? stabilizedAtSecRef.current * 1000 : null,
      dx1: L.dx1, dx2: L.dx2, dx3: L.dx3, mgmt: L.mgmt,
      savedAt: Date.now()
    };
    saveLocal(getStorageKey(ACTIVE_CONSULT_KEY), snap);
    setSaveIndicator(true);
    if (saveIndicatorTimerRef.current) clearTimeout(saveIndicatorTimerRef.current);
    saveIndicatorTimerRef.current = setTimeout(() => setSaveIndicator(false), 1400);
  }

  function debouncedSnapshot() {
    if (snapshotTimerRef.current) clearTimeout(snapshotTimerRef.current);
    snapshotTimerRef.current = setTimeout(doSnapshot, 800);
  }

  function clearActiveSnapshot() {
    try { localStorage.removeItem(getStorageKey(ACTIVE_CONSULT_KEY)); } catch {}
  }

  function saveGameMode(mode) {
    setGameMode(mode);
    saveLocal(getStorageKey(GAME_MODE_KEY), mode);
  }

  function saveProfile(p) {
    setProfile(p);
    saveLocal(getStorageKey(CLINICAL_PROFILE_KEY), p);
  }

  // Add XP to app stats
  function addXpToStats(amount) {
    if (updateStats) {
      updateStats({ xp: (stats?.xp || 0) + amount });
    }
  }

  /* ============ ONBOARDING WIZARD ============ */
  function openOnboarding() {
    const found = PACE_OPTIONS.find(p => p.min * 60 === paceSec);
    setOb({ open: true, step: 0, mode: gameMode, specialty: "Any", pace: found ? found.min : 15, caseIdx: null });
  }

  function closeOnboarding() {
    setOb(o => ({ ...o, open: false }));
  }

  function obBack() {
    setOb(o => (o.step === 0 ? { ...o, open: false } : { ...o, step: o.step - 1, caseIdx: null }));
  }

  function obPool() {
    return ob.specialty === "Any"
      ? CASES.map((c, i) => i)
      : CASES.map((c, i) => (c.specialty === ob.specialty ? i : -1)).filter(i => i >= 0);
  }

  function obNext() {
    if (ob.step === 1 && obPool().length === 0) return;
    if (ob.step === 2) {
      const secs = ob.pace * 60;
      setPaceSec(secs);
      saveLocal(getStorageKey(PACE_KEY), secs);
      const pool = obPool();
      setOb(o => ({ ...o, caseIdx: pool[Math.floor(Math.random() * pool.length)], step: 3 }));
      return;
    }
    if (ob.step === OB_STEPS - 1) {
      obStart();
      return;
    }
    setOb(o => ({ ...o, step: o.step + 1 }));
  }

  function obStart() {
    if (ob.caseIdx == null) return;
    saveGameMode(ob.mode);
    closeOnboarding();
    startCase(ob.caseIdx);
  }

  /* ============ NAVIGATION ============ */
  function startCase(idx) {
    const c = CASES[idx];
    setActiveCase(c);
    setMessages([{ role: "pt", text: c.cc }]);
    setExaminerMessages([]);
    setInvOrdered([]);
    setExamViewed([]);
    setDx1(""); setDx2(""); setDx3(""); setMgmt("");
    setChatInput(""); setExamInput(""); setInvCustomInput("");
    setGrade(null); setGradeError(false); setProgressInfo(null);
    setToolsDrawerOpen(false);
    setVitalsDrawerOpen(false);
    stabilizedAtSecRef.current = null;
    startTimeRef.current = Date.now();
    setElapsedSec(0);
    setCurrentHr(88);
    setDeterPct(0);
    setVitalAlert("");
    setMonitorDeteriorating(false);
    setPatientStatus("stable");
    setScreen("consult");
    setTimeout(doSnapshot, 100);
  }

  function startRandomCase() {
    const indices = CASES.map((c, i) => i);
    startCase(indices[Math.floor(Math.random() * indices.length)]);
  }

  function resumeCase() {
    if (!resumeSnapshot) return;
    const snap = resumeSnapshot;
    const c = CASES[snap.caseIndex];
    if (!c) return;
    setActiveCase(c);
    setMessages(snap.messages || [{ role: "pt", text: c.cc }]);
    setExaminerMessages(snap.examinerMessages || []);
    setInvOrdered(snap.invOrdered || []);
    setExamViewed(snap.examViewed || []);
    setDx1(snap.dx1 || ""); setDx2(snap.dx2 || ""); setDx3(snap.dx3 || "");
    setMgmt(snap.mgmt || "");
    setGrade(null); setGradeError(false); setProgressInfo(null);
    setToolsDrawerOpen(false);
    setVitalsDrawerOpen(false);
    stabilizedAtSecRef.current = snap.stabilizedElapsedMs != null ? Math.floor(snap.stabilizedElapsedMs / 1000) : null;
    startTimeRef.current = Date.now() - (snap.elapsedMs || 0);
    setElapsedSec(Math.floor((snap.elapsedMs || 0) / 1000));
    setResumeSnapshot(null);
    setScreen("consult");
    setTimeout(() => {
      const secs = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsedSec(secs);
      updateVitals(secs);
    }, 50);
  }

  function discardResume() {
    clearActiveSnapshot();
    setResumeSnapshot(null);
  }

  function goToSelect() {
    setScreen("select");
    setToolsDrawerOpen(false);
    setVitalsDrawerOpen(false);
    setModal(null);
    setVitalAlert("");
    setMonitorDeteriorating(false);
    setDeterPct(0);
    setPatientStatus("stable");
    if (document.fullscreenElement) document.exitFullscreen();
    clearActiveSnapshot();
  }

  function openAssessment() {
    if (!activeCase) return;
    setToolsDrawerOpen(false);
    setVitalsDrawerOpen(false);
    setScreen("assess");
  }

  function closeAllDrawers() {
    setToolsDrawerOpen(false);
    setVitalsDrawerOpen(false);
  }

  function toggleConsultFullscreen() {
    const el = consultScreenRef.current;
    if (!el) return;
    if (document.fullscreenElement) { document.exitFullscreen(); return; }
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  }

  /* ============ MODAL ============ */
  function showModal({ title, body, confirmText = "Confirm", cancelText = "Cancel", tone = "confirm", onConfirm = null }) {
    setModal({ title, body, confirmText, cancelText, tone, onConfirm });
  }

  function closeModal() {
    setModal(null);
  }

  /* ============ PATIENT CHAT (AI) ============ */
  async function sendQuestion() {
    const question = chatInput.trim();
    if (!question || isTyping) return;
    setChatInput("");
    setIsTyping(true);
    setMessages(prev => [...prev, { role: "doc", text: question }]);

    const c = activeCase;
    const systemPrompt = `You are roleplaying as a patient in a clinical history-taking simulation for a medical student.

PATIENT PROFILE: ${c.demo}
CHIEF COMPLAINT: "${c.cc}"

HIDDEN CASE FACTS (use ONLY these; never invent contradicting facts, never reveal the diagnosis by name):
${Object.entries(c.history).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

RULES:
- Respond ONLY in first person, as the patient, in plain everyday language (not medical jargon).
- Answer only what is asked, based strictly on the facts above. Do not volunteer unrelated information.
- If asked about something not covered above, respond naturally and vaguely as a real patient would ("I'm not sure", "No, nothing like that"), without inventing new clinical facts that could contradict the real diagnosis.
- Never say the name of a diagnosis or medical condition.
- If the student asks a broad or open-ended question (e.g. "tell me everything", "what's wrong with you", "describe all your symptoms"), respond the way a real patient would: lead with only the 1-2 things bothering you most right now, in your own words. Do not recite a full symptom checklist even if asked to "be thorough" or "list everything" — a real patient needs focused follow-up questions to draw out each detail, they don't self-report a structured list.
- If the student's message bundles several distinct questions into one, answer only the first one and let them ask the rest separately, the way a patient who's in pain or distracted might.
- Keep responses to 1-3 short sentences, conversational and a little anxious/human, unless the question needs more detail.`;

    try {
      const text = await callAIChat({
        system: systemPrompt,
        messages: [{ role: "user", content: question }],
        provider: aiConfig?.provider,
        model: aiConfig?.model
      });
      setMessages(prev => [...prev, { role: "pt", text: text || "…" }]);
      debouncedSnapshot();
    } catch (e) {
      setMessages(prev => [...prev, { role: "pt", text: "(connection trouble — try asking again)" }]);
    }
    setIsTyping(false);
  }

  /* ============ EXAM ============ */
  function doExam(key) {
    const finding = activeCase.exam[key] || "Nothing significant found on this examination.";
    setExamViewed(prev => [...prev, { key, finding }]);
    setMessages(prev => [...prev, { role: "doc", text: `[Examines: ${EXAM_LABELS[key]}]` }, { role: "pt", text: finding }]);
    debouncedSnapshot();
  }

  /* ============ INVESTIGATIONS ============ */
  function orderInvestigation(name) {
    const key = name.toLowerCase().trim();
    if (!key) return;
    const invDict = activeCase.investigations;
    const entry = invDict[key];
    const relevant = !!(entry && entry.indicated);
    const result = entry ? entry.result : "Result within normal limits — low diagnostic yield for this presentation.";
    const already = invOrdered.some(i => i.name.toLowerCase() === key);
    setInvOrdered(prev => [...prev, { name, result, relevant, duplicate: already }]);
    debouncedSnapshot();
  }

  function orderCustomInvestigation() {
    const name = invCustomInput.trim();
    if (!name) return;
    setInvCustomInput("");
    orderInvestigation(name);
  }

  /* ============ SUBMIT + GRADING ============ */
  function attemptSubmit() {
    if (!activeCase) return;
    if (isF) {
      if (questionsAsked < 1) {
        showModal({
          title: "Ask a question first",
          body: "Ask the patient at least one question before finishing this practice round.",
          confirmText: "Back to consult",
          cancelText: "",
          tone: "danger",
          onConfirm: () => setScreen("consult")
        });
        return;
      }
    } else if (!dx1.trim() || !mgmt.trim()) {
      showModal({
        title: "Incomplete assessment",
        body: "Enter at least your top diagnosis and a management plan before submitting.",
        confirmText: "Got it",
        cancelText: "",
        tone: "danger"
      });
      return;
    }

    const exN = examViewed.length, ivN = invOrdered.length;
    const summary = isF
      ? `You asked ${questionsAsked} question${questionsAsked === 1 ? "" : "s"}. In Foundations mode only your history-taking is scored — diagnosis and management are optional practice and won't affect your grade.`
      : `You asked ${questionsAsked} question${questionsAsked === 1 ? "" : "s"}, performed ${exN} examination${exN === 1 ? "" : "s"}, and ordered ${ivN} investigation${ivN === 1 ? "" : "s"}. Submitting ends the consult and grades all four OSCE domains — this can't be undone.`;

    showModal({
      title: isF ? "Finish history practice?" : "Submit for grading?",
      body: summary,
      confirmText: isF ? "Finish history practice" : "Submit & grade",
      cancelText: "Keep working",
      tone: "confirm",
      onConfirm: submitForGrading
    });
  }

  async function submitForGrading() {
    const dxList = [dx1, dx2, dx3].filter(Boolean).map(s => s.trim());
    setIsGrading(true);
    setGradeError(false);

    const c = activeCase;
    const transcript = messages.map(m => `${m.role === "doc" ? "Student" : "Patient"}: ${m.text}`).join("\n") || "(no questions asked)";
    const examLog = examViewed.map(e => `${EXAM_LABELS[e.key]}: ${e.finding}`).join("\n") || "(no examination performed)";
    const invLog = invOrdered.map(i => `${i.name}${i.relevant ? "" : " (low yield)"}: ${i.result}`).join("\n") || "(no investigations ordered)";
    const invStats = computeInvStats(invOrdered, c);

    const gradingPrompt = isF ? `You are a supportive clinical tutor reviewing a PRE-CLINICAL medical student's history-taking practice with a virtual patient. This student has not started clinical rotations yet, so you are ONLY assessing their history-taking and examination questions — never their diagnosis or management.

ESSENTIAL HISTORY/EXAM CHECKLIST — mark ONLY items genuinely covered by the student's questions or exam requests below, based on their content, not phrasing:
${c.essential_points.map((p, i) => `${i + 1}. ${p}`).join("\n")}

WHAT THE STUDENT DID:
--- History taken (chat transcript) ---
${transcript}
--- Examination performed ---
${examLog}

Respond with ONLY a raw JSON object, no markdown fences, no preamble, matching exactly this schema:
{"history_points_covered": [string], "history_points_missed": [string], "history_feedback": string, "overall_feedback": string}

Rules:
- history_points_covered/missed must each be items copied verbatim from the checklist above — every checklist item appears in exactly one of the two lists.
- Feedback should be warm, encouraging and specific (2-3 sentences each), addressed to the student as "you". Focus on the skill of asking clear, structured, curious questions — not on clinical knowledge they haven't been taught yet.` : `You are an OSCE clinical examiner grading a medical student's performance in a virtual patient case. Your job is to check what the student actually elicited and did, not to reward a confident-sounding write-up.

CORRECT DIAGNOSIS (not shown to student): ${c.diagnosis}

ESSENTIAL HISTORY/EXAM CHECKLIST — mark ONLY items genuinely covered by the student's questions or exam requests below, based on their content, not phrasing:
${c.essential_points.map((p, i) => `${i + 1}. ${p}`).join("\n")}

EXPECTED MANAGEMENT CHECKLIST — mark ONLY items genuinely covered by the student's management plan:
${c.management_key.map((p, i) => `${i + 1}. ${p}`).join("\n")}

WHAT THE STUDENT DID:
--- History taken (chat transcript) ---
${transcript}
--- Examination performed ---
${examLog}
--- Investigations ordered by student (already scored separately — for context only) ---
${invLog}
--- Student's differential diagnosis (ranked, most likely first) ---
${dxList.map((d, i) => `${i + 1}. ${d}`).join("\n")}
--- Student's management plan ---
${mgmt}

Respond with ONLY a raw JSON object, no markdown fences, no preamble, matching exactly this schema:
{"history_points_covered": [string], "history_points_missed": [string], "history_feedback": string, "diagnosis_score": number, "diagnosis_correct": boolean, "diagnosis_rank_matched": number_or_null, "diagnosis_feedback": string, "management_points_covered": [string], "management_points_missed": [string], "management_feedback": string, "overall_feedback": string}

Rules:
- history_points_covered/missed must each be items copied verbatim from the essential history/exam checklist above — every checklist item appears in exactly one of the two lists.
- management_points_covered/missed must each be items copied verbatim from the expected management checklist above — every checklist item appears in exactly one of the two lists.
- diagnosis_score (0-10) should reward correct clinical reasoning even if the exact wording differs from the answer key, and give partial credit for a reasonable differential that includes the correct diagnosis.
- diagnosis_rank_matched is the 1-based position in the student's differential list where the correct diagnosis (or an unambiguous synonym) appears, or null if it doesn't appear anywhere in the list.
- Feedback should be specific and short (2-3 sentences each), addressed to the student as "you".`;

    if (document.fullscreenElement) document.exitFullscreen();
    setScreen("grade");

    let raw;
    try {
      const responseText = await callAIChat({
        messages: [{ role: "user", content: gradingPrompt }],
        provider: aiConfig?.provider,
        model: aiConfig?.model
      });
      raw = extractJSON(responseText);
    } catch (e) {
      // Retry once
      try {
        const responseText2 = await callAIChat({
          messages: [{ role: "user", content: gradingPrompt }],
          provider: aiConfig?.provider,
          model: aiConfig?.model
        });
        raw = extractJSON(responseText2);
      } catch (e2) {
        setGradeError(true);
        setIsGrading(false);
        return;
      }
    }

    try {
      const historyTotal = c.essential_points.length;
      const historyCovered = (raw.history_points_covered || []).length;
      const allowedSlack = 3;
      const overAsk = Math.max(0, questionsAsked - (historyTotal + allowedSlack));
      const efficiencyPenalty = Math.min(3, Math.floor(overAsk / 2));
      const historyScoreRaw = historyTotal ? Math.round((historyCovered / historyTotal) * 10) : 0;

      const g = {
        mode: gameMode,
        history_score: Math.max(0, historyScoreRaw - efficiencyPenalty),
        history_covered: raw.history_points_covered || [],
        history_missed: raw.history_points_missed || [],
        history_feedback: raw.history_feedback || "",
        questions_asked: questionsAsked,
        efficiency_penalty: efficiencyPenalty,
        inv_score: null,
        inv_stats: invStats,
        diagnosis_score: null,
        diagnosis_correct: null,
        diagnosis_rank_matched: null,
        diagnosis_feedback: "",
        management_score: null,
        management_covered: [],
        management_missed: [],
        management_feedback: "",
        overall_feedback: raw.overall_feedback || ""
      };

      if (!isF) {
        const mgmtTotal = c.management_key.length;
        const mgmtCovered = (raw.management_points_covered || []).length;
        g.inv_score = invStats.score;
        g.diagnosis_score = raw.diagnosis_score;
        g.diagnosis_correct = raw.diagnosis_correct;
        g.diagnosis_rank_matched = (typeof raw.diagnosis_rank_matched === "number") ? raw.diagnosis_rank_matched : null;
        g.diagnosis_feedback = raw.diagnosis_feedback;
        g.management_score = mgmtTotal ? Math.round((mgmtCovered / mgmtTotal) * 10) : 0;
        g.management_covered = raw.management_points_covered || [];
        g.management_missed = raw.management_points_missed || [];
        g.management_feedback = raw.management_feedback || "";
      }

      setGrade(g);

      // Gamification
      const newProfile = JSON.parse(JSON.stringify(profile));
      const prevLevel = levelFor(newProfile.xp);
      const beforeDeckLen = newProfile.reviewDeck.length;
      const xpGained = isF
        ? Math.round(g.history_score * 10)
        : Math.round(((g.history_score + g.inv_score + g.diagnosis_score + g.management_score) / 4) * 15);
      const unlocked = evaluateAchievements(newProfile, g, gameMode);

      newProfile.xp += xpGained;
      newProfile.casesCompleted += 1;
      newProfile.achievements = Array.from(new Set([...newProfile.achievements, ...unlocked]));
      seedReviewDeck(newProfile, g, c);
      const reviewAdded = newProfile.reviewDeck.length - beforeDeckLen;
      saveProfile(newProfile);

      // Add XP to app stats
      addXpToStats(xpGained);

      const newLevel = levelFor(newProfile.xp);
      setProgressInfo({ profile: newProfile, xpGained, unlocked, leveledUp: newLevel > prevLevel, newLevel, reviewAdded });

      clearActiveSnapshot();
    } catch (e) {
      setGradeError(true);
    }
    setIsGrading(false);
  }

  /* ============ POST-GRADE EXAMINER CHAT (AI) ============ */
  async function askExaminer() {
    const question = examInput.trim();
    if (!question || isExamTyping) return;
    setExamInput("");
    setIsExamTyping(true);
    setExaminerMessages(prev => [...prev, { role: "user", text: question }]);

    const c = activeCase;
    const g = grade || {};
    const systemPrompt = `You are a warm but rigorous OSCE clinical examiner debriefing a medical student right after a virtual patient case.

CASE: ${c.demo}, presenting with "${c.cc}"
CORRECT DIAGNOSIS: ${c.diagnosis}
ESSENTIAL HISTORY/EXAM POINTS: ${c.essential_points.join("; ")}
EXPECTED MANAGEMENT: ${c.management_key.join("; ")}
STUDENT'S SCORES THIS ATTEMPT: history ${g.history_score}/10, investigations ${g.inv_score}/10, diagnosis ${g.diagnosis_score}/10, management ${g.management_score}/10.
STUDENT'S DIFFERENTIAL: ${[dx1, dx2, dx3].filter(Boolean).join(", ") || "none recorded"}
STUDENT'S MANAGEMENT PLAN: ${mgmt || "none recorded"}

Answer the student's follow-up questions about their performance and the underlying clinical reasoning. Be specific, reference what they actually did or missed in this attempt, and keep answers to 2-4 sentences unless they ask for more depth. Never be dismissive — this is a teaching moment.`;

    try {
      const text = await callAIChat({
        system: systemPrompt,
        messages: [...examinerMessages, { role: "user", content: question }].map(m => ({ role: m.role, content: m.text })),
        provider: aiConfig?.provider,
        model: aiConfig?.model
      });
      setExaminerMessages(prev => [...prev, { role: "assistant", text: text || "…" }]);
    } catch (e) {
      setExaminerMessages(prev => [...prev, { role: "assistant", text: "(connection trouble — try asking again)" }]);
    }
    setIsExamTyping(false);
  }

  /* ============ REVIEW DECK ============ */
  function openReviewPanel() {
    setReviewQueue(dueItems);
    setShowReviewPanel(true);
  }

  function rateReviewItem(id, gotIt) {
    const newProfile = JSON.parse(JSON.stringify(profile));
    const item = newProfile.reviewDeck.find(i => i.id === id);
    if (item) {
      item.interval = gotIt ? Math.min(30, Math.round((item.interval || 1) * 2.3)) : 1;
      item.due = new Date(Date.now() + item.interval * 24 * 60 * 60 * 1000).toISOString();
    }
    saveProfile(newProfile);
    setReviewQueue(prev => prev.slice(1));
  }

  /* ============================================================
     RENDER
     ============================================================ */
  const obPoolList = obPool();
  const obCtaDisabled = ob.step === 1 && obPoolList.length === 0;
  const obCtaText = ob.step === OB_STEPS - 1 ? "▶ Start Simulation" : "Continue";
  const obNoteText = ob.step === 0
    ? "You can change this later on the home screen."
    : ob.step === 1
      ? (obPoolList.length ? `${obPoolList.length} case${obPoolList.length === 1 ? "" : "s"} available in this pool.` : "No cases in this specialty yet — pick another.")
      : ob.step === 2
        ? "Sets the pace target on your consult clock."
        : "The clock starts the moment you step in.";
  const vitalsCharted = examViewed.find(e => e.key === "vitals");
  const briefCase = ob.caseIdx != null ? CASES[ob.caseIdx] : null;

  return (
    <div className="vp-root">
      {/* SCREEN 1: CASE SELECT */}
      {screen === "select" && (
        <div>
          <div className="vp-hero">
            <div className="vp-eyebrow">AI Clinical Challenge</div>
            <h1>Meet your patient.</h1>
            <p className="vp-sub">Take a history, examine, order investigations, then commit to a diagnosis and a management plan. You'll be graded on all four — the way an OSCE examiner would.</p>
          </div>

          {resumeSnapshot && (
            <div className="vp-glass vp-resume-card" style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap", padding: "16px 20px" }}>
                <div>
                  <div className="vp-eyebrow" style={{ color: "var(--vp-blue)" }}>Unfinished case</div>
                  <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 15, marginTop: 4 }}>{CASES[resumeSnapshot.caseIndex].bed} · "{CASES[resumeSnapshot.caseIndex].cc}"</div>
                  <div style={{ fontSize: 12, color: "var(--vp-text-faint)", marginTop: 2 }}>{CASES[resumeSnapshot.caseIndex].specialty} · {Math.max(0, Math.round((resumeSnapshot.elapsedMs || 0) / 60000))} min in · {(resumeSnapshot.messages || []).filter(m => m.role === "doc").length} questions asked</div>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <div className="vp-chip" onClick={resumeCase} style={{ borderColor: "var(--vp-blue)", color: "var(--vp-blue)" }}>Resume</div>
                  <div className="vp-chip" onClick={discardResume} style={{ color: "var(--vp-coral)" }}>Discard</div>
                </div>
              </div>
            </div>
          )}

          <div className="vp-glass vp-progress-card" style={{ marginBottom: 16 }}>
            <div className="vp-progress-top">
              <div className="vp-progress-level">Level {levelFor(profile.xp)}</div>
              <div className="vp-progress-xp">{profile.xp} XP · {profile.casesCompleted} case{profile.casesCompleted === 1 ? "" : "s"} completed</div>
            </div>
            <div className="vp-bar-track"><div className="vp-bar-fill" style={{ width: `${profile.xp % 100}%`, background: "var(--vp-blue)" }} /></div>
            <div className="vp-progress-badges">
              {profile.achievements.length
                ? profile.achievements.map(a => <span key={a} className="vp-badge">{ACHIEVEMENT_LABELS[a] || a}</span>)
                : <span style={{ fontSize: 11.5, color: "var(--vp-text-faint)" }}>No badges yet — complete a case to earn your first.</span>}
            </div>
            {dueItems.length > 0 && (
              <div className="vp-review-row">
                <span>{dueItems.length} item{dueItems.length > 1 ? "s" : ""} due for review</span>
                <div className="vp-chip" onClick={openReviewPanel}>Review due items</div>
              </div>
            )}
          </div>

          {showReviewPanel && (
            <ReviewPanel
              queue={reviewQueue}
              onRate={rateReviewItem}
              onClose={() => { setShowReviewPanel(false); }}
            />
          )}

          <div className="vp-specialty-row">
            {specialties.map(s => (
              <div key={s} className={`vp-chip vp-spec-chip ${s === specialtyFilter ? "active" : ""}`} onClick={() => setSpecialtyFilter(s)}>{s}</div>
            ))}
          </div>

          <div className="vp-case-grid">
            {filteredIndices.length === 0 ? (
              <div className="vp-glass vp-no-cases-hint" style={{ gridColumn: "1/-1" }}>No cases in this specialty yet.</div>
            ) : filteredIndices.map(i => {
              const c = CASES[i];
              return (
                <div key={i} className="vp-glass vp-case-card" onClick={() => startCase(i)}>
                  <div className="vp-pulse-dot" />
                  <div className="vp-bed">{c.bed}</div>
                  <div className="vp-spec-tag">{c.specialty}</div>
                  <div className="vp-cc">{c.cc}</div>
                  <div className="vp-demo">{c.demo}</div>
                </div>
              );
            })}
          </div>

          <div className="vp-cta-bar">
            <button className="vp-cta-start" onClick={openOnboarding}>▶ Start patient case</button>
            <button className="vp-cta-dice" onClick={startRandomCase} title="Instant random case">🎲</button>
          </div>
        </div>
      )}

      {/* SCREEN 2: CONSULT */}
      {screen === "consult" && activeCase && (
        <div className="vp-consult-screen" ref={consultScreenRef}>
          <div className="vp-consult-col">
            <header className={`vp-glass vp-case-top ${monitorDeteriorating ? "deteriorating" : ""}`}>
              <div className="vp-ct-row1">
                <button className="vp-ct-back" onClick={goToSelect} title="New case">←</button>
                <div className="vp-ct-title-wrap">
                  <div className="vp-ct-title">
                    <span className={`vp-dot ${patientStatus === "deteriorating" ? "st-bad" : patientStatus === "stabilised" ? "st-ok" : ""}`} />
                    <span>{activeCase.specialty}</span>
                  </div>
                  <div className="vp-ct-sub">
                    {activeCase.bed} · {activeCase.demo} · <span className={patientStatus === "deteriorating" ? "vp-st-bad" : "vp-st-stable"}>{patientStatus}</span>
                  </div>
                </div>
                <div className="vp-ct-right">
                  <span className={`vp-mode-badge ${isF ? "vp-mode-badge-f" : "vp-mode-badge-o"}`}>{isF ? "FOUNDATIONS" : "FULL OSCE"}</span>
                  <span className={`vp-save-indicator ${saveIndicator ? "show" : ""}`}>✓ saved</span>
                  <button className="vp-ct-mini" onClick={toggleConsultFullscreen} title="Fullscreen (F)">{isFullscreen ? "⤡" : "⛶"}</button>
                </div>
              </div>

              <div className="vp-ct-ecg">
                <svg viewBox="0 0 600 30" preserveAspectRatio="none">
                  <polyline fill="none" stroke="#3ECF8E" strokeWidth="1.6" points="0,15 40,15 50,15 55,3 60,27 65,9 70,15 140,15 180,15 190,15 195,3 200,27 205,9 210,15 300,15 340,15 350,15 355,3 360,27 365,9 370,15 440,15 480,15 490,15 495,3 500,27 505,9 510,15 600,15" opacity="0.9" />
                </svg>
                <span className="vp-hr-mini"><b>{currentHr}</b> bpm</span>
              </div>
              <div className={`vp-vital-alert ${vitalAlert ? "show" : ""}`}>{vitalAlert}</div>

              <div className="vp-ct-meters">
                <div className="vp-meter">
                  <div className="vp-meter-top">
                    <span className="vp-m-lbl"><span className="vp-m-ic">⏱</span>{paceOver ? "Over target" : "On pace"}</span>
                    <span className="vp-m-val">{timerM}:{timerS}</span>
                  </div>
                  <div className="vp-bar"><div className={`vp-bar-fill ${paceOver ? "over" : ""}`} style={{ width: `${paceFrac * 100}%` }} /></div>
                </div>
                <div className="vp-meter">
                  <div className="vp-meter-top">
                    <span className="vp-m-lbl"><span className="vp-m-ic">🫀</span>Patient</span>
                    <span className="vp-m-val red">{deterPct}%</span>
                  </div>
                  <div className="vp-bar"><div className="vp-bar-fill red" style={{ width: `${deterPct}%` }} /></div>
                </div>
              </div>

              <div className="vp-ct-actions">
                <button className="vp-act-btn" onClick={() => setVitalsDrawerOpen(true)}>❤️ Vitals</button>
                <button className="vp-act-btn" onClick={() => setToolsDrawerOpen(true)}>📋 Orders <span className="vp-cnt">{remainingExams > 0 ? remainingExams : ""}</span></button>
                <button className="vp-act-btn gold" onClick={openAssessment}>📝 Assess</button>
              </div>
            </header>

            <div className="vp-chat-scroll">
              <div className="vp-chat-log" ref={chatLogRef}>
                {messages.map((m, i) => (
                  <div key={i} className={`vp-bubble ${m.role === "doc" ? "doc" : "pt"}`}>
                    <span className="vp-who">{m.role === "doc" ? "YOU" : "PATIENT"}</span>
                    {m.text}
                  </div>
                ))}
                {isTyping && (
                  <div className="vp-typing"><span></span><span></span><span></span></div>
                )}
              </div>
            </div>

            <div className="vp-input-bar">
              <input
                type="text"
                placeholder="Type an assessment, question, or intervention…"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendQuestion()}
                disabled={isTyping}
              />
              <button className="vp-send-round" onClick={sendQuestion} disabled={isTyping || !chatInput.trim()}>➤</button>
            </div>
          </div>

          {/* BOTTOM SHEET: VITALS */}
          <div className={`vp-drawer-backdrop ${vitalsDrawerOpen ? "show" : ""}`} onClick={closeAllDrawers} />
          <div className={`vp-tools-drawer ${vitalsDrawerOpen ? "open" : ""}`}>
            <div className="vp-drawer-handle" />
            <div className="vp-drawer-header">
              <div className="vp-dh-icon green">🩺</div>
              <div className="vp-dh-titles">
                <div className="vp-dh-title">Live Vitals</div>
                <div className="vp-dh-sub">Telemetry{activeCase.vitalsProfile ? " · live" : ""}</div>
              </div>
              <button className="vp-drawer-close" onClick={closeAllDrawers}>✕</button>
            </div>
            <div className="vp-drawer-scroll">
              <div className="vp-vitals-hero">
                <div className="vp-vh-hr">{currentHr}</div>
                <div className="vp-vh-lbl">HEART RATE · BPM</div>
              </div>
              <div className="vp-vitals-rows">
                <div className="vp-vrow">
                  <span className="vp-vl">Condition</span>
                  <span className={`vp-vv ${patientStatus === "deteriorating" ? "bad" : "ok"}`}>
                    {patientStatus === "deteriorating" ? "Deteriorating" : patientStatus === "stabilised" ? "Stabilised" : "Stable"}
                  </span>
                </div>
                <div className="vp-vrow">
                  <span className="vp-vl">Deterioration</span>
                  <span className={`vp-vv ${deterPct > 30 ? "bad" : "ok"}`}>{deterPct}%</span>
                </div>
              </div>
              <div className="vp-panel-title">Charted Vitals</div>
              {vitalsCharted ? (
                <div className="vp-task done">
                  <div className="vp-task-ic">🩺</div>
                  <div className="vp-task-main">
                    <div className="vp-task-t">Full Vitals Charted</div>
                    <div className="vp-task-finding">{vitalsCharted.finding}</div>
                    <div className="vp-task-status ok">✓ Done</div>
                  </div>
                </div>
              ) : activeCase.exam.vitals ? (
                <div className="vp-task">
                  <div className="vp-task-ic">🩺</div>
                  <div className="vp-task-main">
                    <div className="vp-task-t">Chart Full Vitals</div>
                    <div className="vp-task-cat">Examination · BP, RR, SpO2, temp</div>
                    <div className="vp-task-status">Pending</div>
                  </div>
                  <button className="vp-task-go" onClick={() => doExam("vitals")}>Perform action</button>
                </div>
              ) : (
                <div className="vp-empty-hint">No formal vitals chart available for this case.</div>
              )}
            </div>
          </div>

          {/* BOTTOM SHEET: DOCTOR'S ORDERS */}
          <div className={`vp-drawer-backdrop ${toolsDrawerOpen ? "show" : ""}`} onClick={closeAllDrawers} />
          <div className={`vp-tools-drawer ${toolsDrawerOpen ? "open" : ""}`}>
            <div className="vp-drawer-handle" />
            <div className="vp-drawer-header">
              <div className="vp-dh-icon">📋</div>
              <div className="vp-dh-titles">
                <div className="vp-dh-title">Doctor's Orders</div>
                <div className="vp-dh-sub">{examViewed.length} exams · {invOrdered.length} tests</div>
              </div>
              <button className="vp-drawer-close" onClick={closeAllDrawers}>✕</button>
            </div>
            <div className="vp-drawer-progress">
              <span>Progress</span>
              <div className="vp-bar"><div className="vp-bar-fill" style={{ width: `${examsPct}%` }} /></div>
              <b>{examsPct}%</b>
            </div>
            <div className="vp-drawer-scroll">
              <div className="vp-panel-title">Examination</div>
              {examKeys.map(k => {
                const doneRec = examViewed.find(e => e.key === k);
                return (
                  <div key={k} className={`vp-task ${doneRec ? "done" : ""}`}>
                    <div className="vp-task-ic">{EXAM_ICONS[k] || "🩺"}</div>
                    <div className="vp-task-main">
                      <div className="vp-task-t">{EXAM_LABELS[k]}</div>
                      <div className="vp-task-cat">Examination</div>
                      {doneRec && <div className="vp-task-finding">{doneRec.finding}</div>}
                      <div className={`vp-task-status ${doneRec ? "ok" : ""}`}>{doneRec ? "✓ Done" : "Pending"}</div>
                    </div>
                    {!doneRec && <button className="vp-task-go" onClick={() => doExam(k)}>Perform action</button>}
                  </div>
                );
              })}
              <div className="vp-panel-title">Investigations</div>
              <div className="vp-chip-row">
                {INV_QUICK.map(name => (
                  <div key={name} className="vp-chip" onClick={() => orderInvestigation(name)}>{name}</div>
                ))}
              </div>
              <div className="vp-inv-custom-row">
                <input
                  type="text"
                  placeholder="Order another test…"
                  value={invCustomInput}
                  onChange={e => setInvCustomInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && orderCustomInvestigation()}
                />
                <button onClick={orderCustomInvestigation}>Order</button>
              </div>
              <div className="vp-log-list">
                {invOrdered.map((i, idx) => (
                  <div key={idx} className="vp-log-item" style={{ borderLeftColor: i.relevant ? "var(--vp-gold)" : "var(--vp-coral)" }}>
                    <b>{i.name.toUpperCase()}{i.relevant ? "" : " · LOW YIELD"}</b>{i.result}
                  </div>
                ))}
              </div>
              {invOrdered.length === 0 && <div className="vp-empty-hint">No investigations ordered yet.</div>}
            </div>
          </div>
        </div>
      )}

      {/* SCREEN 3: ASSESSMENT SHEET */}
      {screen === "assess" && activeCase && (
        <div>
          <header className="vp-glass vp-case-header">
            <div>
              <div className="vp-eyebrow" style={{ color: "var(--vp-blue)" }}>Case Assessment</div>
              <div className="vp-cc-line">"{activeCase.cc}" — {activeCase.bed}</div>
              <div className="vp-assess-meta">
                <span className={`vp-mode-badge ${isF ? "vp-mode-badge-f" : "vp-mode-badge-o"}`}>{isF ? "FOUNDATIONS" : "FULL OSCE"}</span>
                <span>Consult clock still running</span>
              </div>
            </div>
            <div className="vp-assess-head-actions">
              <button className="vp-back-btn" onClick={() => setScreen("consult")}>← Back to consult</button>
              <button className="vp-back-btn" onClick={goToSelect}>New case</button>
            </div>
          </header>

          <div className="vp-assess-grid">
            <aside className="vp-glass vp-assess-recap">
              <div className="vp-recap-sec">
                <div className="vp-panel-title" style={{ padding: "0 0 6px" }}>Consult Summary</div>
                <div className="vp-recap-kv"><span>Consult time</span><b>{timerM}:{timerS}</b></div>
                <div className="vp-recap-kv"><span>Questions asked</span><b>{questionsAsked}</b></div>
                <div className="vp-recap-kv"><span>Examinations performed</span><b>{examViewed.length}</b></div>
                <div className="vp-recap-kv"><span>Investigations ordered</span><b>{invOrdered.length}</b></div>
              </div>
              <div className="vp-recap-sec">
                <div className="vp-panel-title" style={{ padding: "0 0 2px" }}>Exam Findings</div>
                <div className="vp-recap-list">
                  {examViewed.length
                    ? examViewed.map((e, idx) => (
                      <div key={idx} className="vp-log-item"><b>{EXAM_LABELS[e.key] || e.key}</b>{e.finding}</div>
                    ))
                    : <div className="vp-recap-empty">No examinations performed yet.</div>}
                </div>
              </div>
              <div className="vp-recap-sec">
                <div className="vp-panel-title" style={{ padding: "0 0 2px" }}>Investigations</div>
                <div className="vp-recap-list">
                  {invOrdered.length
                    ? invOrdered.map((i, idx) => (
                      <div key={idx} className="vp-log-item" style={{ borderLeftColor: i.relevant ? "var(--vp-gold)" : "var(--vp-coral)" }}>
                        <b>{i.name.toUpperCase()}{i.relevant ? "" : " · LOW YIELD"}</b>{i.result}
                      </div>
                    ))
                    : <div className="vp-recap-empty">No investigations ordered yet.</div>}
                </div>
              </div>
            </aside>

            <section className="vp-glass vp-assess-sheet">
              <div className="vp-sheet-sec">
                <div className="vp-sheet-no">01</div>
                <div className="vp-sheet-sec-body">
                  {isF && (
                    <div className="vp-foundations-hint">🌱 Foundations mode: only your history-taking is scored. Fill these in for practice if you'd like — they won't affect your grade or count against you.</div>
                  )}
                  <label className="vp-field-lbl">{isF ? "Differential diagnosis (optional practice — ungraded)" : "Differential diagnosis (most likely first)"}</label>
                  <div className="vp-diff-list">
                    <div className="vp-diff-row"><span className="vp-diff-rank">1</span><input type="text" placeholder="Most likely diagnosis" value={dx1} onChange={e => { setDx1(e.target.value); debouncedSnapshot(); }} /></div>
                    <div className="vp-diff-row"><span className="vp-diff-rank">2</span><input type="text" placeholder="Optional" value={dx2} onChange={e => { setDx2(e.target.value); debouncedSnapshot(); }} /></div>
                    <div className="vp-diff-row"><span className="vp-diff-rank">3</span><input type="text" placeholder="Optional" value={dx3} onChange={e => { setDx3(e.target.value); debouncedSnapshot(); }} /></div>
                  </div>
                </div>
              </div>
              <div className="vp-sheet-sec">
                <div className="vp-sheet-no">02</div>
                <div className="vp-sheet-sec-body">
                  <label className="vp-field-lbl" style={{ display: "block" }}>{isF ? "Management plan (optional practice — ungraded)" : "Management plan"}</label>
                  <textarea
                    placeholder="What would you do next?"
                    style={{ minHeight: 110 }}
                    value={mgmt}
                    onChange={e => { setMgmt(e.target.value); debouncedSnapshot(); }}
                  />
                </div>
              </div>
              <div className="vp-sheet-submit">
                <button className="vp-submit-btn" onClick={attemptSubmit} disabled={isGrading}>
                  {isGrading ? (isF ? "Reviewing…" : "Grading…") : (isF ? "Finish history practice" : "Submit for grading")}
                </button>
                <p className="vp-submit-note">
                  {isF
                    ? "Submitting ends the consult. Only your history-taking is scored — the diagnosis and plan below are practice."
                    : "Submitting ends the consult and grades your performance."}
                </p>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* SCREEN 4: GRADING */}
      {screen === "grade" && activeCase && (
        <div>
          <div className="vp-glass vp-case-header">
            <div>
              <div className="vp-bed-tag">RESULT</div>
              <div className="vp-cc-line">Case: {activeCase.cc}</div>
            </div>
            <button className="vp-back-btn" onClick={goToSelect}>← New case</button>
          </div>

          {gradeError ? (
            <div className="vp-glass vp-grade-loading">
              <div className="vp-gl-title" style={{ color: "var(--vp-coral)" }}>Grading failed</div>
              <div className="vp-gl-sub">We tried twice but couldn't get a valid response back. Your answers are still safe — retry, or go back and adjust your consult first.</div>
              <div className="vp-grade-error-actions" style={{ width: "100%", maxWidth: 280 }}>
                <button className="vp-back-btn2" onClick={() => { setScreen("consult"); setGradeError(false); }}>Back to consult</button>
                <button className="vp-retry-btn" onClick={submitForGrading}>Retry grading</button>
              </div>
            </div>
          ) : isGrading || !grade ? (
            <div className="vp-glass vp-grade-loading">
              <div className="vp-spinner" />
              <div className="vp-gl-title">{isF ? "Reviewing your history-taking…" : "Reviewing your consult…"}</div>
              <div className="vp-gl-sub">{isF ? "Checking your questions against what a thorough history would cover." : "Checking your history, investigations, differential and management plan against the case."}</div>
            </div>
          ) : (
            <GradeScreen
              grade={grade}
              activeCase={activeCase}
              progressInfo={progressInfo}
              dxList={[dx1, dx2, dx3].filter(Boolean)}
              mgmtText={mgmt}
              examinerMessages={examinerMessages}
              isExamTyping={isExamTyping}
              examInput={examInput}
              setExamInput={setExamInput}
              askExaminer={askExaminer}
              examLogRef={examLogRef}
              onNewCase={goToSelect}
            />
          )}
        </div>
      )}

      {/* ONBOARDING WIZARD */}
      <div className={`vp-drawer-backdrop ${ob.open ? "show" : ""}`} onClick={closeOnboarding} />
      <div className={`vp-ob-sheet ${ob.open ? "open" : ""}`}>
        <div className="vp-ob-head">
          <button className="vp-ob-back" style={{ visibility: ob.step === 0 ? "hidden" : "visible" }} onClick={obBack}>←</button>
          <div className="vp-ob-dots">
            {Array.from({ length: OB_STEPS }).map((_, i) => (
              <span key={i} className={i === ob.step ? "on" : i < ob.step ? "done" : ""} />
            ))}
          </div>
          <button className="vp-ob-close" onClick={closeOnboarding}>✕</button>
        </div>
        <div className="vp-ob-body" key={ob.step}>
          {ob.step === 0 && (
            <div className="vp-ob-step">
              <div className="vp-ob-title">How should we grade you?</div>
              <div className="vp-ob-sub">Pick the style that matches where you are in training. This shapes what the examiner scores.</div>
              <div className="vp-ob-grid2">
                <button className={`vp-ob-card ${ob.mode === "foundations" ? "sel" : ""}`} onClick={() => setOb(o => ({ ...o, mode: "foundations" }))}>
                  <span className="vp-ob-emoji">🌱</span>
                  <span><span className="vp-ob-card-t">Foundations</span><span className="vp-ob-card-s">Pre-clinical · history only, no penalties</span></span>
                  <span className="vp-ob-check">✓</span>
                </button>
                <button className={`vp-ob-card ${ob.mode === "osce" ? "sel" : ""}`} onClick={() => setOb(o => ({ ...o, mode: "osce" }))}>
                  <span className="vp-ob-emoji">🩺</span>
                  <span><span className="vp-ob-card-t">Full OSCE</span><span className="vp-ob-card-s">Clinical years · all 4 domains scored</span></span>
                  <span className="vp-ob-check">✓</span>
                </button>
              </div>
            </div>
          )}
          {ob.step === 1 && (
            <div className="vp-ob-step">
              <div className="vp-ob-title">Clinical Specialty</div>
              <div className="vp-ob-sub">Choose the clinical focus for your case. We'll admit you to a random patient from this pool.</div>
              <div className="vp-ob-grid2">
                <button className={`vp-ob-card ${ob.specialty === "Any" ? "sel" : ""}`} onClick={() => setOb(o => ({ ...o, specialty: "Any", caseIdx: null }))}>
                  <span className="vp-ob-emoji">🎲</span>
                  <span><span className="vp-ob-card-t">Any specialty</span><span className="vp-ob-card-s">Surprise me — full hospital pool</span></span>
                  <span className="vp-ob-check">✓</span>
                </button>
                {specialties.filter(s => s !== "All").map(s => {
                  const m = SPECIALTY_META[s] || { icon: "🏥", tag: "Clinical cases" };
                  const n = CASES.filter(c => c.specialty === s).length;
                  return (
                    <button key={s} className={`vp-ob-card ${ob.specialty === s ? "sel" : ""}`} onClick={() => setOb(o => ({ ...o, specialty: s, caseIdx: null }))}>
                      <span className="vp-ob-emoji">{m.icon}</span>
                      <span><span className="vp-ob-card-t">{s}</span><span className="vp-ob-card-s">{m.tag} · {n} case{n === 1 ? "" : "s"}</span></span>
                      <span className="vp-ob-check">✓</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {ob.step === 2 && (
            <div className="vp-ob-step">
              <div className="vp-ob-title">Simulation Duration</div>
              <div className="vp-ob-sub">How much time do you want on the clock? Shorter sessions train quick clinical decision-making.</div>
              <div className="vp-ob-sec-lbl">Case timer · select session pace</div>
              <div className="vp-ob-pace-grid">
                {PACE_OPTIONS.map(p => (
                  <button key={p.min} className={`vp-ob-pace ${ob.pace === p.min ? "sel" : ""}`} onClick={() => setOb(o => ({ ...o, pace: p.min }))}>
                    <span className="vp-p-ic">{p.min <= 10 ? "⚡" : p.min <= 20 ? "🕐" : "⏳"}</span>
                    <div className="vp-p-num">{p.min}<small> min</small></div>
                    <div className="vp-p-lbl">{p.lbl}</div>
                    <div className="vp-p-bar"><i style={{ width: `${p.frac * 100}%` }} /></div>
                  </button>
                ))}
              </div>
            </div>
          )}
          {ob.step === 3 && briefCase && (
            <div className="vp-ob-step">
              <div className="vp-ob-title">You're on call.</div>
              <div className="vp-ob-sub">Here's your admission. Review the brief, then step in — the patient is waiting.</div>
              <div className="vp-ob-brief">
                <div className="vp-bb-eyebrow">{(SPECIALTY_META[briefCase.specialty] || { icon: "🏥" }).icon} {briefCase.specialty} · {briefCase.bed}</div>
                <div className="vp-bb-cc">"{briefCase.cc}"</div>
                <div className="vp-bb-meta">{briefCase.demo} · {ob.pace} min on the clock</div>
                <ul>
                  <li>Ask focused questions — the chat is your history.</li>
                  <li>Examine and order tests from <b>Doctor's Orders</b>.</li>
                  <li>Commit to a differential and plan on the <b>Assessment sheet</b>, then submit for grading.</li>
                </ul>
                <div className="vp-ob-chips">
                  {ob.mode === "foundations"
                    ? <><span className="vp-ob-chip g">🌱 History only</span><span className="vp-ob-chip">No penalties</span></>
                    : <><span className="vp-ob-chip b">History</span><span className="vp-ob-chip b">Investigations</span><span className="vp-ob-chip b">Diagnosis</span><span className="vp-ob-chip b">Management</span></>}
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="vp-ob-foot">
          <button className="vp-ob-cta" onClick={obNext} disabled={obCtaDisabled}>{obCtaText}</button>
          <div className="vp-ob-note">{obNoteText}</div>
        </div>
      </div>

      {/* CONFIRM MODAL */}
      <div
        className={`vp-modal-backdrop ${modal ? "show" : ""}`}
        onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
      >
        {modal && (
          <div className="vp-modal-card" role="dialog" aria-modal="true">
            <div className="vp-modal-title">{modal.title}</div>
            <div className="vp-modal-body">{modal.body}</div>
            <div className="vp-modal-actions">
              {modal.cancelText ? <button className="vp-btn-modal ghost" onClick={closeModal}>{modal.cancelText}</button> : null}
              <button
                className={`vp-btn-modal ${modal.tone === "danger" ? "danger" : "confirm"}`}
                onClick={() => { const cb = modal.onConfirm; closeModal(); if (cb) cb(); }}
              >
                {modal.confirmText}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ReviewPanel({ queue, onRate, onClose }) {
  const [current, setCurrent] = useState(0);

  if (current >= queue.length) {
    return (
      <div className="vp-glass vp-review-panel" style={{ marginBottom: 16 }}>
        <div className="vp-review-card-inner">
          <div className="vp-review-q">Nice — no more items due right now.</div>
        </div>
      </div>
    );
  }

  const item = queue[current];
  return (
    <div className="vp-glass vp-review-panel" style={{ marginBottom: 16 }}>
      <div className="vp-review-card-inner">
        <div className="vp-review-src">FROM: {item.caseDx.toUpperCase()}</div>
        <div className="vp-review-q">Did your history or plan account for:<br /><b>{item.text}</b></div>
        <div className="vp-review-actions">
          <button className="vp-still" onClick={() => { onRate(item.id, false); setCurrent(c => c + 1); }}>Still shaky</button>
          <button className="vp-got" onClick={() => { onRate(item.id, true); setCurrent(c => c + 1); }}>Got it</button>
        </div>
      </div>
    </div>
  );
}

function GradeScreen({ grade: g, activeCase, progressInfo, dxList, mgmtText, examinerMessages, isExamTyping, examInput, setExamInput, askExaminer, examLogRef, onNewCase }) {
  const isF = g.mode === "foundations";
  const idxRef = useRef(0);
  const barRefs = useRef([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      barRefs.current.forEach(el => {
        if (el) el.style.width = el.dataset.target + "%";
      });
    }, 60);
    return () => clearTimeout(timer);
  }, []);

  function nextDelay() { return (idxRef.current++) * 90; }

  function scoreBlock(label, score, feedback, extraHtml = "") {
    const delay = nextDelay();
    return (
      <div className="vp-glass vp-score-card" style={{ animationDelay: `${delay}ms` }} key={label}>
        <div className="vp-score-row">
          <div className="vp-label">{label}</div>
          <div className="vp-val" style={{ color: scoreColor(score) }}>{score}/10</div>
        </div>
        <div className="vp-bar-track">
          <div className="vp-bar-fill" data-target={score * 10} style={{ background: scoreColor(score) }} ref={el => barRefs.current.push(el)} />
        </div>
        <div className="vp-fb">{feedback}</div>
        {extraHtml}
      </div>
    );
  }

  function infoBlock(label, feedback, extraHtml = "") {
    const delay = nextDelay();
    return (
      <div className="vp-glass vp-score-card" style={{ animationDelay: `${delay}ms` }} key={label}>
        <div className="vp-score-row">
          <div className="vp-label">{label}</div>
          <div className="vp-val" style={{ color: "var(--vp-text-faint)", fontSize: 10.5, letterSpacing: ".06em" }}>NOT GRADED YET</div>
        </div>
        <div className="vp-fb" style={{ marginTop: 2 }}>{feedback}</div>
        {extraHtml}
      </div>
    );
  }

  function checklistHtml(covered, missed) {
    if (!covered.length && !missed.length) return null;
    return (
      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 4 }}>
        {covered.map((p, i) => <div key={`c${i}`} style={{ fontSize: 12.5, color: "var(--vp-green)" }}>✓ {p}</div>)}
        {missed.map((p, i) => <div key={`m${i}`} style={{ fontSize: 12.5, color: "var(--vp-text-faint)" }}>✗ {p}</div>)}
      </div>
    );
  }

  function historyExtra() {
    const total = activeCase.essential_points.length;
    return (
      <>
        <div style={{ fontSize: 12, color: "var(--vp-text-faint)", marginTop: 2 }}>
          Asked {g.questions_asked} question{g.questions_asked === 1 ? "" : "s"} to cover {g.history_covered.length}/{total} points{g.efficiency_penalty ? ` · −${g.efficiency_penalty} for over-asking` : ""}.
        </div>
        {checklistHtml(g.history_covered, g.history_missed)}
      </>
    );
  }

  function diagnosisRankNote() {
    if (g.diagnosis_rank_matched === 1) {
      return <div style={{ marginTop: 10, fontSize: 12.5, color: "var(--vp-green)" }}>✓ Correct diagnosis listed first in your differential</div>;
    } else if (g.diagnosis_rank_matched) {
      return <div style={{ marginTop: 10, fontSize: 12.5, color: "var(--vp-gold)" }}>Correct diagnosis appeared at #{g.diagnosis_rank_matched} in your differential</div>;
    }
    return <div style={{ marginTop: 10, fontSize: 12.5, color: "var(--vp-text-faint)" }}>Correct diagnosis wasn't listed in your differential</div>;
  }

  const invFeedback = g.inv_stats.totalRelevant
    ? `You ordered ${g.inv_stats.orderedRelevantCount} of ${g.inv_stats.totalRelevant} clinically relevant investigations for this presentation${g.inv_stats.irrelevantCount ? `, plus ${g.inv_stats.irrelevantCount} test${g.inv_stats.irrelevantCount > 1 ? "s" : ""} with low diagnostic yield here.` : " — nice targeting."}`
    : `No investigations were needed to reach this diagnosis.`;

  let headline, middle;

  if (isF) {
    headline = (
      <div className="vp-glass vp-overall-card" style={{ textAlign: "center", animationDelay: "0ms" }}>
        <div className="vp-panel-title" style={{ padding: 0 }}>History Taking Score</div>
        <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 44, margin: "8px 0", color: scoreColor(g.history_score) }}>
          {g.history_score}<span style={{ fontSize: 20, color: "var(--vp-text-faint)" }}> / 10</span>
        </div>
        <div className="vp-fb" style={{ textAlign: "left" }}>{g.overall_feedback}</div>
      </div>
    );
    middle = (
      <>
        {scoreBlock("History Taking", g.history_score, g.history_feedback, historyExtra())}
        {infoBlock("Investigations ordered", invFeedback)}
        {infoBlock("Diagnosis & Management", `You'll be scored on these once your clinical rotations begin. For now they're just practice — check the reveal below to see how your instinct compared to the real answer.`)}
      </>
    );
  } else {
    const avg = ((g.history_score + g.inv_score + g.diagnosis_score + g.management_score) / 4).toFixed(1);
    headline = (
      <div className="vp-glass vp-overall-card" style={{ textAlign: "center", animationDelay: "0ms" }}>
        <div className="vp-panel-title" style={{ padding: 0 }}>Overall Score</div>
        <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 44, margin: "8px 0", color: scoreColor(avg) }}>
          {avg}<span style={{ fontSize: 20, color: "var(--vp-text-faint)" }}> / 10</span>
        </div>
        <div className="vp-fb" style={{ textAlign: "left" }}>{g.overall_feedback}</div>
      </div>
    );
    middle = (
      <>
        {scoreBlock("History Taking", g.history_score, g.history_feedback, historyExtra())}
        {scoreBlock("Investigation Stewardship", g.inv_score, invFeedback)}
        {scoreBlock("Diagnosis" + (g.diagnosis_correct ? " ✓" : ""), g.diagnosis_score, g.diagnosis_feedback, diagnosisRankNote())}
        {scoreBlock("Management", g.management_score, g.management_feedback, checklistHtml(g.management_covered, g.management_missed))}
      </>
    );
  }

  return (
    <div className="vp-grade-wrap">
      {progressInfo && (
        <div className="vp-glass vp-progress-card" style={{ animationDelay: "0ms" }}>
          <div className="vp-progress-top">
            <div className="vp-progress-level">+{progressInfo.xpGained} XP{progressInfo.leveledUp ? ` · Level up! Now Level ${progressInfo.newLevel}` : ` · Level ${progressInfo.newLevel}`}</div>
            <div className="vp-progress-xp">{progressInfo.profile.xp} XP total</div>
          </div>
          {progressInfo.unlocked.length > 0 && (
            <div className="vp-progress-badges">
              {progressInfo.unlocked.map(a => <span key={a} className="vp-badge" style={{ borderColor: "var(--vp-green)", color: "var(--vp-green)", background: "rgba(62,207,142,0.12)" }}>NEW: {ACHIEVEMENT_LABELS[a] || a}</span>)}
            </div>
          )}
          {progressInfo.reviewAdded > 0 && (
            <div style={{ marginTop: 10, fontSize: 12, color: "var(--vp-text-faint)" }}>{progressInfo.reviewAdded} item{progressInfo.reviewAdded > 1 ? "s" : ""} added to your review deck.</div>
          )}
        </div>
      )}
      {headline}
      {middle}
      <div className="vp-glass vp-reveal-card" style={{ animationDelay: `${nextDelay()}ms` }}>
        <div className="vp-panel-title" style={{ padding: 0 }}>Confirmed Diagnosis</div>
        <div className="vp-dx">{activeCase.diagnosis}</div>
        <div className="vp-fb" style={{ marginTop: 12 }}>
          <b style={{ color: "var(--vp-text)" }}>Key management steps:</b>
          <ul className="vp-missed-list">{activeCase.management_key.map((m, i) => <li key={i}>{m}</li>)}</ul>
        </div>
      </div>
      <div className="vp-glass vp-exam-chat" style={{ animationDelay: `${nextDelay()}ms` }}>
        <div className="vp-panel-title">Ask the Examiner</div>
        <div className="vp-chat-log" ref={examLogRef}>
          {examinerMessages.map((m, i) => (
            <div key={i} className={`vp-bubble ${m.role === "user" ? "doc" : "pt"}`}>
              <span className="vp-who">{m.role === "user" ? "YOU" : "EXAMINER"}</span>
              {m.text}
            </div>
          ))}
          {isExamTyping && <div className="vp-typing"><span></span><span></span><span></span></div>}
        </div>
        <div className="vp-chat-input-row">
          <input
            type="text"
            placeholder="e.g. why did jaw pain matter here?"
            value={examInput}
            onChange={e => setExamInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && askExaminer()}
            disabled={isExamTyping}
          />
          <button className="vp-send-btn" onClick={askExaminer} disabled={isExamTyping || !examInput.trim()}>Ask</button>
        </div>
      </div>
      <button className="vp-again-btn" onClick={onNewCase}>Try another case</button>
    </div>
  );
}
