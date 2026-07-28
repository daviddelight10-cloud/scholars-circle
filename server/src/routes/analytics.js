import express from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.get("/overview", requireAuth, async (req, res) => {
  const sessions = await prisma.sessionAttempt.findMany({
    where: { userId: req.user.sub },
    orderBy: { createdAt: "desc" },
  });
  const total = sessions.length;
  const avg = total ? sessions.reduce((a, s) => a + s.percentage, 0) / total : 0;
  res.json({
    totalSessions: total,
    averagePercentage: Number(avg.toFixed(2)),
    latest: sessions[0] || null,
  });
});

export default router;
