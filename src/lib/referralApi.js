import { API_BASE } from "./constants.js";

/**
 * Fetch the current user's referral code + stats.
 * Returns { code, invited, earned, banked, active, daysPerReferral } or null on failure.
 */
export async function getMyReferral(token) {
  if (!token) return null;
  try {
    const res = await fetch(`${API_BASE}/referrals/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
