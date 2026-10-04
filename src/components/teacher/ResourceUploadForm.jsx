import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { callAI, extractJSON } from "../../lib/aiClient";
import { getSubjectBadgeColor } from "../../lib/researchUtils";
import { getDepartments } from "../../lib/departments.js";
import { getMyProfile } from "../../lib/profileApi.js";
import { listFolders } from "../../lib/foldersApi";
import { API_BASE } from "../../lib/constants";


export default function ResourceUploadForm() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: "",
    subject: "",
    contentType: "",
    description: "",
    isPremium: false,
    level: "",
    semester: "",
    courseCode: "",
    tags: "",
  });
  const [departments, setDepartments] = useState([]);
  const [selectedDeptIds, setSelectedDeptIds] = useState([]);
  const [files, setFiles] = useState([]); // bulk upload queue
  const [fileResults, setFileResults] = useState({}); // name -> "ok"|"err:msg"|"uploading"
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const [userProfile, setUserProfile] = useState(null);
  const [folders, setFolders] = useState([]);
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [existingFiles, setExistingFiles] = useState([]); // for duplicate warning

  // MCQ Builder state
  const [mcqMode, setMcqMode] = useState("manual"); // manual | ai
  const [aiCount, setAiCount] = useState(10);
  const [aiNotes, setAiNotes] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [manualQuestion, setManualQuestion] = useState("");
  const [manualOptions, setManualOptions] = useState({ A: "", B: "", C: "", D: "" });
  const [manualCorrect, setManualCorrect] = useState("");
  const [manualExplanation, setManualExplanation] = useState("");
  const [mcqBank, setMcqBank] = useState([]);

  const subjects = ["PHY", "BIO", "ANA", "Cardiology", "GST", "HEE", "Other"];
  const contentTypes = ["Note", "PDF", "Image", "DOCX", "PPTX", "TXT", "MCQ", "Tutorial Question"];
  const levels = ["100 Level", "200 Level", "300 Level", "400 Level", "500 Level", "600 Level"];
  const semesters = ["First Semester", "Second Semester"];

  useEffect(() => {
    getMyProfile().then((data) => {
      if (data?.profile) setUserProfile(data.profile);
    }).catch(() => {});
    listFolders().then((d) => setFolders(d.own || [])).catch(() => {});
    // Existing uploads — for duplicate warnings
    try {
      const authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
      fetch(`${API_BASE}/api/resources/teacher/my`, { headers: { Authorization: `Bearer ${authData.authToken}` } })
        .then((r) => (r.ok ? r.json() : []))
        .then((rs) => setExistingFiles(rs.map((r) => ({ t: (r.title || "").toLowerCase(), f: (r.fileName || "").toLowerCase() }))))
        .catch(() => {});
    } catch {}
  }, []);

  useEffect(() => {
    if (userProfile?.universityId) {
      getDepartments(userProfile.universityId).then(setDepartments).catch(() => {});
    } else {
      getDepartments().then(setDepartments).catch(() => {});
    }
  }, [userProfile?.universityId]);

  const isMcqType = formData.contentType === "MCQ";

  useEffect(() => {
    // Reset MCQ state when content type changes
    if (!isMcqType) {
      setMcqBank([]);
      setManualQuestion("");
      setManualOptions({ A: "", B: "", C: "", D: "" });
      setManualCorrect("");
      setManualExplanation("");
      setAiNotes("");
    }
  }, [formData.contentType, isMcqType]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleFileChange = (e) => {
    const picked = Array.from(e.target.files || []);
    if (!picked.length) return;
    const ok = picked.filter((f) => f.size <= 50 * 1024 * 1024);
    if (ok.length < picked.length) setError(`${picked.length - ok.length} file(s) skipped — over the 50MB limit`);
    else setError("");
    setFiles((prev) => [...prev, ...ok]);
    setFileResults({});
    e.target.value = ""; // allow re-selecting the same file
  };

  // Duplicate warning: same title or file already uploaded
  const duplicateNames = new Set(
    existingFiles.flatMap((r) => [r.t, r.f].filter(Boolean))
  );
  const dupWarnings = files.filter((f) => duplicateNames.has(f.name.toLowerCase()));

  const uploadOne = async (f, title) => {
    const fd = new FormData();
    fd.append("title", title);
    fd.append("subject", formData.subject);
    fd.append("contentType", formData.contentType.toLowerCase().replace(" ", "_"));
    fd.append("description", formData.description);
    fd.append("isPremium", formData.isPremium);
    if (selectedDeptIds.length > 0) fd.append("departmentIds", JSON.stringify(selectedDeptIds));
    if (formData.level) fd.append("level", formData.level);
    if (formData.semester) fd.append("semester", formData.semester);
    if (formData.courseCode) fd.append("courseCode", formData.courseCode);
    if (formData.tags) fd.append("tags", JSON.stringify(formData.tags.split(",").map((t) => t.trim()).filter(Boolean)));
    if (userProfile?.universityId) fd.append("universityId", userProfile.universityId);
    if (selectedFolderId) fd.append("folderId", selectedFolderId);
    fd.append("file", f);

    const authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
    const response = await fetch(`${API_BASE}/api/resources`, {
      method: "POST",
      headers: { Authorization: `Bearer ${authData.authToken}` },
      body: fd,
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "Upload failed");
    }
  };

  const addManualQuestion = () => {
    if (!manualQuestion.trim()) {
      setError("Enter a question first");
      return;
    }
    if (!manualOptions.A || !manualOptions.B || !manualOptions.C || !manualOptions.D) {
      setError("Fill all 4 options");
      return;
    }
    if (!manualCorrect) {
      setError("Mark the correct answer");
      return;
    }

    setMcqBank((prev) => [
      ...prev,
      {
        question: manualQuestion,
        options: manualOptions,
        correct: manualCorrect,
        explanation: manualExplanation || undefined,
      },
    ]);

    // Clear form
    setManualQuestion("");
    setManualOptions({ A: "", B: "", C: "", D: "" });
    setManualCorrect("");
    setManualExplanation("");
    setError("");
  };

  const generateAIMCQs = async () => {
    if (!aiNotes.trim()) {
      setError("Paste a topic or notes first");
      return;
    }

    setAiGenerating(true);
    setError("");

    try {
      const prompt = `You are an exam MCQ generator for university students. Generate exactly ${aiCount} multiple-choice questions based on this topic/notes:\n\n${aiNotes}\n\nRespond ONLY with a valid JSON array. No markdown, no extra text. Format:\n[\n  {\n    "question": "Question text?",\n    "options": {"A":"...","B":"...","C":"...","D":"..."},\n    "correct": "A",\n    "explanation": "Brief explanation of why the correct answer is right."\n  }\n]`;

      const response = await callAI(prompt, { provider: "openrouter", model: "z-ai/glm-5.3-flash" });
      const parsed = extractJSON(response, "array");

      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error("Invalid response format");
      }

      setMcqBank((prev) => [...prev, ...parsed]);
    } catch (err) {
      setError(err.message || "AI generation failed. Try again.");
    } finally {
      setAiGenerating(false);
    }
  };

  const deleteMcqQuestion = (index) => {
    setMcqBank((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!formData.title || !formData.subject || !formData.contentType) {
      setError("Title, subject, and content type are required");
      return;
    }

    if (isMcqType) {
      if (mcqBank.length === 0) {
        setError("Add at least 1 question for MCQ type");
        return;
      }
    } else {
      if (!files.length) {
        setError("At least one file is required for this content type");
        return;
      }
    }

    setUploading(true);
    setUploadProgress(0);
    setFileResults({});

    try {
      if (isMcqType) {
        // Single MCQ upload (question bank, no file)
        const formDataToSend = new FormData();
        formDataToSend.append("title", formData.title);
        formDataToSend.append("subject", formData.subject);
        formDataToSend.append("contentType", formData.contentType.toLowerCase().replace(" ", "_"));
        formDataToSend.append("description", formData.description);
        formDataToSend.append("isPremium", formData.isPremium);
        if (selectedDeptIds.length > 0) formDataToSend.append("departmentIds", JSON.stringify(selectedDeptIds));
        if (formData.level) formDataToSend.append("level", formData.level);
        if (formData.semester) formDataToSend.append("semester", formData.semester);
        if (formData.courseCode) formDataToSend.append("courseCode", formData.courseCode);
        if (formData.tags) formDataToSend.append("tags", JSON.stringify(formData.tags.split(",").map(t => t.trim()).filter(Boolean)));
        if (userProfile?.universityId) formDataToSend.append("universityId", userProfile.universityId);
        if (selectedFolderId) formDataToSend.append("folderId", selectedFolderId);
        formDataToSend.append("mcqData", JSON.stringify(mcqBank));

        const authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
        const response = await fetch(`${API_BASE}/api/resources`, {
          method: "POST",
          headers: { Authorization: `Bearer ${authData.authToken}` },
          body: formDataToSend,
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Upload failed");
        }
      } else {
        // File queue — one POST per file; title = form title for single, filename for bulk
        const results = {};
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          const title = files.length === 1 ? formData.title : f.name.replace(/\.[^.]+$/, "");
          results[f.name] = "uploading";
          setFileResults({ ...results });
          try {
            await uploadOne(f, title);
            results[f.name] = "ok";
          } catch (err) {
            results[f.name] = `err:${err.message}`;
          }
          setFileResults({ ...results });
          setUploadProgress(Math.round(((i + 1) / files.length) * 100));
        }
        const failed = files.filter((f) => results[f.name]?.startsWith("err:"));
        if (failed.length === files.length) {
          throw new Error(results[files[0].name].slice(4) || "Upload failed");
        }
        if (failed.length > 0) {
          setError(`${failed.length} of ${files.length} uploads failed — check the queue below`);
          return; // stay on page so lecturer can see what failed
        }
      }

      setUploadProgress(100);
      setTimeout(() => {
        navigate("/teacher/resources", { state: { refresh: true } });
      }, 500);
    } catch (err) {
      const msg = err.message === "Failed to fetch"
        ? "Network error — check your connection or server may be down"
        : (err.message || "Upload failed");
      setError(msg);
      setUploadProgress(0);
      console.error("Upload error:", err, "API_BASE:", API_BASE);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "20px" }}>
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#e8eaf6", marginBottom: "8px" }}>
          Upload Resource
        </h1>
        <p style={{ fontSize: "14px", color: "#7b82b8" }}>Add study materials for students to discover and practice</p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {/* Title */}
        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#4a5080", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Title *
          </label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleInputChange}
            placeholder="e.g. PHY 111 Tutorial Questions Set 1"
            style={{
              width: "100%",
              background: "#0a0c1e",
              border: "0.5px solid #1e2245",
              borderRadius: "8px",
              padding: "10px 14px",
              fontSize: "14px",
              color: "#DAA520",
              outline: "none",
            }}
          />
        </div>

        {/* Subject */}
        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#4a5080", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Subject *
          </label>
          <select
            name="subject"
            value={formData.subject}
            onChange={handleInputChange}
            style={{
              width: "100%",
              background: "#0a0c1e",
              border: "0.5px solid #1e2245",
              borderRadius: "8px",
              padding: "10px 14px",
              fontSize: "14px",
              color: "#DAA520",
              outline: "none",
            }}
          >
            <option value="">Select subject…</option>
            {subjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* Content Type */}
        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#4a5080", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Content Type *
          </label>
          <select
            name="contentType"
            value={formData.contentType}
            onChange={handleInputChange}
            style={{
              width: "100%",
              background: "#0a0c1e",
              border: "0.5px solid #1e2245",
              borderRadius: "8px",
              padding: "10px 14px",
              fontSize: "14px",
              color: "#DAA520",
              outline: "none",
            }}
          >
            <option value="">Select type…</option>
            {contentTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        {/* Course Code + Tags */}
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 200px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#4a5080", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Course Code
            </label>
            <input
              type="text"
              name="courseCode"
              value={formData.courseCode}
              onChange={handleInputChange}
              placeholder="e.g. PHY 111"
              style={{ width: "100%", background: "#0a0c1e", border: "0.5px solid #1e2245", borderRadius: "8px", padding: "10px 14px", fontSize: "14px", color: "#DAA520", outline: "none" }}
            />
          </div>
          <div style={{ flex: "1 1 300px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#4a5080", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Tags (comma-separated)
            </label>
            <input
              type="text"
              name="tags"
              value={formData.tags}
              onChange={handleInputChange}
              placeholder="e.g. midterm, past-questions, cardiology"
              style={{ width: "100%", background: "#0a0c1e", border: "0.5px solid #1e2245", borderRadius: "8px", padding: "10px 14px", fontSize: "14px", color: "#DAA520", outline: "none" }}
            />
          </div>
        </div>

        {/* University badge */}
        {userProfile?.universityId && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", background: "#0a0c1e", border: "0.5px solid #1e2245", borderRadius: "8px" }}>
            <span style={{ fontSize: "11px", color: "#4a5080" }}>University:</span>
            <span style={{ fontSize: "12px", color: "#DAA520", fontWeight: 600 }}>
              {userProfile?.institution || "Your University"}
            </span>
          </div>
        )}

        {/* Department / Level / Semester */}
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 100%" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#4a5080", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Departments (select multiple)
            </label>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {departments.map((d) => {
                const selected = selectedDeptIds.includes(d.id);
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setSelectedDeptIds((prev) => selected ? prev.filter((id) => id !== d.id) : [...prev, d.id])}
                    style={{
                      padding: "6px 14px", borderRadius: "999px", fontSize: "12px", fontWeight: 600, cursor: "pointer",
                      background: selected ? "#1a1a1a" : "#0a0c1e",
                      border: selected ? "0.5px solid #B8860B" : "0.5px solid #1e2245",
                      color: selected ? "#FFD700" : "#7b82b8",
                    }}
                  >
                    {d.icon || "🏛️"} {d.name}
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ flex: "1 1 120px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#4a5080", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Level
            </label>
            <select
              name="level"
              value={formData.level}
              onChange={handleInputChange}
              style={{ width: "100%", background: "#0a0c1e", border: "0.5px solid #1e2245", borderRadius: "8px", padding: "10px 14px", fontSize: "14px", color: "#DAA520", outline: "none" }}
            >
              <option value="">Select level…</option>
              {levels.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div style={{ flex: "1 1 120px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#4a5080", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Semester
            </label>
            <select
              name="semester"
              value={formData.semester}
              onChange={handleInputChange}
              style={{ width: "100%", background: "#0a0c1e", border: "0.5px solid #1e2245", borderRadius: "8px", padding: "10px 14px", fontSize: "14px", color: "#DAA520", outline: "none" }}
            >
              <option value="">Select semester…</option>
              {semesters.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Destination folder (optional) */}
        {folders.length > 0 && (
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#4a5080", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Add to Folder (optional)
            </label>
            <select
              value={selectedFolderId}
              onChange={(e) => setSelectedFolderId(e.target.value)}
              style={{
                width: "100%",
                background: "#0a0c1e",
                border: "0.5px solid #1e2245",
                borderRadius: "8px",
                padding: "10px 14px",
                fontSize: "14px",
                color: "#DAA520",
                outline: "none",
              }}
            >
              <option value="">— Don't add to a folder —</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>📁 {f.name}{f.courseCode ? ` (${f.courseCode})` : ""}</option>
              ))}
            </select>
          </div>
        )}

        {/* File Upload (hidden for MCQ) — supports multiple files */}
        {!isMcqType && (
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#4a5080", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              File{files.length > 1 ? "s" : ""} * {files.length > 1 && <span style={{ textTransform: "none", color: "#7b82b8" }}>({files.length} — each becomes a resource named after the file)</span>}
            </label>
            <div
              onClick={() => document.getElementById("fileInput").click()}
              style={{
                border: "1px dashed #2a2d4a",
                borderRadius: "10px",
                padding: files.length ? "16px" : "30px",
                textAlign: "center",
                cursor: "pointer",
                transition: "borderColor 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#B8860B")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#2a2d4a")}
            >
              <input
                id="fileInput"
                type="file"
                multiple
                onChange={handleFileChange}
                accept=".pdf,.docx,.doc,.txt,.json,.png,.jpg,.jpeg,.webp,.gif,.bmp,.pptx"
                style={{ display: "none" }}
              />
              <div style={{ fontSize: "24px", color: "#3a3d60", marginBottom: "8px" }}>📁</div>
              <p style={{ fontSize: "14px", color: "#4a5080", margin: 0 }}>
                {files.length ? "Tap to add more files" : "Drop files here or tap to browse"}
              </p>
              <span style={{ fontSize: "12px", color: "#2e3260" }}>PDF, DOCX, PPTX, TXT, Images · Max 50MB each</span>
            </div>

            {/* Duplicate warnings */}
            {dupWarnings.length > 0 && (
              <div style={{ marginTop: 8, padding: "8px 12px", background: "#1a1000", border: "0.5px solid #3a2800", borderRadius: "8px", fontSize: "12px", color: "#ffcc80" }}>
                ⚠️ Possible duplicates — {dupWarnings.map((f) => f.name).join(", ")} already exist in your uploads
              </div>
            )}

            {/* File queue */}
            {files.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: 10 }}>
                {files.map((f, i) => {
                  const st = fileResults[f.name];
                  return (
                    <div key={`${f.name}-${i}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "#0d0f20", border: "0.5px solid #1e2245", borderRadius: "8px", fontSize: "12px" }}>
                      <span style={{ flex: 1, color: "#c5c9e8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                      <span style={{ color: "#4a5080", fontSize: "10px", flexShrink: 0 }}>{(f.size / 1024 / 1024).toFixed(1)}MB</span>
                      {st === "uploading" && <span style={{ color: "#DAA520", fontSize: "11px" }}>⏳</span>}
                      {st === "ok" && <span style={{ color: "#66bb6a", fontSize: "11px" }}>✓</span>}
                      {st?.startsWith("err:") && <span style={{ color: "#ef9a9a", fontSize: "10px" }} title={st.slice(4)}>✗ failed</span>}
                      {!uploading && (
                        <button type="button" onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: "#4a5080", cursor: "pointer", fontSize: "13px", padding: 0 }}>✕</button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* MCQ Builder (shown only for MCQ type) */}
        {isMcqType && (
          <div style={{ background: "#0d0f20", border: "0.5px solid #1e2245", borderRadius: "12px", padding: "16px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#4a5080", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Build MCQ Bank
            </label>

            {/* Mode Tabs */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
              <button
                type="button"
                onClick={() => setMcqMode("manual")}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "10px",
                  background: mcqMode === "manual" ? "#1a1a1a" : "#0f1128",
                  border: mcqMode === "manual" ? "0.5px solid #B8860B" : "0.5px solid #252860",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: mcqMode === "manual" ? "#FFD700" : "#5a6090",
                  cursor: "pointer",
                }}
              >
                ✏️ Manual Entry
              </button>
              <button
                type="button"
                onClick={() => setMcqMode("ai")}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "10px",
                  background: mcqMode === "ai" ? "#1a1a1a" : "#0f1128",
                  border: mcqMode === "ai" ? "0.5px solid #B8860B" : "0.5px solid #252860",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: mcqMode === "ai" ? "#FFD700" : "#5a6090",
                  cursor: "pointer",
                }}
              >
                ✨ AI Generate
              </button>
            </div>

            {/* Manual Mode */}
            {mcqMode === "manual" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", color: "#7b82b8", marginBottom: "4px" }}>Question Text *</label>
                  <textarea
                    value={manualQuestion}
                    onChange={(e) => setManualQuestion(e.target.value)}
                    rows="2"
                    placeholder="Type your question here…"
                    style={{
                      width: "100%",
                      background: "#0a0c1e",
                      border: "0.5px solid #1e2245",
                      borderRadius: "8px",
                      padding: "8px 12px",
                      fontSize: "12px",
                      color: "#DAA520",
                      outline: "none",
                      resize: "none",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11px", color: "#7b82b8", marginBottom: "4px" }}>Options — tap ● to mark correct answer</label>
                  {["A", "B", "C", "D"].map((letter) => (
                    <div key={letter} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                      <div
                        style={{
                          width: "22px",
                          height: "22px",
                          borderRadius: "6px",
                          background: "#12142a",
                          border: "0.5px solid #252860",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "9px",
                          fontWeight: 700,
                          color: "#5a6090",
                        }}
                      >
                        {letter}
                      </div>
                      <input
                        type="text"
                        value={manualOptions[letter]}
                        onChange={(e) => setManualOptions((prev) => ({ ...prev, [letter]: e.target.value }))}
                        placeholder={`Option ${letter}`}
                        style={{
                          flex: 1,
                          background: "#0a0c1e",
                          border: "0.5px solid #1e2245",
                          borderRadius: "7px",
                          padding: "6px 10px",
                          fontSize: "11px",
                          color: "#DAA520",
                          outline: "none",
                        }}
                      />
                      <input
                        type="radio"
                        name="correctOpt"
                        checked={manualCorrect === letter}
                        onChange={() => setManualCorrect(letter)}
                        style={{ cursor: "pointer" }}
                      />
                    </div>
                  ))}
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11px", color: "#7b82b8", marginBottom: "4px" }}>Explanation (optional)</label>
                  <textarea
                    value={manualExplanation}
                    onChange={(e) => setManualExplanation(e.target.value)}
                    rows="2"
                    placeholder="Explain why the correct answer is right…"
                    style={{
                      width: "100%",
                      background: "#0a0c1e",
                      border: "0.5px solid #1e2245",
                      borderRadius: "8px",
                      padding: "8px 12px",
                      fontSize: "12px",
                      color: "#DAA520",
                      outline: "none",
                      resize: "none",
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={addManualQuestion}
                  style={{
                    width: "100%",
                    padding: "8px",
                    background: "#111328",
                    border: "0.5px solid #2a3080",
                    borderRadius: "8px",
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "#7986cb",
                    cursor: "pointer",
                  }}
                >
                  + Add to Bank
                </button>
              </div>
            )}

            {/* AI Mode */}
            {mcqMode === "ai" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", color: "#7b82b8", marginBottom: "4px" }}>Topic or Notes *</label>
                  <textarea
                    value={aiNotes}
                    onChange={(e) => setAiNotes(e.target.value)}
                    rows="4"
                    placeholder="e.g. 'Cardiac cycle and heart sounds' or paste lecture notes directly…"
                    style={{
                      width: "100%",
                      background: "#0a0c1e",
                      border: "0.5px solid #1e2245",
                      borderRadius: "8px",
                      padding: "8px 12px",
                      fontSize: "12px",
                      color: "#DAA520",
                      outline: "none",
                      resize: "none",
                    }}
                  />
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "11px", color: "#7b82b8" }}>Questions to generate (max 150)</span>
                  <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                    <button
                      type="button"
                      onClick={() => setAiCount((prev) => Math.max(1, prev - 5))}
                      style={{
                        width: "26px",
                        height: "26px",
                        borderRadius: "6px",
                        background: "#12142a",
                        border: "0.5px solid #252860",
                        color: "#7b82b8",
                        cursor: "pointer",
                        fontSize: "14px",
                        fontWeight: 700,
                      }}
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={150}
                      value={aiCount}
                      onChange={(e) => setAiCount(Math.max(1, Math.min(150, parseInt(e.target.value) || 1)))}
                      style={{
                        width: "50px",
                        textAlign: "center",
                        fontSize: "13px",
                        fontWeight: 700,
                        color: "#c5c9e8",
                        background: "#12142a",
                        border: "0.5px solid #252860",
                        borderRadius: "6px",
                        padding: "4px",
                        outline: "none",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setAiCount((prev) => Math.min(150, prev + 5))}
                      style={{
                        width: "26px",
                        height: "26px",
                        borderRadius: "6px",
                        background: "#12142a",
                        border: "0.5px solid #252860",
                        color: "#7b82b8",
                        cursor: "pointer",
                        fontSize: "14px",
                        fontWeight: 700,
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={generateAIMCQs}
                  disabled={aiGenerating}
                  style={{
                    width: "100%",
                    padding: "10px",
                    background: "linear-gradient(135deg, #1a1a1a, #0a0a0a)",
                    border: "0.5px solid #B8860B",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: 700,
                    color: "#FFD700",
                    cursor: aiGenerating ? "not-allowed" : "pointer",
                    opacity: aiGenerating ? 0.4 : 1,
                  }}
                >
                  {aiGenerating ? "Generating..." : "✨ Generate MCQs"}
                </button>
              </div>
            )}

            {/* Question Bank Preview */}
            {mcqBank.length > 0 && (
              <div style={{ marginTop: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                  <div style={{ flex: 1, height: "0.5px", background: "#1e2245" }} />
                  <span style={{ fontSize: "10px", color: "#3a3d60", fontWeight: 600, whiteSpace: "nowrap" }}>
                    MCQ BANK PREVIEW
                  </span>
                  <div style={{ flex: 1, height: "0.5px", background: "#1e2245" }} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
                  <span style={{ fontSize: "10px" }}>📋</span>
                  <span style={{ fontSize: "10px", fontWeight: 700, color: "#7986cb" }}>
                    {mcqBank.length} question{mcqBank.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {mcqBank.map((q, i) => (
                    <div
                      key={i}
                      style={{
                        background: "#0d0f20",
                        border: "0.5px solid #1e2245",
                        borderRadius: "10px",
                        padding: "10px 12px",
                        position: "relative",
                      }}
                    >
                      <div style={{ fontSize: "9px", color: "#3a3d60", fontWeight: 700, marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        Question {i + 1}
                      </div>
                      <div style={{ fontSize: "11px", color: "#c5c9e8", lineHeight: 1.5, marginBottom: "8px" }}>
                        {q.question}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                        {Object.entries(q.options).map(([k, v]) => (
                          <span
                            key={k}
                            style={{
                              padding: "3px 9px",
                              borderRadius: "6px",
                              fontSize: "10px",
                              fontWeight: 600,
                              background: k === q.correct ? "#0f2a1a" : "#12142a",
                              border: k === q.correct ? "0.5px solid #2a6a3a" : "0.5px solid #1e2245",
                              color: k === q.correct ? "#a5d6a7" : "#5a6090",
                            }}
                          >
                            {k}: {v}
                          </span>
                        ))}
                      </div>
                      {q.explanation && (
                        <div style={{ fontSize: "10px", color: "#7b82b8", marginTop: "6px", fontStyle: "italic", lineHeight: 1.4 }}>
                          💡 {q.explanation}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => deleteMcqQuestion(i)}
                        style={{
                          position: "absolute",
                          top: "8px",
                          right: "8px",
                          width: "20px",
                          height: "20px",
                          background: "#1a0a0a",
                          border: "0.5px solid #3a1010",
                          borderRadius: "5px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          color: "#ef9a9a",
                          fontSize: "10px",
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Description */}
        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#4a5080", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Description (optional)
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            rows="3"
            placeholder="Brief description…"
            style={{
              width: "100%",
              background: "#0a0c1e",
              border: "0.5px solid #1e2245",
              borderRadius: "8px",
              padding: "10px 14px",
              fontSize: "14px",
              color: "#DAA520",
              outline: "none",
              resize: "none",
            }}
          />
        </div>

        {/* Premium Toggle */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 14px",
            background: "#0a0c1e",
            border: "0.5px solid #1e2245",
            borderRadius: "8px",
          }}
        >
          <span style={{ fontSize: "12px", color: "#7b82b8" }}>Mark as Premium</span>
          <div
            onClick={() => setFormData((prev) => ({ ...prev, isPremium: !prev.isPremium }))}
            style={{
              width: "34px",
              height: "18px",
              background: formData.isPremium ? "#1a1a1a" : "#1e2245",
              borderRadius: "9px",
              position: "relative",
              cursor: "pointer",
              transition: "background 0.2s",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "2px",
                left: formData.isPremium ? "18px" : "2px",
                width: "14px",
                height: "14px",
                borderRadius: "50%",
                background: formData.isPremium ? "#DAA520" : "#4a5080",
                transition: "all 0.2s",
              }}
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: "#1a0808", border: "0.5px solid #4a1010", borderRadius: "8px", padding: "10px 12px", fontSize: "12px", color: "#ef9a9a" }}>
            {error}
          </div>
        )}

        {/* Upload Progress */}
        {uploading && (
          <div>
            <div style={{ height: "4px", background: "#1a1d35", borderRadius: "2px", marginBottom: "8px", overflow: "hidden" }}>
              <div style={{ height: "100%", background: "#B8860B", borderRadius: "2px", width: `${uploadProgress}%`, transition: "width 0.3s" }} />
            </div>
            <p style={{ fontSize: "12px", color: "#7b82b8", textAlign: "center" }}>Uploading… {uploadProgress}%</p>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={uploading}
          style={{
            width: "100%",
            padding: "12px",
            background: "#1a1a1a",
            border: "0.5px solid #B8860B",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: 700,
            color: "#FFD700",
            cursor: uploading ? "not-allowed" : "pointer",
            opacity: uploading ? 0.4 : 1,
          }}
        >
          {uploading ? "Uploading…" : "Upload Resource"}
        </button>
      </form>
    </div>
  );
}
