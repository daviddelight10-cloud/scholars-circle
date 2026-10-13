import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { updateUniversalStreak, localDayKey, clampOffset } from "../lib/streak.js";
import express from "express";
const router = express.Router();

// Get all user data
router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;
    console.log("Loading user data for:", userId);

    // Opening the app counts as the day's streak touch (idempotent — no-ops
    // if already counted today; consumes freezes on a gap). Runs before the
    // fetch so the response carries the fresh streak/lastStudied.
    // ?tz=<minutes east of UTC> carries the device's current offset so the
    // streak day uses the user's local calendar, not UTC.
    // streakInfo tells the client what this open did (new day / freeze used /
    // streak broken) — drives the daily streak-moment sheet.
    let streakInfo = null;
    try {
      const tz = req.query.tz !== undefined ? Number(req.query.tz) : undefined;
      streakInfo = await updateUniversalStreak(userId, prisma, Number.isFinite(tz) ? tz : undefined);
    } catch (e) {
      console.warn("[streak] login touch failed:", e?.message);
    }

    const [progress, timetable, flashcards, reminders, chatHistory, notes, discussions, outlineProgress] = await Promise.all([
      prisma.userProgress.findUnique({ where: { userId } }),
      prisma.userTimetable.findUnique({ where: { userId } }),
      prisma.customFlashcard.findMany({ where: { userId } }),
      prisma.reminder.findMany({ where: { userId } }),
      prisma.aIChatMessage.findMany({ where: { userId }, orderBy: { timestamp: "asc" } }),
      prisma.userNote.findMany({ where: { userId } }),
      prisma.discussionPost.findMany({ where: { userId }, include: { replies: true } }),
      prisma.courseOutlineProgress.findMany({ where: { userId } }),
    ]);

    res.json({
      progress,
      timetable: timetable?.timetable || {},
      flashcards,
      reminders,
      chatHistory,
      notes,
      discussions,
      outlineProgress,
      streakInfo,
    });
  } catch (error) {
    console.error("Error fetching user data:", error);
    res.status(500).json({ error: "Failed to fetch user data" });
  }
});

// Per-day activity for the streak calendar: the distinct LOCAL days in the
// requested month with any study signal (quiz attempt, material view, login),
// plus freeze-covered days inferred from gaps inside the current streak run.
// ?month=YYYY-MM (defaults to the user's current local month), ?tz= offset.
router.get("/streak-calendar", requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;
    const tz = req.query.tz !== undefined ? Number(req.query.tz) : undefined;
    const offsetMin = Number.isFinite(tz) ? clampOffset(tz) : 0;

    const monthParam = String(req.query.month || "");
    const monthKey = /^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam)
      ? monthParam
      : localDayKey(Date.now(), offsetMin).slice(0, 7);

    // Local-month window as an absolute-ms range, widened ±1 day so day
    // boundaries can't slip outside the query at extreme offsets.
    const [y, m] = monthKey.split("-").map(Number);
    const monthStart = Date.UTC(y, m - 1, 1);
    const monthEnd = Date.UTC(m === 12 ? y + 1 : y, m % 12, 1);
    const range = { gte: new Date(monthStart - 86400000), lt: new Date(monthEnd + 86400000) };

    // NB: ResourceView timestamps its rows "viewedAt" (no createdAt column).
    const [attempts, views, logins, up] = await Promise.all([
      prisma.quizAttempt.findMany({ where: { userId, createdAt: range }, select: { createdAt: true } }),
      prisma.resourceView.findMany({ where: { userId, viewedAt: range }, select: { viewedAt: true } }),
      prisma.loginEvent.findMany({ where: { userId, createdAt: range }, select: { createdAt: true } }),
      prisma.userProgress.findUnique({ where: { userId }, select: { streak: true, longestStreak: true, lastStudied: true } }),
    ]);

    const daySet = new Set();
    for (const row of attempts.concat(logins)) {
      daySet.add(localDayKey(new Date(row.createdAt).getTime(), offsetMin));
    }
    for (const row of views) {
      daySet.add(localDayKey(new Date(row.viewedAt).getTime(), offsetMin));
    }
    const days = [...daySet].filter((d) => d.startsWith(monthKey)).sort();

    // The streak run covers the last `streak` local days ending at the
    // last-studied local day — days in that window with no activity were
    // covered by a freeze. Only report ones inside the requested month.
    const freezeDays = [];
    if (up?.streak > 0 && up.lastStudied) {
      const lastLocal = localDayKey(new Date(up.lastStudied).getTime(), offsetMin);
      // UTC ms at the *local* midnight of the last-studied day — walking
      // backwards from it keeps every day key exact at any offset (parsing
      // the key bare and re-applying a negative offset shifts a day).
      const lastLocalMs = Date.parse(lastLocal) - offsetMin * 60000;
      for (let i = 0; i < up.streak; i++) {
        const dk = localDayKey(lastLocalMs - i * 86400000, offsetMin);
        if (!dk.startsWith(monthKey)) { if (dk < monthKey) break; continue; }
        if (!daySet.has(dk)) freezeDays.push(dk);
      }
    }

    res.json({
      month: monthKey,
      days,
      freezeDays,
      streak: up?.streak ?? 0,
      longestStreak: up?.longestStreak ?? 0,
    });
  } catch (e) {
    console.error("streak-calendar failed:", e);
    res.status(500).json({ error: "Failed to load streak calendar" });
  }
});

