// Client-side premium helpers for the social tier (Live Quiz hosting, ranked
// battles, challenge options, result insights). The server is authoritative —
// these only shape the UI and route `premium_required` responses into the
// payment modal.
import { isActivatedUser } from "./freeTier.js";

export function isPremium() {
  return isActivatedUser();
}

// Feature-keyed upgrade copy — shown as the payment modal's headline when a
// gate fires, so the pitch matches what the user just tried to do.
export const PREMIUM_HEADLINES = {
  host_controls: "Host bigger rooms with full controls",
  voice: "Unlock voice chat for your room",
  ranked_battles: "Send ranked battles — put your clan's rating on the line",
  scheduled_wars: "Schedule clan wars",
  unlimited_challenges: "Run unlimited exam challenges",
  challenge_deadline: "Custom and open-ended challenge deadlines",
  challenge_options: "Best-score scoring and locked reveals",
  creator_stats: "See how every challenger did",
  resultInsights: "Unlock all explanations",
  summary_seek: "Scrub back through your audio summary",
  live_seats: "Host up to 50 players",
  premium: "Go Premium",
};

// Fires the payment modal (App.jsx listens). `feature` selects the headline.
export function openPremium(feature) {
  window.dispatchEvent(new CustomEvent("sc-open-premium", { detail: { feature } }));
}

// Throw a normalized error for a server `premium_required` response — the
// message still reaches any catch/UI fallback.
export function premiumRequiredError(data) {
  const err = new Error(data?.error || "Premium feature");
  err.code = "premium_required";
  err.feature = data?.feature || "premium";
  return err;
}
