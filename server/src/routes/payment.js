import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

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

    // Verify with Paystack
    const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
    if (!PAYSTACK_SECRET) {
      return res.status(500).json({ error: "Payment provider not configured" });
    }

    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
    });
    const verifyData = await verifyRes.json();

    if (!verifyData.status || verifyData.data.status !== "success") {
      return res.status(400).json({ error: "Payment not verified. Please try again." });
    }

    const amountPaid = verifyData.data.amount / 100; // Paystack returns kobo
    const planPrices = { week1: 700, week2: 1300, month1: 2400 };

    if (amountPaid < planPrices[plan]) {
      return res.status(400).json({ error: `Insufficient payment. Expected ₦${planPrices[plan]}, got ₦${amountPaid}` });
    }

    // Calculate expiry based on plan
    const now = new Date();
    let expiryDate;
    if (plan === "week1") expiryDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    else if (plan === "week2") expiryDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    else expiryDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Activate user
    const updated = await prisma.user.update({
      where: { id: req.user.sub },
      data: {
        isActivated: true,
        activatedAt: now,
        activationExpiry: expiryDate,
        planType: plan,
        paymentStatus: "paid",
        transactionId: reference,
      },
      select: { id: true, isActivated: true, planType: true, activationExpiry: true },
    });

    res.json({ activated: true, user: updated });
  } catch (err) {
    console.error("Payment verification error:", err);
    res.status(500).json({ error: "Verification failed. Please contact support." });
  }
});

// POST /payment/webhook — Paystack webhook for payment.success events
router.post("/webhook", async (req, res) => {
  try {
    const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
    if (!PAYSTACK_SECRET) {
      return res.status(500).json({ error: "Payment provider not configured" });
    }

    // Verify webhook signature
    const hash = require("crypto")
      .createHmac("sha512", PAYSTACK_SECRET)
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (hash !== req.headers["x-paystack-signature"]) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    const event = req.body.event;
    if (event === "charge.success") {
      const { reference, metadata, amount, customer } = req.body.data;
      const plan = metadata?.plan;
      const activationKey = metadata?.activationKey;
      const userId = metadata?.userId;

      if (!plan || !["week1", "week2", "month1"].includes(plan)) {
        console.log("Webhook: Invalid plan in metadata", metadata);
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

      // Calculate expiry based on plan
      const now = new Date();
      let expiryDate;
      if (plan === "week1") expiryDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      else if (plan === "week2") expiryDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
      else expiryDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      // Activate user
      await prisma.user.update({
        where: { id: user.id },
        data: {
          isActivated: true,
          activatedAt: now,
          activationExpiry: expiryDate,
          planType: plan,
          paymentStatus: "paid",
          transactionId: reference,
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
