import { useState, useMemo } from "react";
import DOMPurify from "dompurify";

const NOTES_KEY = "sc_user_notes_v1";
const CUSTOM_QUESTIONS_KEY = "sc_custom_questions_v1";
const AI_DOCS_KEY = "sc_ai_study_assistant_v1";
const LECTURE_NOTES_KEY = "sc_lecture_notes_v1";

function loadFromStorage(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function GlobalSearch({ subjects }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [activeFilter, setActiveFilter] = useState("all"); // all, notes, questions, flashcards, lectures

  // Load all searchable content
  const allContent = useMemo(() => {
    const userNotes = loadFromStorage(NOTES_KEY);
    const customQuestions = loadFromStorage(CUSTOM_QUESTIONS_KEY);
    const aiDocs = loadFromStorage(AI_DOCS_KEY);
    const lectureNotes = loadFromStorage(LECTURE_NOTES_KEY);

    return {
      notes: userNotes.map((n) => ({
        type: "note",
        id: n.id,
        subjectId: n.subjectId,
        subject: subjects.find((s) => s.id === n.subjectId)?.label || "Unknown",
        title: "Student Note",
        content: n.content,
        timestamp: n.updatedAt
      })),
      questions: customQuestions.map((q, i) => ({
        type: "question",
        id: `q_${i}`,
        subjectId: q.subjectId,
        subject: subjects.find((s) => s.id === q.subjectId)?.label || "Unknown",
        title: "Custom Question",
        content: `${q.q} ${q.options?.join(" ")} ${q.explanation || ""}`,
        timestamp: Date.now()
      })),
      flashcards: aiDocs.flatMap((doc) => 
        (doc.flashcards || []).map((f, i) => ({
          type: "flashcard",
          id: `${doc.id}_f_${i}`,
          subjectId: doc.subjectId,
          subject: doc.subjectLabel,
          title: "Flashcard",
          content: `${f.front} ${f.back}`,
          timestamp: doc.createdAt
        }))
      ),
      lectures: lectureNotes.map((n) => ({
        type: "lecture",
        id: n.id,
        subjectId: n.subjectId,
        subject: subjects.find((s) => s.id === n.subjectId)?.label || "Unknown",
        title: n.title,
        content: `${(n.summary || []).join(" ")} ${(n.key_terms || []).map(t => `${t.term} ${t.definition}`).join(" ")}`,
        timestamp: n.createdAt
      }))
    };
  }, [subjects]);

  const searchResults = useMemo(() => {
    if (!query.trim()) return [];

    const lowerQuery = query.toLowerCase();
    const allItems = [
      ...allContent.notes,
      ...allContent.questions,
      ...allContent.flashcards,
      ...allContent.lectures
    ];

    const filtered = allItems.filter((item) => {
      // Filter by type
      if (activeFilter !== "all" && item.type !== activeFilter) return false;

      // Search in content
      const contentMatch = item.content.toLowerCase().includes(lowerQuery);
      const titleMatch = item.title.toLowerCase().includes(lowerQuery);
      const subjectMatch = item.subject.toLowerCase().includes(lowerQuery);

      return contentMatch || titleMatch || subjectMatch;
    });

    // Sort by relevance (content match > title match > subject match)
    return filtered.sort((a, b) => {
      const aContentScore = a.content.toLowerCase().includes(lowerQuery) ? 3 : 0;
      const aTitleScore = a.title.toLowerCase().includes(lowerQuery) ? 2 : 0;
      const aSubjectScore = a.subject.toLowerCase().includes(lowerQuery) ? 1 : 0;
      const aScore = aContentScore + aTitleScore + aSubjectScore;

      const bContentScore = b.content.toLowerCase().includes(lowerQuery) ? 3 : 0;
      const bTitleScore = b.title.toLowerCase().includes(lowerQuery) ? 2 : 0;
      const bSubjectScore = b.subject.toLowerCase().includes(lowerQuery) ? 1 : 0;
      const bScore = bContentScore + bTitleScore + bSubjectScore;

      return bScore - aScore;
    });
  }, [query, activeFilter, allContent]);

  const typeIcons = {
    note: "📝",
    question: "❓",
    flashcard: "🃏",
    lecture: "🎓"
  };

  const typeColors = {
    note: "#818cf8",
    question: "#facc15",
    flashcard: "#2dd4a0",
    lecture: "#ef4444"
  };

  function highlightText(text, query) {
    if (!query) return text;
    // Sanitize text to prevent XSS
    const sanitizedText = DOMPurify.sanitize(text);
    // Escape special regex characters to prevent errors
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    return sanitizedText.replace(regex, '<mark style="background: #fef08a; padding: 0 2px; border-radius: 2px;">$1</mark>');
  }

  return (
    <div className="card">
      <h2>🔍 Global Search</h2>
      <p className="muted">
        Search across all your notes, questions, flashcards, and lecture materials.
      </p>

      {/* Search Input */}
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search anything..."
          style={{
            width: "100%",
            padding: 12,
            fontSize: 14,
            borderRadius: 6,
            border: "1px solid #374151",
            background: "#1f2937",
            color: "white"
          }}
          autoFocus
        />
      </div>

      {/* Filter Buttons */}
      <div className="row" style={{ gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {["all", "notes", "questions", "flashcards", "lectures"].map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            style={{
              background: activeFilter === filter ? "#818cf8" : "#374151",
              color: "white",
              padding: "6px 12px",
              fontSize: 12,
              borderRadius: 4,
              border: "none",
              cursor: "pointer"
            }}
          >
            {filter === "all" ? "All" : filter.charAt(0).toUpperCase() + filter.slice(1)}
          </button>
        ))}
      </div>

      {/* Results */}
      {!query.trim() && (
        <p className="muted" style={{ textAlign: "center", padding: 40 }}>
          Start typing to search across all your content
        </p>
      )}

      {query.trim() && searchResults.length === 0 && (
        <p className="muted" style={{ textAlign: "center", padding: 40 }}>
          No results found for "{query}"
        </p>
      )}

      {searchResults.length > 0 && (
        <div>
          <p className="muted" style={{ marginBottom: 12 }}>
            Found {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
          </p>
          {searchResults.map((item) => (
            <div
              key={item.id}
              style={{
                padding: 12,
                background: "#1f2937",
                borderRadius: 6,
                marginBottom: 8,
                borderLeft: `4px solid ${typeColors[item.type]}`
              }}
            >
              <div className="row" style={{ justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>
                  {typeIcons[item.type]} {item.title}
                </span>
                <span style={{ fontSize: 11, color: "#9ca3af" }}>
                  {item.subject}
                </span>
              </div>
              <p
                style={{
                  fontSize: 12,
                  color: "#d1d5db",
                  marginBottom: 4,
                  lineHeight: 1.4
                }}
                dangerouslySetInnerHTML={{
                  __html: highlightText(
                    item.content.length > 200 
                      ? item.content.substring(0, 200) + "..." 
                      : item.content,
                    query
                  )
                }}
              />
              <span style={{ fontSize: 11, color: "#6b7280" }}>
                {new Date(item.timestamp).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
