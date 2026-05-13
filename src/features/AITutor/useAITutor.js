// Unified AI Tutor hook - replaces scattered AI logic across the app.
// Wraps callAI() with discipline + mode + memory + RAG context.

import { useState, useCallback, useRef } from "react";
import { callAI, extractJSON } from "../../lib/aiClient.js";
import { buildSystemPrompt, userPrompt } from "./prompts.js";
import { detectDiscipline } from "./disciplines.js";

const STORAGE_KEY = "sc_ai_tutor_history_v1";

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveHistory(history) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {}
}

/**
 * Unified AI Tutor hook
 * @param {object} opts
 * @param {object} opts.aiConfig - AI provider config (provider, model, apiKey)
 * @param {object} opts.subject - current subject {id, label}
 * @param {string} opts.disciplineId - manually selected discipline (optional)
 * @param {Array}  opts.classroomDocs - documents for RAG context (optional)
 */
export function useAITutor({ aiConfig, subject, disciplineId, classroomDocs } = {}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [history, setHistoryState] = useState(() => loadHistory());
  const abortRef = useRef(null);

  const subjectKey = subject?.id || "_general";
  const messages = history[subjectKey] || [];

  const effectiveDiscipline = disciplineId || detectDiscipline(subject?.label);

  // Topics asked about (for weak-area detection)
  const recentTopics = messages
    .filter((m) => m.role === "user")
    .slice(-5)
    .map((m) => m.content.slice(0, 80));

  /**
   * Send a single-shot prompt in any mode and return the result.
   * Does not append to chat history (use ask() for that).
   */
  const generate = useCallback(async ({ mode, input, extra = {} }) => {
    setLoading(true);
    setError(null);
    try {
      const system = buildSystemPrompt({
        mode,
        disciplineId: effectiveDiscipline,
        subject,
        classroomDocs,
        recentTopics
      });
      const formatter = userPrompt[mode] || userPrompt.chat;
      const user = formatter(input, ...(extra.args || []));
      const fullPrompt = `${system}\n\n---\n\nUSER REQUEST:\n${user}`;
      const text = await callAI(fullPrompt, aiConfig);

      // Auto-parse JSON for generator modes
      if (mode === "generate_flashcards" || mode === "generate_quiz") {
        try {
          return { text, parsed: extractJSON(text, "array") };
        } catch (e) {
          return { text, parsed: null, parseError: e.message };
        }
      }
      return { text };
    } catch (e) {
      setError(e.message || "AI request failed");
      throw e;
    } finally {
      setLoading(false);
    }
  }, [aiConfig, effectiveDiscipline, subject, classroomDocs, recentTopics]);

  /**
   * Conversational ask() that maintains chat history per subject.
   */
  const ask = useCallback(async (userMessage) => {
    if (!userMessage?.trim()) return;
    setLoading(true);
    setError(null);

    const newUserMsg = { role: "user", content: userMessage, ts: Date.now() };
    const updated = [...messages, newUserMsg];

    // Update UI immediately with user message
    const interim = { ...history, [subjectKey]: updated };
    setHistoryState(interim);
    saveHistory(interim);

    try {
      const system = buildSystemPrompt({
        mode: "chat",
        disciplineId: effectiveDiscipline,
        subject,
        classroomDocs,
        recentTopics
      });
      // Include last 10 turns for context
      const convo = updated.slice(-10).map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");
      const fullPrompt = `${system}\n\n---\n\nCONVERSATION SO FAR:\n${convo}\n\nASSISTANT:`;
      const text = await callAI(fullPrompt, aiConfig);

      const aiMsg = { role: "assistant", content: text, ts: Date.now() };
      const finalHistory = { ...history, [subjectKey]: [...updated, aiMsg] };
      setHistoryState(finalHistory);
      saveHistory(finalHistory);
      return text;
    } catch (e) {
      setError(e.message || "AI request failed");
      throw e;
    } finally {
      setLoading(false);
    }
  }, [aiConfig, effectiveDiscipline, subject, classroomDocs, recentTopics, history, messages, subjectKey]);

  const clearHistory = useCallback(() => {
    const next = { ...history, [subjectKey]: [] };
    setHistoryState(next);
    saveHistory(next);
  }, [history, subjectKey]);

  const clearAllHistory = useCallback(() => {
    setHistoryState({});
    saveHistory({});
  }, []);

  return {
    loading,
    error,
    messages,
    discipline: effectiveDiscipline,
    ask,
    generate,
    clearHistory,
    clearAllHistory
  };
}
