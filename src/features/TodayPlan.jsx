import { useEffect, useMemo, useState } from "react";
import { callAI, extractJSON as extractJSONShared } from "../lib/aiClient";
import SmartStudyInput from "../components/home/SmartStudyInput";

// Maximum days for day-by-day plan before switching to weekly
const MAX_DAILY_DAYS = 21;
// Maximum weeks allowed (to prevent JSON overflow)
const MAX_WEEKS = 8;

const BASE_STORE_KEY = "sc_study_plan_v1";

function loadPlan(userId) {
  const key = userId ? `${BASE_STORE_KEY}::${userId}` : BASE_STORE_KEY;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : { plans: {}, completed: {} };
  } catch {
    return { plans: {}, completed: {} };
  }
}

function savePlan(state, userId) {
  const key = userId ? `${BASE_STORE_KEY}::${userId}` : BASE_STORE_KEY;
  localStorage.setItem(key, JSON.stringify(state));
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

const extractJSON = (raw) => extractJSONShared(raw, "array");

export function StudyPlanGenerator({ subjects, aiConfig, onPlanCreated, userId, existingPlan }) {
  const [subjectId, setSubjectId] = useState(subjects[0]?.id || "");
  const [examDate, setExamDate] = useState("");
  const [dailyMinutes, setDailyMinutes] = useState(60);
  const [confidence, setConfidence] = useState(2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [focusAreas, setFocusAreas] = useState("");

  async function generate() {
    setError("");
    if (!subjectId || !examDate) {
      setError("Pick a subject and an exam date.");
      return;
    }
    const subject = subjects.find((s) => s.id === subjectId);
    const lessons = (subject?.lessons || []).map((l) => l.title).slice(0, 30);
    const days = Math.max(
      1,
      Math.ceil((new Date(examDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    );
    
    // Use weekly format for long durations
    const isWeekly = days > MAX_DAILY_DAYS;
    const weeksCount = Math.min(MAX_WEEKS, Math.ceil(days / 7));
    
    let prompt;
    if (isWeekly) {
      // Build explicit week list to force AI to generate all weeks
      const weekList = Array.from({length: weeksCount}, (_, i) => `{"week":${i+1},"focus":"[topic for week ${i+1}]","goals":["[goal 1]","[goal 2]"]}`).join(',\n  ');
      
      prompt = `You are an expert tutor. Create a ${weeksCount}-week study plan for ${subject?.label || "course"}.

Course topics: ${lessons.join(", ") || "general first-year content"}
${focusAreas ? `Student wants to focus on: ${focusAreas}` : ""}
Exam date: ${examDate}
Daily study time: ${dailyMinutes} minutes
Current confidence: ${confidence}/5

You MUST return a JSON array with EXACTLY ${weeksCount} weeks. Here is the EXACT format:

[
  ${weekList}
]

Replace [topic] and [goal] placeholders with actual content based on the course topics above.
Distribute topics across ${weeksCount} weeks:
- Weeks 1-${Math.ceil(weeksCount/3)}: Learn fundamentals
- Weeks ${Math.ceil(weeksCount/3)+1}-${weeksCount-1}: Advanced topics and practice
- Week ${weeksCount}: Final revision and past papers

Return ONLY the JSON array. No other text.`;
    } else {
      prompt = `You are an expert tutor for first-year university students.
Create a day-by-day study plan to prepare for the ${subject?.label || "course"} exam on ${examDate}.
Student details:
- Days remaining: ${days}
- Daily study time available: ${dailyMinutes} minutes
- Current confidence (1=lost, 5=ready): ${confidence}
- Lesson topics in this course: ${lessons.join("; ") || "general first-year content"}
${focusAreas ? `- Specific areas to focus on: ${focusAreas}` : ""}

Return ONLY a JSON array. Each item:
{"day": <1-based number>, "date": "YYYY-MM-DD", "tasks": [{"title": string, "type": "read"|"practice"|"flashcards"|"pastpaper"|"review"|"video"|"quiz", "minutes": number, "priority": "high"|"medium"|"low"}]}
Build exactly ${days} days. Front-load weak topics. Add at least one past-paper day in the final 3 days. Mix reading + practice + videos. Include rest days every 4-5 days. Keep total minutes per day at or under ${dailyMinutes}. Prioritize tasks based on importance.`;
    }
    
    try {
      setLoading(true);
      const raw = await callAI(prompt, aiConfig);
      const plan = extractJSON(raw);
      const state = loadPlan(userId);
      state.plans[subjectId] = { examDate, dailyMinutes, confidence, focusAreas, createdAt: Date.now(), days: plan, isWeekly };
      savePlan(state, userId);
      if (onPlanCreated) onPlanCreated(subjectId);
    } catch (e) {
      setError(`Could not generate plan: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="lesson-block">
      <h3>📅 Study Plan Generator</h3>
      <p className="muted">Tell me your exam date and I'll build a personalized day-by-day plan.</p>
      <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
        <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.icon} {s.label}
            </option>
          ))}
        </select>
        <input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
        <input
          type="number"
          min={15}
          max={300}
          step={15}
          value={dailyMinutes}
          onChange={(e) => setDailyMinutes(Number(e.target.value))}
          style={{ width: 110 }}
          title="Daily study minutes"
        />
        <select value={confidence} onChange={(e) => setConfidence(Number(e.target.value))}>
          <option value={1}>Confidence: 1 — Lost</option>
          <option value={2}>Confidence: 2 — Shaky</option>
          <option value={3}>Confidence: 3 — Okay</option>
          <option value={4}>Confidence: 4 — Solid</option>
          <option value={5}>Confidence: 5 — Ready</option>
        </select>
      </div>
      <div style={{ marginTop: 8 }}>
        <input
          type="text"
          placeholder="Focus areas (optional, e.g., 'mitosis, genetics')"
          value={focusAreas}
          onChange={(e) => setFocusAreas(e.target.value)}
          style={{ width: "100%", padding: 8 }}
        />
      </div>
      <button
        onClick={generate}
        disabled={loading}
        style={{ marginTop: 8, borderColor: "#2dd4a0", color: "#2dd4a0" }}
      >
        {loading ? "Building plan…" : "✨ Generate Plan"}
      </button>
      <p className="muted" style={{ fontSize: 11, marginTop: 4 }}>
        {examDate && (() => {
          const d = Math.ceil((new Date(examDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          const w = Math.ceil(d / 7);
          if (d > MAX_DAILY_DAYS) {
            return w > MAX_WEEKS 
              ? `⚠️ ${w} weeks detected - will generate ${MAX_WEEKS}-week condensed plan`
              : `Long-term plan: will generate ${w} weekly summaries`;
          }
          return "Day-by-day plan for short durations";
        })()}
      </p>
      {error && <p style={{ color: "#ff6b6b", fontSize: 13 }}>{error}</p>}
    </div>
  );
}

// Storage for saved materials
const SAVED_MATERIALS_KEY = "sc_saved_materials_v1";

function loadSavedMaterials(userId) {
  const key = userId ? `${SAVED_MATERIALS_KEY}::${userId}` : SAVED_MATERIALS_KEY;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveMaterialsToStorage(materials, userId) {
  const key = userId ? `${SAVED_MATERIALS_KEY}::${userId}` : SAVED_MATERIALS_KEY;
  const saved = loadSavedMaterials(userId);
  const newEntry = {
    id: Date.now(),
    topic: materials.topic,
    createdAt: Date.now(),
    ...materials
  };
  saved.unshift(newEntry);
  // Keep only last 20 saved materials
  const trimmed = saved.slice(0, 20);
  localStorage.setItem(key, JSON.stringify(trimmed));
  return newEntry;
}

// Study Materials Generator Component
export function StudyMaterialsGenerator({ aiConfig, subjects, onMaterialsGenerated, userId, onImportToBank }) {
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedLesson, setSelectedLesson] = useState("");
  const [customTopic, setCustomTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [materials, setMaterials] = useState(null);
  const [questionCount, setQuestionCount] = useState(10);
  const [savedList, setSavedList] = useState(loadSavedMaterials(userId));
  const [showSaved, setShowSaved] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // Quiz state
  const [quizMode, setQuizMode] = useState(false);
  const [currentQ, setCurrentQ] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState([]);
  
  // Flashcard state
  const [flashcardMode, setFlashcardMode] = useState(false);
  const [currentCard, setCurrentCard] = useState(0);
  const [showBack, setShowBack] = useState(false);

  // Get lessons for selected subject
  const selectedSubject = subjects?.find(s => s.id === selectedSubjectId);
  const lessons = selectedSubject?.lessons || [];

  // Determine the topic to use
  const topic = customTopic.trim() || selectedLesson || "";

  async function generateMaterials() {
    setError("");
    if (!topic.trim()) {
      setError("Select a topic from the dropdown or enter a custom topic.");
      return;
    }
    
    // Determine if this is a calculation-heavy subject
    const calculationSubjects = ['mathematics', 'math', 'physics', 'chemistry', 'further maths', 'further mathematics', 'statistics', 'accounting', 'economics', 'mth', 'phy', 'chm', 'gst'];
    const isCalculationSubject = calculationSubjects.some(s => 
      topic.toLowerCase().includes(s) || (selectedSubject?.label || '').toLowerCase().includes(s)
    );
    
    const prompt = `You are an expert tutor creating study materials for: "${topic}".

${isCalculationSubject ? `
CRITICAL INSTRUCTIONS FOR CALCULATION-BASED SUBJECTS:
1. Write ALL equations and formulas in PLAIN TEXT - NO LaTeX, NO special symbols
2. Use words: "squared" for ², "cubed" for ³, "divided by" for ÷, "times" for ×
3. Write fractions as "numerator/denominator" or "numerator over denominator"
4. Example: "x squared plus y squared equals r squared" instead of "x² + y² = r²"
5. Include step-by-step solutions in explanations
6. For numerical problems, show the calculation method clearly
` : `
IMPORTANT: Write clearly and concisely for 100-level university students.
`}

Return ONLY a valid JSON object with NO additional text, markdown, or code blocks:
{
  "summary": "2-3 paragraph summary explaining key concepts${isCalculationSubject ? ' and formulas' : ''}",
  "keyPoints": ["point1", "point2", "point3", "point4", "point5"],
  "questions": [
    {"q": "question text", "options": ["option A", "option B", "option C", "option D"], "answer": 0, "explanation": "step-by-step explanation${isCalculationSubject ? ' showing calculation' : ''}"}
  ],
  "flashcards": [
    {"front": "term or question", "back": "answer or definition"}
  ]
}

Generate exactly:
- 1 summary (2-3 paragraphs)
- 5 key points
- ${questionCount} multiple choice questions with 4 options each
- 5 flashcards

All text must be plain English. No special characters or symbols.`;

    try {
      setLoading(true);
      setSaveSuccess(false);
      const raw = await callAI(prompt, aiConfig);
      
      if (!raw || raw.trim().length < 10) {
        throw new Error("AI returned an empty response. Please try again.");
      }
      
      const data = extractJSONShared(raw, "object");
      
      if (!data || typeof data !== 'object') {
        throw new Error("Failed to parse AI response. Please try again with a different topic.");
      }
      
      // Validate and set defaults for missing fields
      data.summary = data.summary || "";
      data.keyPoints = Array.isArray(data.keyPoints) ? data.keyPoints : [];
      data.questions = Array.isArray(data.questions) ? data.questions : [];
      data.flashcards = Array.isArray(data.flashcards) ? data.flashcards : [];
      
      // Validate each question
      data.questions = data.questions.filter((q, i) => {
        if (!q.q || !Array.isArray(q.options) || q.options.length !== 4 || typeof q.answer !== 'number') {
          console.warn(`Invalid question at index ${i}, skipping`);
          return false;
        }
        return true;
      });
      
      if (data.questions.length === 0) {
        setError("Warning: No valid questions were generated. Try with a different topic or fewer questions.");
      }
      
      data.topic = topic;
      setMaterials(data);
      setQuizMode(false);
      setFlashcardMode(false);
      resetQuiz();
      if (onMaterialsGenerated) onMaterialsGenerated(data);
    } catch (e) {
      console.error("Material generation error:", e);
      
      let errorMessage = "Could not generate materials.";
      
      if (e.message?.includes("JSON") || e.message?.includes("parse")) {
        errorMessage = "Failed to parse AI response. The topic may be too complex. Try being more specific.";
      } else if (e.message?.includes("timeout") || e.message?.includes("ETIMEDOUT")) {
        errorMessage = "Request timed out. Please try with fewer questions or a simpler topic.";
      } else if (e.message?.includes("rate limit") || e.message?.includes("429")) {
        errorMessage = "Too many requests. Please wait a moment and try again.";
      } else if (e.message?.includes("network") || e.message?.includes("fetch")) {
        errorMessage = "Network error. Please check your internet connection.";
      } else if (e.message) {
        errorMessage = e.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  function saveMaterials() {
    if (!materials) return;
    const entry = saveMaterialsToStorage(materials, userId);
    setSavedList(loadSavedMaterials(userId));
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  }

  function loadSavedMaterial(entry) {
    setMaterials(entry);
    setQuizMode(false);
    setFlashcardMode(false);
    resetQuiz();
    setShowSaved(false);
  }

  function deleteSavedMaterial(id) {
    const key = userId ? `${SAVED_MATERIALS_KEY}::${userId}` : SAVED_MATERIALS_KEY;
    const filtered = savedList.filter(m => m.id !== id);
    localStorage.setItem(key, JSON.stringify(filtered));
    setSavedList(filtered);
  }

  function importToQuestionBank() {
    if (!materials?.questions || !onImportToBank) return;
    onImportToBank(materials.questions, materials.topic);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  }

  function resetQuiz() {
    setCurrentQ(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setScore(0);
    setAnswered([]);
  }

  function handleAnswer(idx) {
    if (showResult) return;
    setSelectedAnswer(idx);
    setShowResult(true);
    const correct = idx === materials.questions[currentQ].answer;
    if (correct) setScore(s => s + 1);
    setAnswered([...answered, { q: currentQ, selected: idx, correct }]);
  }

  function nextQuestion() {
    if (currentQ < materials.questions.length - 1) {
      setCurrentQ(currentQ + 1);
      setSelectedAnswer(null);
      setShowResult(false);
    } else {
      // Quiz complete - show results
      setQuizMode(false);
    }
  }

  function startQuiz() {
    resetQuiz();
    setQuizMode(true);
  }

  function nextCard() {
    setShowBack(false);
    if (currentCard < materials.flashcards.length - 1) {
      setCurrentCard(currentCard + 1);
    } else {
      setFlashcardMode(false);
      setCurrentCard(0);
    }
  }

  return (
    <div className="lesson-block">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h3>📚 Study Materials Generator</h3>
        {savedList.length > 0 && (
          <button onClick={() => setShowSaved(!showSaved)} style={{ fontSize: 11 }}>
            📁 Saved ({savedList.length})
          </button>
        )}
      </div>
      <p className="muted">Select a topic from your course or enter a custom topic.</p>
      
      {/* Saved Materials List */}
      {showSaved && (
        <div style={{ marginBottom: 12, padding: 8, background: "#f3f4f6", borderRadius: 6, maxHeight: 200, overflowY: "auto" }}>
          <strong style={{ fontSize: 12 }}>Saved Materials:</strong>
          {savedList.map((entry) => (
            <div key={entry.id} className="row" style={{ justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: "1px solid #e5e7eb" }}>
              <span style={{ fontSize: 12, cursor: "pointer" }} onClick={() => loadSavedMaterial(entry)}>
                {entry.topic}
              </span>
              <button onClick={() => deleteSavedMaterial(entry.id)} style={{ fontSize: 10, color: "#ef4444" }}>✕</button>
            </div>
          ))}
        </div>
      )}
      
      {/* Subject and Topic Selection */}
      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
        <div className="row" style={{ gap: 8 }}>
          <select 
            value={selectedSubjectId} 
            onChange={(e) => { setSelectedSubjectId(e.target.value); setSelectedLesson(""); }}
            style={{ flex: 1 }}
          >
            <option value="">Select Subject (optional)</option>
            {subjects?.map(s => (
              <option key={s.id} value={s.id}>{s.icon} {s.label}</option>
            ))}
          </select>
        </div>
        
        {selectedSubjectId && lessons.length > 0 && (
          <select 
            value={selectedLesson} 
            onChange={(e) => setSelectedLesson(e.target.value)}
            style={{ flex: 1 }}
          >
            <option value="">Select Topic from {selectedSubject?.label}</option>
            {lessons.map((l, i) => (
              <option key={i} value={l.title}>{l.title}</option>
            ))}
          </select>
        )}
        
        <div className="row" style={{ gap: 8 }}>
          <input
            type="text"
            placeholder={selectedSubjectId ? "Or enter custom topic..." : "Enter topic (e.g., Mitosis)"}
            value={customTopic}
            onChange={(e) => setCustomTopic(e.target.value)}
            style={{ flex: 1, padding: 8 }}
          />
          <select 
            value={questionCount} 
            onChange={(e) => setQuestionCount(Number(e.target.value))}
            style={{ width: 80 }}
            title="Number of questions"
          >
            <option value={5}>5 Qs</option>
            <option value={10}>10 Qs</option>
            <option value={15}>15 Qs</option>
          </select>
          <button
            onClick={generateMaterials}
            disabled={loading}
            style={{ borderColor: "#818cf8", color: "#818cf8" }}
          >
            {loading ? "..." : "✨"}
          </button>
        </div>
      </div>
      
      {topic && !materials && (
        <p style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
          Topic: <strong>{topic}</strong> · Questions: <strong>{questionCount}</strong>
        </p>
      )}
      
      {error && <p style={{ color: "#ff6b6b", fontSize: 13 }}>{error}</p>}
      
      {saveSuccess && (
        <p style={{ color: "#059669", fontSize: 12, marginTop: 4 }}>✓ Saved successfully!</p>
      )}
      
      {materials && (
        <div style={{ marginTop: 16 }}>
          {/* Topic header */}
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{materials.topic}</span>
            <div className="row" style={{ gap: 4 }}>
              <button onClick={saveMaterials} style={{ fontSize: 11, borderColor: "#6b7280", color: "#6b7280" }}>
                💾 Save
              </button>
              {onImportToBank && (
                <button onClick={importToQuestionBank} style={{ fontSize: 11, borderColor: "#059669", color: "#059669" }}>
                  📥 Import to Bank
                </button>
              )}
            </div>
          </div>
          
          {/* Action buttons */}
          <div className="row" style={{ gap: 8, marginBottom: 12 }}>
            <button 
              onClick={startQuiz}
              style={{ borderColor: "#059669", color: "#059669", fontSize: 13 }}
            >
              🎯 Practice MCQs ({materials.questions?.length || 0})
            </button>
            <button 
              onClick={() => { setFlashcardMode(true); setCurrentCard(0); setShowBack(false); }}
              style={{ borderColor: "#d97706", color: "#d97706", fontSize: 13 }}
            >
              🃏 Review Flashcards
            </button>
          </div>

          {/* Quiz Mode */}
          {quizMode && materials.questions && (
            <div style={{ padding: 16, background: "var(--quiz-bg, #f0fdf4)", borderRadius: 8, marginBottom: 16, border: "1px solid var(--border-color, #e5e7eb)" }}>
              <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: "var(--quiz-header, #059669)" }}>
                  Question {currentQ + 1} of {materials.questions.length}
                </span>
                <span style={{ fontSize: 12, color: "var(--quiz-header, #059669)" }}>
                  Score: {score}/{answered.length}
                </span>
              </div>
              
              <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: "var(--text-primary, #111)" }}>
                {materials.questions[currentQ].q}
              </p>
              
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {materials.questions[currentQ].options?.map((opt, j) => {
                  const isSelected = selectedAnswer === j;
                  const isCorrect = j === materials.questions[currentQ].answer;
                  let bg = "var(--option-bg, #fff)";
                  let border = "var(--border-color, #d1d5db)";
                  let textColor = "var(--text-primary, #111)";
                  if (showResult) {
                    if (isCorrect) { bg = "var(--correct-bg, #dcfce7)"; border = "var(--correct-border, #22c55e)"; textColor = "var(--correct-text, #166534)"; }
                    else if (isSelected) { bg = "var(--wrong-bg, #fee2e2)"; border = "var(--wrong-border, #ef4444)"; textColor = "var(--wrong-text, #991b1b)"; }
                  } else if (isSelected) {
                    bg = "var(--selected-bg, #e0f2fe)";
                    border = "var(--selected-border, #0ea5e9)";
                  }
                  return (
                    <button
                      key={j}
                      onClick={() => handleAnswer(j)}
                      disabled={showResult}
                      style={{
                        padding: "10px 12px",
                        background: bg,
                        border: `2px solid ${border}`,
                        borderRadius: 6,
                        textAlign: "left",
                        cursor: showResult ? "default" : "pointer",
                        fontSize: 13,
                        transition: "all 0.2s",
                        color: textColor,
                      }}
                    >
                      <strong>{String.fromCharCode(65 + j)})</strong> {opt}
                      {showResult && isCorrect && <span style={{ marginLeft: 8, color: "#16a34a" }}>✓</span>}
                      {showResult && isSelected && !isCorrect && <span style={{ marginLeft: 8, color: "#dc2626" }}>✗</span>}
                    </button>
                  );
                })}
              </div>
              
              {showResult && (
                <>
                  <p style={{ fontSize: 12, marginTop: 12, padding: 8, background: "var(--card-bg, #fff)", borderRadius: 4, color: "var(--text-primary, #111)", border: "1px solid var(--border-light, #e5e7eb)" }}>
                    💡 {materials.questions[currentQ].explanation}
                  </p>
                  <button
                    onClick={nextQuestion}
                    style={{ marginTop: 12, borderColor: "var(--quiz-header, #059669)", color: "var(--quiz-header, #059669)" }}
                  >
                    {currentQ < materials.questions.length - 1 ? "Next Question →" : "Finish Quiz"}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Flashcard Mode */}
          {flashcardMode && materials.flashcards && (
            <div style={{ marginBottom: 16 }}>
              <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: "var(--flashcard-header, #d97706)" }}>
                  Card {currentCard + 1} of {materials.flashcards.length}
                </span>
                <button onClick={() => setFlashcardMode(false)} style={{ fontSize: 11 }}>Exit</button>
              </div>
              
              <div
                onClick={() => setShowBack(!showBack)}
                style={{
                  padding: 24,
                  background: showBack ? "var(--flashcard-back, #fef3c7)" : "var(--flashcard-front, #fefce8)",
                  borderRadius: 12,
                  minHeight: 150,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  cursor: "pointer",
                  border: `2px solid var(--flashcard-border, #d97706)`,
                  fontSize: 16,
                  transition: "all 0.3s",
                  color: "var(--text-primary, #111)",
                }}
              >
                {showBack 
                  ? materials.flashcards[currentCard].back 
                  : materials.flashcards[currentCard].front
                }
              </div>
              <p className="muted" style={{ fontSize: 11, textAlign: "center", marginTop: 8 }}>
                {showBack ? "Click to see front" : "Click to flip"}
              </p>
              
              <div className="row" style={{ justifyContent: "center", gap: 8, marginTop: 12 }}>
                <button
                  onClick={() => { setShowBack(false); setCurrentCard(Math.max(0, currentCard - 1)); }}
                  disabled={currentCard === 0}
                  style={{ fontSize: 12 }}
                >
                  ← Previous
                </button>
                <button
                  onClick={nextCard}
                  style={{ borderColor: "#d97706", color: "#d97706", fontSize: 12 }}
                >
                  {currentCard < materials.flashcards.length - 1 ? "Next →" : "Finish"}
                </button>
              </div>
            </div>
          )}

          {/* Summary (hidden during quiz/flashcard mode) */}
          {!quizMode && !flashcardMode && (
            <>
              <h4 style={{ color: "var(--text-primary, #111)" }}>📝 Summary</h4>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-primary, #111)" }}>{materials.summary}</p>
              
              <h4 style={{ marginTop: 12, color: "var(--text-primary, #111)" }}>🔑 Key Points</h4>
              <ul style={{ fontSize: 13, lineHeight: 1.8, color: "var(--text-primary, #111)" }}>
                {materials.keyPoints?.map((p, i) => <li key={i} style={{ color: "var(--text-primary, #111)" }}>{p}</li>)}
              </ul>
              
              <h4 style={{ marginTop: 12, color: "var(--text-primary, #111)" }}>❓ Practice Questions</h4>
              <p style={{ fontSize: 11, color: "var(--text-secondary, #374151)" }}>Click "Practice MCQs" above to take the quiz interactively</p>
              
              <h4 style={{ marginTop: 12, color: "var(--text-primary, #111)" }}>🃏 Flashcards</h4>
              <p style={{ fontSize: 11, color: "var(--text-secondary, #374151)" }}>Click "Review Flashcards" above to practice interactively</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function TodayScreen({
  subjects,
  mastery,
  dueCards,
  history,
  stats,
  aiConfig,
  onStartSpaced,
  onStartSubject,
  onOpenTab,
  userId,
  onImportToBank,
  userName,
  onOpenAI,
  onOpenLearn,
  onOpenStudy,
}) {
  const [planState, setPlanState] = useState(loadPlan(userId));
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    setPlanState(loadPlan(userId));
  }, [refresh, userId]);

  const weakest = useMemo(() => {
    const ranked = subjects
      .map((s) => ({ s, m: mastery[s.id] ?? 0 }))
      .sort((a, b) => a.m - b.m);
    return ranked[0];
  }, [subjects, mastery]);

  const todayStr = todayKey();
  
  const todaysTasks = useMemo(() => {
    const out = [];
    for (const sid of Object.keys(planState.plans || {})) {
      const plan = planState.plans[sid];
      const subject = subjects.find((s) => s.id === sid);
      
      if (plan.isWeekly) {
        // Simplified weekly plan - show current week's goals as tasks
        const planStartDate = new Date(plan.createdAt || Date.now());
        const daysSinceStart = Math.floor((Date.now() - planStartDate.getTime()) / (1000 * 60 * 60 * 24));
        const currentWeekNum = Math.floor(daysSinceStart / 7) + 1;
        const week = (plan.days || []).find((w) => w.week === currentWeekNum);
        if (week) {
          // Convert goals to tasks for display
          (week.goals || []).forEach((goal, i) => {
            out.push({
              sid,
              subjectLabel: subject?.label || sid,
              subjectIcon: subject?.icon || "📚",
              taskIndex: i,
              title: goal,
              type: "goal",
              minutes: plan.dailyMinutes || 60,
              priority: "medium",
              weekFocus: week.focus,
            });
          });
        }
      } else {
        // Daily plan: find the day matching today
        const day = (plan.days || []).find((d) => d.date === todayStr);
        if (day) {
          for (let i = 0; i < (day.tasks || []).length; i++) {
            out.push({
              sid,
              subjectLabel: subject?.label || sid,
              subjectIcon: subject?.icon || "📚",
              taskIndex: i,
              ...day.tasks[i],
            });
          }
        }
      }
    }
    return out;
  }, [planState, subjects, todayStr]);

  function toggleDone(sid, taskIndex) {
    const state = loadPlan(userId);
    const k = `${todayStr}:${sid}:${taskIndex}`;
    state.completed[k] = !state.completed[k];
    savePlan(state, userId);
    setRefresh((r) => r + 1);
  }

  function isDone(sid, taskIndex) {
    return !!planState.completed[`${todayStr}:${sid}:${taskIndex}`];
  }

  function deletePlan(sid) {
    if (!confirm("Delete this study plan?")) return;
    const state = loadPlan(userId);
    delete state.plans[sid];
    savePlan(state, userId);
    setRefresh((r) => r + 1);
  }

  const planSubjectIds = Object.keys(planState.plans || {});
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  const statCards = [
    { icon:"🔥", label:"Streak",   value:`${stats?.streak ?? 0}d`,   color:"#ff7043", bg:"#1a0a00", border:"#4a1800" },
    { icon:"⚡", label:"XP",       value:stats?.xp ?? 0,             color:"#ffd54f", bg:"#1a1500", border:"#4a3a00" },
    { icon:"🧠", label:"Due",      value:dueCards?.length ?? 0,      color:"#80cbc4", bg:"#001a18", border:"#004a44" },
    { icon:"📚", label:"Sessions", value:stats?.sessions ?? 0,       color:"#9fa8da", bg:"#080d2a", border:"#1a2a6a" },
  ];

  return (
    <div style={{ fontFamily:"Manrope, sans-serif" }}>
      {/* ── Header ── */}
      <div style={{
        background:"linear-gradient(135deg,#0d0f22 0%,#090b1a 100%)",
        border:"0.5px solid #1e2140", borderRadius:16,
        padding:"16px 18px 14px", marginBottom:14, position:"relative", overflow:"hidden",
      }}>
        <div style={{ position:"absolute",top:-30,right:-20,width:140,height:140,borderRadius:"50%",background:"#1a237e",opacity:0.12,pointerEvents:"none" }} />
        <div style={{ fontSize:11,fontWeight:600,color:"#3949ab",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:4,fontFamily:"Syne,sans-serif" }}>
          {new Date().toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"})}
        </div>
        <div style={{ fontSize:20,fontWeight:800,color:"#e8eaf6",fontFamily:"Syne,sans-serif",lineHeight:1.2 }}>
          {greeting}, {userName || "Scholar"} 👋
        </div>
        <div style={{ fontSize:12,color:"#7b82b8",marginTop:4 }}>Ready to study? Let's go.</div>
      </div>

      {/* ── Stat pills ── */}
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:14 }}>
        {statCards.map(sc => (
          <div key={sc.label} style={{
            background:sc.bg, border:`0.5px solid ${sc.border}`,
            borderRadius:12, padding:"10px 10px 8px", textAlign:"center",
          }}>
            <div style={{ fontSize:16,marginBottom:3 }}>{sc.icon}</div>
            <div style={{ fontSize:15,fontWeight:800,color:sc.color,lineHeight:1 }}>{sc.value}</div>
            <div style={{ fontSize:9,color:"#4a5080",marginTop:3,fontWeight:600,letterSpacing:"0.05em",textTransform:"uppercase" }}>{sc.label}</div>
          </div>
        ))}
      </div>

      {/* ── What to do right now ── */}
      {(() => {
        const firstIncomplete = todaysTasks.find((t, i) => !isDone(t.sid, t.taskIndex));
        let action = null;
        if (dueCards?.length > 0) {
          action = { icon:"🧠", color:"#80cbc4", bg:"#001a18", border:"#004a44", label:"Review overdue cards", desc:`${dueCards.length} flashcard${dueCards.length > 1 ? "s" : ""} due for spaced repetition`, onClick: onStartSpaced };
        } else if (weakest?.m !== undefined && weakest.m < 50 && weakest.s) {
          action = { icon:"🎯", color:"#ffd54f", bg:"#1a1500", border:"#4a3a00", label:`Boost ${weakest.s.label}`, desc:`Only ${weakest.m}% mastery — needs your attention`, onClick: () => onStartSubject?.(weakest.s.id) };
        } else if (firstIncomplete) {
          action = { icon:"📅", color:"#9fa8da", bg:"#080d2a", border:"#1a2a6a", label:firstIncomplete.title, desc:`${firstIncomplete.type} · ${firstIncomplete.minutes} min · ${firstIncomplete.subjectLabel}`, onClick: () => onOpenTab?.("plan") };
        } else {
          action = { icon:"✨", color:"#ce93d8", bg:"#120a1a", border:"#3a1a4a", label:"Start a study session", desc:"Pick a subject or use Guided Study", onClick: () => onOpenStudy?.("") };
        }
        return (
          <div onClick={action.onClick} style={{
            background: action.bg, border:`0.5px solid ${action.border}`, borderRadius:14,
            padding:"12px 14px", marginBottom:14, display:"flex", alignItems:"center", gap:12, cursor:"pointer",
            transition:"opacity 0.15s",
          }}>
            <div style={{ fontSize:24, flexShrink:0 }}>{action.icon}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:10, fontWeight:700, color:action.color, letterSpacing:"0.07em", textTransform:"uppercase", marginBottom:2 }}>What to do right now</div>
              <div style={{ fontSize:13, fontWeight:700, color:"#e8eaf6", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{action.label}</div>
              <div style={{ fontSize:11, color:"#7b82b8", marginTop:2 }}>{action.desc}</div>
            </div>
            <div style={{ fontSize:16, color:action.color, flexShrink:0 }}>›</div>
          </div>
        );
      })()}

      <SmartStudyInput
        onOpenStudy={(topic, mode, attachment) => onOpenStudy?.(topic, mode, attachment)}
        onOpenLearn={() => onOpenLearn?.()}
      />

      {/* ── Quick actions ── */}
      <div style={{ marginTop:14,marginBottom:4 }}>
        <div style={{ fontSize:11,fontWeight:700,color:"#3949ab",letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:9,fontFamily:"Syne,sans-serif" }}>Quick Actions</div>
        <div style={{ display:"flex",gap:7,flexWrap:"wrap" }}>
          {dueCards?.length > 0 && (
            <button onClick={onStartSpaced} style={{
              display:"inline-flex",alignItems:"center",gap:6,padding:"7px 13px",borderRadius:20,
              background:"#001a10",border:"0.5px solid #1a4a30",color:"#81c784",
              fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"Manrope,sans-serif",
            }}>🧠 Review {dueCards.length} cards</button>
          )}
          {weakest?.s && (
            <button onClick={() => onStartSubject(weakest.s.id)} style={{
              display:"inline-flex",alignItems:"center",gap:6,padding:"7px 13px",borderRadius:20,
              background:"#1a1500",border:"0.5px solid #4a3a00",color:"#ffd54f",
              fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"Manrope,sans-serif",
            }}>🎯 Boost {weakest.s.label} ({weakest.m}%)</button>
          )}
          <button onClick={() => onOpenTab("bank")} style={{
            display:"inline-flex",alignItems:"center",gap:6,padding:"7px 13px",borderRadius:20,
            background:"#0a0c1e",border:"0.5px solid #2a2d4a",color:"#9fa8da",
            fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"Manrope,sans-serif",
          }}>📝 Past papers</button>
          <button onClick={() => onOpenTab("lectures")} style={{
            display:"inline-flex",alignItems:"center",gap:6,padding:"7px 13px",borderRadius:20,
            background:"#0a0c1e",border:"0.5px solid #2a2d4a",color:"#9fa8da",
            fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"Manrope,sans-serif",
          }}>🎧 Lecture notes</button>
        </div>
      </div>

      <h3 style={{ marginTop: 18 }}>📅 Today's plan</h3>
      {todaysTasks.length === 0 ? (
        <p className="muted">No tasks for today. Generate a study plan below.</p>
      ) : (
        <ul className="plan-tasks">
          {todaysTasks.map((t, i) => {
            const done = isDone(t.sid, t.taskIndex);
            const priorityColor = t.priority === "high" ? "#ff6b6b" : t.priority === "medium" ? "#facc15" : "#4ade80";
            return (
              <li key={i} className={`plan-task ${done ? "done" : ""}`}>
                <label>
                  <input type="checkbox" checked={done} onChange={() => toggleDone(t.sid, t.taskIndex)} />
                  <span className="task-title">
                    {t.subjectIcon} <strong>{t.title}</strong>
                    {t.priority && (
                      <span style={{ 
                        marginLeft: 8, 
                        fontSize: 10, 
                        padding: "2px 6px", 
                        borderRadius: 4, 
                        background: priorityColor + "20", 
                        color: priorityColor,
                        fontWeight: 600
                      }}>
                        {t.priority.toUpperCase()}
                      </span>
                    )}
                  </span>
                  <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>
                    {t.type} · {t.minutes} min · {t.subjectLabel}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      <StudyPlanGenerator subjects={subjects} aiConfig={aiConfig} onPlanCreated={() => setRefresh((r) => r + 1)} userId={userId} />

      {planSubjectIds.length > 0 && (
        <>
          <h3 style={{ marginTop: 18 }}>Active plans</h3>
          {planSubjectIds.map((sid) => {
            const plan = planState.plans[sid];
            const subject = subjects.find((s) => s.id === sid);
            const completedTasks = Object.keys(planState.completed || {}).filter(k => k.startsWith(`${todayStr}:`)).length;
            const progress = Math.round((completedTasks / (todaysTasks.length || 1)) * 100);
            
            // Calculate totals differently for weekly vs daily
            let totalTasks, upcoming;
            if (plan.isWeekly) {
              totalTasks = (plan.days || []).reduce((sum, w) => sum + (w.goals?.length || 0), 0);
              upcoming = (plan.days || []).slice(0, 3);
            } else {
              totalTasks = (plan.days || []).reduce((sum, d) => sum + (d.tasks?.length || 0), 0);
              upcoming = (plan.days || []).filter((d) => d.date >= todayStr).slice(0, 5);
            }
            
            return (
              <div key={sid} className="lesson-block" style={{ 
                background: "var(--card-bg, #fff)", 
                border: "1px solid var(--border-color, #e5e7eb)",
                borderRadius: 8 
              }}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ color: "var(--text-primary, #111)" }}>
                    {subject?.icon} {subject?.label} — exam {fmtDate(plan.examDate)}
                    {plan.isWeekly && <span style={{ 
                      color: "var(--accent-color, #6366f1)", 
                      background: "var(--accent-bg, rgba(99, 102, 241, 0.1))",
                      padding: "2px 8px",
                      borderRadius: 4,
                      marginLeft: 8,
                      fontSize: 11
                    }}>Weekly Plan</span>}
                  </strong>
                  <div className="row" style={{ gap: 8 }}>
                    <button onClick={() => deletePlan(sid)} style={{ fontSize: 12 }}>
                      Delete
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: 12, marginTop: 4, color: "var(--text-secondary, #374151)" }}>
                  {plan.isWeekly 
                    ? `${plan.days?.length || 0} weeks · ${totalTasks} goals`
                    : `${plan.days?.length || 0} days · ${totalTasks} tasks`
                  }
                  · Confidence: {plan.confidence || "N/A"}
                  {plan.focusAreas && ` · Focus: ${plan.focusAreas}`}
                </div>
                <div style={{ marginTop: 8, background: "var(--progress-bg, #e5e7eb)", borderRadius: 4, height: 6, overflow: "hidden" }}>
                  <div style={{ 
                    width: `${progress}%`, 
                    background: progress >= 80 ? "#16a34a" : progress >= 50 ? "#ca8a04" : "#2563eb", 
                    height: "100%", 
                    transition: "width 0.3s" 
                  }} />
                </div>
                <p style={{ fontSize: 11, marginTop: 4, color: "var(--text-secondary, #374151)" }}>
                  Today's progress: {completedTasks}/{todaysTasks.length} tasks completed ({progress}%)
                </p>
                <ul style={{ marginTop: 8, listStyle: "none", padding: 0, margin: 0 }}>
                  {plan.isWeekly ? (
                    upcoming.map((w, i) => (
                      <li key={i} style={{ 
                        padding: "8px 12px", 
                        marginBottom: 6, 
                        background: "var(--item-bg, #f3f4f6)", 
                        borderRadius: 6,
                        border: "1px solid var(--border-light, #e5e7eb)"
                      }}>
                        <div style={{ 
                          fontSize: 12, 
                          fontWeight: 600, 
                          color: "var(--text-primary, #111)",
                          marginBottom: 4
                        }}>
                          Week {w.week}: <span style={{ color: "var(--accent-color, #6366f1)" }}>{w.focus || "General review"}</span>
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-secondary, #374151)" }}>
                          Goals: {(w.goals || []).join(" · ") || "—"}
                        </div>
                      </li>
                    ))
                  ) : (
                    upcoming.map((d, i) => (
                      <li key={i} style={{ 
                        padding: "8px 12px", 
                        marginBottom: 6, 
                        background: "var(--item-bg, #f3f4f6)", 
                        borderRadius: 6,
                        border: "1px solid var(--border-light, #e5e7eb)"
                      }}>
                        <span style={{ color: "var(--text-muted, #6b7280)", fontSize: 11 }}>{fmtDate(d.date)}:</span>{" "}
                        <span style={{ color: "var(--text-primary, #111)", fontSize: 12 }}>
                          {(d.tasks || []).map((t) => t.title).join(" · ") || "—"}
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
