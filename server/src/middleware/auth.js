import jwt from "jsonwebtoken";

export function requireAuth(req, res, next) {
  // Try to get token from Authorization header first (for backwards compatibility)
  const auth = req.headers.authorization || "";
  let token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  
  // If no Authorization header, try to get token from httpOnly cookie
  if (!token && req.cookies && req.cookies.auth_token) {
    token = req.cookies.auth_token;
  }
  
  // If still no token, try query param (for iframe/img embeds that can't send headers)
  if (!token && req.query && req.query.token) {
    token = req.query.token;
  }
  
  if (!token) return res.status(401).json({ error: "Missing token" });
  
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

export function optionalAuth(req, _res, next) {
  const auth = req.headers.authorization || "";
  let token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token && req.cookies && req.cookies.auth_token) token = req.cookies.auth_token;
  if (!token && req.query && req.query.token) token = req.query.token;
  if (token) {
    try { req.user = jwt.verify(token, process.env.JWT_SECRET); } catch {}
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
