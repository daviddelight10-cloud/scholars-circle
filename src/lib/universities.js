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

// Predefined list of Nigerian universities with medical/health-science programs
export const FALLBACK_UNIVERSITIES = [
  // Federal Universities with Medical Schools
  "Ahmadu Bello University",
  "Bayero University, Kano",
  "Federal University of Health Sciences, Azare",
  "Federal University of Health Sciences, Ila-Orangun",
  "Federal University of Health Sciences, Otukpo",
  "Nnamdi Azikiwe University",
  "Obafemi Awolowo University",
  "University of Abuja",
  "University of Benin",
  "University of Calabar",
  "University of Ibadan",
  "University of Ilorin",
  "University of Jos",
  "University of Lagos",
  "University of Maiduguri",
  "University of Nigeria, Nsukka",
  "University of Port Harcourt",
  "University of Uyo",
  "Usmanu Danfodiyo University",
  // State Universities with Medical/Health Sciences
  "Abia State University",
  "Ambrose Alli University",
  "Bayelsa Medical University",
  "Benue State University",
  "Chukwuemeka Odumegwu Ojukwu University",
  "Delta State University, Abraka",
  "Ebonyi State University",
  "Edo State University, Uzairue",
  "Ekiti State University",
  "Gombe State University",
  "Imo State University",
  "Kaduna State University",
  "Kwara State University",
  "Ladoke Akintola University of Technology",
  "Lagos State University",
  "Nasarawa State University, Keffi",
  "Niger Delta University",
  "Olabisi Onabanjo University",
  "Osun State University",
  "Rivers State University",
  "Sokoto State University",
  // Private Universities with Medical/Health Sciences
  "Afe Babalola University",
  "Babcock University",
  "Bingham University",
  "Benson Idahosa University",
  "Igbinedion University",
  "Madonna University",
  "PAMO University of Medical Sciences",
  "Redeemer's University",
  "Nile University of Nigeria",
  "Novena University",
  "Gregory University",
  "Achievers University",
  "Elizade University",
  "Wesley University",
  "Anchor University",
  "Covenant University",
  "Bowen University",
];
