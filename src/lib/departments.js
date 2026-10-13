import { API_BASE as BASE } from "./constants.js";

import { authFetch } from "./authToken.js";

export async function getDepartments(universityId) {
  const params = universityId ? `?universityId=${universityId}` : "";
  const res = await authFetch(`${BASE}/api/departments${params}`);
  if (!res.ok) throw new Error("Failed to load departments");
  return res.json();
}

export async function getUserDepartment() {
  const res = await authFetch(`${BASE}/api/departments/user`);
  if (!res.ok) return null;
  return res.json();
}

export async function setUserDepartment(departmentId, yearLevel, semester, universityId) {
  const res = await authFetch(`${BASE}/api/departments/user`, {
    method: "POST",
    body: JSON.stringify({ departmentId, yearLevel, semester, universityId }),
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
