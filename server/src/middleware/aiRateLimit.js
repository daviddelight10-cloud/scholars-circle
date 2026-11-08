import { prisma } from "../db.js";

const FREE_TRIAL_AI_DAILY_LIMIT = parseInt(process.env.FREE_TRIAL_AI_DAILY_LIMIT || "10", 10);

const FREE_MCQ_TOTAL_CAP = 30;

function getResetAt() {
  const tomorrow = new Date();
  tomorrow.setHours(24, 0, 0, 0);
  return tomorrow.toISOString();
}

export async function aiRateLimit(req, res, next) {
  try {
    const userId = req.user?.sub;
    if (!userId) return next();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isActivated: true, role: true },
    });

    const paid = !user || user.isActivated || ["TEACHER", "LECTURER", "ADMIN"].includes(String(user.role).toUpperCase());
    if (paid) {
      return next();
    }

    // Customised Rapid Recall (more than the auto-size set) is a paid feature.
    const mcqTotal = Number(req.body?.mcqTotal);
    if (Number.isFinite(mcqTotal) && mcqTotal > FREE_MCQ_TOTAL_CAP) {
      return res.status(403).json({
        error: `Custom question sets over ${FREE_MCQ_TOTAL_CAP} questions are a Premium feature.`,
        code: "premium_required",
      });
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const usedToday = await prisma.aiUsageLog.count({
      where: {
        userId,
        createdAt: { gte: startOfDay },
      },
    });

    if (usedToday >= FREE_TRIAL_AI_DAILY_LIMIT) {
      return res.status(429).json({
        error: `Daily AI limit reached (${FREE_TRIAL_AI_DAILY_LIMIT}/day). Upgrade for unlimited access!`,
        limit: FREE_TRIAL_AI_DAILY_LIMIT,
        used: usedToday,
        resetAt: getResetAt(),
      });
    }

    const endpoint = req.path.replace(/^\//, "");
    await prisma.aiUsageLog.create({
      data: {
        userId,
        endpoint,
        provider: req.body?.provider || null,
      },
    }).catch(() => {});

    next();
  } catch (err) {
    console.error("aiRateLimit error (failing open):", err.message);
    next();
  }
}

export { FREE_TRIAL_AI_DAILY_LIMIT, getResetAt };
