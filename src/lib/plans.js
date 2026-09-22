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
