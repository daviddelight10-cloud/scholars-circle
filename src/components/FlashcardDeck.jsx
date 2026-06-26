import React, { useState } from "react";
import { api } from "../lib/appUtils";

export function FlashcardDeck({ subjects, srData, customFlashcards, setCustomFlashcards, token }) {
  const allCards = [
    ...subjects.flatMap((s) =>
      s.questions.map((q, i) => ({
        front: q.q,
        back: q.explanation || q.options[q.answer],
        subject: s.label,
        key: `${s.id}-${i}`,
        type: "auto",
      }))
    ),
    ...customFlashcards.map((c, i) => ({ ...c, key: `custom-${i}`, type: "custom" })),
  ];

  const dueCards = allCards.filter((c) => (srData[c.key]?.due || 0) <= Date.now() && srData[c.key]);
  const pool = dueCards.length > 0 ? dueCards : allCards;

  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [finished, setFinished] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newFront, setNewFront] = useState("");
  const [newBack, setNewBack] = useState("");
  const [newSubject, setNewSubject] = useState(subjects[0]?.label || "");
  const [cardTypeFilter, setCardTypeFilter] = useState("all");

  const filteredByType = cardTypeFilter === "all" ? pool : pool.filter((c) => c.type === cardTypeFilter);
  const filtered = subjectFilter === "all" ? filteredByType : filteredByType.filter((c) => c.subject === subjectFilter);
  const card = filtered[idx];

  function next() {
    setFlipped(false);
    if (idx + 1 >= filtered.length) { setFinished(true); return; }
    setTimeout(() => setIdx((i) => i + 1), 150);
  }

  function restart() { setIdx(0); setFlipped(false); setFinished(false); }

  function createCard() {
    if (!newFront.trim() || !newBack.trim()) return;
    const newCard = { front: newFront, back: newBack, subject: newSubject };
    setCustomFlashcards((p) => [...p, newCard]);
    if (token) {
      api("/user-data/flashcards", { token, method: "POST", body: newCard }).catch(console.error);
    }
    setNewFront("");
    setNewBack("");
    setShowCreate(false);
    restart();
  }

  function deleteCustomCard(index) {
    const card = customFlashcards[index];
    setCustomFlashcards((p) => p.filter((_, i) => i !== index));
    if (token && card.id) {
      api(`/user-data/flashcards/${card.id}`, { token, method: "DELETE" }).catch(console.error);
    }
    restart();
  }

  return (
    <div className="card">
      <div className="row">
        <h2>Flashcards</h2>
        <button onClick={() => setShowCreate(true)}>+ Create Card</button>
      </div>
      <div className="row">
        <select value={cardTypeFilter} onChange={(e) => { setCardTypeFilter(e.target.value); restart(); }}>
          <option value="all">All Types ({pool.length})</option>
          <option value="auto">Auto from Questions</option>
          <option value="custom">Custom ({customFlashcards.length})</option>
        </select>
        <select value={subjectFilter} onChange={(e) => { setSubjectFilter(e.target.value); restart(); }}>
          <option value="all">All Subjects</option>
          {subjects.map((s) => <option key={s.id} value={s.label}>{s.label}</option>)}
        </select>
      </div>
      {dueCards.length > 0 && subjectFilter === "all" && cardTypeFilter === "all" && (
        <p className="muted" style={{ color: "#2dd4a0" }}>Showing {dueCards.length} due spaced-review cards.</p>
      )}
      {finished ? (
        <div style={{ textAlign: "center", padding: 32 }}>
          <p style={{ fontSize: "2rem" }}>🎉</p>
          <h3>Deck complete!</h3>
          <button onClick={restart}>Restart</button>
        </div>
      ) : card ? (
        <>
          <p className="muted">{idx + 1} / {filtered.length} — {card.subject}</p>
          <div className="flashcard-wrap" onClick={() => setFlipped((v) => !v)}>
            <div className={`flashcard ${flipped ? "flipped" : ""}`}>
              <div className="flashcard-front">
                <p className="question">{card.front}</p>
                <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>Tap to reveal answer</p>
              </div>
              <div className="flashcard-back">
                <p className="flashcard-answer">{card.back}</p>
              </div>
            </div>
          </div>
          {flipped && (
            <div className="row" style={{ marginTop: 16 }}>
              <button style={{ borderColor: "#ff6b6b", color: "#ff6b6b" }} onClick={next}>Got it wrong</button>
              <button style={{ borderColor: "#2dd4a0", color: "#2dd4a0" }} onClick={next}>Got it right ✓</button>
            </div>
          )}
        </>
      ) : (
        <p className="muted">No cards available.</p>
      )}
      {customFlashcards.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h4>Custom Cards ({customFlashcards.length})</h4>
          <div className="history">
            {customFlashcards.map((c, i) => (
              <div key={i} className="history-row">
                <span>{c.subject}: {c.front.substring(0, 40)}...</span>
                <button className="danger" style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => deleteCustomCard(i)}>Delete</button>
              </div>
            ))}
          </div>
        </div>
      )}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>Create Flashcard</h3>
            <label>Subject</label>
            <select value={newSubject} onChange={(e) => setNewSubject(e.target.value)}>
              {subjects.map((s) => <option key={s.id} value={s.label}>{s.label}</option>)}
            </select>
            <label>Front (Question)</label>
            <textarea value={newFront} onChange={(e) => setNewFront(e.target.value)} placeholder="Enter the question..." rows={3} />
            <label>Back (Answer)</label>
            <textarea value={newBack} onChange={(e) => setNewBack(e.target.value)} placeholder="Enter the answer..." rows={3} />
            <div className="row" style={{ marginTop: 16 }}>
              <button onClick={createCard}>Create</button>
              <button onClick={() => setShowCreate(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
