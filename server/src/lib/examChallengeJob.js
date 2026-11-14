// Exam-challenge deadline sweep — runs every 30 min.
//  1) ~24h before a deadline: nudge group members/viewers who haven't taken it.
//  2) When a challenge closes: tell the creator who won and members that
//     results are in. Flags live on the ExamChallenge row (no extra tables).
import { prisma } from "../db.js";
import { sendPushToUser, sendPushToUsers } from "./pushSender.js";
import { rankAttempts } from "./challengeRank.js";

const SWEEP_MS = 30 * 60 * 1000;

function examTitle(resource) {
  let p = resource?.mcqData;
  if (typeof p === "string") { try { p = JSON.parse(p); } catch { p = null; } }
  return p?.config?.name || resource?.title || "Exam";
}

async function sweepReminders() {
  const now = new Date();
  const soon = new Date(now.getTime() + 24 * 3600000);
  const challenges = await prisma.examChallenge.findMany({
    where: { deadline: { gt: now, lte: soon }, reminder24SentAt: null },
    include: {
      examResource: { select: { title: true, mcqData: true } },
      creator: { select: { name: true, username: true } },
    },
    take: 50,
  });

  for (const c of challenges) {
    try {
      const title = examTitle(c.examResource);
      const takenUsers = new Set(
        (await prisma.quizAttempt.findMany({ where: { challengeId: c.id }, select: { userId: true } })).map((a) => a.userId)
      );
      takenUsers.add(c.creatorId);

      // Audience: group members when group-scoped, else authed viewers.
      let targets = [];
      if (c.groupId) {
        const members = await prisma.classroomMember.findMany({ where: { classroomId: c.groupId }, select: { userId: true } });
        targets = members.map((m) => m.userId);
      } else {
        const views = await prisma.examChallengeView.findMany({ where: { challengeId: c.id }, select: { userId: true } });
        targets = views.map((v) => v.userId);
      }
      targets = [...new Set(targets)].filter((id) => !takenUsers.has(id));

      if (targets.length) {
        const takenCount = takenUsers.size - 1; // exclude creator from count display
        const who = c.creator?.name || c.creator?.username || "Your friend";
        await sendPushToUsers(
          targets,
          {
            title: `⏰ 24h left — ${who}'s exam challenge`,
            body: `"${title}" closes soon${takenCount > 0 ? ` and ${takenCount} ${takenCount === 1 ? "person has" : "people have"} already taken it` : ""}.`,
            tag: `exam-challenge-${c.id}`,
            data: { url: `/exam/${c.token}`, examChallenge: c.token },
          },
          { category: "examAlerts" }
        );
      }
    } catch (err) {
      console.warn(`[examChallengeJob] reminder failed for ${c.id}:`, err?.message);
    } finally {
      await prisma.examChallenge.update({ where: { id: c.id }, data: { reminder24SentAt: new Date() } }).catch(() => {});
    }
  }
}

async function sweepClosed() {
  const now = new Date();
  const challenges = await prisma.examChallenge.findMany({
    where: { deadline: { lt: now }, closedNotifiedAt: null },
    include: { examResource: { select: { title: true, mcqData: true } } },
    take: 50,
  });

  for (const c of challenges) {
    try {
      const title = examTitle(c.examResource);
      const attempts = await prisma.quizAttempt.findMany({
        where: { challengeId: c.id },
        select: { userId: true, score: true, total: true, durationMs: true, createdAt: true, user: { select: { name: true, username: true } } },
      });
      const ranked = rankAttempts(attempts, c.scoring);
      const winner = ranked[0];
      const takenCount = attempts.length;

      if (winner) {
        const winnerName = winner.user?.name || winner.user?.username || "A scholar";
        const pct = winner.total > 0 ? Math.round((winner.score / winner.total) * 100) : 0;
        await sendPushToUser(
          c.creatorId,
          {
            title: `🏁 "${title}" — challenge closed`,
            body: `${takenCount} took it. Winner: ${winnerName} with ${pct}%.`,
            tag: `exam-challenge-${c.id}`,
            data: { url: `/exam/${c.token}`, examChallenge: c.token },
          },
          { category: "examAlerts" }
        ).catch(() => {});
      }

      if (c.groupId && takenCount) {
        const members = await prisma.classroomMember.findMany({ where: { classroomId: c.groupId }, select: { userId: true } });
        const targets = members.map((m) => m.userId).filter((id) => id !== c.creatorId);
        if (targets.length) {
          const winnerName = winner ? (winner.user?.name || winner.user?.username || "a scholar") : "—";
          const winnerPct = winner && winner.total > 0 ? Math.round((winner.score / winner.total) * 100) : null;
          await sendPushToUsers(
            targets,
            {
              title: `🏁 Results are in — "${title}"`,
              body: winner ? winnerName + " tops the board" + (winnerPct != null ? " with " + winnerPct + "%" : "") + ". See where you placed." : "",
              tag: `exam-challenge-${c.id}`,
              data: { url: `/exam/${c.token}`, examChallenge: c.token },
            },
            { category: "examAlerts" }
          ).catch(() => {});
        }
      }
    } catch (err) {
      console.warn(`[examChallengeJob] close failed for ${c.id}:`, err?.message);
    } finally {
      await prisma.examChallenge.update({ where: { id: c.id }, data: { closedNotifiedAt: new Date() } }).catch(() => {});
    }
  }
}

export function startExamChallengeJob() {
  const run = async () => {
    try { await sweepReminders(); } catch (e) { console.warn("[examChallengeJob] reminder sweep:", e?.message); }
    try { await sweepClosed(); } catch (e) { console.warn("[examChallengeJob] close sweep:", e?.message); }
  };
  run(); // first pass on boot
  return setInterval(run, SWEEP_MS);
}
