import React, { useState, useEffect, useMemo } from "react";
import DOMPurify from "dompurify";
import { NOTES_KEY, CUSTOM_QUESTIONS_KEY, AI_DOCS_KEY, LECTURE_NOTES_KEY } from "../lib/constants";
import { loadFromStorage } from "../lib/appUtils";

export function GlobalSearchDropdown({ query, filter, subjects }) {
  const safeSubjects = subjects || [];

  const allContent = useMemo(() => {
    const userNotes = loadFromStorage(NOTES_KEY);
    const customQuestions = loadFromStorage(CUSTOM_QUESTIONS_KEY);
    const aiDocs = loadFromStorage(AI_DOCS_KEY);
    const lectureNotes = loadFromStorage(LECTURE_NOTES_KEY);

    return {
      notes: userNotes.filter(Boolean).map((n) => ({
        type: "note",
        id: n?.id || "",
        subjectId: n?.subjectId,
        subject: safeSubjects.find((s) => s.id === n?.subjectId)?.label || "Unknown",
        title: "Student Note",
        content: n?.content || "",
        timestamp: n?.updatedAt
      })),
      questions: customQuestions.filter(Boolean).map((q, i) => ({
        type: "question",
        id: `q_${i}`,
        subjectId: q?.subjectId,
        subject: safeSubjects.find((s) => s.id === q?.subjectId)?.label || "Unknown",
        title: "Custom Question",
        content: `${q?.q || ""} ${q?.options?.join(" ") || ""} ${q?.explanation || ""}`,
        timestamp: Date.now()
      })),
      flashcards: aiDocs.filter(Boolean).flatMap((doc) =>
        (doc?.flashcards || []).filter(Boolean).map((f, i) => ({
          type: "flashcard",
          id: `${doc?.id || ""}_f_${i}`,
          subjectId: doc?.subjectId,
          subject: doc?.subjectLabel || "Unknown",
          title: "Flashcard",
          content: `${f?.front || ""} ${f?.back || ""}`,
          timestamp: doc?.createdAt
        }))
      ),
      lectures: lectureNotes.filter(Boolean).map((n) => ({
        type: "lecture",
        id: n?.id || "",
        subjectId: n?.subjectId,
        subject: safeSubjects.find((s) => s.id === n?.subjectId)?.label || "Unknown",
        title: n?.title || "",
        content: `${(n?.summary || []).join(" ")} ${(n?.key_terms || []).filter(Boolean).map(t => `${t?.term || ""} ${t?.definition || ""}`).join(" ")}`,
        timestamp: n?.createdAt
      }))
    };
  }, [safeSubjects]);

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
      if (filter !== "all" && item.type !== filter) return false;
      const contentMatch = item.content.toLowerCase().includes(lowerQuery);
      const titleMatch = item.title.toLowerCase().includes(lowerQuery);
      const subjectMatch = item.subject.toLowerCase().includes(lowerQuery);
      return contentMatch || titleMatch || subjectMatch;
    });
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
  }, [query, filter, allContent]);

  const typeIcons = { note: "📝", question: "❓", flashcard: "🃏", lecture: "🎓" };
  const typeColors = { note: "#FFD700", question: "#facc15", flashcard: "#FFD700", lecture: "#ef4444" };

  function highlightText(text, query) {
    if (!query) return text;
    const sanitizedText = DOMPurify.sanitize(text);
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    return sanitizedText.replace(regex, '<mark style="background: #fef08a; padding: 0 2px; border-radius: 2px;">$1</mark>');
  }

  if (!query.trim()) {
    return <p className="muted" style={{ textAlign: "center", padding: 20 }}>Start typing to search across all your content</p>;
  }

  if (searchResults.length === 0) {
    return <p className="muted" style={{ textAlign: "center", padding: 20 }}>No results found for "{query}"</p>;
  }

  return (
    <div>
      <p className="muted" style={{ marginBottom: 12, fontSize: 12 }}>
        Found {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
      </p>
      {searchResults.map((item) => (
        <div
          key={item.id}
          style={{
            padding: 10,
            background: "#1f2937",
            borderRadius: 6,
            marginBottom: 6,
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
                item.content.length > 150
                  ? item.content.substring(0, 150) + "..."
                  : item.content,
                query
              )
            }}
          />
          <span style={{ fontSize: 10, color: "#6b7280" }}>
            {new Date(item.timestamp).toLocaleDateString()}
          </span>
        </div>
      ))}
    </div>
  );
}

export default GlobalSearchDropdown;
