import { prisma } from "../db.js";

// Fan an XP award out to every study group (kind="group") the earner belongs
// to — this is the "every member's practice lifts the clan" fuel. Idempotent
// when callers pass a dedupeKey (postfixed per group). Best-effort: a failure
// must never break the XP award itself.
export async function recordGroupXp(userId, xp, { source = "xp", dedupeKey = null } = {}) {
  if (!userId || !Number.isInteger(xp) || xp <= 0) return;
  try {
    const memberships = await prisma.classroomMember.findMany({
      where: { userId, classroom: { kind: "group" } },
      select: { classroomId: true },
    });
    if (!memberships.length) return;
    await prisma.groupXpEvent.createMany({
      data: memberships.map((m) => ({
        classroomId: m.classroomId,
        userId,
        xp,
        source,
        dedupeKey: dedupeKey ? `${dedupeKey}:${m.classroomId}` : null,
      })),
      skipDuplicates: true,
    });
  } catch (e) {
    console.warn("[group-xp] record failed:", e?.message);
  }
}
