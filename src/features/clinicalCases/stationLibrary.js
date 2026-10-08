// Custom-station library — locally authored OSCE cases. Stored per-user in
// localStorage; playable by the same VirtualPatient engine as built-in CASES
// and selectable as group-practice stations.

const KEY = "scc_custom_stations";

function storageKey() {
  try {
    const u = JSON.parse(localStorage.getItem("scholars-circle-auth"))?.authUser;
    return `${KEY}::${u?.id || u?.username || "guest"}`;
  } catch {
    return `${KEY}::guest`;
  }
}

export function getCustomStations() {
  try {
    const raw = localStorage.getItem(storageKey());
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function save(list) {
  try { localStorage.setItem(storageKey(), JSON.stringify(list)); } catch {}
}

/** Validate a draft station — returns { ok, errors[], station } */
export function validateStation(draft) {
  const errors = [];
  const s = (v) => (typeof v === "string" ? v.trim() : "");
  const st = {
    id: draft.id || `st_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    custom: true,
    title: s(draft.title),
    bed: s(draft.bed) || "CUSTOM",
    demo: s(draft.demo),
    cc: s(draft.cc),
    specialty: s(draft.specialty) || "General Medicine",
    station_type: ["history", "counselling", "data"].includes(draft.station_type) ? draft.station_type : "history",
    candidate_instructions: s(draft.candidate_instructions),
    persona: s(draft.persona),
    history: {},
    exam: {},
    investigations: {},
    diagnosis: s(draft.diagnosis),
    essential_points: Array.isArray(draft.essential_points) ? draft.essential_points.map(s).filter(Boolean) : [],
    management_key: Array.isArray(draft.management_key) ? draft.management_key.map(s).filter(Boolean) : [],
    closing_points: Array.isArray(draft.closing_points) ? draft.closing_points.map(s).filter(Boolean) : [],
    critical: Array.isArray(draft.critical) ? draft.critical.filter((n) => Number.isInteger(n)) : [],
    viva: Array.isArray(draft.viva) ? draft.viva.map(s).filter(Boolean) : [],
    voice: s(draft.voice) || undefined,
  };
  for (const [k, v] of Object.entries(draft.history || {})) {
    if (s(k) && s(v)) st.history[s(k)] = s(v);
  }
  for (const [k, v] of Object.entries(draft.exam || {})) {
    if (s(k) && s(v)) st.exam[s(k)] = s(v);
  }
  for (const [name, inv] of Object.entries(draft.investigations || {})) {
    if (s(name) && inv && s(inv.result)) st.investigations[s(name).toLowerCase()] = { result: s(inv.result), indicated: !!inv.indicated };
  }
  if (draft.hidden_agenda?.reveal?.trim()) {
    st.hidden_agenda = { trigger_hint: s(draft.hidden_agenda.trigger_hint), reveal: draft.hidden_agenda.reveal.trim() };
  }

  if (!st.cc && !st.title) errors.push("Give the station a title or chief complaint.");
  if (!st.demo) errors.push("Patient demographics are required (e.g. 'Female, 34, teacher').");
  if (st.station_type !== "counselling" && Object.keys(st.history).length < 3) {
    errors.push("Add at least 3 history-script facts so the patient can answer questions.");
  }
  if (st.station_type === "history" && !st.diagnosis) {
    errors.push("The hidden diagnosis is required for a history station.");
  }
  if (st.essential_points.length < 3) {
    errors.push("Add at least 3 examiner-checklist items.");
  }
  return { ok: errors.length === 0, errors, station: st };
}

export function saveCustomStation(draft) {
  const v = validateStation(draft);
  if (!v.ok) return v;
  const list = getCustomStations();
  const idx = list.findIndex((x) => x.id === v.station.id);
  if (idx >= 0) list[idx] = v.station;
  else list.push(v.station);
  save(list);
  return v;
}

export function deleteCustomStation(id) {
  save(getCustomStations().filter((x) => x.id !== id));
}

export function getCustomStation(id) {
  return getCustomStations().find((x) => x.id === id) || null;
}
