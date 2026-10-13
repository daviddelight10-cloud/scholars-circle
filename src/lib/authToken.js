import { supabase } from "./supabaseClient.js";
import { API_BASE } from "./constants";

// ── Shared auth-token plumbing ───────────────────────────────────────────
// Every API module used to re-implement "read the JWT from localStorage"
// with no recovery path — once the Supabase access token expired mid-
// session, every request 401'd until the user manually logged in again.
// These helpers make expiry self-healing: a 401 asks Supabase for a fresh
// session (the SDK auto-refreshes), retries once, and only surfaces a
// dead-session signal when no recoverable session exists.

export function getStoredToken() {
  try {
    return JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}")?.authToken || null;
  } catch {
    return null;
  }
}

export function syncStoredToken(accessToken) {
  try {
    const raw = localStorage.getItem("scholars-circle-auth");
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed.authToken !== accessToken) {
      parsed.authToken = accessToken;
      localStorage.setItem("scholars-circle-auth", JSON.stringify(parsed));
    }
  } catch {}
}

let refreshInFlight = null;

/**
 * Fresh session token: asks the Supabase SDK for the current session —
 * it auto-refreshes expired access tokens. Single-flight so a burst of
 * 401s triggers one refresh, not many. Falls back to the stored token.
 */
export async function getValidToken() {
  if (!refreshInFlight) {
    refreshInFlight = supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (session?.access_token) {
          syncStoredToken(session.access_token);
          return session.access_token;
        }
        return null;
      })
      .catch(() => null)
      .finally(() => { refreshInFlight = null; });
  }
  return (await refreshInFlight) || getStoredToken();
}

let sessionDeadFired = false;
function markSessionDead() {
  if (sessionDeadFired) return;
  sessionDeadFired = true;
  try { window.dispatchEvent(new CustomEvent("sc:session-dead")); } catch {}
}

/** Call on sign-in so the dead-session latch re-arms for the new session. */
export function clearSessionDeadFlag() {
  sessionDeadFired = false;
}

/**
 * fetch() with Bearer auth + one self-healing 401 retry.
 * Drop-in replacement for the per-file authFetch clones.
 * Pass { token } to override the stored token for the first attempt —
 * if it's rejected the retry always uses the fresh session token.
 */
export async function fetchWithAuth(url, { token, ...opts } = {}) {
  // FormData/multipart bodies must keep the browser-set boundary header —
  // only default to JSON for everything else.
  const isForm = typeof FormData !== "undefined" && opts.body instanceof FormData;
  const run = (t) => fetch(url, {
    credentials: "include",
    ...opts,
    headers: {
      ...(isForm ? {} : { "Content-Type": "application/json" }),
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
      ...(opts.headers || {}),
    },
  });

  const attempted = token || getStoredToken();
  let res = await run(attempted);
  if (res.status !== 401) return res;

  const fresh = await getValidToken();
  if (fresh) res = await run(fresh);

  // Tell React state about the newer token so callers holding a stale one
  // stop taking the 401 → refresh → retry path on every request.
  if (fresh && fresh !== attempted) {
    try { window.dispatchEvent(new CustomEvent("sc:token-refreshed", { detail: fresh })); } catch {}
  }

  if (res.status === 401) {
    // Rejected even after refresh — only a dead signal if no session
    // survives at all (a live session + 401 is a permissions issue).
    const { data: { session } } = await supabase.auth.getSession()
      .catch(() => ({ data: { session: null } }));
    if (!session) markSessionDead();
  }
  return res;
}

export const authFetch = fetchWithAuth;

/**
 * Resolve a full app session for surfaces outside the /app shell —
 * shared-material links, OAuth returns, cleared storage. Fast path:
 * stored authUser. Otherwise ask Supabase for the session (this catches
 * OAuth hash returns, where Supabase is signed in but nothing wrote
 * scholars-circle-auth), fetch the app profile, and write it back.
 * Returns the authUser object, or null when no session exists.
 */
export async function ensureAppSession() {
  try {
    const stored = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
    if (stored.authUser) return stored.authUser;
  } catch {}

  let session = null;
  try {
    const { data } = await supabase.auth.getSession();
    session = data?.session || null;
  } catch {}
  if (!session?.access_token) return null;

  syncStoredToken(session.access_token);
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = await res.json().catch(() => ({}));
    const appUser = data?.user || null;
    if (!appUser) return null;
    try {
      localStorage.setItem("scholars-circle-auth", JSON.stringify({
        authUser: appUser,
        authToken: session.access_token,
      }));
    } catch {}
    return appUser;
  } catch {
    return null;
  }
}
