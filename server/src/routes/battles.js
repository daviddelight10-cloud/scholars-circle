import { Router } from "express";
import rateLimit from "express-rate-limit";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { createRoom, registerParticipant, getRoomByCode } from "../lib/liveQuizRooms.js";
import {
  isGroupCaptain,
  validateLineup,
  rankedGuards,
  pendingExpiry,
  sweepBattles,
  hydrateLineups,
  MAX_LINEUP,
} from "../lib/battles.js";
import { normalizeMcqData, shuffle, identityFor } from "./liveQuiz.js";
import { generateTicket } from "./voiceSession.js";

const router = Router();

// Challenges push the opponent captain — cap them like live-quiz creates.
const challengeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.sub || req.ip,
  message: { error: "Too many challenges — try again in a bit" },
});

function userId(req) {
  return req.user.sub || req.user.id;
}

// Live-room annotation for list rows (rooms are in-memory, may be gone).
function liveInfo(battle) {
  const room = battle.liveCode ? getRoomByCode(battle.liveCode) : null;
  return {
    liveCode: battle.liveCode,
    livePhase: room?.phase || null,
    players: room ? room.participants.size : 0,
  };
}

function shapeBattle(b, uid, myCaptainIds) {
  const inA = (b.lineupA || []).map(String).includes(uid);
  const inB = (b.lineupB || []).map(String).includes(uid);
  const expired = b.status === "pending" && new Date(b.expiresAt) < new Date();
  return {
    id: b.id,
    status: expired ? "expired" : b.status,
    mode: b.mode,
    title: b.title,
    createdAt: b.createdAt,
    scheduledFor: b.scheduledFor,
    completedAt: b.completedAt,
    numQuestions: b.numQuestions,
    timePerQuestion: b.timePerQuestion,
    a: {
      id: b.challenger.id, name: b.challenger.name, subject: b.challenger.subject,
      score: b.scoreA, ratingDelta: b.ratingDeltaA, size: (b.lineupA || []).length,
      rating: b.challenger.rating,
    },
    b: {
      id: b.challenged.id, name: b.challenged.name, subject: b.challenged.subject,
      score: b.scoreB, ratingDelta: b.ratingDeltaB, size: (b.lineupB || []).length,
      rating: b.challenged.rating,
    },
    winnerId: b.winnerId,
    myTeam: inA ? "a" : inB ? "b" : null,
    // I'm the challenged captain and the ball is in my court.
    needsLineup: b.status === "pending" && !expired && myCaptainIds.has(b.challengedId),
    // I'm in a lineup and the room is live — join button.
    joinable: b.status === "active" && (inA || inB),
    ...liveInfo(b),
  };
}

const BATTLE_INCLUDE = {
  challenger: { select: { id: true, name: true, subject: true, rating: true, createdById: true } },
  challenged: { select: { id: true, name: true, subject: true, rating: true, createdById: true } },
};

// Groups I captain (creator OR role="captain") — for needsLineup flags.
async function myCaptainGroupIds(uid) {
  const [created, captained] = await Promise.all([
    prisma.classroom.findMany({ where: { createdById: uid, kind: "group" }, select: { id: true } }),
    prisma.classroomMember.findMany({ where: { userId: uid, role: "captain" }, select: { classroomId: true } }),
  ]);
  return new Set([...created.map((g) => g.id), ...captained.map((m) => m.classroomId)]);
}

async function myGroupIds(uid) {
  const [created, memberships] = await Promise.all([
    prisma.classroom.findMany({ where: { createdById: uid, kind: "group" }, select: { id: true } }),
    prisma.classroomMember.findMany({ where: { userId: uid }, select: { classroomId: true } }),
  ]);
  return new Set([...created.map((g) => g.id), ...memberships.map((m) => m.classroomId)]);
}

