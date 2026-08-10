import { useState, useEffect, useCallback } from "react";
import { getUniversities, createUniversity, updateUniversity } from "../../lib/universities.js";

export default function UniversityManager() {
  const [universities, setUniversities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saveError, setSaveError] = useState("");
  const [form, setForm] = useState({ name: "", type: "university", country: "Nigeria", city: "" });

  const fetchUniversities = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getUniversities(search || undefined);
      setUniversities(data);
    } catch {
      setError("Failed to load universities");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchUniversities(); }, [fetchUniversities]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setSaveError("");
    if (!form.name.trim()) { setSaveError("Name is required"); return; }
    try {
      await createUniversity(form.name.trim(), form.type, form.country, form.city || null);
      setForm({ name: "", type: "university", country: "Nigeria", city: "" });
      setShowAddForm(false);
      fetchUniversities();
    } catch (err) {
      setSaveError(err.message);
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    setSaveError("");
    if (!form.name.trim()) { setSaveError("Name is required"); return; }
    try {
      await updateUniversity(editingId, {
        name: form.name.trim(),
        type: form.type,
        country: form.country,
        city: form.city || null,
      });
      setEditingId(null);
      setForm({ name: "", type: "university", country: "Nigeria", city: "" });
      fetchUniversities();
    } catch (err) {
      setSaveError(err.message);
    }
  };

  const startEdit = (uni) => {
    setEditingId(uni.id);
    setForm({ name: uni.name, type: uni.type || "university", country: uni.country || "Nigeria", city: uni.city || "" });
    setSaveError("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({ name: "", type: "university", country: "Nigeria", city: "" });
    setSaveError("");
  };

  const inputStyle = {
    width: "100%", background: "#0a0c1e", border: "0.5px solid #1e2245", borderRadius: "8px",
    padding: "10px 14px", fontSize: "14px", color: "#DAA520", outline: "none",
  };
  const labelStyle = {
    display: "block", fontSize: "12px", fontWeight: 600, color: "#4a5080",
    marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px",
  };

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#e8eaf6", marginBottom: "4px" }}>
            Universities
          </h1>
          <p style={{ fontSize: "14px", color: "#7b82b8" }}>Manage available universities and schools</p>
        </div>
        <button
          onClick={() => { setShowAddForm(!showAddForm); cancelEdit(); }}
          style={{
            padding: "10px 20px", borderRadius: "10px", fontSize: "13px", fontWeight: 700,
            background: showAddForm ? "#1a1a1a" : "linear-gradient(135deg, #B8860B, #DAA520)",
            color: showAddForm ? "#7b82b8" : "#0a0a0a", border: "none", cursor: "pointer",
          }}
        >
          {showAddForm ? "Cancel" : "+ Add University"}
        </button>
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search universities…"
        style={{ ...inputStyle, marginBottom: "20px" }}
      />

      {/* Add/Edit Form */}
      {(showAddForm || editingId) && (
        <form onSubmit={editingId ? handleEdit : handleAdd} style={{
          background: "#0d0f20", border: "0.5px solid #1e2245", borderRadius: "12px",
          padding: "20px", marginBottom: "20px", display: "flex", flexDirection: "column", gap: "16px",
        }}>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 250px" }}>
              <label style={labelStyle}>Name *</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. University of Lagos" style={inputStyle} />
            </div>
            <div style={{ flex: "1 1 150px" }}>
              <label style={labelStyle}>Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} style={inputStyle}>
                <option value="university">University</option>
                <option value="polytechnic">Polytechnic</option>
                <option value="college">College</option>
                <option value="school">School</option>
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 200px" }}>
              <label style={labelStyle}>Country</label>
              <input type="text" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} style={inputStyle} />
            </div>
            <div style={{ flex: "1 1 200px" }}>
              <label style={labelStyle}>City</label>
              <input type="text" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="e.g. Lagos" style={inputStyle} />
            </div>
          </div>
          {saveError && <div style={{ fontSize: "12px", color: "#ef9a9a" }}>{saveError}</div>}
          <button type="submit" style={{
            padding: "10px 20px", borderRadius: "10px", fontSize: "13px", fontWeight: 700,
            background: "linear-gradient(135deg, #B8860B, #DAA520)", color: "#0a0a0a",
            border: "none", cursor: "pointer", alignSelf: "flex-start",
          }}>
            {editingId ? "Save Changes" : "Create University"}
          </button>
        </form>
      )}

      {/* List */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#4a5080" }}>Loading…</div>
      ) : error ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#ef9a9a" }}>{error}</div>
      ) : universities.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#4a5080" }}>No universities found</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {universities.map((uni) => (
            <div key={uni.id} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "#0d0f20", border: "0.5px solid #1e2245", borderRadius: "10px", padding: "14px 18px",
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "#DAA520", marginBottom: "2px" }}>
                  {uni.name}
                </div>
                <div style={{ display: "flex", gap: "12px", fontSize: "11px", color: "#4a5080" }}>
                  <span>{uni.type}</span>
                  {uni.city && <span>{uni.city}, {uni.country}</span>}
                  <span>{uni._count?.departments || 0} depts</span>
                  <span>{uni._count?.userProfiles || 0} students</span>
                </div>
              </div>
              <button
                onClick={() => editingId === uni.id ? cancelEdit() : startEdit(uni)}
                style={{
                  padding: "6px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 600,
                  background: editingId === uni.id ? "#1a1a1a" : "#111328",
                  color: editingId === uni.id ? "#7b82b8" : "#7986cb",
                  border: "0.5px solid #252860", cursor: "pointer", flexShrink: 0,
                }}
              >
                {editingId === uni.id ? "Cancel" : "Edit"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