// Store the device's timezone offset (minutes EAST of UTC, e.g. +60 Lagos).
// The streak logic and reminder job read this to use the user's local day.
router.post("/timezone", requireAuth, async (req, res) => {
  try {
    const tz = Number(req.body?.tzOffsetMinutes);
    if (!Number.isFinite(tz) || Math.abs(tz) > 840) {
      return res.status(400).json({ error: "Invalid tzOffsetMinutes" });
    }
    const offset = Math.round(tz);
    await prisma.userProgress.upsert({
      where: { userId: req.user.sub },
      update: { tzOffsetMinutes: offset },
      create: { userId: req.user.sub, tzOffsetMinutes: offset },
    });
    res.json({ tzOffsetMinutes: offset });
  } catch (error) {
    console.error("Error storing timezone:", error);
    res.status(500).json({ error: "Failed to store timezone" });
  }
});

// Save/Update user progress
router.post("/progress", requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;
    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }
    const data = req.body;

    // Verify user exists before upsert
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Read existing XP so we don't clobber XP awarded by quiz-attempts endpoint
    const existingProgress = await prisma.userProgress.findUnique({ where: { userId } });
    const maxXp = Math.max(existingProgress?.xp ?? 0, data.xp ?? 0);

    const progress = await prisma.userProgress.upsert({
      where: { userId },
      update: {
        xp: maxXp,
        sessions: data.sessions,
        // streak + lastStudied are server-owned (updateUniversalStreak /
        // freeze consumption) — accepting client values here would let stale
        // local state overwrite a freeze-preserved streak.
        coins: data.coins,
        weeklyGoal: data.weeklyGoal,
        totalCorrect: data.totalCorrect,
        mastery: data.mastery,
        wrongCounts: data.wrongCounts,
        srData: data.srData,
        lastActivity: data.lastActivity ? new Date(data.lastActivity) : null,
        darkMode: data.darkMode,
        themePack: data.themePack,
        density: data.density,
      },
      create: {
        userId,
        xp: data.xp || 0,
        sessions: data.sessions || 0,
        streak: data.streak || 0,
        coins: data.coins || 0,
        weeklyGoal: data.weeklyGoal || 5,
        totalCorrect: data.totalCorrect || 0,
        mastery: data.mastery || {},
        wrongCounts: data.wrongCounts || {},
        srData: data.srData || {},
        lastStudied: data.lastStudied ? new Date(data.lastStudied) : null,
        lastActivity: data.lastActivity ? new Date(data.lastActivity) : null,
        darkMode: data.darkMode ?? true,
        themePack: data.themePack || "aurora",
        density: data.density || "cozy",
      },
    });

    res.json(progress);
  } catch (error) {
    console.error("Error saving user progress:", error);
    res.status(500).json({ error: "Failed to save user progress" });
  }
});

