// Daily study reminder + motivation push job.
// - Morning motivation push ~7am local
// - Exam countdown push ~8am local (per own UserCoursePref.examDate)
// - Evening "have you studied?" reminder ~6pm local (cards-due when ≥5 due)
// Slots fire in each user's OWN local time (UserProgress.tzOffsetMinutes),
// so a Lagos evening reminder isn't sent an hour early.
// Respects NotificationPreference.studyReminders / .examAlerts flags.
// Runs every 30 min; each user gets each slot once per local day.

import { prisma } from "../db.js";
import { sendPushToUsers, sendPushToUser } from "./pushSender.js";

// === Content pools ===
const MORNING_MOTIVATIONS = [
  { title: "🌅 Good morning, scholar!", body: "Small consistent steps beat occasional cramming. Tackle one topic today and your future self will thank you." },
  { title: "💪 You've got this!", body: "The expert in anything was once a beginner. 30 focused minutes today moves the needle." },
  { title: "🧠 Brain's freshest now", body: "Studies show morning sessions build deeper memory. Open your weakest subject and warm up with 5 questions." },
  { title: "🚀 Make today count", body: "You don't need to study everything — pick one chapter, master it, repeat tomorrow." },
  { title: "🌟 New day, new wins", body: "Yesterday's mistakes are today's lessons. Open Scholar's Circle and turn confusion into clarity." },
  { title: "📚 Your edge is consistency", body: "Top students aren't smarter — they just show up daily. You're already here. Now go do 1 quiz." },
  { title: "✨ Tiny effort, huge impact", body: "Just 20 minutes of focused practice today = 2.3 hours saved during exams. Start now." },
  { title: "🎯 Focus mode on", body: "Pick the subject that scares you most. Spend 15 minutes there. The fear shrinks every time." },
  { title: "🔥 You're closer than yesterday", body: "Every question answered, every review cleared — they all stack. Open the app, take one step." },
  { title: "☕ Coffee + courses = magic", body: "Brew a drink, open one chapter, and let curiosity do the rest. You don't need motivation, just movement." }
];

const EVENING_REMINDERS = [
  { title: "🌙 Don't break your streak!", body: "A quick 10-minute review tonight keeps the knowledge fresh. Open the app and do 3 questions." },
  { title: "📖 5 minutes can save your week", body: "Spend just 5 minutes reviewing today's class — research shows it triples retention." },
  { title: "🎓 End your day strong", body: "Pick one topic that confused you today and ask the AI Tutor. Sleep on it, wake up smarter." },
  { title: "⏰ Quick check-in", body: "Have you studied today? Even 10 questions counts. Don't let momentum slip." },
  { title: "🌟 Future-you will be glad", body: "It's the small daily practice that wins exams — not last-minute cramming. 15 minutes now?" },
  { title: "💡 One more session?", body: "Your brain consolidates while you sleep. Feed it something to work on tonight." },
  { title: "🧩 Close the loop on today", body: "Review one classroom announcement or do 3 past paper questions. Then rest guilt-free." },
  { title: "🎯 You showed up today?", body: "If yes — well done! If not — there's still time. 10 questions before bed beats 0." }
];

const STREAK_RISK_BODIES = [
  "One quick review keeps it alive — 5 questions is all it takes.",
  "You've built something real. Protect it with one session before midnight.",
  "Don't let the momentum slip — a 5-minute review saves the whole streak.",
  "It only takes one run to keep the flame burning. Open Daily Review now."
];

