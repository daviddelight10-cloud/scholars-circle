import { useState } from "react";
import { callAI, extractJSON as extractJSONShared } from "../lib/aiClient";
import { jsPDF } from "jspdf";

const STORE_KEY = "sc_ai_study_assistant_v1";
const SUBJECTS_KEY = "sc_custom_subjects_v1";

function loadDocuments() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveDocuments(list) {
  localStorage.setItem(STORE_KEY, JSON.stringify(list));
}

function loadCustomSubjects() {
  try {
    const raw = localStorage.getItem(SUBJECTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCustomSubjects(list) {
  localStorage.setItem(SUBJECTS_KEY, JSON.stringify(list));
}

const extractJSON = (raw) => extractJSONShared(raw, "object");

export function AIStudyAssistant({ subjects, onImportQuestions, demoMode, demoUsage, setDemoUsage }) {
  const [customSubjects, setCustomSubjects] = useState(loadCustomSubjects());
  const [allSubjects, setAllSubjects] = useState([...subjects, ...loadCustomSubjects()]);
  
  const [selectedSubjectId, setSelectedSubjectId] = useState(allSubjects[0]?.id || "");
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectIcon, setNewSubjectIcon] = useState("📚");
  
  const [uploadedFile, setUploadedFile] = useState(null);
  const [extractedText, setExtractedText] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  
  const [difficulty, setDifficulty] = useState("medium");
  const [questionCount, setQuestionCount] = useState(20);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  
  const [savedDocuments, setSavedDocuments] = useState(loadDocuments());
  const [activeTab, setActiveTab] = useState("upload"); // upload, results, saved, practice
  
  const [practiceMode, setPracticeMode] = useState(null); // null, "mcq", "flashcard"
  const [practiceDoc, setPracticeDoc] = useState(null); // which doc/saved item to practice
  const [mcqIndex, setMcqIndex] = useState(0);
  const [mcqSelected, setMcqSelected] = useState(null);
  const [mcqScore, setMcqScore] = useState(0);
  const [mcqShowResult, setMcqShowResult] = useState(false);
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [flashcardFlipped, setFlashcardFlipped] = useState(false);

  async function extractTextFromFile(file) {
    setIsExtracting(true);
    setError("");
    
    try {
      if (file.type === 'application/pdf') {
        // Load PDF.js from CDN dynamically
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        script.type = 'text/javascript';
        
        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
        
        const pdfjsLib = window.pdfjsLib;
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        
        let fullText = "";
        const totalPages = pdf.numPages;
        
        for (let i = 1; i <= totalPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => item.str).join(' ');
          fullText += pageText + '\n';
        }
        
        setExtractedText(fullText);
      } else if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
        const text = await file.text();
        setExtractedText(text);
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.endsWith('.docx')) {
        setError('DOCX support requires mammoth.js library. Please convert to PDF or TXT for now.');
      } else {
        setError('Unsupported file type. Please upload PDF, TXT, or DOCX files.');
      }
      
      setUploadedFile(file);
    } catch (e) {
      console.error('File extraction error:', e);
      setError(`Failed to extract text: ${e.message || 'Unknown error'}`);
    } finally {
      setIsExtracting(false);
    }
  }

  function handleFileUpload(e) {
    const file = e.target.files[0];
    if (file) {
      extractTextFromFile(file);
    }
  }

  function handleCreateSubject() {
    if (!newSubjectName.trim()) {
      setError("Please enter a subject name");
      return;
    }
    
    const newSubject = {
      id: `custom_${Date.now()}`,
      label: newSubjectName,
      icon: newSubjectIcon,
      isCustom: true
    };
    
    const updatedSubjects = [...customSubjects, newSubject];
    setCustomSubjects(updatedSubjects);
    saveCustomSubjects(updatedSubjects);
    setAllSubjects([...subjects, ...updatedSubjects]);
    setSelectedSubjectId(newSubject.id);
    setNewSubjectName("");
    setError("");
  }

  async function processContent() {
    setError("");
    setResult(null);
    
    if (!extractedText.trim()) {
      setError("Please upload a file and extract text first.");
      return;
    }
    
    const subject = allSubjects.find((s) => s.id === selectedSubjectId);
    
    // Limit content length to 12000 characters
    const maxLength = 12000;
    const content = extractedText.length > maxLength 
      ? extractedText.slice(0, maxLength) + "\n...[content truncated for processing]"
      : extractedText;
    
    // Determine if this is a calculation-heavy subject (math, physics, chemistry)
    const calculationSubjects = ['mathematics', 'math', 'physics', 'chemistry', 'further maths', 'further mathematics', 'statistics', 'accounting', 'economics'];
    const isCalculationSubject = calculationSubjects.some(s => 
      (subject?.label || '').toLowerCase().includes(s)
    );
    
    const actualQuestionCount = Math.min(questionCount, 100);
    
    const prompt = `You are an expert study assistant. Create comprehensive study materials from this content for ${subject?.label || "a course"}.

IMPORTANT INSTRUCTIONS:
1. Return ONLY valid JSON. No markdown, no code blocks, no extra text before or after.
2. Generate exactly ${actualQuestionCount} MCQ questions.
3. ${isCalculationSubject ? `This is a calculation-based subject. Include questions with formulas, numerical problems, and step-by-step solutions in explanations.` : 'Focus on conceptual understanding and application.'}
4. Each question must have exactly 4 options and the correct answer index (0-3).
5. Make questions challenging but fair for 100-level university students.

Content:
"""
${content}
"""

Return this EXACT JSON structure (no other text):
{"summary":["point1","point2","point3","point4","point5","point6","point7"],"key_concepts":[{"concept":"name","explanation":"brief explanation","importance":"high"}],"mcq_questions":[{"question":"text","options":["A","B","C","D"],"answer":0,"explanation":"why this answer is correct","difficulty":"${difficulty}"}],"flashcards":[{"front":"question or concept","back":"answer or explanation","category":"topic"}],"study_tips":["tip1","tip2","tip3","tip4","tip5"],"exam_prep":["question1","question2","question3","question4","question5"]}

Generate ${actualQuestionCount} MCQ questions and 10 flashcards. Keep all text concise but informative.`;

    try {
      setIsProcessing(true);
      console.log("Starting AI processing...");
      
      const raw = await callAI(prompt, { provider: "openrouter", model: "qwen/qwen-2.5-7b-instruct" });
      console.log("AI response received:", raw?.substring(0, 200));
      
      if (!raw || raw.trim().length < 10) {
        throw new Error("AI returned an empty response. Please try again with shorter content.");
      }
      
      const parsed = extractJSON(raw);
      console.log("Parsed result keys:", Object.keys(parsed || {}));
      
      if (!parsed || typeof parsed !== 'object') {
        throw new Error("Failed to parse AI response. The content may be too long or complex.");
      }
      
      // Validate required fields
      if (!parsed.mcq_questions || !Array.isArray(parsed.mcq_questions)) {
        console.warn("No MCQ questions generated, creating empty array");
        parsed.mcq_questions = [];
      }
      
      if (parsed.mcq_questions.length === 0) {
        setError("Warning: No MCQ questions were generated. Try with different content or fewer questions.");
      }
      
      // Validate each MCQ question
      parsed.mcq_questions = parsed.mcq_questions.filter((q, i) => {
        if (!q.question || !Array.isArray(q.options) || q.options.length !== 4 || typeof q.answer !== 'number') {
          console.warn(`Invalid MCQ question at index ${i}, skipping`);
          return false;
        }
        return true;
      });
      
      console.log(`Successfully parsed ${parsed.mcq_questions.length} valid MCQ questions`);
      
      setResult(parsed);
      setActiveTab("results");
      
      // Track demo usage
      if (demoMode && setDemoUsage) {
        const today = new Date().toDateString();
        setDemoUsage(prev => ({
          ...prev,
          aiStudyAssistantUsed: prev.aiStudyAssistantDate === today ? (prev.aiStudyAssistantUsed || 0) + 1 : 1,
          aiStudyAssistantDate: today,
        }));
      }
    } catch (e) {
      console.error("AI processing error:", e);
      
      // Provide user-friendly error messages
      let errorMessage = "An error occurred while processing your content.";
      
      if (e.message?.includes("JSON") || e.message?.includes("parse")) {
        errorMessage = "Failed to parse AI response. The content may be too long or complex. Try reducing the question count to 20-30.";
      } else if (e.message?.includes("timeout") || e.message?.includes("ETIMEDOUT")) {
        errorMessage = "Request timed out. Please try with fewer questions (20-30) or shorter content.";
      } else if (e.message?.includes("rate limit") || e.message?.includes("429")) {
        errorMessage = "Too many requests. Please wait a moment and try again.";
      } else if (e.message?.includes("network") || e.message?.includes("fetch")) {
        errorMessage = "Network error. Please check your internet connection and try again.";
      } else if (e.message) {
        errorMessage = e.message;
      }
      
      setError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  }

  function saveDocument() {
    if (!result) return;
    
    const subject = allSubjects.find((s) => s.id === selectedSubjectId);
    const entry = {
      id: Date.now(),
      subjectId: selectedSubjectId,
      subjectLabel: subject?.label || "Unknown",
      fileName: uploadedFile?.name || "Untitled",
      difficulty,
      questionCount,
      createdAt: Date.now(),
      summary: result.summary || [],
      keyConcepts: result.key_concepts || [],
      mcqQuestions: result.mcq_questions || [],
      flashcards: result.flashcards || [],
      studyTips: result.study_tips || [],
      examPrep: result.exam_prep || []
    };
    
    const next = [entry, ...savedDocuments].slice(0, 50);
    saveDocuments(next);
    setSavedDocuments(next);
  }

  function importMCQs() {
    if (!result?.mcq_questions?.length) return;
    
    const items = result.mcq_questions
      .filter((q) => Array.isArray(q.options) && q.options.length === 4 && Number.isInteger(q.answer))
      .map((q) => ({
        q: q.question,
        options: q.options,
        answer: q.answer,
        explanation: q.explanation || "From uploaded material.",
        difficulty: q.difficulty || difficulty
      }));
    
    if (items.length && onImportQuestions) onImportQuestions(items);
  }

  // ===== Practice Mode Functions =====
  function startMcqPractice(docOrResult) {
    const mcqs = docOrResult.mcqQuestions || docOrResult.mcq_questions || [];
    if (!mcqs.length) return;
    setPracticeDoc(docOrResult);
    setPracticeMode("mcq");
    setMcqIndex(0);
    setMcqSelected(null);
    setMcqScore(0);
    setMcqShowResult(false);
  }

  function startFlashcardPractice(docOrResult) {
    const cards = docOrResult.flashcards || [];
    if (!cards.length) return;
    setPracticeDoc(docOrResult);
    setPracticeMode("flashcard");
    setFlashcardIndex(0);
    setFlashcardFlipped(false);
  }

  function handleMcqAnswer(answerIndex) {
    if (mcqShowResult) return;
    const mcqs = practiceDoc.mcqQuestions || practiceDoc.mcq_questions || [];
    const q = mcqs[mcqIndex];
    setMcqSelected(answerIndex);
    setMcqShowResult(true);
    if (answerIndex === q.answer) {
      setMcqScore(prev => prev + 1);
    }
  }

  function nextMcq() {
    const mcqs = practiceDoc.mcqQuestions || practiceDoc.mcq_questions || [];
    if (mcqIndex < mcqs.length - 1) {
      setMcqIndex(prev => prev + 1);
      setMcqSelected(null);
      setMcqShowResult(false);
    } else {
      // Finished
      setPracticeMode(null);
      setPracticeDoc(null);
    }
  }

  function nextFlashcard() {
    const cards = practiceDoc.flashcards || [];
    if (flashcardIndex < cards.length - 1) {
      setFlashcardIndex(prev => prev + 1);
      setFlashcardFlipped(false);
    } else {
      setPracticeMode(null);
      setPracticeDoc(null);
    }
  }

  function prevFlashcard() {
    if (flashcardIndex > 0) {
      setFlashcardIndex(prev => prev - 1);
      setFlashcardFlipped(false);
    }
  }

  function exportToPDF() {
    if (!result) return;
    
    const doc = new jsPDF();
    const subject = allSubjects.find((s) => s.id === selectedSubjectId);
    const title = uploadedFile?.name || "Study Material";
    
    doc.setFontSize(20);
    doc.text(title, 20, 20);
    
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`${subject?.icon} ${subject?.label || "Course"} · Difficulty: ${difficulty}`, 20, 30);
    doc.setTextColor(0);
    
    let yPosition = 45;
    
    // Summary
    if (result.summary?.length > 0) {
      doc.setFontSize(16);
      doc.text("Summary", 20, yPosition);
      yPosition += 10;
      
      doc.setFontSize(11);
      result.summary.forEach((point) => {
        const lines = doc.splitTextToSize(`• ${point}`, 170);
        doc.text(lines, 20, yPosition);
        yPosition += lines.length * 6;
      });
      yPosition += 10;
    }
    
    // Key Concepts
    if (result.key_concepts?.length > 0) {
      if (yPosition > 250) {
        doc.addPage();
        yPosition = 20;
      }
      doc.setFontSize(16);
      doc.text("Key Concepts", 20, yPosition);
      yPosition += 10;
      
      doc.setFontSize(11);
      result.key_concepts.forEach((concept) => {
        const conceptText = `${concept.concept}: ${concept.explanation}`;
        const lines = doc.splitTextToSize(conceptText, 170);
        doc.text(lines, 20, yPosition);
        yPosition += lines.length * 6;
      });
      yPosition += 10;
    }
    
    // Study Tips
    if (result.study_tips?.length > 0) {
      if (yPosition > 250) {
        doc.addPage();
        yPosition = 20;
      }
      doc.setFontSize(16);
      doc.text("Study Tips", 20, yPosition);
      yPosition += 10;
      
      doc.setFontSize(11);
      result.study_tips.forEach((tip) => {
        const lines = doc.splitTextToSize(`• ${tip}`, 170);
        doc.text(lines, 20, yPosition);
        yPosition += lines.length * 6;
      });
    }
    
    doc.save(`${title.replace(/[^a-z0-9]/gi, '_')}_study_guide.pdf`);
  }

  function deleteSaved(id) {
    const next = savedDocuments.filter((d) => d.id !== id);
    saveDocuments(next);
    setSavedDocuments(next);
  }

  return (
    <div className="card">
      <h2>🤖 AI Study Assistant</h2>
      <p className="muted">
        Upload your study materials (PDF, TXT) and let AI create MCQs, summaries, flashcards, and explanations.
        Perfect for 100-level students!
      </p>

      {/* Tab Navigation */}
      <div className="row" style={{ gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <button 
          onClick={() => setActiveTab("upload")}
          style={{ background: activeTab === "upload" ? "#818cf8" : "#374151", color: "white" }}
        >
          📤 Upload & Process
        </button>
        <button 
          onClick={() => setActiveTab("results")}
          style={{ background: activeTab === "results" ? "#818cf8" : "#374151", color: "white" }}
          disabled={!result}
        >
          📊 Results
        </button>
        <button 
          onClick={() => setActiveTab("saved")}
          style={{ background: activeTab === "saved" ? "#818cf8" : "#374151", color: "white" }}
        >
          💾 Saved ({savedDocuments.length})
        </button>
        {practiceMode && (
          <button 
            onClick={() => { setPracticeMode(null); setPracticeDoc(null); }}
            style={{ background: "#ef4444", color: "white" }}
          >
            ✕ Exit Practice
          </button>
        )}
      </div>

      {/* ===== PRACTICE MODE TAKES OVER ===== */}
      {practiceMode === "mcq" && practiceDoc && (
        <div className="lesson-block" style={{ background: "#1f2937", border: "2px solid #3b82f6", marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3>📝 MCQ Practice</h3>
            <span className="muted">
              Question {mcqIndex + 1} of {(practiceDoc.mcqQuestions || practiceDoc.mcq_questions || []).length} · Score: {mcqScore}/{mcqIndex + (mcqShowResult ? 1 : 0)}
            </span>
          </div>
          
          <div style={{ height: 6, background: "#374151", borderRadius: 3, marginBottom: 16 }}>
            <div style={{
              height: "100%",
              width: `${((mcqIndex + 1) / (practiceDoc.mcqQuestions || practiceDoc.mcq_questions || []).length) * 100}%`,
              background: "#3b82f6",
              borderRadius: 3,
              transition: "width 0.3s"
            }} />
          </div>
          
          {(() => {
            const mcqs = practiceDoc.mcqQuestions || practiceDoc.mcq_questions || [];
            const q = mcqs[mcqIndex];
            if (!q) return null;
            
            return (
              <>
                <p style={{ fontSize: 15, lineHeight: 1.6, marginBottom: 16 }}>{q.question}</p>
                
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                  {(q.options || []).map((opt, i) => {
                    const letter = String.fromCharCode(65 + i);
                    const isSelected = mcqSelected === i;
                    const isCorrect = i === q.answer;
                    
                    let bg = "#1f2937";
                    let border = "1px solid #374151";
                    
                    if (mcqShowResult) {
                      if (isCorrect) { bg = "#064e3b"; border = "2px solid #10b981"; }
                      else if (isSelected && !isCorrect) { bg = "#7f1d1d"; border = "2px solid #ef4444"; }
                    } else if (isSelected) {
                      bg = "#3730a3"; border = "2px solid #818cf8";
                    }
                    
                    return (
                      <button
                        key={i}
                        onClick={() => !mcqShowResult && handleMcqAnswer(i)}
                        disabled={mcqShowResult}
                        style={{
                          padding: 12,
                          background: bg,
                          border: border,
                          borderRadius: 8,
                          color: "white",
                          textAlign: "left",
                          cursor: mcqShowResult ? "default" : "pointer",
                          fontSize: 14,
                          transition: "all 0.2s"
                        }}
                      >
                        <span style={{ fontWeight: 600, marginRight: 8 }}>{letter})</span>
                        {opt}
                        {mcqShowResult && isCorrect && <span style={{ float: "right", color: "#10b981" }}>✓ Correct</span>}
                        {mcqShowResult && isSelected && !isCorrect && <span style={{ float: "right", color: "#ef4444" }}>✗ Wrong</span>}
                      </button>
                    );
                  })}
                </div>
                
                {mcqShowResult && (
                  <div style={{ 
                    padding: 12, 
                    background: mcqSelected === q.answer ? "#064e3b" : "#7f1d1d", 
                    borderRadius: 8, 
                    marginBottom: 16 
                  }}>
                    <p style={{ fontWeight: 600, color: "white", marginBottom: 4 }}>
                      {mcqSelected === q.answer ? "✅ Correct!" : "❌ Incorrect"}
                    </p>
                    {q.explanation && (
                      <p style={{ fontSize: 13, color: "#e5e7eb" }}>{q.explanation}</p>
                    )}
                  </div>
                )}
                
                {mcqShowResult && (
                  <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
                    <button
                      onClick={nextMcq}
                      style={{
                        background: "#3b82f6",
                        color: "white",
                        border: "none",
                        padding: "10px 24px",
                        borderRadius: 6,
                        cursor: "pointer",
                        fontSize: 14
                      }}
                    >
                      {mcqIndex < mcqs.length - 1 ? "Next Question →" : "Finish Practice ✅"}
                    </button>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {practiceMode === "flashcard" && practiceDoc && (
        <div className="lesson-block" style={{ background: "#1f2937", border: "2px solid #f59e0b", marginBottom: 16, textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3>🃏 Flashcard Review</h3>
            <span className="muted">
              Card {flashcardIndex + 1} of {(practiceDoc.flashcards || []).length}
            </span>
          </div>
          
          <div style={{ height: 6, background: "#374151", borderRadius: 3, marginBottom: 20 }}>
            <div style={{
              height: "100%",
              width: `${((flashcardIndex + 1) / (practiceDoc.flashcards || []).length) * 100}%`,
              background: "#f59e0b",
              borderRadius: 3,
              transition: "width 0.3s"
            }} />
          </div>
          
          {(() => {
            const cards = practiceDoc.flashcards || [];
            const card = cards[flashcardIndex];
            if (!card) return null;
            
            return (
              <>
                <div
                  onClick={() => setFlashcardFlipped(!flashcardFlipped)}
                  style={{
                    padding: 40,
                    background: flashcardFlipped ? "#064e3b" : "#1e3a5f",
                    borderRadius: 12,
                    border: `2px solid ${flashcardFlipped ? "#10b981" : "#3b82f6"}`,
                    cursor: "pointer",
                    minHeight: 180,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 20,
                    transition: "all 0.3s ease"
                  }}
                >
                  <div>
                    <p style={{ 
                      fontSize: flashcardFlipped ? 16 : 18, 
                      fontWeight: 500,
                      color: "white",
                      lineHeight: 1.6
                    }}>
                      {flashcardFlipped ? card.back : card.front}
                    </p>
                    <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 12 }}>
                      {flashcardFlipped ? "🔄 Click to see front" : "👆 Click to flip"}
                    </p>
                  </div>
                </div>
                
                {card.category && (
                  <span style={{ 
                    fontSize: 11, 
                    color: "#6b7280", 
                    display: "block", 
                    marginBottom: 16 
                  }}>
                    Category: {card.category}
                  </span>
                )}
                
                <div className="row" style={{ gap: 12, justifyContent: "center" }}>
                  <button
                    onClick={prevFlashcard}
                    disabled={flashcardIndex === 0}
                    style={{
                      background: flashcardIndex === 0 ? "#374151" : "#374151",
                      color: flashcardIndex === 0 ? "#6b7280" : "white",
                      border: "1px solid #4b5563",
                      padding: "8px 16px",
                      borderRadius: 6,
                      cursor: flashcardIndex === 0 ? "not-allowed" : "pointer"
                    }}
                  >
                    ← Previous
                  </button>
                  
                  <button
                    onClick={() => setFlashcardFlipped(!flashcardFlipped)}
                    style={{
                      background: "#818cf8",
                      color: "white",
                      border: "none",
                      padding: "8px 20px",
                      borderRadius: 6,
                      cursor: "pointer"
                    }}
                  >
                    {flashcardFlipped ? "🔄 Show Front" : "🔃 Flip Card"}
                  </button>
                  
                  <button
                    onClick={nextFlashcard}
                    style={{
                      background: "#f59e0b",
                      color: "white",
                      border: "none",
                      padding: "8px 16px",
                      borderRadius: 6,
                      cursor: "pointer"
                    }}
                  >
                    {flashcardIndex < cards.length - 1 ? "Next →" : "Finish ✅"}
                  </button>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* ===== TAB CONTENT (hidden during practice) ===== */}
      {!practiceMode && activeTab === "upload" && (
        <>
          {/* Subject Selection & Creation */}
          <div className="lesson-block" style={{ marginBottom: 12 }}>
            <h3>📚 Select or Create Subject</h3>
            <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              <select 
                value={selectedSubjectId} 
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                style={{ flex: 1, minWidth: 200, padding: 8 }}
              >
                <option value="">-- Select a subject --</option>
                {allSubjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.icon} {s.label} {s.isCustom && "✨ (Custom)"}
                  </option>
                ))}
              </select>
            </div>
            
            <div style={{ marginTop: 12, padding: 12, background: "#f0fdf4", borderRadius: 6, border: "1px dashed #22c55e" }}>
              <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 8, color: "#166534" }}>
                ➕ Create a new custom subject:
              </p>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <input
                  value={newSubjectName}
                  onChange={(e) => setNewSubjectName(e.target.value)}
                  placeholder="Enter your custom subject name (e.g., Physics 101, Intro to Psychology)"
                  style={{ flex: 1, minWidth: 150, padding: 8 }}
                />
                <select
                  value={newSubjectIcon}
                  onChange={(e) => setNewSubjectIcon(e.target.value)}
                  style={{ minWidth: 60, padding: 8 }}
                >
                  <option value="📚">📚</option>
                  <option value="🔬">🔬</option>
                  <option value="💻">💻</option>
                  <option value="📐">📐</option>
                  <option value="🌍">🌍</option>
                  <option value="🎨">🎨</option>
                  <option value="📖">📖</option>
                  <option value="⚗️">⚗️</option>
                  <option value="🧮">🧮</option>
                  <option value="🔭">🔭</option>
                  <option value="💡">💡</option>
                  <option value="🎵">🎵</option>
                </select>
                <button 
                  onClick={handleCreateSubject} 
                  style={{ 
                    borderColor: "#22c55e", 
                    color: "#22c55e",
                    background: "#f0fdf4",
                    padding: "8px 16px"
                  }}
                >
                  ✨ Create Subject
                </button>
              </div>
              {customSubjects.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <p style={{ fontSize: 12, color: "#166534", fontWeight: 500 }}>
                    Your custom subjects:
                  </p>
                  <div className="row" style={{ gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                    {customSubjects.map(s => (
                      <span key={s.id} style={{ 
                        fontSize: 12, 
                        padding: "4px 10px", 
                        background: "#dcfce7", 
                        color: "#166534",
                        borderRadius: 12,
                        border: "1px solid #86efac"
                      }}>
                        {s.icon} {s.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* File Upload */}
          <div className="lesson-block" style={{ marginBottom: 12 }}>
            <h3>📄 Upload Study Material</h3>
            <div className="row" style={{ marginTop: 8, gap: 8, flexWrap: "wrap" }}>
              <label style={{ 
                display: "inline-flex", 
                alignItems: "center", 
                gap: 8, 
                padding: "10px 20px", 
                background: "#818cf8", 
                color: "white", 
                borderRadius: 4, 
                cursor: "pointer",
                fontSize: 14
              }}>
                📤 Choose File
                <input
                  type="file"
                  accept=".pdf,.txt,.docx"
                  onChange={handleFileUpload}
                  style={{ display: "none" }}
                />
              </label>
              {uploadedFile && (
                <span className="muted" style={{ fontSize: 13 }}>
                  {uploadedFile.name} ({(uploadedFile.size / 1024).toFixed(1)} KB)
                </span>
              )}
              {isExtracting && <span className="muted" style={{ fontSize: 12 }}>Extracting text...</span>}
            </div>
            
            {extractedText && (
              <div style={{ marginTop: 8 }}>
                <p className="muted" style={{ fontSize: 12 }}>
                  Extracted {extractedText.length} characters
                </p>
              </div>
            )}
          </div>

          {/* Processing Options */}
          <div className="lesson-block" style={{ marginBottom: 12 }}>
            <h3>⚙️ Processing Options</h3>
            <div className="row" style={{ gap: 16, marginTop: 8, flexWrap: "wrap" }}>
              <div>
                <label style={{ fontSize: 13, display: "block", marginBottom: 4 }}>Difficulty</label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  style={{ minWidth: 120 }}
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, display: "block", marginBottom: 4 }}>Questions (up to 100)</label>
                <select
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value))}
                  style={{ minWidth: 120 }}
                >
                  <option value={10}>10 questions</option>
                  <option value={20}>20 questions</option>
                  <option value={30}>30 questions</option>
                  <option value={40}>40 questions</option>
                  <option value={50}>50 questions</option>
                  <option value={60}>60 questions</option>
                  <option value={70}>70 questions</option>
                  <option value={80}>80 questions</option>
                  <option value={90}>90 questions</option>
                  <option value={100}>100 questions</option>
                </select>
              </div>
            </div>
          </div>

          <button
            onClick={processContent}
            disabled={isProcessing || isExtracting || !extractedText}
            style={{ 
              marginTop: 8, 
              borderColor: "#818cf8", 
              color: "#818cf8",
              padding: "12px 24px",
              fontSize: 14
            }}
          >
            {isProcessing ? "🔄 Processing with AI..." : "✨ Generate Study Materials"}
          </button>
          {error && <p style={{ color: "#ff6b6b", fontSize: 13, marginTop: 8 }}>{error}</p>}
        </>
      )}

      {!practiceMode && activeTab === "results" && result && (
        <div className="lesson-block">
          <h3>📊 Generated Results</h3>
          
          {/* Summary */}
          {result.summary?.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <h4>📝 Summary</h4>
              <ul>
                {result.summary.map((point, i) => (
                  <li key={i}>{point}</li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Key Concepts */}
          {result.key_concepts?.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <h4>🔑 Key Concepts</h4>
              {result.key_concepts.map((concept, i) => (
                <div key={i} style={{ 
                  padding: 8, 
                  background: concept.importance === "high" ? "#fef3c7" : concept.importance === "medium" ? "#e0e7ff" : "#f3f4f6",
                  borderRadius: 4,
                  marginBottom: 8
                }}>
                  <strong>{concept.concept}</strong>
                  <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>{concept.explanation}</p>
                  <span style={{ fontSize: 11, color: "#6b7280" }}>
                    Importance: {concept.importance}
                  </span>
                </div>
              ))}
            </div>
          )}
          
          {/* MCQ Questions */}
          {result.mcq_questions?.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <h4>❓ MCQ Questions ({result.mcq_questions.length})</h4>
              {result.mcq_questions.slice(0, 5).map((q, i) => (
                <div key={i} className="history-row" style={{ padding: 8, background: "#f9fafb", borderRadius: 4, marginBottom: 8 }}>
                  <p style={{ fontSize: 13, fontWeight: 500 }}>{i + 1}. {q.question}</p>
                  <div style={{ fontSize: 12, marginTop: 4 }}>
                    {q.options.map((opt, j) => (
                      <span key={j} style={{ 
                        marginRight: 12,
                        color: j === q.answer ? "#10b981" : "#6b7280",
                        fontWeight: j === q.answer ? "bold" : "normal"
                      }}>
                        {String.fromCharCode(65 + j)}) {opt} {j === q.answer && "✓"}
                      </span>
                    ))}
                  </div>
                  {q.explanation && (
                    <p className="muted" style={{ fontSize: 11, marginTop: 4 }}>💡 {q.explanation}</p>
                  )}
                </div>
              ))}
              {result.mcq_questions.length > 5 && (
                <p className="muted" style={{ fontSize: 12 }}>+ {result.mcq_questions.length - 5} more questions</p>
              )}
            </div>
          )}
          
          {/* Flashcards */}
          {result.flashcards?.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <h4>🃏 Flashcards ({result.flashcards.length})</h4>
              {result.flashcards.slice(0, 4).map((card, i) => (
                <div key={i} className="history-row" style={{ padding: 8, background: "#fef3c7", borderRadius: 4, marginBottom: 8 }}>
                  <p style={{ fontSize: 13, fontWeight: 500 }}>Q: {card.front}</p>
                  <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>A: {card.back}</p>
                  {card.category && (
                    <span style={{ fontSize: 11, color: "#6b7280" }}>Category: {card.category}</span>
                  )}
                </div>
              ))}
            </div>
          )}
          
          {/* Study Tips */}
          {result.study_tips?.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <h4>💡 Study Tips</h4>
              <ul>
                {result.study_tips.map((tip, i) => (
                  <li key={i}>{tip}</li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Exam Prep */}
          {result.exam_prep?.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <h4>🎯 Exam Preparation</h4>
              <ol>
                {result.exam_prep.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ol>
            </div>
          )}
          
          {/* Action Buttons */}
          <div className="row" style={{ marginTop: 16, gap: 8, flexWrap: "wrap" }}>
            <button onClick={saveDocument} style={{ borderColor: "#2dd4a0", color: "#2dd4a0" }}>
              💾 Save to Library
            </button>
            <button onClick={importMCQs} style={{ borderColor: "#facc15", color: "#facc15" }}>
              ✅ Import {result.mcq_questions?.length || 0} MCQs
            </button>
            <button onClick={exportToPDF} style={{ borderColor: "#ef4444", color: "#ef4444" }}>
              📄 Export Study Guide PDF
            </button>
          </div>
          
          {/* Practice Buttons */}
          {(result.mcq_questions?.length > 0 || result.flashcards?.length > 0) && (
            <div style={{ marginTop: 12, padding: 12, background: "#1e3a5f", borderRadius: 8, border: "1px solid #3b82f6" }}>
              <p style={{ fontSize: 13, color: "#93c5fd", marginBottom: 8, fontWeight: 600 }}>
                🎮 Practice Mode
              </p>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                {result.mcq_questions?.length > 0 && (
                  <button 
                    onClick={() => startMcqPractice(result)}
                    style={{ background: "#3b82f6", color: "white", border: "none", padding: "8px 16px", borderRadius: 4, cursor: "pointer" }}
                  >
                    📝 Practice {result.mcq_questions.length} MCQs
                  </button>
                )}
                {result.flashcards?.length > 0 && (
                  <button 
                    onClick={() => startFlashcardPractice(result)}
                    style={{ background: "#f59e0b", color: "white", border: "none", padding: "8px 16px", borderRadius: 4, cursor: "pointer" }}
                  >
                    🃏 Review {result.flashcards.length} Flashcards
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {!practiceMode && activeTab === "saved" && (
        <>
          <h3>📚 Saved Study Materials</h3>
          {savedDocuments.length === 0 ? (
            <p className="muted">No saved materials yet. Upload and process a file to get started!</p>
          ) : (
            savedDocuments.map((doc) => (
              <details key={doc.id} className="lesson-block">
                <summary>
                  <strong>
                    {doc.subjectLabel} · {doc.fileName}
                  </strong>
                  <span className="muted" style={{ fontSize: 12 }}>
                    · {new Date(doc.createdAt).toLocaleDateString()} · {doc.difficulty}
                  </span>
                </summary>
                <div style={{ marginTop: 8 }}>
                  <p className="muted" style={{ fontSize: 12 }}>
                    {doc.mcqQuestions.length} MCQs · {doc.flashcards.length} Flashcards
                  </p>
                  <ul style={{ marginTop: 8 }}>
                    {(doc.summary || []).slice(0, 3).map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                  <div className="row" style={{ marginTop: 8, gap: 8, flexWrap: "wrap" }}>
                    {doc.mcqQuestions?.length > 0 && (
                      <button 
                        onClick={() => startMcqPractice(doc)}
                        style={{ fontSize: 12, background: "#3b82f6", color: "white", border: "none", padding: "6px 12px", borderRadius: 4, cursor: "pointer" }}
                      >
                        📝 Practice {doc.mcqQuestions.length} MCQs
                      </button>
                    )}
                    {doc.flashcards?.length > 0 && (
                      <button 
                        onClick={() => startFlashcardPractice(doc)}
                        style={{ fontSize: 12, background: "#f59e0b", color: "white", border: "none", padding: "6px 12px", borderRadius: 4, cursor: "pointer" }}
                      >
                        🃏 Review {doc.flashcards.length} Flashcards
                      </button>
                    )}
                    <button 
                      onClick={() => deleteSaved(doc.id)} 
                      style={{ fontSize: 12, borderColor: "#ef4444", color: "#ef4444", background: "transparent", padding: "6px 12px", borderRadius: 4, cursor: "pointer" }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </details>
            ))
          )}
        </>
      )}

    </div>
  );
}
