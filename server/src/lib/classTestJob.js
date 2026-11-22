// Class-test reminder sweep — runs every 10 min.
//  1) ~30 min before opensAt: nudge class members the test is opening.
//  2) ~15 min before closesAt: nudge members who haven't submitted yet.
// Flags live on the ClassTest row — no extra tables.
import { prisma } from "../db.js";
import { sendPushToUsers } from "./pushSender.js";

const SWEEP_MS = 10 * 60 * 1000;

async function memberIds(classroomId, excludeId) {
  const ms = await prisma.classroomMember.findMany({ where: { classroomId }, select: { userId: true } });
  return ms.map((m) => m.userId).filter((id) => id !== excludeId);
}

async function sweepOpening() {
  const now = new Date();
  const soon = new Date(now.getTime() + 30 * 60 * 1000);
  const tests = await prisma.classTest.findMany({
    where: { published: true, opensAt: { gt: now, lte: soon }, openNotifiedAt: null },
    include: { classroom: { select: { name: true } } },
    take: 50,
  });
  for (const t of tests) {
    try {
      const ids = await memberIds(t.classroomId, t.createdById);
      if (ids.length) {
        await sendPushToUsers(ids, {
          title: `⏳ ${t.classroom?.name || "Class"}: "${t.title}" opens in ~30 min`,
          body: `${t.durationMin} min · closes ${t.closesAt.toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit" })}. Get ready.`,
          tag: `classtest-open-${t.id}`,
          data: { tab: "classroom", classroomId: t.classroomId, testId: t.id },
        }, { category: "examAlerts" });
      }
    } catch (err) {
      console.warn(`[classTestJob] open reminder failed for ${t.id}:`, err?.message);
    } finally {
      await prisma.classTest.update({ where: { id: t.id }, data: { openNotifiedAt: new Date() } }).catch(() => {});
    }
  }
}

async function sweepClosing() {
  const now = new Date();
  const soon = new Date(now.getTime() + 15 * 60 * 1000);
  const tests = await prisma.classTest.findMany({
    where: { published: true, closesAt: { gt: now, lte: soon }, closeNotifiedAt: null },
    include: { classroom: { select: { name: true } } },
    take: 50,
  });
  for (const t of tests) {
    try {
      const members = await memberIds(t.classroomId, t.createdById);
      if (!members.length) continue;
      const submitted = await prisma.classTestAttempt.findMany({
        where: { testId: t.id, userId: { in: members }, status: "submitted" },
        select: { userId: true },
      });
      const doneSet = new Set(submitted.map((a) => a.userId));
      const targets = members.filter((id) => !doneSet.has(id));
      if (targets.length) {
        await sendPushToUsers(targets, {
          title: `⏰ Closing soon — "${t.title}"`,
          body: `${t.classroom?.name || "Class"} test closes in ~15 min and you haven't submitted yet.`,
          tag: `classtest-close-${t.id}`,
          data: { tab: "classroom", classroomId: t.classroomId, testId: t.id },
        }, { category: "examAlerts" });
      }
    } catch (err) {
      console.warn(`[classTestJob] close reminder failed for ${t.id}:`, err?.message);
    } finally {
      await prisma.classTest.update({ where: { id: t.id }, data: { closeNotifiedAt: new Date() } }).catch(() => {});
    }
  }
}

export function startClassTestJob() {
  const run = async () => {
    try { await sweepOpening(); } catch (e) { console.warn("[classTestJob] open sweep:", e?.message); }
    try { await sweepClosing(); } catch (e) { console.warn("[classTestJob] close sweep:", e?.message); }
  };
  run();
  return setInterval(run, SWEEP_MS);
}
