// Daily study reminder + motivation push job.
// - Morning motivation push (06:00 UTC ≈ 7am Lagos / 6am UK summer)
// - Evening "have you studied?" reminder (18:00 UTC ≈ 7pm Lagos / 7pm UK summer)
// Respects each user's NotificationPreference.studyReminders flag.
// Runs hourly; if the current UTC hour matches a slot, sends to all eligible users.

import { prisma } from "../db.js";
import { sendPushToUsers } from "./pushSender.js";

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
  { title: "🔥 You're closer than yesterday", body: "Every question answered, every flashcard reviewed — they all stack. Open the app, take one step." },
  { title: "☕ Coffee + courses = magic", body: "Brew a drink, open one chapter, and let curiosity do the rest. You don't need motivation, just movement." }
];

const EVENING_REMINDERS = [
  { title: "🌙 Don't break your streak!", body: "A quick 10-minute review tonight keeps the knowledge fresh. Open the app and do 3 flashcards." },
  { title: "📖 5 minutes can save your week", body: "Spend just 5 minutes reviewing today's class — research shows it triples retention." },
  { title: "🎓 End your day strong", body: "Pick one topic that confused you today and ask the AI Tutor. Sleep on it, wake up smarter." },
  { title: "⏰ Quick check-in", body: "Have you studied today? Even 10 questions counts. Don't let momentum slip." },
  { title: "🌟 Future-you will be glad", body: "It's the small daily practice that wins exams — not last-minute cramming. 15 minutes now?" },
  { title: "💡 One more session?", body: "Your brain consolidates while you sleep. Feed it something to work on tonight." },
  { title: "🧩 Close the loop on today", body: "Review one classroom announcement or do 3 past paper questions. Then rest guilt-free." },
  { title: "🎯 You showed up today?", body: "If yes — well done! If not — there's still time. 10 questions before bed beats 0." }
];

const STUDY_TIPS = [
  "💡 Tip: Active recall (testing yourself) is 4x more effective than re-reading.",
  "💡 Tip: Teach a concept to your phone in your own words — if you can't, you don't know it yet.",
  "💡 Tip: Spaced repetition beats marathon sessions. Use the Flashcards tab daily.",
  "💡 Tip: Hard problems first — your brain is freshest in the first 25 minutes.",
  "💡 Tip: Sleep is study time. 8 hours = better recall than another hour cramming.",
  "💡 Tip: Use the Pomodoro timer: 25 min focus, 5 min break. Repeat 4×, then rest 20."
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Send the morning motivation to every user who has opted in.
 */
async function sendMorningMotivation() {
  const subs = await prisma.pushSubscription.findMany({ select: { userId: true }, distinct: ["userId"] });
  const userIds = [...new Set(subs.map((s) => s.userId))];
  if (userIds.length === 0) return { sent: 0, reason: "no_subscribers" };

  const m = pick(MORNING_MOTIVATIONS);
  const tip = Math.random() < 0.5 ? "\n\n" + pick(STUDY_TIPS) : "";

  const result = await sendPushToUsers(
    userIds,
    {
      title: m.title,
      body: m.body + tip,
      tag: "daily-motivation",
      data: { tab: "today", kind: "motivation" }
    },
    { category: "studyReminders" }
  );
  console.log(`[reminder] morning motivation -> ${result.sent}/${result.users}`);
  return result;
}

/**
 * Send evening study reminder to users who haven't recorded a session today.
 * Falls back to all opted-in users if no session-tracking is wired.
 */
async function sendEveningReminder() {
  const subs = await prisma.pushSubscription.findMany({ select: { userId: true }, distinct: ["userId"] });
  const allUserIds = [...new Set(subs.map((s) => s.userId))];
  if (allUserIds.length === 0) return { sent: 0, reason: "no_subscribers" };

  // Best-effort: skip users who already have a study activity in the last 12h.
  // The schema may or may not have an "Activity" model — we silently skip if not.
  let inactiveUserIds = allUserIds;
  try {
    const since = new Date(Date.now() - 12 * 60 * 60 * 1000);
    if (prisma.studySession?.findMany) {
      const recent = await prisma.studySession.findMany({
        where: { createdAt: { gte: since } },
        select: { userId: true },
        distinct: ["userId"]
      });
      const activeIds = new Set(recent.map((r) => r.userId));
      inactiveUserIds = allUserIds.filter((id) => !activeIds.has(id));
    }
  } catch {
    // ignore — model may not exist
  }

  if (inactiveUserIds.length === 0) return { sent: 0, reason: "everyone_studied_today" };

  const m = pick(EVENING_REMINDERS);
  const result = await sendPushToUsers(
    inactiveUserIds,
    {
      title: m.title,
      body: m.body,
      tag: "daily-reminder",
      data: { tab: "today", kind: "study_reminder" }
    },
    { category: "studyReminders" }
  );
  console.log(`[reminder] evening reminder -> ${result.sent}/${result.users}`);
  return result;
}

// Track which slots we've already fired today to avoid duplicates if the loop fires twice in one hour.
const firedToday = new Set();
let lastDayKey = null;

/**
 * Hourly tick. Fires the appropriate slot based on current UTC hour.
 * Slots:
 *   06:00 UTC → morning motivation
 *   18:00 UTC → evening study reminder
 */
async function tick() {
  const now = new Date();
  const dayKey = now.toISOString().slice(0, 10); // YYYY-MM-DD
  if (dayKey !== lastDayKey) {
    firedToday.clear();
    lastDayKey = dayKey;
  }

  const hourUtc = now.getUTCHours();
  try {
    if (hourUtc === 6 && !firedToday.has("morning")) {
      firedToday.add("morning");
      await sendMorningMotivation();
    }
    if (hourUtc === 18 && !firedToday.has("evening")) {
      firedToday.add("evening");
      await sendEveningReminder();
    }
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
  console.log("[reminder] Study reminder job started (06:00 + 18:00 UTC daily)");
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