// GET /api/battles/opponents?q=&from= — groups you can challenge. Challenging
// isn't joining: private groups are eligible (group names are already public
// on the leaderboard). Matches name/description, or joinCode exactly so a
// private clan can be found by its invite code. `from` excludes the
// challenging group itself.
router.get("/opponents", requireAuth, async (req, res) => {
  try {
    const { q = "", from } = req.query;
    const term = String(q).trim();
    const groups = await prisma.classroom.findMany({
      where: {
        kind: "group",
        ...(from ? { id: { not: String(from) } } : {}),
        ...(term
          ? {
              OR: [
                { name: { contains: term, mode: "insensitive" } },
                { description: { contains: term, mode: "insensitive" } },
                { joinCode: { equals: term.toUpperCase() } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        subject: true,
        rating: true,
        rankedWins: true,
        rankedLosses: true,
        createdBy: { select: { id: true, username: true, fullName: true } },
        _count: { select: { members: true } },
      },
      orderBy: [{ rating: "desc" }, { createdAt: "desc" }],
      take: 40,
    });
    res.json(
      groups.map((g) => ({
        id: g.id,
        name: g.name,
        subject: g.subject,
        memberCount: g._count?.members ?? 0,
        rating: g.rating,
        record: g.rankedWins || g.rankedLosses ? `${g.rankedWins}W–${g.rankedLosses}L` : null,
        creator: g.createdBy
          ? { id: g.createdBy.id, name: g.createdBy.fullName || g.createdBy.username || "Scholar" }
          : null,
      }))
    );
  } catch (error) {
    console.error("Error searching opponents:", error);
    res.status(500).json({ error: "Failed to search groups" });
  }
});

// POST /api/battles — captain challenges another group.
// { fromId, toId, mcqResourceId, mode, lineupIds, scheduledFor?, timePerQuestion?, numQuestions? }
router.post("/", requireAuth, challengeLimiter, async (req, res) => {
  try {
    const uid = userId(req);
    const { fromId, toId, mcqResourceId, mode = "friendly", lineupIds, scheduledFor, timePerQuestion, numQuestions } = req.body || {};
    if (!fromId || !toId) return res.status(400).json({ error: "fromId and toId are required" });
    if (fromId === toId) return res.status(400).json({ error: "A group can't battle itself" });
    if (!mcqResourceId) return res.status(400).json({ error: "Pick a question set for the battle" });
    if (!["friendly", "ranked"].includes(mode)) return res.status(400).json({ error: "mode must be friendly or ranked" });

    if (!(await isGroupCaptain(fromId, uid))) {
      return res.status(403).json({ error: "Only a group captain can send challenges" });
    }

    const [from, to] = await Promise.all([
      prisma.classroom.findUnique({ where: { id: fromId }, select: { id: true, name: true, kind: true, createdById: true } }),
      prisma.classroom.findUnique({ where: { id: toId }, select: { id: true, name: true, kind: true, createdById: true, _count: { select: { members: true } } } }),
    ]);
    if (!from || !to || to.kind !== "group") return res.status(404).json({ error: "Group not found" });

    const ranked = mode === "ranked";
    const lineupCheck = await validateLineup(fromId, lineupIds, { ranked });
    if (!lineupCheck.ok) return res.status(400).json({ error: lineupCheck.error });
    if (ranked) {
      const guard = await rankedGuards(fromId, toId);
      if (!guard.ok) return res.status(400).json({ error: guard.error });
    }

    // Same material rules as hosting a live quiz: yours, or approved.
    const mcq = await prisma.resource.findUnique({
      where: { id: mcqResourceId },
      select: {
        id: true, title: true, contentType: true, mcqData: true,
        sourceResourceId: true, status: true, uploadedBy: true,
        sourceResource: { select: { status: true } },
      },
    });
    if (!mcq || mcq.contentType !== "mcq" || !mcq.mcqData) {
      return res.status(400).json({ error: "That material has no MCQ questions" });
    }
    const allowed =
      mcq.uploadedBy === uid || mcq.status === "approved" || mcq.sourceResource?.status === "approved";
    if (!allowed || mcq.status === "rejected") {
      return res.status(403).json({ error: "You can't battle with this material" });
    }
    const questionCount = normalizeMcqData(mcq.mcqData).length;
    if (questionCount === 0) return res.status(400).json({ error: "This MCQ set is empty" });

    let scheduled = null;
    if (scheduledFor) {
      scheduled = new Date(scheduledFor);
      if (Number.isNaN(scheduled.getTime()) || scheduled <= new Date()) {
        return res.status(400).json({ error: "scheduledFor must be a future time" });
      }
      if (scheduled > new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)) {
        return res.status(400).json({ error: "Scheduled wars max 14 days out" });
      }
    }

    // One open challenge per pairing at a time.
    const open = await prisma.groupBattle.findFirst({
      where: { status: { in: ["pending", "active"] }, challengerId: fromId, challengedId: toId },
      select: { id: true },
    });
    if (open) return res.status(409).json({ error: "There's already an open challenge between these groups" });

    const battle = await prisma.groupBattle.create({
      data: {
        challengerId: fromId,
        challengedId: toId,
        createdById: uid,
        mcqResourceId: mcq.id,
        mode,
        title: mcq.title,
        lineupA: lineupCheck.lineup,
        timePerQuestion: [15, 20, 30, 45, 60].includes(timePerQuestion) ? timePerQuestion : 20,
        numQuestions: Math.max(1, Math.min(parseInt(numQuestions, 10) || 10, questionCount, 25)),
        scheduledFor: scheduled,
        expiresAt: pendingExpiry(),
      },
      include: BATTLE_INCLUDE,
    });

    // Ping the opponent's captains (creator + promoted captains).
    (async () => {
      try {
        const { sendPushToUsers } = await import("../lib/pushSender.js");
        const captains = await prisma.classroomMember.findMany({
          where: { classroomId: toId, role: "captain" },
          select: { userId: true },
        });
        const me = await prisma.user.findUnique({ where: { id: uid }, select: { fullName: true, username: true } });
        await sendPushToUsers(
          [...new Set([to.createdById, ...captains.map((c) => c.userId)])],
          {
            title: `⚔️ ${from.name} challenges ${to.name}`,
            body: `${me?.fullName || me?.username || "A captain"} calls out your clan — ${lineupCheck.lineup.length}v${lineupCheck.lineup.length}, ${battle.numQuestions} questions${mode === "ranked" ? " · ranked" : ""}`,
            tag: `battle-${battle.id}`,
            data: { tab: "discuss", feedTab: "groups", battle: battle.id },
          },
          { category: "social" }
        );
      } catch (e) {
        console.warn("[battle] challenge push failed:", e?.message);
      }
    })();

    res.status(201).json(shapeBattle(battle, uid, await myCaptainGroupIds(uid)));
  } catch (err) {
    console.error("Battle create error:", err);
    res.status(500).json({ error: "Failed to create battle" });
  }
});

// GET /api/battles/mine — battles touching any of my groups (captain actions
// flagged per battle). Registered before /:id.
router.get("/mine", requireAuth, async (req, res) => {
  try {
    const uid = userId(req);
    sweepBattles().catch(() => {});
    const ids = [...(await myGroupIds(uid))];
    if (!ids.length) return res.json([]);
    const battles = await prisma.groupBattle.findMany({
      where: { OR: [{ challengerId: { in: ids } }, { challengedId: { in: ids } }] },
      include: BATTLE_INCLUDE,
      orderBy: { createdAt: "desc" },
      take: 40,
    });
    const caps = await myCaptainGroupIds(uid);
    res.json(battles.map((b) => shapeBattle(b, uid, caps)));
  } catch (err) {
    console.error("Battles mine error:", err);
    res.status(500).json({ error: "Failed to load battles" });
  }
});

// GET /api/battles/group/:classroomId — history for one group (member-gated).
router.get("/group/:classroomId", requireAuth, async (req, res) => {
  try {
    const uid = userId(req);
    const { classroomId } = req.params;
    const member = await prisma.classroomMember.findUnique({
      where: { classroomId_userId: { classroomId, userId: uid } },
      select: { userId: true },
    }).catch(() => null);
    const owned = await prisma.classroom.findFirst({
      where: { id: classroomId, createdById: uid },
      select: { id: true },
    });
    if (!member && !owned) return res.status(403).json({ error: "Not a member" });

    sweepBattles().catch(() => {});
    const battles = await prisma.groupBattle.findMany({
      where: { OR: [{ challengerId: classroomId }, { challengedId: classroomId }] },
      include: BATTLE_INCLUDE,
      orderBy: { createdAt: "desc" },
      take: 25,
    });
    const caps = await myCaptainGroupIds(uid);
    res.json(battles.map((b) => shapeBattle(b, uid, caps)));
  } catch (err) {
    console.error("Group battles error:", err);
    res.status(500).json({ error: "Failed to load battles" });
  }
});

// GET /api/battles/:id — detail + hydrated lineups (members of either side).
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const uid = userId(req);
    const b = await prisma.groupBattle.findUnique({
      where: { id: req.params.id },
      include: BATTLE_INCLUDE,
    });
    if (!b) return res.status(404).json({ error: "Battle not found" });
    const mine = await myGroupIds(uid);
    if (!mine.has(b.challengerId) && !mine.has(b.challengedId)) {
      return res.status(403).json({ error: "Not a member of either group" });
    }
    const lineups = await hydrateLineups(b);
    const caps = await myCaptainGroupIds(uid);
    res.json({ ...shapeBattle(b, uid, caps), lineups });
  } catch (err) {
    console.error("Battle detail error:", err);
    res.status(500).json({ error: "Failed to load battle" });
  }
});

