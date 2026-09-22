import express from "express";
import crypto from "crypto";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

const REFERRAL_DAYS = 3; // days awarded to both referrer and referee

// Generate a referral code like "DELIGHT-7K3F" from the username
function generateReferralCode(username) {
  const base = (username || "scholar")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8) || "SCHOLAR";
  const suffix = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `${base}-${suffix}`;
}

async function ensureReferralCode(user) {
  if (user.referralCode) return user.referralCode;
  let code = generateReferralCode(user.username);
  let unique = false;
  let attempts = 0;
  while (!unique && attempts < 10) {
    const existing = await prisma.user.findUnique({ where: { referralCode: code } });
    if (!existing) {
      unique = true;
      break;
    }
    code = generateReferralCode(user.username);
    attempts++;
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { referralCode: code },
  });
  return code;
}

// GET /referrals/me — current user's referral code + stats
router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
      select: {
        id: true,
        username: true,
        referralCode: true,
        referralBankedDays: true,
        isActivated: true,
        activationExpiry: true,
      },
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    const code = await ensureReferralCode(user);
    const invited = await prisma.referral.count({
      where: { referrerId: user.id },
    });

    const now = new Date();
    const active = user.isActivated && user.activationExpiry && new Date(user.activationExpiry) > now;

    res.json({
      code,
      invited,
      earned: invited * REFERRAL_DAYS,
      banked: user.referralBankedDays,
      active: !!active,
      daysPerReferral: REFERRAL_DAYS,
    });
  } catch (err) {
    console.error("Referral /me error:", err);
    res.status(500).json({ error: "Failed to fetch referral info" });
  }
});

// POST /referrals/credit — award referral days to both parties.
// Called internally by auth.js during signup. Kept as a route for testing/admin use.
router.post("/credit", requireAuth, async (req, res) => {
  try {
    const { referralCode } = req.body;
    if (!referralCode || typeof referralCode !== "string") {
      return res.status(400).json({ error: "referralCode is required" });
    }

    const me = await prisma.user.findUnique({
      where: { id: req.user.sub },
      select: { id: true, referredById: true, referralReceived: true },
    });
    // A user can only be referred once
    if (me?.referredById || me?.referralReceived) {
      return res.status(400).json({ error: "Account has already used a referral code" });
    }

    const referrer = await prisma.user.findUnique({
      where: { referralCode: referralCode.trim().toUpperCase() },
      select: { id: true, isActivated: true, activationExpiry: true },
    });
    if (!referrer || referrer.id === req.user.sub) {
      return res.status(400).json({ error: "Invalid referral code" });
    }

    const now = new Date();
    const result = await applyReferral(req.user.sub, referrer.id, now);
    res.json(result);
  } catch (err) {
    console.error("Referral /credit error:", err);
    res.status(500).json({ error: "Failed to apply referral" });
  }
});

/**
 * Shared helper: apply a referral between referee and referrer.
 * - Referee gets REFERRAL_DAYS of premium immediately.
 * - Referrer gets REFERRAL_DAYS added to active premium, or banked for later.
 */
export async function applyReferral(refereeId, referrerId, now = new Date()) {
  const referrer = await prisma.user.findUnique({
    where: { id: referrerId },
    select: { id: true, isActivated: true, activationExpiry: true, referralBankedDays: true },
  });

  // Credit referee: 3 free days of premium
  const refereeExpiry = new Date(now.getTime() + REFERRAL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.user.update({
    where: { id: refereeId },
    data: {
      referredById: referrerId,
      isActivated: true,
      activationExpiry: refereeExpiry,
    },
  });

  await prisma.referral.create({
    data: { referrerId, refereeId },
  });

  // Credit referrer: extend active premium or bank the days
  let referrerBanked = false;
  const referrerActive = referrer?.isActivated && referrer?.activationExpiry && new Date(referrer.activationExpiry) > now;
  if (referrerActive) {
    const newExpiry = new Date(new Date(referrer.activationExpiry).getTime() + REFERRAL_DAYS * 24 * 60 * 60 * 1000);
    await prisma.user.update({
      where: { id: referrerId },
      data: { activationExpiry: newExpiry },
    });
  } else {
    await prisma.user.update({
      where: { id: referrerId },
      data: { referralBankedDays: { increment: REFERRAL_DAYS } },
    });
    referrerBanked = true;
  }

  return { applied: true, referrerBanked, days: REFERRAL_DAYS };
}

export default router;
