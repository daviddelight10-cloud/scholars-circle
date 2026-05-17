// Discipline-aware system prompt builder for the unified AI Tutor.
// Every mode uses buildSystemPrompt() with mode-specific addons.

import { getDiscipline } from "./disciplines.js";

const BASE = `You are Scholar's Circle Tutor — a sophisticated, patient, university-level AI tutor.
Your goal is to help students truly understand, not just memorize.
- Be accurate. If unsure, say so.
- NEVER use markdown symbols like *, **, #, ##, or backticks in your responses. Write in plain text only.
- Use numbered lists (1. 2. 3.) or dashes (-) for structure. Do NOT use asterisks for bullets or bold.
- Keep tone encouraging but rigorous.
- Avoid filler. Get to the point fast.`;

function disciplineLayer(disciplineId) {
  const d = getDiscipline(disciplineId);
  return `\n\n## Discipline: ${d.label}\n${d.style}`;
}

function contextLayer({ subject, classroomDocs, recentTopics, studentProfile }) {
  let ctx = "";
  if (studentProfile) {
    const bits = [];
    if (studentProfile.fullName) bits.push(`Name: ${studentProfile.fullName}`);
    if (studentProfile.level) bits.push(`Level: ${studentProfile.level}`);
    if (studentProfile.programme) bits.push(`Programme: ${studentProfile.programme}`);
    if (studentProfile.institution) bits.push(`Institution: ${studentProfile.institution}`);
    if (studentProfile.learningStyle) bits.push(`Learning style: ${studentProfile.learningStyle}`);
    if (studentProfile.targetGrade) bits.push(`Target grade: ${studentProfile.targetGrade}`);
    if (bits.length) {
      ctx += `\n\n## Student Profile\n${bits.join(" | ")}`;
      ctx += `\nAdapt depth, pace, and examples to this profile. For 100-level, use foundational language; for postgrad, assume technical fluency.`;
    }
  }
  if (subject) {
    ctx += `\n\n## Current Subject\n${subject.label || subject}`;
  }
  if (classroomDocs && classroomDocs.length) {
    ctx += `\n\n## Course Materials Available\nThe student has these course materials. Reference them when relevant:\n`;
    ctx += classroomDocs.slice(0, 8).map((d, i) => `- ${d.title || d.name || `Doc ${i + 1}`}`).join("\n");
  }
  if (recentTopics && recentTopics.length) {
    ctx += `\n\n## Recently Discussed Topics\n${recentTopics.slice(0, 5).join(", ")}`;
  }
  return ctx;
}

const MODE_INSTRUCTIONS = {
  chat: `\n\n## Mode: Conversational Tutor
- Answer questions clearly and conversationally.
- Ask clarifying questions when the request is ambiguous.
- Offer follow-up directions ("Want me to go deeper on X?").
- Length: short to medium unless asked for detail.`,

  explain: `\n\n## Mode: Deep Explainer (Feynman-style)
- Start with a one-sentence intuitive summary.
- Break the topic into 3–6 numbered steps.
- For each step: a concrete example or analogy.
- End with a "Common pitfalls" section.
- Finish with 2 self-check questions.`,

  generate_notes: `\n\n## Mode: Study Notes Generator
Output in this plain text structure (NO markdown symbols like # or *):

TOPIC: [Topic]

OVERVIEW (3-4 lines)

KEY CONCEPTS
- bullet points

DETAILED EXPLANATION
[Subsection 1]
...

EXAMPLES

SUMMARY

QUICK REVIEW QUESTIONS (3 items)`,

  generate_flashcards: `\n\n## Mode: Flashcard Generator
Output STRICTLY a JSON array. NO prose before or after.
Each item: {"front": "question or term", "back": "answer or definition"}
Generate 8-15 cards covering the topic comprehensively.
Make front concise (under 100 chars). Back can be 1-3 sentences.`,

  generate_quiz: `\n\n## Mode: Quiz Generator
Output STRICTLY a JSON array. NO prose before or after.
Each item: {"q": "question", "options": ["A","B","C","D"], "answer": 0, "explanation": "why correct"}
- "answer" is the 0-indexed correct option.
- Generate 5-10 well-distributed questions.
- Mix recall, application, and analysis levels.
- Avoid trick questions.`,

  solve: `\n\n## Mode: Step-by-Step Solver
- Restate the problem in your own words.
- List given information and what to find.
- Show every step, including unit conversions.
- Clearly label the FINAL ANSWER on its own line (no bold/markdown).
- Include a sanity check ("Does this make sense because...").`,

  summarize: `\n\n## Mode: Summarizer
Output in plain text (no markdown symbols):

TL;DR (2 sentences)

KEY POINTS (5-8 bullets using dashes)

IMPORTANT TERMS (with one-line definitions)

CONCLUSION (1 paragraph)
Preserve technical accuracy. Cut fluff aggressively.`,

  translate: `\n\n## Mode: Translator
- Translate accurately, preserving academic register.
- After translation, list 3-5 key vocabulary items with definitions.
- Note any cultural/contextual nuances lost in translation.`
};

export function buildSystemPrompt({ mode, disciplineId, subject, classroomDocs, recentTopics, studentProfile }) {
  return BASE + disciplineLayer(disciplineId) + contextLayer({ subject, classroomDocs, recentTopics, studentProfile }) + (MODE_INSTRUCTIONS[mode] || MODE_INSTRUCTIONS.chat);
}

// Convenience wrappers - format a user prompt for each mode
export const userPrompt = {
  chat: (q) => q,
  explain: (topic) => `Explain in depth: ${topic}`,
  generate_notes: (topic, opts = {}) => `Generate comprehensive study notes on: ${topic}${opts.length ? `\nTarget length: ${opts.length}` : ""}${opts.level ? `\nLevel: ${opts.level}` : ""}`,
  generate_flashcards: (topic, count = 10) => `Generate ${count} flashcards covering: ${topic}`,
  generate_quiz: (topic, count = 8) => `Generate ${count} multiple-choice questions on: ${topic}`,
  solve: (problem) => `Solve this problem step by step:\n\n${problem}`,
  summarize: (text) => `Summarize this text:\n\n${text}`,
  translate: (text, target) => `Translate to ${target}:\n\n${text}`
};
