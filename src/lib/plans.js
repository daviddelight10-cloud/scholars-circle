// Shared Premium plan catalog — single source of truth for the PremiumPage,
// the settings premium card, and the compact payment modal in App.jsx.
// Keep ids in sync with the backend PlanType enum (server/src/routes/payment.js).

export const PLANS = [
  { id: "week1", label: "1 Week", days: 7, price: 700, icon: "⚡", note: "Perfect for trying out" },
  { id: "week2", label: "2 Weeks", days: 14, price: 1300, icon: "🔥", note: "Save ₦100" },
  { id: "month1", label: "1 Month", days: 30, price: 2400, icon: "💎", note: "Save ₦400 — most scholars pick this" },
  { id: "semester", label: "Semester", days: 120, price: 7000, icon: "🎓", note: "One payment till exams — save ₦2,600+", best: true },
];

export function getPlan(id) {
  return PLANS.find((p) => p.id === id) || null;
}

export function planLabel(id) {
  const plan = getPlan(id);
  return plan ? `${plan.label} Plan` : null;
}

export function naira(n) {
  return "₦" + Number(n).toLocaleString();
}

export const WHATSAPP_NUMBER = "2349028617178";

// Builds a WhatsApp deep-link pre-filled with payment details so support can
// match a bank transfer to the right account without a back-and-forth.
export function waPaymentProofLink(planId, user) {
  const plan = getPlan(planId);
  const lines = [
    "Hi Scholar's Circle team, I've made a bank transfer for Premium.",
    "",
    `Plan: ${plan ? plan.label : planId}`,
    `Amount: ${plan ? naira(plan.price) : "—"}`,
    `Activation key: ${user?.activationKey || "—"}`,
  ];
  const name = user?.fullName || user?.username;
  if (name) lines.push(`Name: ${name}`);
  if (user?.email) lines.push(`Email: ${user.email}`);
  lines.push("", "Payment proof attached below 👇");
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join("\n"))}`;
}