const STUDY_TIPS = [
  "💡 Tip: Active recall (testing yourself) is 4x more effective than re-reading.",
  "💡 Tip: Teach a concept to your phone in your own words — if you can't, you don't know it yet.",
  "💡 Tip: Spaced repetition beats marathon sessions. Use Daily Review every day.",
  "💡 Tip: Hard problems first — your brain is freshest in the first 25 minutes.",
  "💡 Tip: Sleep is study time. 8 hours = better recall than another hour cramming.",
  "💡 Tip: Use the Pomodoro timer: 25 min focus, 5 min break. Repeat 4×, then rest 20."
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Escalating exam-countdown copy. `daysLeft` is a calendar-day difference
// (local day vs stored exam date), so 0 = exam day.
function examCountdownCopy(course, daysLeft) {
  if (daysLeft === 30) return { title: `📅 One month to ${course}`, body: "Perfect time to plan your revision — a little every day beats a cram." };
  if (daysLeft === 21) return { title: `📅 3 weeks to ${course}`, body: "Start your spaced reviews now — clear a few cards daily and walk in ready." };
  if (daysLeft > 7) return { title: `📅 ${daysLeft} days to ${course}`, body: "Keep the daily reviews going — consistency now is marks later." };
  if (daysLeft === 7) return { title: `📅 One week to ${course}`, body: "Time for full practice sets — run a practice sheet and patch the gaps." };
  if (daysLeft >= 2) return { title: `⏰ ${daysLeft} days to ${course} — final stretch`, body: "Prioritise your weakest topics; short focused sessions win." };
  if (daysLeft === 1) return { title: `🔥 ${course} exam is TOMORROW`, body: "Light review only — glance at your weak cards, then sleep early." };
  return { title: `🍀 ${course} exam day — go get it!`, body: "You've put the work in. Stay calm, read each question twice." };
}

// Per-user local time. UserProgress.tzOffsetMinutes = minutes EAST of UTC
// (reported by the client; 0 = UTC default). Shifted-UTC trick: add the
// offset, then read UTC fields — that IS the user's local calendar.
function localParts(nowMs, offsetMin) {
  const off = Math.max(-840, Math.min(840, Number(offsetMin) || 0));
  const shifted = new Date(nowMs + off * 60000);
  return {
    hour: shifted.getUTCHours(),
    day: shifted.toISOString().slice(0, 10),
    // Instant at which the user's local "today" began (UTC ms).
    dayStartUtcMs: Math.floor((nowMs + off * 60000) / 86400000) * 86400000 - off * 60000,
  };
}

// Dedup: `${kind}:${userId}:${localDay}` — each user gets each slot once
// per their own day. Cleared on UTC rollover to bound memory.
const sentKeys = new Set();
let lastUtcDay = null;

/**
 * Local-time slots, evaluated per user every tick:
 *   local hour 7  → morning motivation
 *   local hour 8  → exam countdown (own UserCoursePref.examDate, last 2 weeks
 *                   daily + 30/21-day milestones)
 *   local hour 18 → evening reminder (streak-risk if they haven't studied
 *                   their local today, cards-due when ≥5 FSRS items are due,
 *                   generic otherwise)
 */
async function sendSlotReminders(nowMs) {
  const subs = await prisma.pushSubscription.findMany({ select: { userId: true }, distinct: ["userId"] });
  const allUserIds = [...new Set(subs.map((s) => s.userId))];
  if (allUserIds.length === 0) return { sent: 0, reason: "no_subscribers" };

  const progressRows = await prisma.userProgress.findMany({
    where: { userId: { in: allUserIds } },
    select: { userId: true, streak: true, lastStudied: true, tzOffsetMinutes: true },
  }).catch(() => []);
  const prog = new Map(progressRows.map((p) => [p.userId, p]));

  // Own exam dates (UserCoursePref) → per-user list for the countdown slot.
  const examPrefs = await prisma.userCoursePref.findMany({
    where: { userId: { in: allUserIds }, examDate: { not: null } },
    select: { userId: true, courseCode: true, examDate: true },
  }).catch(() => []);
  const examsByUser = new Map();
  for (const e of examPrefs) {
    if (!examsByUser.has(e.userId)) examsByUser.set(e.userId, []);
    examsByUser.get(e.userId).push(e);
  }

  // FSRS cards due right now → per-user count for the evening cards-due nudge.
  const dueGroups = await prisma.pdfReviewItem.groupBy({
    by: ["userId"],
    where: { userId: { in: allUserIds }, dueAt: { lte: new Date(nowMs) } },
    _count: { _all: true },
  }).catch(() => []);
  const dueCounts = new Map(dueGroups.map((g) => [g.userId, g._count._all]));

  const morningIds = [];
  const streakRisk = []; // { userId, streak }
  const cardsDue = []; // { userId, count }
  const genericIds = [];
  const examCountdowns = []; // { userId, courseCode, daysLeft }

  for (const userId of allUserIds) {
    const p = prog.get(userId);
    const { hour, day, dayStartUtcMs } = localParts(nowMs, p?.tzOffsetMinutes);

    if (hour === 7 && !sentKeys.has(`m:${userId}:${day}`)) {
      sentKeys.add(`m:${userId}:${day}`);
      morningIds.push(userId);
    }

    if (hour === 8) {
      for (const e of examsByUser.get(userId) || []) {
        const key = `x:${userId}:${e.courseCode}:${day}`;
        if (sentKeys.has(key)) continue;
        // examDate is stored as new Date("YYYY-MM-DD") = UTC midnight, so its
        // UTC date part IS the intended calendar day — comparing ISO days
        // avoids any timezone drift in the difference.
        const examDay = e.examDate.toISOString().slice(0, 10);
        const daysLeft = Math.round((Date.parse(`${examDay}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / 86400000);
        if (daysLeft === 30 || daysLeft === 21 || (daysLeft >= 0 && daysLeft <= 14)) {
          sentKeys.add(key);
          examCountdowns.push({ userId, courseCode: e.courseCode, daysLeft });
        }
      }
    }

    if (hour === 18 && !sentKeys.has(`e:${userId}:${day}`)) {
      sentKeys.add(`e:${userId}:${day}`);
      const studiedToday = p?.lastStudied && new Date(p.lastStudied).getTime() >= dayStartUtcMs;
      const dueCount = dueCounts.get(userId) || 0;
      if (!studiedToday && (p?.streak || 0) > 0) streakRisk.push({ userId, streak: p.streak });
      else if (dueCount >= 5) cardsDue.push({ userId, count: dueCount });
      else if (!studiedToday) genericIds.push(userId);
    }
  }

  let sent = 0;

  if (morningIds.length) {
    const m = pick(MORNING_MOTIVATIONS);
    const tip = Math.random() < 0.5 ? "\n\n" + pick(STUDY_TIPS) : "";
    const r = await sendPushToUsers(
      morningIds,
      { title: m.title, body: m.body + tip, tag: "daily-motivation", data: { tab: "today", kind: "motivation" } },
      { category: "studyReminders" }
    );
    sent += r.sent || 0;
    console.log(`[reminder] morning motivation -> ${r.sent}/${morningIds.length}`);
  }

  if (streakRisk.length) {
    await Promise.all(
      streakRisk.map(async (u) => {
        const r = await sendPushToUser(
          u.userId,
          {
            title: `🔥 Your ${u.streak}-day streak ends tonight!`,
            body: pick(STREAK_RISK_BODIES),
            tag: "streak-risk",
            data: { tab: "today", kind: "streak_risk" }
          },
          { category: "studyReminders" }
        ).catch(() => ({ sent: 0 }));
        sent += r.sent || 0;
      })
    );
  }

  if (genericIds.length) {
    const m = pick(EVENING_REMINDERS);
    const r = await sendPushToUsers(
      genericIds,
      { title: m.title, body: m.body, tag: "daily-reminder", data: { tab: "today", kind: "study_reminder" } },
      { category: "studyReminders" }
    );
    sent += r.sent || 0;
  }

  if (cardsDue.length) {
    await Promise.all(
      cardsDue.map(async (u) => {
        const r = await sendPushToUser(
          u.userId,
          {
            title: `📚 ${u.count} cards due for review`,
            body: "Clear them tonight — 10 focused minutes keeps them out of tomorrow's pile.",
            tag: "cards-due",
            data: { tab: "today", kind: "cards_due" }
          },
          { category: "studyReminders" }
        ).catch(() => ({ sent: 0 }));
        sent += r.sent || 0;
      })
    );
  }

  if (examCountdowns.length) {
    await Promise.all(
      examCountdowns.map(async (x) => {
        const msg = examCountdownCopy(x.courseCode, x.daysLeft);
        const r = await sendPushToUser(
          x.userId,
          {
            title: msg.title,
            body: msg.body,
            tag: `exam-${x.courseCode}`,
            data: { tab: "today", kind: "exam_countdown", courseCode: x.courseCode }
          },
          { category: "examAlerts" }
        ).catch(() => ({ sent: 0 }));
        sent += r.sent || 0;
      })
    );
    console.log(`[reminder] exam countdown -> ${examCountdowns.length} push(es)`);
  }

  if (streakRisk.length || cardsDue.length || genericIds.length) {
    console.log(`[reminder] evening -> streak-risk ${streakRisk.length}, cards-due ${cardsDue.length}, generic ${genericIds.length}`);
  }
  return { sent, users: morningIds.length + streakRisk.length + cardsDue.length + genericIds.length + examCountdowns.length };
}

async function tick() {
  const nowMs = Date.now();
  const utcDay = new Date(nowMs).toISOString().slice(0, 10);
  if (utcDay !== lastUtcDay) {
    sentKeys.clear();
    lastUtcDay = utcDay;
  }
  try {
    await sendSlotReminders(nowMs);
  } catch (err) {
    console.error("[reminder] tick failed:", err.message);
  }
}

let started = false;
export function startStudyReminderJob() {
  if (started) return;
  started = true;
  // Run every 30 minutes — guarantees we catch the slot even if a tick is delayed.
  setInterval(tick, 30 * 60 * 1000);
  // Also run shortly after server start so missed slots aren't lost on a deploy.
  setTimeout(tick, 30 * 1000);
  console.log("[reminder] Study reminder job started (07:00 motivation, 08:00 exam countdown, 18:00 evening — local time daily)");
}

// Exposed for the manual test endpoint.
export async function runMotivationNow(userId) {
  if (!userId) return { sent: 0 };
  const m = pick(MORNING_MOTIVATIONS);
  const tip = pick(STUDY_TIPS);
  const { sendPushToUser } = await import("./pushSender.js");
  return await sendPushToUser(
    userId,
    {
      title: m.title,
      body: m.body + "\n\n" + tip,
      tag: "manual-motivation",
      data: { tab: "today", kind: "motivation" }
    },
    { category: "studyReminders" }
  );
}