// Sync 💎 balance — client reports its absolute balance (debounced after
// every earn/spend); server stores it so gems persist across devices.
// Same client-reported trust level as the XP sync above.
router.post("/gems", requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;
    const gems = Number(req.body?.gems);
    if (!Number.isFinite(gems) || gems < 0 || gems > 100000) {
      return res.status(400).json({ error: "Invalid gems value" });
    }
    const progress = await prisma.userProgress.upsert({
      where: { userId },
      update: { gems: Math.round(gems) },
      create: { userId, gems: Math.round(gems) },
    });
    res.json({ gems: progress.gems });
  } catch (error) {
    console.error("Error syncing gems:", error);
    res.status(500).json({ error: "Failed to sync gems" });
  }
});

// Save/Update timetable
router.post("/timetable", requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;
    const { timetable } = req.body;

    // Verify user exists before upsert
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const result = await prisma.userTimetable.upsert({
      where: { userId },
      update: { timetable },
      create: { userId, timetable },
    });

    res.json(result);
  } catch (error) {
    console.error("Error saving timetable:", error);
    res.status(500).json({ error: "Failed to save timetable" });
  }
});

// Custom Flashcards
router.post("/flashcards", requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;
    const { front, back, subject } = req.body;

    const flashcard = await prisma.customFlashcard.create({
      data: { userId, front, back, subject },
    });

    res.json(flashcard);
  } catch (error) {
    console.error("Error creating flashcard:", error);
    res.status(500).json({ error: "Failed to create flashcard" });
  }
});

router.delete("/flashcards/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;
    const { id } = req.params;

    await prisma.customFlashcard.deleteMany({
      where: { id, userId },
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting flashcard:", error);
    res.status(500).json({ error: "Failed to delete flashcard" });
  }
});

// Reminders
router.post("/reminders", requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;
    const { time, label, subject } = req.body;

    const reminder = await prisma.reminder.create({
      data: {
        userId,
        time: new Date(time),
        label,
        subject,
      },
    });

    res.json(reminder);
  } catch (error) {
    console.error("Error creating reminder:", error);
    res.status(500).json({ error: "Failed to create reminder" });
  }
});

router.delete("/reminders/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;
    const { id } = req.params;

    await prisma.reminder.deleteMany({
      where: { id, userId },
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting reminder:", error);
    res.status(500).json({ error: "Failed to delete reminder" });
  }
});

router.patch("/reminders/:id/sent", requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;
    const { id } = req.params;

    const reminder = await prisma.reminder.updateMany({
      where: { id, userId },
      data: { sent: true },
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Error updating reminder:", error);
    res.status(500).json({ error: "Failed to update reminder" });
  }
});

// AI Chat History
router.post("/chat", requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;
    const { role, content } = req.body;

    const message = await prisma.aIChatMessage.create({
      data: { userId, role, content },
    });

    res.json(message);
  } catch (error) {
    console.error("Error saving chat message:", error);
    res.status(500).json({ error: "Failed to save chat message" });
  }
});

router.delete("/chat", requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;

    await prisma.aIChatMessage.deleteMany({
      where: { userId },
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Error clearing chat history:", error);
    res.status(500).json({ error: "Failed to clear chat history" });
  }
});

// Notes
router.post("/notes", requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;
    const { subjectId, content } = req.body;

    const note = await prisma.userNote.upsert({
      where: { userId_subjectId: { userId, subjectId } },
      update: { content },
      create: { userId, subjectId, content },
    });

    res.json(note);
  } catch (error) {
    console.error("Error saving note:", error);
    res.status(500).json({ error: "Failed to save note" });
  }
});

// Discussion Posts
router.post("/discussions", requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;
    const { subjectId, text, role } = req.body;

    const post = await prisma.discussionPost.create({
      data: {
        userId,
        subjectId,
        text,
        role: role || "Student",
      },
    });

    res.json(post);
  } catch (error) {
    console.error("Error creating discussion post:", error);
    res.status(500).json({ error: "Failed to create discussion post" });
  }
});

router.post("/discussions/:postId/replies", requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;
    const { postId } = req.params;
    const { text, role } = req.body;

    const reply = await prisma.discussionReply.create({
      data: {
        postId,
        userId,
        text,
        role: role || "Student",
      },
    });

    res.json(reply);
  } catch (error) {
    console.error("Error creating discussion reply:", error);
    res.status(500).json({ error: "Failed to create discussion reply" });
  }
});

