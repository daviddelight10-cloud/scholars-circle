import { useState, useEffect } from "react";
import { callAI, extractJSON as extractJSONShared } from "../lib/aiClient";
import { jsPDF } from "jspdf";

const STORE_KEY = "sc_lecture_notes_v1";

function loadNotes() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveNotes(list) {
  localStorage.setItem(STORE_KEY, JSON.stringify(list));
}

const extractJSON = (raw) => extractJSONShared(raw, "object");

export function LectureToNotes({ subjects, aiConfig, onImportQuestions, demoMode, demoUsage, setDemoUsage }) {
  const [subjectId, setSubjectId] = useState(subjects[0]?.id || "");
  const [title, setTitle] = useState("");
  const [transcript, setTranscript] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [savedNotes, setSavedNotes] = useState(loadNotes());
  const [pdfLoading, setPdfLoading] = useState(false);

  async function extractTextFromPDF(file) {
    setPdfLoading(true);
    setError("");
    
    try {
      // Load PDF.js from CDN dynamically
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.type = 'text/javascript';
      
      await new Promise((resolve, reject) => {
        // Check if already loaded
        if (window.pdfjsLib) {
          resolve();
          return;
        }
        script.onload = resolve;
        script.onerror = () => reject(new Error("Failed to load PDF.js library"));
        document.head.appendChild(script);
      });
      
      // Set worker source
      const pdfjsLib = window.pdfjsLib;
      if (!pdfjsLib) {
        throw new Error("PDF.js library not available");
      }
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      
      const arrayBuffer = await file.arrayBuffer();
      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        throw new Error("File is empty or could not be read");
      }
      
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
      
      if (!fullText.trim()) {
        throw new Error("No text could be extracted from this PDF. It may be a scanned image or protected document.");
      }
      
      setTranscript(fullText);
      if (!title) {
        setTitle(file.name.replace('.pdf', ''));
      }
      setPdfLoading(false);
    } catch (e) {
      console.error('PDF extraction error:', e);
      setError(`Failed to extract text from PDF: ${e.message || 'Unknown error'}`);
      setPdfLoading(false);
    }
  }

  function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.type === 'application/pdf') {
      extractTextFromPDF(file);
    } else if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
      // Handle text files
      const reader = new FileReader();
      reader.onload = (event) => {
        setTranscript(event.target.result);
        if (!title) {
          setTitle(file.name.replace('.txt', ''));
        }
      };
      reader.onerror = () => {
        setError('Failed to read text file');
      };
      reader.readAsText(file);
    } else {
      setError('Please upload a PDF or text (.txt) file');
    }
  }

  async function process() {
    setError("");
    setResult(null);
    if (!transcript.trim()) {
      setError("Paste lecture text first.");
      return;
    }
    const subject = subjects.find((s) => s.id === subjectId);
    
    // For longer content, process in chunks and combine results
    const CHUNK_SIZE = 6000; // Characters per chunk
    const MAX_CHUNKS = 4; // Process up to 4 chunks for very long content
    
    try {
      setLoading(true);
      
      let allSummaries = [];
      let allKeyTerms = [];
      let allExamQuestions = [];
      let allFlashcards = [];
      
      // Split content into chunks
      const chunks = [];
      if (transcript.length <= CHUNK_SIZE) {
        chunks.push(transcript);
      } else {
        // Split by paragraphs or sentences for better chunking
        const paragraphs = transcript.split(/\n\n+|\.\s+/);
        let currentChunk = "";
        for (const para of paragraphs) {
          if (currentChunk.length + para.length > CHUNK_SIZE && currentChunk.length > 0) {
            chunks.push(currentChunk);
            currentChunk = para;
            if (chunks.length >= MAX_CHUNKS) break;
          } else {
            currentChunk += (currentChunk ? ". " : "") + para;
          }
        }
        if (currentChunk && chunks.length < MAX_CHUNKS) {
          chunks.push(currentChunk);
        }
      }
      
      // Process each chunk
      for (let i = 0; i < chunks.length; i++) {
        const chunkNum = i + 1;
        const isMultiChunk = chunks.length > 1;
        
        const prompt = `You are a study assistant. Create notes from this ${isMultiChunk ? `section ${chunkNum} of ${chunks.length} of` : ""} lecture for ${subject?.label || "a course"}.

IMPORTANT: Return ONLY valid JSON. No markdown, no code blocks, no extra text.

Lecture title: "${title || "Untitled"}"
Content:
"""
${chunks[i]}
"""

Return this exact JSON structure:
{"summary":["point1","point2","point3","point4","point5"],"key_terms":[{"term":"word","definition":"meaning"}],"exam_questions":["question1","question2","question3"],"flashcards":[{"q":"question","options":["A","B","C","D"],"answer":0,"explanation":"why","difficulty":"medium"}]}

Generate 5 flashcards as multiple-choice with 4 options. Keep all text concise.`;

        const raw = await callAI(prompt, { provider: aiConfig?.provider || "openrouter", model: aiConfig?.model || "google/gemini-2.5-flash", apiKey: aiConfig?.apiKey });
        const parsed = extractJSON(raw);
        
        // Combine results
        if (parsed.summary) allSummaries.push(...parsed.summary);
        if (parsed.key_terms) allKeyTerms.push(...parsed.key_terms);
        if (parsed.exam_questions) allExamQuestions.push(...parsed.exam_questions);
        if (parsed.flashcards) allFlashcards.push(...parsed.flashcards);
      }
      
      // Deduplicate and limit results
      const uniqueSummaries = [...new Set(allSummaries)].slice(0, 15);
      const uniqueKeyTerms = allKeyTerms.filter((term, index, self) => 
        index === self.findIndex(t => t.term?.toLowerCase() === term.term?.toLowerCase())
      ).slice(0, 15);
      const uniqueExamQuestions = [...new Set(allExamQuestions)].slice(0, 10);
      const uniqueFlashcards = allFlashcards.slice(0, 10);
      
      setResult({
        summary: uniqueSummaries,
        key_terms: uniqueKeyTerms,
        exam_questions: uniqueExamQuestions,
        flashcards: uniqueFlashcards
      });
      
      // Track demo usage
      if (demoMode && setDemoUsage) {
        const today = new Date().toDateString();
        setDemoUsage(prev => ({
          ...prev,
          lectureToNotesUsed: prev.lectureToNotesDate === today ? (prev.lectureToNotesUsed || 0) + 1 : 1,
          lectureToNotesDate: today,
        }));
      }
    } catch (e) {
      setError(`${e.message}. Try with shorter content.`);
    } finally {
      setLoading(false);
    }
  }

  function saveToLibrary() {
    if (!result) return;
    const entry = {
      id: Date.now(),
      subjectId,
      title: title || "Untitled lecture",
      createdAt: Date.now(),
      summary: result.summary || [],
      key_terms: result.key_terms || [],
      exam_questions: result.exam_questions || [],
    };
    const next = [entry, ...savedNotes].slice(0, 50);
    saveNotes(next);
    setSavedNotes(next);
  }

  function importFlashcards() {
    if (!result?.flashcards?.length) return;
    const items = result.flashcards
      .filter((f) => Array.isArray(f.options) && f.options.length === 4 && Number.isInteger(f.answer))
      .map((f) => ({
        q: f.q,
        options: f.options,
        answer: f.answer,
        explanation: f.explanation || "From lecture notes.",
        difficulty: f.difficulty || "medium",
      }));
    if (items.length && onImportQuestions) onImportQuestions(items);
  }

  function deleteSaved(id) {
    const next = savedNotes.filter((n) => n.id !== id);
    saveNotes(next);
    setSavedNotes(next);
  }

  function exportToPDF() {
    if (!result) return;
    
    const doc = new jsPDF();
    const subject = subjects.find((s) => s.id === subjectId);
    const pageTitle = title || "Untitled Lecture";
    
    // Title
    doc.setFontSize(20);
    doc.text(pageTitle, 20, 20);
    
    // Subject
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`${subject?.icon} ${subject?.label || "Course"}`, 20, 30);
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
    
    // Key Terms
    if (result.key_terms?.length > 0) {
      if (yPosition > 250) {
        doc.addPage();
        yPosition = 20;
      }
      doc.setFontSize(16);
      doc.text("Key Terms", 20, yPosition);
      yPosition += 10;
      
      doc.setFontSize(11);
      result.key_terms.forEach((term) => {
        const termText = `${term.term}: ${term.definition}`;
        const lines = doc.splitTextToSize(termText, 170);
        doc.text(lines, 20, yPosition);
        yPosition += lines.length * 6;
      });
      yPosition += 10;
    }
    
    // Exam Questions
    if (result.exam_questions?.length > 0) {
      if (yPosition > 250) {
        doc.addPage();
        yPosition = 20;
      }
      doc.setFontSize(16);
      doc.text("Likely Exam Questions", 20, yPosition);
      yPosition += 10;
      
      doc.setFontSize(11);
      result.exam_questions.forEach((q, i) => {
        const questionText = `${i + 1}. ${q}`;
        const lines = doc.splitTextToSize(questionText, 170);
        doc.text(lines, 20, yPosition);
        yPosition += lines.length * 6;
      });
    }
    
    // Save PDF
    doc.save(`${pageTitle.replace(/[^a-z0-9]/gi, '_')}_notes.pdf`);
  }

  return (
    <div className="card">
      <h2>🎧 Lecture → Notes</h2>
      <p className="muted">
        Upload a PDF or paste lecture text. AI returns a clean summary, key terms, likely exam questions,
        and 8 ready-to-import flashcards.
      </p>

      <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
        <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.icon} {s.label}
            </option>
          ))}
        </select>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Lecture title (e.g. Mitosis)"
          style={{ flex: 1, minWidth: 220 }}
        />
      </div>
      
      <div className="row" style={{ marginTop: 8, gap: 8, flexWrap: "wrap" }}>
        <label style={{ 
          display: "inline-flex", 
          alignItems: "center", 
          gap: 8, 
          padding: "8px 16px", 
          background: "#FFD700", 
          color: "white", 
          borderRadius: 4, 
          cursor: "pointer",
          fontSize: 13
        }}>
          📄 Upload PDF/TXT
          <input
            type="file"
            accept=".pdf,.txt,text/plain"
            onChange={handleFileUpload}
            style={{ display: "none" }}
          />
        </label>
        {pdfLoading && (
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          gap: 8, 
          background: "#1e3a5f", 
          color: "#60a5fa", 
          padding: "12px 16px", 
          borderRadius: 8,
          border: "1px solid #FFD700",
          fontSize: 14,
          fontWeight: 500,
          marginTop: 8,
          marginBottom: 8,
          animation: "pulse 2s infinite"
        }}>
          <span style={{ 
            display: "inline-block", 
            width: 18, 
            height: 18, 
            border: "2px solid #FFD700", 
            borderTopColor: "transparent", 
            borderRadius: "50%", 
            animation: "spin 1s linear infinite" 
          }} />
          📄 Extracting text from PDF... Please wait
        </div>
      )}
      </div>

      <textarea
        rows={10}
        value={transcript}
        onChange={(e) => setTranscript(e.target.value)}
        placeholder="Paste lecture transcript or your raw notes here, or upload a PDF above…"
        style={{ width: "100%", marginTop: 8, resize: "vertical" }}
      />
      <button
        onClick={process}
        disabled={loading || pdfLoading}
        style={{ marginTop: 8, borderColor: "#FFD700", color: "#FFD700" }}
      >
        {loading ? "Processing…" : "✨ Summarise + Make Flashcards"}
      </button>
      {error && <p style={{ color: "#ff6b6b", fontSize: 13 }}>{error}</p>}

      {result && (
        <div className="lesson-block" style={{ marginTop: 12 }}>
          <h3>Summary</h3>
          <ul>
            {(result.summary || []).map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
          {result.key_terms?.length > 0 && (
            <>
              <h3>Key terms</h3>
              <ul>
                {result.key_terms.map((t, i) => (
                  <li key={i}>
                    <strong>{t.term}:</strong> {t.definition}
                  </li>
                ))}
              </ul>
            </>
          )}
          {result.exam_questions?.length > 0 && (
            <>
              <h3>Likely exam questions</h3>
              <ol>
                {result.exam_questions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ol>
            </>
          )}
          {result.flashcards?.length > 0 && (
            <>
              <h3>Generated flashcards ({result.flashcards.length})</h3>
              {result.flashcards.slice(0, 4).map((f, i) => (
                <div key={i} className="history-row">
                  <span style={{ fontSize: 13 }}>
                    Q: {f.q}
                  </span>
                  <span className="muted" style={{ fontSize: 12 }}>
                    A: {f.options?.[f.answer]}
                  </span>
                </div>
              ))}
            </>
          )}
          <div className="row" style={{ marginTop: 8, gap: 8, flexWrap: "wrap" }}>
            <button onClick={saveToLibrary} style={{ borderColor: "#FFD700", color: "#FFD700" }}>
              💾 Save notes
            </button>
            <button onClick={importFlashcards} style={{ borderColor: "#facc15", color: "#facc15" }}>
              ✅ Import {result.flashcards?.length || 0} flashcards to bank
            </button>
            <button onClick={exportToPDF} style={{ borderColor: "#ef4444", color: "#ef4444" }}>
              📄 Export to PDF
            </button>
          </div>
        </div>
      )}

      {savedNotes.length > 0 && (
        <>
          <h3 style={{ marginTop: 18 }}>📚 Saved lecture notes</h3>
          {savedNotes.map((n) => {
            const subject = subjects.find((s) => s.id === n.subjectId);
            return (
              <details key={n.id} className="lesson-block">
                <summary>
                  <strong>
                    {subject?.icon} {n.title}
                  </strong>{" "}
                  <span className="muted" style={{ fontSize: 12 }}>
                    · {new Date(n.createdAt).toLocaleDateString()}
                  </span>
                </summary>
                <ul style={{ marginTop: 8 }}>
                  {(n.summary || []).map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
                <button onClick={() => deleteSaved(n.id)} style={{ fontSize: 12 }}>
                  Delete
                </button>
              </details>
            );
          })}
        </>
      )}
    </div>
  );
}
