import { Router } from "express";
import { createHmac } from "crypto";
import jwt from "jsonwebtoken";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const PLAN_DURATIONS = {
  week1: 7 * 24 * 60 * 60 * 1000,
  week2: 14 * 24 * 60 * 60 * 1000,
  month1: 30 * 24 * 60 * 60 * 1000,
};

const PLAN_PRICES = { week1: 700, week2: 1300, month1: 2400 };
const VALID_PLANS = ["week1", "week2", "month1"];

function calcExpiry(plan, fromDate = new Date()) {
  return new Date(fromDate.getTime() + (PLAN_DURATIONS[plan] || PLAN_DURATIONS.month1));
}

// POST /payment/verify — verify Paystack payment and activate user
router.post("/verify", requireAuth, async (req, res) => {
  try {
    const { reference, plan, activationKey } = req.body;

    if (!reference || !plan) {
      return res.status(400).json({ error: "Missing payment reference or plan" });
    }

    const validPlans = ["week1", "week2", "month1"];
    if (!validPlans.includes(plan)) {
      return res.status(400).json({ error: "Invalid plan" });
    }

    // Verify with Paystack (retry up to 3 times — Paystack API can have a delay after popup success)
    const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
    if (!PAYSTACK_SECRET) {
      return res.status(500).json({ error: "Payment provider not configured" });
    }

    let verifyData = null;
    let lastError = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
          headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
        });
        verifyData = await verifyRes.json();
        if (verifyData.status && verifyData.data?.status === "success") break;
        lastError = `Paystack returned status=${verifyData.data?.status || "unknown"}`;
      } catch (fetchErr) {
        lastError = fetchErr.message;
      }
      if (attempt < 3) await new Promise((r) => setTimeout(r, 2000));
    }

    if (!verifyData || !verifyData.status || verifyData.data?.status !== "success") {
      console.error("Paystack verification failed after retries:", { reference, lastError, verifyData });
      return res.status(400).json({ error: `Payment not verified. ${lastError || "Please try again."}` });
    }

    const amountPaid = verifyData.data.amount / 100; // Paystack returns kobo

    if (amountPaid < PLAN_PRICES[plan]) {
      return res.status(400).json({ error: `Insufficient payment. Expected ₦${PLAN_PRICES[plan]}, got ₦${amountPaid}` });
    }

    const now = new Date();

    // Atomically claim this transaction reference — prevents double activation
    // when both /verify (frontend onSuccess) and /webhook (Paystack server) fire.
    // Only the first writer wins; the second sees transactionId already matches and skips.
    const claim = await prisma.user.updateMany({
      where: { id: req.user.sub, transactionId: { not: reference } },
      data: { transactionId: reference },
    });

    if (claim.count === 0) {
      // This reference was already processed — return existing state without stacking
      const existing = await prisma.user.findUnique({
        where: { id: req.user.sub },
        select: { id: true, isActivated: true, planType: true, activationExpiry: true, username: true, role: true },
      });
      const newToken = jwt.sign(
        { sub: existing.id, role: existing.role, username: existing.username, isActivated: existing.isActivated },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );
      return res.json({ activated: true, user: existing, token: newToken });
    }

    // We won the claim — safe to stack expiry onto existing plan if still active
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.sub },
      select: { activationExpiry: true, isActivated: true },
    });

    const baseDate = (currentUser?.isActivated && currentUser?.activationExpiry && new Date(currentUser.activationExpiry) > now)
      ? new Date(currentUser.activationExpiry)
      : now;
    const expiryDate = calcExpiry(plan, baseDate);

    // Activate user
    const updated = await prisma.user.update({
      where: { id: req.user.sub },
      data: {
        isActivated: true,
        activatedAt: now,
        activationExpiry: expiryDate,
        planType: plan,
        paymentStatus: "verified",
      },
      select: { id: true, isActivated: true, planType: true, activationExpiry: true, username: true, role: true },
    });

    // Issue a fresh JWT with isActivated: true so the frontend updates immediately
    const newToken = jwt.sign(
      { sub: updated.id, role: updated.role, username: updated.username, isActivated: true },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ activated: true, user: updated, token: newToken });
  } catch (err) {
    console.error("Payment verification error:", err);
    res.status(500).json({ error: "Verification failed. Please contact support." });
  }
});

