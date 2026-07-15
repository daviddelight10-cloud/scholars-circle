import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import express from "express";
const router = express.Router();

// Get all user data
router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;
    console.log("Loading user data for:", userId);

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
    });
  } catch (error) {
    console.error("Error fetching user data:", error);
    res.status(500).json({ error: "Failed to fetch user data" });
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

    const progress = await prisma.userProgress.upsert({
      where: { userId },
      update: {
        xp: data.xp,
        sessions: data.sessions,
        streak: data.streak,
        coins: data.coins,
        weeklyGoal: data.weeklyGoal,
        totalCorrect: data.totalCorrect,
        mastery: data.mastery,
        wrongCounts: data.wrongCounts,
        srData: data.srData,
        lastStudied: data.lastStudied ? new Date(data.lastStudied) : null,
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

    // Upsert user progress
    if (data.stats) {
      await prisma.userProgress.upsert({
        where: { userId },
        update: {
          xp: data.stats.xp,
          sessions: data.stats.sessions,
          streak: data.stats.streak,
          coins: data.stats.coins,
          weeklyGoal: data.stats.weeklyGoal,
          totalCorrect: data.stats.totalCorrect,
          mastery: data.mastery,
          wrongCounts: data.wrongCounts,
          srData: data.srData,
          lastStudied: data.lastStudied ? new Date(data.lastStudied) : null,
          lastActivity: data.lastActivity ? new Date(data.lastActivity) : null,
        },
        create: {
          userId,
          xp: data.stats.xp || 0,
          sessions: data.stats.sessions || 0,
          streak: data.stats.streak || 0,
          coins: data.stats.coins || 0,
          weeklyGoal: data.stats.weeklyGoal || 5,
          totalCorrect: data.stats.totalCorrect || 0,
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
