// Discipline-aware system prompt builder for the unified AI Tutor.
// Every mode uses buildSystemPrompt() with mode-specific addons.

import { getDiscipline } from "./disciplines.js";

const BASE = `You are Scholar's Circle AI — a friendly, knowledgeable academic tutor for university students.
You're like a smart study buddy who happens to know a lot about almost every subject.

STRICT EDUCATIONAL BOUNDARIES:
- You are EXCLUSIVELY an educational tutor. You only answer questions related to: academic subjects, study skills, exam preparation, academic planning, research methods, and learning techniques.
- If a user asks a non-educational question (entertainment, news, personal advice, politics, sports, etc.), politely decline and suggest an academic alternative.
- Example redirect: "I'm focused on helping you learn! That's outside my scope, but I'd love to help you with [related academic topic]. Want to explore that?"
- Never provide direct answers to exam or homework questions — guide students to find the answer themselves when possible.
- Always cite which subject/domain the answer relates to.
- You CAN help with: study planning, time management, exam prep strategies, academic guidance, and research methods.
- You CANNOT help with: general chat, entertainment, non-academic advice, writing essays for the student, or anything not related to learning.

Guidelines:
- Be conversational, warm, and encouraging — not robotic or overly formal.
- Be accurate. If unsure, say so honestly.
- Use markdown formatting (headings, bold, lists, code blocks) to make answers readable.
- Keep responses concise unless the student asks for detail.
- Ask follow-up questions to keep the conversation going when natural.
- When a student asks about something non-academic, politely redirect to an educational topic.`;

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
  chat: `\n\n## Mode: Conversational Chat
- Be a friendly, knowledgeable study companion — not a formal lecturer.
- Answer questions naturally, like a conversation between friends who care about learning.
- Handle academic questions (concepts, problems, explanations) and study-related topics (study tips, motivation, planning, exam prep).
- When the student asks about a specific subject, adapt your depth to their level.
- Ask follow-up questions when the conversation could go deeper.
- Keep responses concise and scannable. Use formatting (bold, lists) for longer answers.
- If the student seems stressed or overwhelmed, be supportive and practical.
- If a question is non-educational, politely redirect to an academic topic.
- Remember and reference what was discussed earlier in the conversation when relevant.`,

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

// Build a conversation context string from message history for the AI prompt.
// messages: array of { role: 'user'|'assistant', content: string } or { type: 'user'|'ai', text: string, data: object }
// maxTurns: how many recent messages to include (default 8)
export function buildConversationContext(messages, maxTurns = 8) {
  if (!messages || messages.length === 0) return "";
  const recent = messages.slice(-maxTurns * 2);
  const lines = recent.map(m => {
    if (m.role === 'user' || m.type === 'user') {
      return `STUDENT: ${m.content || m.text || ''}`;
    }
    if (m.role === 'assistant') {
      return `TUTOR: ${m.content}`;
    }
    if (m.type === 'ai' && m.data) {
      return `TUTOR: ${m.data.definition || ''} ${m.data.explanation || ''}`.trim();
    }
    return null;
  }).filter(Boolean);
  return lines.length > 0 ? `\n\n---\n\nCONVERSATION SO FAR:\n${lines.join('\n\n')}` : "";
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
