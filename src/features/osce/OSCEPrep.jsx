import { useState, useEffect } from "react";

const OSCE_STATIONS = [
  {
    id: "osce-001",
    type: "History Taking",
    title: "Abdominal pain in a 25-year-old female",
    scenario: "You are a medical student in the GP clinic. A 25-year-old female presents with 3 days of lower abdominal pain. Take a focused history.",
    duration: 8,
    checklist: [
      "Introduces self and confirms patient identity",
      "Asks about onset, character, and location of pain (SOCRATES)",
      "Asks about associated symptoms (nausea, vomiting, fever, diarrhea)",
      "Asks about menstrual history (LMP, cycle, dysmenorrhea)",
      "Asks about sexual history (contraception, STI risk)",
      "Asks about urinary symptoms (dysuria, frequency)",
      "Asks about past medical and surgical history",
      "Asks about family history of similar conditions",
      "Counsels patient on next steps and thanks them",
    ],
    pitfalls: ["Forgetting to ask about pregnancy risk", "Not using SOCRATES for pain", "Ignoring menstrual history", "Not asking about sexual history"],
    examinerNotes: "Look for structured approach. Must rule out ectopic pregnancy in any female of reproductive age with abdominal pain.",
  },
  {
    id: "osce-002",
    type: "Examination",
    title: "Respiratory system examination",
    scenario: "Examine the respiratory system of this 60-year-old male patient who presents with chronic cough.",
    duration: 10,
    checklist: [
      "Washes hands, introduces self, confirms patient identity",
      "Positions patient at 45 degrees, exposes appropriately",
      "Inspects for cyanosis, clubbing, accessory muscle use",
      "Checks respiratory rate and pattern",
      "Palpates trachea for deviation",
      "Performs chest expansion",
      "Percusses all lung fields",
      "Auscultates all lung fields",
      "Checks for lymphadenopathy",
      "Summarizes findings and suggests further investigations",
    ],
    pitfalls: ["Forgetting to check fingers for clubbing", "Not percussing axilla", "Missing respiratory rate", "Not exposing adequately"],
    examinerNotes: "Must follow inspection, palpation, percussion, auscultation (IPPA) sequence. Check for clubbing and cyanosis first.",
  },
  {
    id: "osce-003",
    type: "Communication",
    title: "Breaking bad news — cancer diagnosis",
    scenario: "A 50-year-old patient has just been diagnosed with colorectal cancer. Break the news to them sensitively.",
    duration: 10,
    checklist: [
      "Prepares environment (private, sit down, no interruptions)",
      "Assesses patient's understanding so far (Ask-Tell-Ask)",
      "Gives warning shot ('I'm afraid I have some concerning news')",
      "Delivers diagnosis clearly and simply",
      "Pauses to allow patient to process",
      "Acknowledges and validates emotional response",
      "Explores patient's concerns and fears",
      "Discusses management plan in broad terms",
      "Offers follow-up and support resources",
      "Summarizes and checks understanding",
    ],
    pitfalls: ["Using jargon", "Rushing through the news", "Not pausing for emotions", "Not offering hope or support"],
    examinerNotes: "Use SPIKES protocol. The key is empathy and allowing silence. Don't overwhelm with information.",
  },
  {
    id: "osce-004",
    type: "Procedure",
    title: "Hand washing and aseptic technique",
    scenario: "Demonstrate proper hand washing technique before a sterile procedure.",
    duration: 5,
    checklist: [
      "Removes watch and jewelry",
      "Wets hands with water",
      "Applies sufficient soap",
      "Cleans palms, between fingers, backs of hands",
      "Cleans thumbs and fingernails",
      "Rinses thoroughly with water",
      "Dries hands with single-use towel",
      "Uses towel to turn off tap",
      "Total duration 40-60 seconds",
    ],
    pitfalls: ["Missing between fingers", "Not cleaning nails", "Touching tap after washing", "Too short duration"],
    examinerNotes: "WHO 6-step hand washing technique. Must be thorough and systematic.",
  },
  {
    id: "osce-005",
    type: "History Taking",
    title: "Chest pain in a 55-year-old male",
    scenario: "A 55-year-old man presents with chest pain. Take a focused history to determine the cause.",
    duration: 8,
    checklist: [
      "Introduces self and confirms identity",
      "Uses SOCRATES for pain characterization",
      "Asks about associated symptoms (sweating, nausea, dyspnea)",
      "Asks about cardiac risk factors (smoking, diabetes, hypertension, family history)",
      "Asks about previous cardiac history",
      "Asks about exertional relationship",
      "Asks about relieving factors (rest, GTN)",
      "Counsels on urgency and next steps",
    ],
    pitfalls: ["Not asking about radiation", "Missing cardiac risk factors", "Not asking about GTN use", "Forgetting family history"],
    examinerNotes: "Must differentiate cardiac from non-cardiac pain. Risk factors are crucial for risk stratification.",
  },
];

