import { prisma } from "../db.js";

// Server-side Premium check for the social tier (live rooms, battles, exam
// challenges). Mirrors the client's isActivatedUser() in src/lib/freeTier.js:
// premium = an activated plan that hasn't expired, or a staff/faculty role.
// `isActivated` alone is only cleared on auth refresh, so expiry is checked
// directly to avoid honouring lapsed plans.
const STAFF_ROLES = new Set(["TEACHER", "LECTURER", "ADMIN"]);

const cache = new Map(); // userId -> { premium, role, ts }
const TTL_MS = 60 * 1000;

export function invalidatePremium(userId) {
  if (userId) cache.delete(String(userId));
}

export async function getPremiumStatus(userId) {
  if (!userId) return { premium: false, role: null };
  const key = String(userId);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < TTL_MS) return cached;
  try {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { isActivated: true, activationExpiry: true, role: true },
    });
    const role = String(u?.role || "").toUpperCase();
    const premium =
      STAFF_ROLES.has(role) ||
      (u?.isActivated === true && (!u.activationExpiry || new Date(u.activationExpiry) > new Date()));
    const entry = { premium, role: u?.role || null, ts: Date.now() };
    cache.set(key, entry);
    return entry;
  } catch {
    return { premium: false, role: null };
  }
}

export async function isPremium(userId) {
  return (await getPremiumStatus(userId)).premium;
}

// Same `premium_required` code aiRateLimit.js uses — the client's request
// layer turns it into the upgrade modal.
export function premiumRequired(res, feature, message) {
  return res.status(403).json({
    code: "premium_required",
    feature,
    error: message || "That's a Premium feature — upgrade to unlock it.",
  });
}