// POST /api/battles/:id/accept — challenged captain sets their lineup; the
// live room is created here and both lineups get pinged to join.
router.post("/:id/accept", requireAuth, async (req, res) => {
  try {
    const uid = userId(req);
    const { lineupIds } = req.body || {};
    const b = await prisma.groupBattle.findUnique({
      where: { id: req.params.id },
      include: BATTLE_INCLUDE,
    });
    if (!b) return res.status(404).json({ error: "Battle not found" });
    if (b.status !== "pending") return res.status(409).json({ error: `Battle is ${b.status}` });
    if (new Date(b.expiresAt) < new Date()) {
      await prisma.groupBattle.update({ where: { id: b.id }, data: { status: "expired" } }).catch(() => {});
      return res.status(410).json({ error: "This challenge expired" });
    }
    if (!(await isGroupCaptain(b.challengedId, uid))) {
      return res.status(403).json({ error: "Only a captain of the challenged group can accept" });
    }

    const ranked = b.mode === "ranked";
    const lineupCheck = await validateLineup(b.challengedId, lineupIds, { ranked });
    if (!lineupCheck.ok) return res.status(400).json({ error: lineupCheck.error });
    if (lineupCheck.lineup.length !== (b.lineupA || []).length) {
      return res.status(400).json({ error: `Lineup must match their ${(b.lineupA || []).length} players — no headcount advantage` });
    }
    if (ranked) {
      const guard = await rankedGuards(b.challengerId, b.challengedId);
      if (!guard.ok) return res.status(400).json({ error: guard.error });
    }

    const mcq = await prisma.resource.findUnique({
      where: { id: b.mcqResourceId },
      select: { id: true, title: true, mcqData: true, sourceResourceId: true },
    });
    const questions = mcq ? normalizeMcqData(mcq.mcqData) : [];
    if (!questions.length) return res.status(400).json({ error: "The question set is gone — ask them to send a new challenge" });

    const host = await identityFor(uid, req.user.username);
    const room = createRoom({
      hostId: uid,
      hostName: host.name,
      resourceId: mcq.sourceResourceId || null,
      mcqResourceId: mcq.id,
      title: `${b.challenger.name} vs ${b.challenged.name}`,
      questions: shuffle(questions),
      settings: { timePerQuestion: b.timePerQuestion, numQuestions: b.numQuestions },
      battle: {
        id: b.id,
        mode: b.mode,
        createdById: b.createdById,
        a: { classroomId: b.challengerId, name: b.challenger.name, lineup: (b.lineupA || []).map(String) },
        b: { classroomId: b.challengedId, name: b.challenged.name, lineup: lineupCheck.lineup },
      },
    });
    // The accepting captain only enters the room when they're in the lineup —
    // a captain can set a lineup and spectate from the battle list otherwise.
    const playing = lineupCheck.lineup.includes(uid);
    if (playing) registerParticipant(room, uid, host.name, host.avatar);

    const battle = await prisma.groupBattle.update({
      where: { id: b.id },
      data: {
        status: "active",
        lineupB: lineupCheck.lineup,
        liveCode: room.code,
        acceptedAt: new Date(),
      },
      include: BATTLE_INCLUDE,
    });

    const ticket = playing ? generateTicket(room.id, uid) : null;

    // Notify both lineups + drop a join card into each group's chat (the
    // existing QuizBattles list picks liveCode messages up automatically).
    (async () => {
      try {
        const { sendPushToUsers } = await import("../lib/pushSender.js");
        const allLineup = [...new Set([...(b.lineupA || []), ...lineupCheck.lineup].map(String))].filter((id) => id !== uid);
        await sendPushToUsers(
          allLineup,
          {
            title: `⚔️ ${b.challenger.name} vs ${b.challenged.name} is LIVE`,
            body: `${b.title || "Group battle"} — your clan needs you in the lobby`,
            tag: `battle-${b.id}`,
            data: { tab: "discuss", liveCode: room.code, battle: b.id },
          },
          { category: "social" }
        );
        await prisma.classroomMessage.createMany({
          data: [b.challengerId, b.challengedId].map((cid) => ({
            classroomId: cid,
            userId: uid,
            text: `⚔️ ${b.challenger.name} vs ${b.challenged.name} — battle is live, lineup members join now`,
            liveCode: room.code,
          })),
        }).catch(() => {});
      } catch (e) {
        console.warn("[battle] accept notify failed:", e?.message);
      }
    })();

    res.json({
      ...shapeBattle(battle, uid, await myCaptainGroupIds(uid)),
      roomId: playing ? room.id : null,
      code: playing ? room.code : null,
      ticket,
    });
  } catch (err) {
    console.error("Battle accept error:", err);
    res.status(500).json({ error: "Failed to accept battle" });
  }
});

// POST /api/battles/:id/decline
router.post("/:id/decline", requireAuth, async (req, res) => {
  try {
    const uid = userId(req);
    const b = await prisma.groupBattle.findUnique({
      where: { id: req.params.id },
      include: BATTLE_INCLUDE,
    });
    if (!b) return res.status(404).json({ error: "Battle not found" });
    if (b.status !== "pending") return res.status(409).json({ error: `Battle is ${b.status}` });
    if (!(await isGroupCaptain(b.challengedId, uid))) {
      return res.status(403).json({ error: "Only a captain of the challenged group can decline" });
    }
    await prisma.groupBattle.update({ where: { id: b.id }, data: { status: "declined" } });
    (async () => {
      try {
        const { sendPushToUsers } = await import("../lib/pushSender.js");
        await sendPushToUsers([b.createdById], {
          title: `${b.challenged.name} declined the battle`,
          body: "Pick another opponent — or a different lineup.",
          tag: `battle-${b.id}`,
          data: { tab: "discuss", feedTab: "groups" },
        }, { category: "social" });
      } catch {}
    })();
    res.json({ ok: true });
  } catch (err) {
    console.error("Battle decline error:", err);
    res.status(500).json({ error: "Failed to decline battle" });
  }
});

export default router;
