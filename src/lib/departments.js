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

export async function getDepartments() {
  const res = await fetch(`${BASE}/api/departments`);
  if (!res.ok) throw new Error("Failed to load departments");
  return res.json();
}

export async function getUserDepartment() {
  const res = await authFetch(`${BASE}/api/departments/user`);
  if (!res.ok) return null;
  return res.json();
}

export async function setUserDepartment(departmentId, yearLevel) {
  const res = await authFetch(`${BASE}/api/departments/user`, {
    method: "POST",
    body: JSON.stringify({ departmentId, yearLevel }),
  });
  if (!res.ok) throw new Error("Failed to save department");
  return res.json();
}

export async function createDepartment(name, icon) {
  const res = await authFetch(`${BASE}/api/departments`, {
    method: "POST",
    body: JSON.stringify({ name, icon }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to create department");
  }
  return res.json();
}

export async function updateDepartment(id, data) {
  const res = await authFetch(`${BASE}/api/departments/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update department");
  return res.json();
}

export async function deleteDepartment(id) {
  const res = await authFetch(`${BASE}/api/departments/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to delete department");
  }
  return res.json();
}