// POST /payment/webhook — Paystack webhook for charge.success events
// NOTE: This route must receive the RAW body for signature verification.
// In index.js, express.json({ verify: ... }) captures req.rawBody for us.
router.post("/webhook", async (req, res) => {
  try {
    const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
    if (!PAYSTACK_SECRET) {
      return res.status(500).json({ error: "Payment provider not configured" });
    }

    // Verify webhook signature using raw body
    const rawBody = req.rawBody || JSON.stringify(req.body);
    const hash = createHmac("sha512", PAYSTACK_SECRET)
      .update(rawBody)
      .digest("hex");

    if (hash !== req.headers["x-paystack-signature"]) {
      console.warn("Webhook: Invalid signature");
      return res.status(401).json({ error: "Invalid signature" });
    }

    const event = req.body.event;
    if (event === "charge.success") {
      const { reference, metadata } = req.body.data;
      const plan = metadata?.plan;
      const activationKey = metadata?.activationKey;
      const userId = metadata?.userId;

      if (!plan || !VALID_PLANS.includes(plan)) {
        console.log("Webhook: Invalid plan in metadata", metadata);
        return res.status(200).json({ status: "ok" });
      }

      // Verify amount paid matches plan price
      const amountPaid = (req.body.data.amount || 0) / 100;
      if (amountPaid < PLAN_PRICES[plan]) {
        console.log("Webhook: Insufficient payment", { reference, plan, amountPaid, expected: PLAN_PRICES[plan] });
        return res.status(200).json({ status: "ok" });
      }

      // Find user by activationKey or userId
      let user;
      if (activationKey) {
        user = await prisma.user.findUnique({ where: { activationKey } });
      } else if (userId) {
        user = await prisma.user.findUnique({ where: { id: userId } });
      }

      if (!user) {
        console.log("Webhook: User not found", { activationKey, userId });
        return res.status(200).json({ status: "ok" });
      }

      // Atomically claim this transaction reference — prevents double activation
      // when both /verify (frontend) and /webhook (Paystack) fire concurrently.
      const claim = await prisma.user.updateMany({
        where: { id: user.id, transactionId: { not: reference } },
        data: { transactionId: reference },
      });

      if (claim.count === 0) {
        // Already processed by /verify or a previous webhook delivery — skip
        console.log("Webhook: Transaction already processed, skipping", { reference });
        return res.status(200).json({ status: "ok" });
      }

      const now = new Date();

      // Re-fetch user after claim to get current activation state
      const freshUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { isActivated: true, activationExpiry: true },
      });

      // If user is still active and expiry is in the future, add days to existing expiry
      const baseDate = (freshUser?.isActivated && freshUser?.activationExpiry && new Date(freshUser.activationExpiry) > now)
        ? new Date(freshUser.activationExpiry)
        : now;
      const expiryDate = calcExpiry(plan, baseDate);

      // Activate user
      await prisma.user.update({
        where: { id: user.id },
        data: {
          isActivated: true,
          activatedAt: now,
          activationExpiry: expiryDate,
          planType: plan,
          paymentStatus: "verified",
        },
      });

      console.log("Webhook: User activated", { userId: user.id, plan, reference });
    }

    res.status(200).json({ status: "ok" });
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

// GET /payment/status — check current activation status
router.get("/status", requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
      select: {
        isActivated: true,
        activatedAt: true,
        activationExpiry: true,
        planType: true,
        paymentStatus: true,
      },
    });

    if (!user) return res.status(404).json({ error: "User not found" });

    // Check if activation has expired
    if (user.isActivated && user.activationExpiry && new Date() > user.activationExpiry) {
      await prisma.user.update({
        where: { id: req.user.sub },
        data: { isActivated: false, planType: null },
      });
      return res.json({ isActivated: false, expired: true });
    }

    res.json(user);
  } catch (err) {
    console.error("Payment status error:", err);
    res.status(500).json({ error: "Failed to fetch status" });
  }
});

export default router;
