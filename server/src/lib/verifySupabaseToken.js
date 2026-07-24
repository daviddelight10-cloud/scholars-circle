import { createRemoteJWKSet, jwtVerify } from "jose";
import jwt from "jsonwebtoken";

const SUPABASE_URL = process.env.SUPABASE_URL;

// Supabase's public JWKS endpoint (used for projects with asymmetric
// signing keys, e.g. ES256/RS256 — the current default for new projects).
const JWKS = SUPABASE_URL
  ? createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`))
  : null;

/**
 * Verifies a Supabase-issued JWT, supporting both:
 *  - New projects using asymmetric signing keys (ES256/RS256) via JWKS
 *  - Legacy projects using a shared HS256 secret (SUPABASE_JWT_SECRET)
 *
 * Returns the decoded payload, or throws if verification fails.
 */
export async function verifySupabaseToken(token) {
  const [headerB64] = token.split(".");
  let alg;
  try {
    alg = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf8")).alg;
  } catch {
    throw new Error("Malformed token header");
  }

  if (alg && alg.startsWith("HS")) {
    // Legacy shared-secret verification
    if (!process.env.SUPABASE_JWT_SECRET) {
      throw new Error("SUPABASE_JWT_SECRET not configured for HS256 token");
    }
    return jwt.verify(token, process.env.SUPABASE_JWT_SECRET);
  }

  // Asymmetric verification via JWKS
  if (!JWKS) {
    throw new Error("SUPABASE_URL not configured for JWKS verification");
  }
  const { payload } = await jwtVerify(token, JWKS);
  return payload;
}
