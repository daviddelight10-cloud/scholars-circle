import { API_BASE as BASE } from "./constants.js";

async function authFetch(url, opts = {}) {
  let token = null;
  try { token = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}").authToken; } catch {}
  return fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
}

export async function getUniversities(query) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  const res = await authFetch(`${BASE}/api/universities${params.toString() ? `?${params}` : ""}`);
  if (!res.ok) throw new Error("Failed to load universities");
  return res.json();
}

export async function getUniversity(id) {
  const res = await authFetch(`${BASE}/api/universities/${id}`);
  if (!res.ok) throw new Error("Failed to load university");
  return res.json();
}

export async function getUniversityDepartments(universityId) {
  const res = await authFetch(`${BASE}/api/universities/${universityId}/departments`);
  if (!res.ok) throw new Error("Failed to load departments");
  return res.json();
}

export async function createUniversity(name, type = "university", country = "Nigeria", city = null) {
  const res = await authFetch(`${BASE}/api/universities`, {
    method: "POST",
    body: JSON.stringify({ name, type, country, city }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to create university");
  }
  return res.json();
}

export async function createUniversityDepartment(universityId, name, icon) {
  const res = await authFetch(`${BASE}/api/universities/${universityId}/departments`, {
    method: "POST",
    body: JSON.stringify({ name, icon }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to create department");
  }
  return res.json();
}

export async function seedUniversities() {
  const res = await authFetch(`${BASE}/api/universities/seed`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to seed universities");
  return res.json();
}

// Predefined list for instant UI rendering before API responds
export const FALLBACK_UNIVERSITIES = [
  "University of Lagos",
  "University of Ibadan",
  "University of Nigeria, Nsukka",
  "Obafemi Awolowo University",
  "University of Benin",
  "Ahmadu Bello University",
  "University of Ilorin",
  "Covenant University",
  "Federal University of Technology, Akure",
  "University of Port Harcourt",
  "Lagos State University",
  "Bayero University Kano",
  "Nnamdi Azikiwe University",
  "Yaba College of Technology",
  "Federal Polytechnic, Ilaro",
  "Kaduna Polytechnic",
];