// Course Outline Progress
router.post("/outline-progress", requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;
    const { subjectId, semester, progress } = req.body;

    const outlineProgress = await prisma.courseOutlineProgress.upsert({
      where: { userId_subjectId_semester: { userId, subjectId, semester } },
      update: { progress },
      create: { userId, subjectId, semester, progress },
    });

    res.json(outlineProgress);
  } catch (error) {
    console.error("Error saving outline progress:", error);
    res.status(500).json({ error: "Failed to save outline progress" });
  }
});

// Sync all user data at once (for initial load and periodic sync)
router.post("/sync", requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;
    const data = req.body;

    // Device timezone offset rides along on syncs so the stored offset stays
    // fresh even for sessions that never hit GET /user-data.
    const tz = Number(data.tzOffsetMinutes);
    const tzValid = Number.isFinite(tz) && Math.abs(tz) <= 840;

    // Upsert user progress
    if (data.stats || tzValid) {
      // Read existing XP so we don't clobber XP awarded by quiz-attempts endpoint
      const existing = await prisma.userProgress.findUnique({ where: { userId } });
      const maxXp = Math.max(existing?.xp ?? 0, data.stats?.xp ?? 0);

      await prisma.userProgress.upsert({
        where: { userId },
        update: {
          xp: maxXp,
          sessions: data.stats?.sessions,
          // streak + lastStudied are server-owned (updateUniversalStreak /
          // freeze consumption) — a stale client streak would clobber a
          // freeze-preserved streak otherwise.
          ...(tzValid ? { tzOffsetMinutes: Math.round(tz) } : {}),
          coins: data.stats?.coins,
          weeklyGoal: data.stats?.weeklyGoal,
          totalCorrect: data.stats?.totalCorrect,
          mastery: data.mastery,
          wrongCounts: data.wrongCounts,
          srData: data.srData,
          lastActivity: data.lastActivity ? new Date(data.lastActivity) : null,
        },
        create: {
          userId,
          xp: data.stats?.xp || 0,
          sessions: data.stats?.sessions || 0,
          streak: data.stats?.streak || 0,
          ...(tzValid ? { tzOffsetMinutes: Math.round(tz) } : {}),
          coins: data.stats?.coins || 0,
          weeklyGoal: data.stats?.weeklyGoal || 5,
          totalCorrect: data.stats?.totalCorrect || 0,
          mastery: data.mastery || {},
          wrongCounts: data.wrongCounts || {},
          srData: data.srData || {},
          lastStudied: data.lastStudied ? new Date(data.lastStudied) : null,
          lastActivity: data.lastActivity ? new Date(data.lastActivity) : null,
        },
      });
    }

    // Upsert timetable
    if (data.timetable) {
      await prisma.userTimetable.upsert({
        where: { userId },
        update: { timetable: data.timetable },
        create: { userId, timetable: data.timetable },
      });
    }

    // Sync outline progress
    if (data.outlineProgress) {
      for (const [subjectId, semData] of Object.entries(data.outlineProgress)) {
        for (const [semester, progress] of Object.entries(semData)) {
          await prisma.courseOutlineProgress.upsert({
            where: { userId_subjectId_semester: { userId, subjectId, semester } },
            update: { progress },
            create: { userId, subjectId, semester, progress },
          });
        }
      }
    }

    // Sync notes
    if (data.notes) {
      for (const [subjectId, content] of Object.entries(data.notes)) {
        await prisma.userNote.upsert({
          where: { userId_subjectId: { userId, subjectId } },
          update: { content },
          create: { userId, subjectId, content },
        });
      }
    }

    res.json({ success: true, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error("Error syncing user data:", error);
    res.status(500).json({ error: "Failed to sync user data" });
  }
});

// Get sync timestamp for conflict resolution
router.get("/sync-timestamp", requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;
    const progress = await prisma.userProgress.findUnique({ where: { userId } });
    res.json({
      timestamp: progress?.updatedAt || new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error getting sync timestamp:", error);
    res.status(500).json({ error: "Failed to get sync timestamp" });
  }
});

export default router;
