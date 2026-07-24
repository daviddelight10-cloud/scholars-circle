import jwt from "jsonwebtoken";
import { prisma } from "../db.js";

// In-memory cache: supabaseId -> { id, role, username, ts }
// Avoids a DB lookup on every single API request.
const userCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function resolvePrismaUser(supabaseId) {
  const cached = userCache.get(supabaseId);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached;
  }

  const user = await prisma.user.findUnique({
    where: { supabaseId },
    select: { id: true, role: true, username: true },
  });

  if (user) {
    const entry = { ...user, ts: Date.now() };
    userCache.set(supabaseId, entry);
    return entry;
  }

  return null;
}

// Invalidate cache entry when a user profile is created or updated
export function invalidateUserCache(supabaseId) {
  if (supabaseId) userCache.delete(supabaseId);
}

function extractToken(req) {
  const auth = req.headers.authorization || "";
  let token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!token && req.cookies && req.cookies.auth_token) {
    token = req.cookies.auth_token;
  }

  if (!token && req.query && req.query.token) {
    token = req.query.token;
  }

  return token;
}

export async function requireAuth(req, res, next) {
  const token = extractToken(req);

  if (!token) return res.status(401).json({ error: "Missing token" });

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.SUPABASE_JWT_SECRET);
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  const supabaseId = decoded.sub;
  if (!supabaseId) {
    return res.status(401).json({ error: "Invalid token: missing subject" });
  }

  // Fast path: prismaId stored in app_metadata (set during profile creation)
  const prismaIdFromToken = decoded.app_metadata?.prismaId;
  const roleFromToken = decoded.app_metadata?.role;

  if (prismaIdFromToken && roleFromToken) {
    req.user = {
      sub: prismaIdFromToken,
      supabaseId,
      email: decoded.email || null,
      role: roleFromToken,
      username: decoded.user_metadata?.username || null,
    };
    return next();
  }

  // Slow path: DB lookup by supabaseId
  try {
    const prismaUser = await resolvePrismaUser(supabaseId);

    if (!prismaUser) {
      return res.status(403).json({
        error: "User profile not found. Please complete your profile setup.",
        code: "PROFILE_NOT_FOUND",
      });
    }

    req.user = {
      sub: prismaUser.id,
      supabaseId,
      email: decoded.email || null,
      role: prismaUser.role,
      username: prismaUser.username || decoded.user_metadata?.username || null,
    };

    return next();
  } catch (err) {
    console.error("[requireAuth] DB lookup error:", err.message);
    return res.status(500).json({ error: "Authentication lookup failed" });
  }
}

export async function optionalAuth(req, _res, next) {
  const token = extractToken(req);

  if (!token) return next();

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.SUPABASE_JWT_SECRET);
  } catch {
    return next();
  }

  const supabaseId = decoded.sub;
  if (!supabaseId) return next();

  const prismaIdFromToken = decoded.app_metadata?.prismaId;
  const roleFromToken = decoded.app_metadata?.role;

  if (prismaIdFromToken && roleFromToken) {
    req.user = {
      sub: prismaIdFromToken,
      supabaseId,
      email: decoded.email || null,
      role: roleFromToken,
      username: decoded.user_metadata?.username || null,
    };
    return next();
  }

  try {
    const prismaUser = await resolvePrismaUser(supabaseId);
    if (prismaUser) {
      req.user = {
        sub: prismaUser.id,
        supabaseId,
        email: decoded.email || null,
        role: prismaUser.role,
        username: prismaUser.username || decoded.user_metadata?.username || null,
      };
    }
  } catch {
    // Silently continue without user for optional auth
  }

  return next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: "Forbidden" });
    return next();
  };
}
