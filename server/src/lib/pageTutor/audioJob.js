// Per-section audio job. The lesson row returns immediately; sections' audio
// generate in the background so one failed section never redoes the lesson.
// In-process queue — same pattern as the reminder/exam-challenge jobs.
import { prisma } from "../../db.js";
import { synthesizeSection } from "./tts.js";
import { stripStageDirections } from "./lessonSchema.js";
import { saveBuffer, removePrefix, AUDIO_BUCKET } from "../storage.js";

const running = new Set();
let timer = null;

async function updateLessonAudioStatus(lessonId) {
  const rows = await prisma.pageLessonAudio.findMany({ where: { lessonId }, select: { status: true } });
  const total = rows.length;
  const ready = rows.filter((r) => r.status === "ready").length;
  const status = total === 0 ? "skipped"
    : ready === total ? "ready"
    : ready > 0 ? "partial"
    : rows.every((r) => r.status === "failed") ? "failed" : "pending";
  await prisma.pageLesson.update({ where: { id: lessonId }, data: { audioStatus: status } }).catch(() => {});
  return status;
}

async function processSection(lessonId, row) {
  const lesson = await prisma.pageLesson.findUnique({ where: { id: lessonId }, select: { lesson: true, voice: true, ttsChars: true } });
  const section = (lesson?.lesson?.sections || []).find((s) => s.id === row.sectionId);
  const narration = stripStageDirections(section?.narration);
  if (!narration) {
    await prisma.pageLessonAudio.update({ where: { id: row.id }, data: { status: "failed" } }).catch(() => {});
    return;
  }
  const r = await synthesizeSection(narration, lesson.voice || undefined);
  if (!r.ok) {
    console.warn(`[pageTutor] TTS ${lessonId}/${row.sectionId}: ${r.error}`);
    await prisma.pageLessonAudio.update({ where: { id: row.id }, data: { status: "failed" } }).catch(() => {});
    return;
  }
  try {
    const objectPath = `${lessonId}/${row.sectionId}.mp3`;
    const stored = await saveBuffer(r.mp3, objectPath, { bucket: AUDIO_BUCKET, contentType: "audio/mpeg" });
    await prisma.pageLessonAudio.update({
      where: { id: row.id },
      data: { path: stored, bytes: r.mp3.byteLength, durationMs: r.durationMs, status: "ready" },
    });
    await prisma.pageLesson.update({
      where: { id: lessonId },
      data: { ttsChars: { increment: r.chars } },
    }).catch(() => {});
  } catch (err) {
    console.warn(`[pageTutor] storage ${lessonId}/${row.sectionId}: ${err.message}`);
    await prisma.pageLessonAudio.update({ where: { id: row.id }, data: { status: "failed" } }).catch(() => {});
  }
}

export function enqueueAudio(lessonId) {
  if (running.has(lessonId)) return;
  running.add(lessonId);
  (async () => {
    try {
      const rows = await prisma.pageLessonAudio.findMany({
        where: { lessonId, status: { in: ["pending", "failed"] } },
        orderBy: { sectionId: "asc" },
      });
      for (const row of rows) await processSection(lessonId, row);
      await updateLessonAudioStatus(lessonId);
    } finally {
      running.delete(lessonId);
    }
  })().catch((e) => console.warn("[pageTutor] audio job:", e.message));
}

// Rows seeded when the lesson is created.
export async function seedAudioRows(lessonId, sections) {
  await prisma.pageLessonAudio.createMany({
    data: sections.map((s) => ({ lessonId, sectionId: s.id, path: "", status: "pending" })),
    skipDuplicates: true,
  });
}

// Regenerate: wipe stored objects + rows, reseed, re-enqueue.
export async function resetAudio(lessonId, sections) {
  await removePrefix(`${lessonId}/`, { bucket: AUDIO_BUCKET }).catch(() => {});
  await prisma.pageLessonAudio.deleteMany({ where: { lessonId } }).catch(() => {});
  await seedAudioRows(lessonId, sections);
}

// Boot sweep — restart orphans lessons whose audio was mid-flight on deploy.
export function startPageTutorSweeper() {
  if (timer) return;
  const sweep = async () => {
    try {
      const lessons = await prisma.pageLesson.findMany({
        where: { audioStatus: { in: ["pending", "partial"] } },
        select: { id: true },
        take: 20,
      });
      for (const l of lessons) enqueueAudio(l.id);
    } catch { /* db may not be ready yet */ }
  };
  sweep();
  timer = setInterval(sweep, 5 * 60 * 1000);
  timer.unref?.();
}
