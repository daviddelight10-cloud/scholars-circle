import { useState, useMemo } from "react";

const STUDY_PATHS_KEY = "sc_study_paths_v1";

function loadStudyPaths() {
  try {
    const raw = localStorage.getItem(STUDY_PATHS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStudyPaths(paths) {
  localStorage.setItem(STUDY_PATHS_KEY, JSON.stringify(paths));
}

export function PersonalizedStudyPaths({ subjects, mastery, history, stats, onStartPractice }) {
  const [studyPaths, setStudyPaths] = useState(loadStudyPaths());
  const [selectedPath, setSelectedPath] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPathName, setNewPathName] = useState("");
  const [selectedSubjects, setSelectedSubjects] = useState([]);

  // Analyze performance to generate recommendations
  const recommendations = useMemo(() => {
    const weakSubjects = subjects.filter(s => (mastery[s.id] || 0) < 60);
    const strongSubjects = subjects.filter(s => (mastery[s.id] || 0) >= 80);
    
    const paths = [];
    
    // Path 1: Focus on weak areas
    if (weakSubjects.length > 0) {
      paths.push({
        id: "weakness-focus",
        name: "🎯 Weakness Focus",
        description: "Prioritize subjects where you need improvement",
        subjects: weakSubjects.map(s => s.id),
        estimatedDays: weakSubjects.length * 3,
        difficulty: "medium",
        icon: "🎯"
      });
    }
    
    // Path 2: Balanced review
    if (subjects.length >= 2) {
      paths.push({
        id: "balanced-review",
        name: "⚖️ Balanced Review",
        description: "Review all subjects evenly",
        subjects: subjects.map(s => s.id),
        estimatedDays: subjects.length * 2,
        difficulty: "easy",
        icon: "⚖️"
      });
    }
    
    // Path 3: Mastery push
    if (strongSubjects.length > 0) {
      paths.push({
        id: "mastery-push",
        name: "🚀 Mastery Push",
        description: "Push strong subjects to 100% mastery",
        subjects: strongSubjects.map(s => s.id),
        estimatedDays: strongSubjects.length * 2,
        difficulty: "hard",
        icon: "🚀"
      });
    }
    
    // Path 4: Exam prep
    paths.push({
      id: "exam-prep",
      name: "📝 Exam Preparation",
      description: "Comprehensive review for upcoming exams",
      subjects: subjects.map(s => s.id),
      estimatedDays: subjects.length * 4,
      difficulty: "hard",
      icon: "📝"
    });
    
    return paths;
  }, [subjects, mastery]);

  function createCustomPath() {
    if (!newPathName.trim() || selectedSubjects.length === 0) return;
    
    const newPath = {
      id: `custom_${Date.now()}`,
      name: newPathName,
      description: `Custom path focusing on ${selectedSubjects.length} subject(s)`,
      subjects: selectedSubjects,
      estimatedDays: selectedSubjects.length * 3,
      difficulty: "medium",
      icon: "📚",
      isCustom: true,
      createdAt: Date.now(),
      progress: 0
    };
    
    const updated = [...studyPaths, newPath];
    setStudyPaths(updated);
    saveStudyPaths(updated);
    setNewPathName("");
    setSelectedSubjects([]);
    setShowCreateModal(false);
  }

  function deletePath(pathId) {
    const updated = studyPaths.filter(p => p.id !== pathId);
    setStudyPaths(updated);
    saveStudyPaths(updated);
  }

  function startPath(path) {
    setSelectedPath(path);
    // Start with the first subject in the path
    const firstSubjectId = path.subjects[0];
    if (firstSubjectId && onStartPractice) {
      onStartPractice(firstSubjectId);
    }
  }

  function toggleSubject(subjectId) {
    setSelectedSubjects(prev => 
      prev.includes(subjectId) 
        ? prev.filter(id => id !== subjectId)
        : [...prev, subjectId]
    );
  }

  const allPaths = [...recommendations, ...studyPaths];

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2>🗺️ Personalized Study Paths</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            background: "#FFD700",
            color: "white",
            border: "none",
            padding: "8px 16px",
            borderRadius: 6,
            cursor: "pointer"
          }}
        >
          + Create Custom Path
        </button>
      </div>

      <p className="muted">
        AI-generated study paths based on your performance. Choose a path to focus your learning.
      </p>

      {/* Recommended Paths */}
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 12 }}>🤖 AI Recommendations</h3>
        <div style={{ display: "grid", gap: 12 }}>
          {recommendations.map((path) => (
            <div
              key={path.id}
              className="lesson-block"
              style={{
                borderLeft: `4px solid ${path.difficulty === "easy" ? "#10b981" : path.difficulty === "medium" ? "#f59e0b" : "#ef4444"}`,
                cursor: "pointer"
              }}
              onClick={() => startPath(path)}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h4 style={{ margin: 0, marginBottom: 4 }}>{path.icon} {path.name}</h4>
                  <p className="muted" style={{ fontSize: 13, margin: 0 }}>{path.description}</p>
                </div>
                <span style={{ 
                  fontSize: 11, 
                  padding: "4px 8px", 
                  borderRadius: 4,
                  background: path.difficulty === "easy" ? "#065f46" : path.difficulty === "medium" ? "#92400e" : "#7f1d1d"
                }}>
                  {path.difficulty}
                </span>
              </div>
              <div style={{ marginTop: 8, display: "flex", gap: 16, fontSize: 12, color: "#9ca3af" }}>
                <span>📚 {path.subjects.length} subject(s)</span>
                <span>📅 ~{path.estimatedDays} days</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Custom Paths */}
      {studyPaths.length > 0 && (
        <div>
          <h3 style={{ marginBottom: 12 }}>📝 Your Custom Paths</h3>
          <div style={{ display: "grid", gap: 12 }}>
            {studyPaths.map((path) => (
              <div
                key={path.id}
                className="lesson-block"
                style={{
                  borderLeft: "4px solid #FFD700"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h4 style={{ margin: 0, marginBottom: 4 }}>{path.icon} {path.name}</h4>
                    <p className="muted" style={{ fontSize: 13, margin: 0 }}>{path.description}</p>
                  </div>
                  <button
                    onClick={() => deletePath(path.id)}
                    style={{
                      background: "transparent",
                      border: "1px solid #ef4444",
                      color: "#ef4444",
                      padding: "4px 8px",
                      borderRadius: 4,
                      cursor: "pointer",
                      fontSize: 12
                    }}
                  >
                    Delete
                  </button>
                </div>
                <div style={{ marginTop: 8, display: "flex", gap: 16, fontSize: 12, color: "#9ca3af" }}>
                  <span>📚 {path.subjects.length} subject(s)</span>
                  <span>📅 ~{path.estimatedDays} days</span>
                  <button
                    onClick={() => startPath(path)}
                    style={{
                      background: "#FFD700",
                      color: "white",
                      border: "none",
                      padding: "4px 12px",
                      borderRadius: 4,
                      cursor: "pointer",
                      marginLeft: "auto"
                    }}
                  >
                    Start
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Custom Path Modal */}
      {showCreateModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.7)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000
        }}>
          <div style={{
            background: "#1f2937",
            padding: 24,
            borderRadius: 12,
            maxWidth: 500,
            width: "90%"
          }}>
            <h3 style={{ margin: "0 0 16px 0" }}>Create Custom Study Path</h3>
            
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 4, fontSize: 13 }}>Path Name</label>
              <input
                type="text"
                value={newPathName}
                onChange={(e) => setNewPathName(e.target.value)}
                placeholder="e.g., Biology Week 1"
                style={{
                  width: "100%",
                  padding: 8,
                  background: "#374151",
                  border: "1px solid #4b5563",
                  borderRadius: 4,
                  color: "white"
                }}
              />
            </div>
            
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 8, fontSize: 13 }}>Select Subjects</label>
              <div style={{ display: "grid", gap: 8, maxHeight: 200, overflowY: "auto" }}>
                {subjects.map((s) => (
                  <label key={s.id} style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    gap: 8,
                    padding: 8,
                    background: selectedSubjects.includes(s.id) ? "#3730a3" : "#374151",
                    borderRadius: 4,
                    cursor: "pointer"
                  }}>
                    <input
                      type="checkbox"
                      checked={selectedSubjects.includes(s.id)}
                      onChange={() => toggleSubject(s.id)}
                      style={{ cursor: "pointer" }}
                    />
                    <span>{s.icon} {s.label}</span>
                    <span className="muted" style={{ marginLeft: "auto", fontSize: 11 }}>
                      {mastery[s.id] || 0}% mastery
                    </span>
                  </label>
                ))}
              </div>
            </div>
            
            <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{
                  background: "#374151",
                  color: "white",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: 4,
                  cursor: "pointer"
                }}
              >
                Cancel
              </button>
              <button
                onClick={createCustomPath}
                disabled={!newPathName.trim() || selectedSubjects.length === 0}
                style={{
                  background: "#FFD700",
                  color: "white",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: 4,
                  cursor: "pointer",
                  opacity: (!newPathName.trim() || selectedSubjects.length === 0) ? 0.5 : 1
                }}
              >
                Create Path
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