export default function OSCEPrep() {
  const [selectedStation, setSelectedStation] = useState(null);
  const [timer, setTimer] = useState(0);
  const [running, setRunning] = useState(false);
  const [checkedItems, setCheckedItems] = useState({});
  const [showFeedback, setShowFeedback] = useState(false);
  const [filterType, setFilterType] = useState("");

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      setTimer((t) => Math.max(0, t - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [running]);

  useEffect(() => {
    if (timer === 0 && running) {
      setRunning(false);
    }
  }, [timer, running]);

  function startStation(station) {
    setSelectedStation(station);
    setTimer(station.duration * 60);
    setRunning(false);
    setCheckedItems({});
    setShowFeedback(false);
  }

  function toggleCheck(idx) {
    setCheckedItems((prev) => ({ ...prev, [idx]: !prev[idx] }));
  }

  const score = Object.values(checkedItems).filter(Boolean).length;
  const totalChecks = selectedStation ? selectedStation.checklist.length : 0;
  const percentage = totalChecks > 0 ? Math.round((score / totalChecks) * 100) : 0;

  const filteredStations = filterType
    ? OSCE_STATIONS.filter((s) => s.type === filterType)
    : OSCE_STATIONS;

  const stationTypes = [...new Set(OSCE_STATIONS.map((s) => s.type))];

  if (selectedStation) {
    const minutes = Math.floor(timer / 60);
    const seconds = timer % 60;
    return (
      <div style={{ maxWidth: 800, margin: "0 auto", padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2>{selectedStation.title}</h2>
          <button className="ghost" onClick={() => setSelectedStation(null)}>← Back</button>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, padding: "12px 16px", background: "#111", borderRadius: 12, border: "1px solid #333" }}>
          <div>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>Station Type: </span>
            <span style={{ color: "#ef4444" }}>{selectedStation.type}</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: timer < 60 ? "#ef4444" : "#FFD700" }}>
            {minutes}:{seconds.toString().padStart(2, "0")}
          </div>
          <button style={{ borderColor: "#ef4444", color: "#ef4444" }} onClick={() => setRunning(!running)}>
            {running ? "Pause" : "Start"}
          </button>
        </div>
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>📋 Scenario</h3>
          <p>{selectedStation.scenario}</p>
        </div>
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>✅ Checklist</h3>
          {selectedStation.checklist.map((item, i) => (
            <label key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", cursor: "pointer" }}>
              <input type="checkbox" checked={!!checkedItems[i]} onChange={() => toggleCheck(i)} style={{ width: 20, height: 20 }} />
              <span style={{ color: checkedItems[i] ? "#22c55e" : "#cbd5e1" }}>{item}</span>
            </label>
          ))}
        </div>
        {showFeedback && (
          <div className="card" style={{ marginBottom: 16, border: "1px solid #f59e0b" }}>
            <h3>📝 Examiner Feedback</h3>
            <p><strong>Score:</strong> {score}/{totalChecks} ({percentage}%)</p>
            <p><strong>Common Pitfalls:</strong></p>
            <ul>{selectedStation.pitfalls.map((p, i) => <li key={i}>{p}</li>)}</ul>
            <p><strong>Examiner Notes:</strong> {selectedStation.examinerNotes}</p>
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <button className="ghost" onClick={() => setSelectedStation(null)}>Exit Station</button>
          <button style={{ borderColor: "#ef4444", color: "#ef4444" }} onClick={() => setShowFeedback(true)}>Submit & Get Feedback</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 16 }}>
      <h2>🏥 OSCE Prep Stations</h2>
      <p className="muted" style={{ marginBottom: 16 }}>
        Practice Objective Structured Clinical Examination stations with timed checklists and scoring rubrics.
      </p>
      <div style={{ marginBottom: 16 }}>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 8, background: "#111", color: "#fff", border: "1px solid #333" }}>
          <option value="">All Station Types</option>
          {stationTypes.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
        {filteredStations.map((s) => (
          <div key={s.id} className="card" style={{ cursor: "pointer" }} onClick={() => startStation(s)}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: "#ef4444" }}>{s.type}</span>
              <span style={{ fontSize: 12, color: "#FFD700" }}>⏱ {s.duration} min</span>
            </div>
            <h3 style={{ fontSize: 16 }}>{s.title}</h3>
            <p className="muted" style={{ fontSize: 13 }}>{s.scenario.slice(0, 80)}...</p>
          </div>
        ))}
      </div>
    </div>
  );
}
