import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { callAIChat, extractJSON } from "../../lib/aiClient";
import { CASES, EXAM_LABELS, INV_QUICK, ACHIEVEMENT_LABELS, DEFAULT_PROFILE } from "./caseData";
import "./virtualPatient.css";

const ACTIVE_CONSULT_KEY = "scc_active_consult";
const GAME_MODE_KEY = "scc_game_mode";
const CLINICAL_PROFILE_KEY = "scc_clinical_profile";

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
  const [saveIndicator, setSaveIndicator] = useState(false);

  // Refs
  const startTimeRef = useRef(Date.now());
  const timerIntervalRef = useRef(null);
  const stabilizedAtSecRef = useRef(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [currentHr, setCurrentHr] = useState(88);
  const [vitalAlert, setVitalAlert] = useState("");
  const [monitorDeteriorating, setMonitorDeteriorating] = useState(false);
  const chatLogRef = useRef(null);
  const examLogRef = useRef(null);
  const snapshotTimerRef = useRef(null);
  const saveIndicatorTimerRef = useRef(null);

  const specialties = useMemo(() => ["All", ...Array.from(new Set(CASES.map(c => c.specialty)))], []);
  const filteredIndices = useMemo(() =>
    CASES.map((c, i) => i).filter(i => specialtyFilter === "All" || CASES[i].specialty === specialtyFilter),
    [specialtyFilter]
  );

  const dueItems = useMemo(() => getDueItems(profile), [profile]);

  // Load resume snapshot on mount
  useEffect(() => {
    const snap = loadLocal(getStorageKey(ACTIVE_CONSULT_KEY), null);
    if (snap && CASES[snap.caseIndex]) {
      setResumeSnapshot(snap);
    }
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    if (chatLogRef.current) chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
  }, [messages, isTyping]);

  useEffect(() => {
    if (examLogRef.current) examLogRef.current.scrollTop = examLogRef.current.scrollHeight;
  }, [examinerMessages, isExamTyping]);

  // Timer tick
  useEffect(() => {
    if (screen !== "consult") {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      return;
    }
    timerIntervalRef.current = setInterval(() => {
      const secs = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsedSec(secs);
      // Update vitals
      updateVitals(secs);
      // Auto-snapshot every 15s
      if (secs > 0 && secs % 15 === 0) doSnapshot();
    }, 1000);
    return () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  function updateVitals(secs) {
    const vp = activeCase?.vitalsProfile;
    if (!vp) {
      setCurrentHr(88);
      setVitalAlert("");
      setMonitorDeteriorating(false);
      return;
    }
    if (stabilizedAtSecRef.current == null) {
      const key = (vp.stabilizing_action || "").toLowerCase();
      const done = invOrdered.some(i => i.name.toLowerCase() === key);
      if (done) stabilizedAtSecRef.current = secs;
    }
    const anchorSecs = stabilizedAtSecRef.current != null ? stabilizedAtSecRef.current : secs;
    const span = Math.max(1, vp.decompensate_full - vp.decompensate_start);
    const t = Math.min(1, Math.max(0, (anchorSecs - vp.decompensate_start) / span));
    const jitter = Math.floor(Math.random() * 5) - 2;
    const hr = Math.round(vp.baseline_hr + (vp.critical_hr - vp.baseline_hr) * t) + jitter;
    setCurrentHr(hr);

    const deteriorating = t > 0.05 && stabilizedAtSecRef.current == null;
    const recognizedRecently = stabilizedAtSecRef.current != null && (secs - stabilizedAtSecRef.current) < 6;
    setMonitorDeteriorating(deteriorating);
    if (deteriorating) setVitalAlert("⚠ DETERIORATING");
    else if (recognizedRecently) setVitalAlert("✓ RECOGNIZED");
    else setVitalAlert("");
  }

  function doSnapshot() {
    if (!activeCase) return;
    const idx = CASES.indexOf(activeCase);
    if (idx < 0) return;
    const snap = {
      caseIndex: idx,
      mode: gameMode,
      messages,
      examinerMessages,
      invOrdered,
      examViewed,
      elapsedMs: Date.now() - startTimeRef.current,
      stabilizedElapsedMs: stabilizedAtSecRef.current != null ? stabilizedAtSecRef.current * 1000 : null,
      dx1, dx2, dx3, mgmt,
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
    stabilizedAtSecRef.current = null;
    startTimeRef.current = Date.now();
    setElapsedSec(0);
    setScreen("consult");
    setTimeout(doSnapshot, 100);
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
    stabilizedAtSecRef.current = snap.stabilizedElapsedMs != null ? Math.floor(snap.stabilizedElapsedMs / 1000) : null;
    startTimeRef.current = Date.now() - (snap.elapsedMs || 0);
    setResumeSnapshot(null);
    setScreen("consult");
  }

  function discardResume() {
    clearActiveSnapshot();
    setResumeSnapshot(null);
  }

  function goToSelect() {
    setScreen("select");
    setToolsDrawerOpen(false);
    setVitalAlert("");
    setMonitorDeteriorating(false);
    clearActiveSnapshot();
  }

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

  function doExam(key) {
    const finding = activeCase.exam[key] || "Nothing significant found on this examination.";
    setExamViewed(prev => [...prev, { key, finding }]);
    setMessages(prev => [...prev, { role: "doc", text: `[Examines: ${EXAM_LABELS[key]}]` }, { role: "pt", text: finding }]);
    debouncedSnapshot();
  }

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

  async function submitForGrading() {
    const isF = gameMode === "foundations";
    const questionsAsked = messages.filter(m => m.role === "doc").length;

    if (isF) {
      if (questionsAsked < 1) {
        alert("Ask the patient at least one question before finishing this practice round.");
        return;
      }
    } else if (!dx1.trim() || !mgmt.trim()) {
      alert("Please enter at least your top diagnosis and a management plan before submitting.");
      return;
    }

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

  const isF = gameMode === "foundations";
  const timerM = String(Math.floor(elapsedSec / 60)).padStart(2, "0");
  const timerS = String(elapsedSec % 60).padStart(2, "0");
  const examChips = activeCase ? Object.keys(EXAM_LABELS).filter(k => activeCase.exam[k]) : [];

  return (
    <div className="vp-root">
      {/* Monitor strip */}
      <div className={`vp-monitor ${monitorDeteriorating ? "deteriorating" : ""}`}>
        <div className="vp-brand">Scholar's <span>Circle</span><span className="long"> — Clinical Challenge</span></div>
        <div className="vp-ecg-wrap">
          <svg viewBox="0 0 600 34" preserveAspectRatio="none">
            <polyline fill="none" stroke="#3ECF8E" strokeWidth="1.6" points="0,17 40,17 50,17 55,4 60,30 65,10 70,17 140,17 180,17 190,17 195,4 200,30 205,10 210,17 300,17 340,17 350,17 355,4 360,30 365,10 370,17 440,17 480,17 490,17 495,4 500,30 505,10 510,17 600,17" opacity="0.85" />
          </svg>
        </div>
        <div className={`vp-vital-alert ${vitalAlert ? "show" : ""}`}>{vitalAlert}</div>
        <div className={`vp-save-indicator ${saveIndicator ? "show" : ""}`}>✓ saved</div>
        <div className="vp-vital"><span className="vp-num">{currentHr}</span><span className="vp-lbl">HR BPM</span></div>
        <div className="vp-vital"><span className="vp-timer-num">{timerM}:{timerS}</span><span className="vp-timer-lbl">CONSULT TIME</span></div>
      </div>

      {/* SCREEN 1: CASE SELECT */}
      {screen === "select" && (
        <div>
          <div className="vp-hero">
            <div className="vp-eyebrow">AI Clinical Challenge</div>
            <h1>Meet your patient.</h1>
            <p className="vp-sub">Take a history, examine, order investigations, then commit to a diagnosis and a management plan. You'll be graded on all four — the way an OSCE examiner would.</p>
          </div>

          <div className="vp-mode-select-row">
            <div className="vp-mode-select-label">Mode</div>
            <div className="vp-mode-toggle">
              <button className={`vp-mode-btn ${isF ? "active" : ""}`} onClick={() => saveGameMode("foundations")}>
                🌱 Foundations<span className="vp-mode-sub">Pre-clinical · history only, no penalties</span>
              </button>
              <button className={`vp-mode-btn ${!isF ? "active" : ""}`} onClick={() => saveGameMode("osce")}>
                🩺 Full OSCE<span className="vp-mode-sub">Clinical years · all 4 domains scored</span>
              </button>
            </div>
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

          {filteredIndices.length > 0 && (
            <button className="vp-glass vp-chip vp-random-btn" style={{ padding: "12px 18px", fontSize: 13 }} onClick={() => startCase(filteredIndices[Math.floor(Math.random() * filteredIndices.length)])}>
              🎲 Random case
            </button>
          )}
        </div>
      )}

      {/* SCREEN 2: CONSULT */}
      {screen === "consult" && activeCase && (
        <div>
          <div className="vp-glass vp-case-header">
            <div>
              <div className="vp-bed-tag">{activeCase.bed}</div>
              <span className={`vp-mode-badge ${isF ? "vp-mode-badge-f" : "vp-mode-badge-o"}`}>{isF ? "FOUNDATIONS" : "FULL OSCE"}</span>
              <div className="vp-cc-line">"{activeCase.cc}"</div>
            </div>
            <button className="vp-back-btn" onClick={goToSelect}>← New case</button>
          </div>

          <div className="vp-consult-grid">
            {/* Chat */}
            <div className="vp-glass vp-chat-panel">
              <div className="vp-panel-title">History Taking</div>
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
              <div className="vp-chat-input-row">
                <input
                  type="text"
                  placeholder="Ask the patient a question…"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && sendQuestion()}
                  disabled={isTyping}
                />
                <button className="vp-send-btn" onClick={sendQuestion} disabled={isTyping || !chatInput.trim()}>Ask</button>
              </div>
            </div>

            {/* Tools */}
            <div className="vp-glass vp-tools-panel">
              <div className="vp-tool-block">
                <div className="vp-panel-title" style={{ padding: "14px 18px 8px" }}>Clinical Tools</div>
                <div style={{ padding: "0 18px" }}>
                  <button className="vp-tools-trigger-btn" onClick={() => setToolsDrawerOpen(true)}>
                    <span className="vp-ttb-label">🩺 Examine &amp; Order Tests</span>
                    <span className="vp-tools-trigger-badge">
                      {examViewed.length > 0 || invOrdered.length > 0
                        ? `${examViewed.length} exam${examViewed.length > 1 ? "s" : ""}${examViewed.length > 0 && invOrdered.length > 0 ? " · " : ""}${invOrdered.length > 0 ? `${invOrdered.length} test${invOrdered.length > 1 ? "s" : ""}` : ""}`
                        : ""}
                    </span>
                  </button>
                </div>
              </div>
              <div className="vp-diagnose-block">
                <div className="vp-panel-title" style={{ padding: "0 0 6px" }}>Diagnosis &amp; Management</div>
                {isF && (
                  <div className="vp-foundations-hint">🌱 Foundations mode: only your history-taking is scored. Fill these in for practice if you'd like — they won't affect your grade or count against you.</div>
                )}
                <label className="vp-field-lbl">{isF ? "Differential diagnosis (optional practice — ungraded)" : "Differential diagnosis (most likely first)"}</label>
                <div className="vp-diff-list">
                  <div className="vp-diff-row"><span className="vp-diff-rank">1</span><input type="text" placeholder="Most likely diagnosis" value={dx1} onChange={e => { setDx1(e.target.value); debouncedSnapshot(); }} /></div>
                  <div className="vp-diff-row"><span className="vp-diff-rank">2</span><input type="text" placeholder="Optional" value={dx2} onChange={e => { setDx2(e.target.value); debouncedSnapshot(); }} /></div>
                  <div className="vp-diff-row"><span className="vp-diff-rank">3</span><input type="text" placeholder="Optional" value={dx3} onChange={e => { setDx3(e.target.value); debouncedSnapshot(); }} /></div>
                </div>
                <label className="vp-field-lbl" style={{ marginTop: 12, display: "block" }}>{isF ? "Management plan (optional practice — ungraded)" : "Management plan"}</label>
                <textarea placeholder="What would you do next?" style={{ minHeight: 80 }} value={mgmt} onChange={e => { setMgmt(e.target.value); debouncedSnapshot(); }} />
                <button className="vp-submit-btn" onClick={submitForGrading} disabled={isGrading}>
                  {isGrading ? (isF ? "Reviewing…" : "Grading…") : (isF ? "Finish history practice" : "Submit for grading")}
                </button>
              </div>
            </div>
          </div>

          {/* Tools drawer */}
          <div className={`vp-drawer-backdrop ${toolsDrawerOpen ? "show" : ""}`} onClick={() => setToolsDrawerOpen(false)} />
          <div className={`vp-tools-drawer ${toolsDrawerOpen ? "open" : ""}`}>
            <div className="vp-drawer-handle" />
            <div className="vp-drawer-header">
              <div className="vp-panel-title">Clinical Tools</div>
              <button className="vp-drawer-close" onClick={() => setToolsDrawerOpen(false)}>✕</button>
            </div>
            <div className="vp-drawer-scroll">
              <div className="vp-tool-block">
                <div className="vp-panel-title">Examine</div>
                <div className="vp-chip-row">
                  {examChips.map(k => (
                    <div key={k} className="vp-chip" onClick={() => doExam(k)}>{EXAM_LABELS[k]}</div>
                  ))}
                </div>
              </div>
              <div className="vp-tool-block">
                <div className="vp-panel-title">Investigations</div>
                <div className="vp-chip-row">
                  {INV_QUICK.map(name => (
                    <div key={name} className="vp-chip" onClick={() => orderInvestigation(name)}>{name}</div>
                  ))}
                </div>
                <div className="vp-inv-custom-row">
                  <input type="text" placeholder="Order another test…" value={invCustomInput} onChange={e => setInvCustomInput(e.target.value)} onKeyDown={e => e.key === "Enter" && orderCustomInvestigation()} />
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
        </div>
      )}

      {/* SCREEN 3: GRADING */}
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
  const [cardIndex, setCardIndex] = useState(0);
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
