import { prisma } from "../db.js";

const FREE_TRIAL_AI_DAILY_LIMIT = parseInt(process.env.FREE_TRIAL_AI_DAILY_LIMIT || "10", 10);

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
      select: { isActivated: true },
    });

    if (!user || user.isActivated) {
      return next();
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
