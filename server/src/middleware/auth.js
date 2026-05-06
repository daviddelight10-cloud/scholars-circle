import jwt from "jsonwebtoken";
import { prisma } from "../db.js";

export function requireAuth(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing token" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: "Forbidden" });
    return next();
  };
}

export async function requireActiveUser(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
      select: { isActivated: true, activationExpiry: true, role: true },
    });

    if (!user) return res.status(404).json({ error: "User not found" });

    // Teachers are always active
    if (user.role === "TEACHER") return next();

    // Check if student is activated
    if (!user.isActivated) {
      return res.status(403).json({ error: "Account not activated. Please upgrade to access premium features." });
    }

    // Check if activation has expired
    if (user.activationExpiry && new Date(user.activationExpiry) < new Date()) {
      // Deactivate expired users
      await prisma.user.update({
        where: { id: req.user.sub },
        data: { isActivated: false, activationExpiry: null, planType: null, paymentStatus: "pending" },
      });
      return res.status(403).json({ error: "Your subscription has expired. Please renew to continue." });
    }

    return next();
  } catch (error) {
    console.error("Error checking user activation:", error);
    return res.status(500).json({ error: "Failed to verify activation status" });
  }
}
