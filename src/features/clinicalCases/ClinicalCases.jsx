import { useState } from "react";

const SPECIALTIES = [
  "Internal Medicine", "Surgery", "Obstetrics & Gynaecology", "Paediatrics",
  "Psychiatry", "Emergency Medicine", "Dermatology", "Orthopaedics",
  "ENT", "Ophthalmology", "Community Medicine", "Radiology",
];

const SAMPLE_CASES = [
  {
    id: "case-001",
    specialty: "Internal Medicine",
    title: "28-year-old with fever and cough",
    difficulty: "Medium",
    patient: { age: 28, sex: "Male", occupation: "Trader" },
    presenting: "Fever for 2 weeks, productive cough with blood-stained sputum, night sweats, weight loss",
    findings: "Temp 38.5°C, RR 24, SpO2 94% on room air. Crackles in right upper zone. No lymphadenopathy.",
    investigations: ["Sputum AFB", "Chest X-ray", "HIV test", "CBC", "ESR"],
    differentials: ["Pulmonary tuberculosis", "Pneumonia", "Lung malignancy", "Bronchiectasis"],
    diagnosis: "Pulmonary tuberculosis",
    management: "Start DOTS therapy (2HRZE/4HR). Isolate patient. Contact tracing. HIV counselling and testing.",
    pearls: ["Always screen for HIV in TB patients", "Sputum AFB is first-line diagnostic", "DOTS ensures compliance"],
  },
  {
    id: "case-002",
    specialty: "Emergency Medicine",
    title: "55-year-old with crushing chest pain",
    difficulty: "Hard",
    patient: { age: 55, sex: "Male", occupation: "Banker" },
    presenting: "Sudden onset crushing central chest pain radiating to left arm, sweating, nausea. 1 hour duration.",
    findings: "BP 160/95, HR 110, RR 22, SpO2 98%. Anxious, diaphoretic. Heart sounds normal. No murmurs.",
    investigations: ["ECG", "Troponin I", "CBC", "U&E", "Creatinine", "Lipid profile", "Blood glucose"],
    differentials: ["Acute MI (STEMI)", "Aortic dissection", "Pulmonary embolism", "Pericarditis", "GERD"],
    diagnosis: "Acute ST-elevation myocardial infarction (STEMI)",
    management: "MONA (Morphine, Oxygen, Nitrates, Aspirin). Dual antiplatelet therapy. Urgent PCI or thrombolysis if within 12 hours.",
    pearls: ["Time is muscle — door-to-balloon < 90 min", "ECG within 10 minutes of arrival", "Aspirin 300mg stat"],
  },
  {
    id: "case-003",
    specialty: "Paediatrics",
    title: "3-year-old with fever and convulsions",
    difficulty: "Medium",
    patient: { age: 3, sex: "Female", occupation: "N/A" },
    presenting: "3-day history of fever, cough, diarrhea. Today had a generalized tonic-clonic seizure lasting 5 minutes.",
    findings: "Temp 39.2°C, HR 140, RR 36. Lethargic but rousable. Cap refill 2s. No neck stiffness. Dehydrated.",
    investigations: ["Blood glucose", "CBC", "Blood culture", "Malaria smear", "Stool microscopy", "U&E"],
    differentials: ["Febrile convulsion with malaria", "Meningitis", "Encephalitis", "Hypoglycemia", "Dehydration with electrolyte imbalance"],
    diagnosis: "Febrile convulsion secondary to malaria with dehydration",
    management: "IV fluids (bolus 20ml/kg normal saline). IV quinine or artesunate. Paracetamol. Monitor blood glucose. Check electrolytes.",
    pearls: ["Always check blood glucose in seizing child", "Rule out meningitis if persistent altered consciousness", "Malaria is commonest cause of fever in endemic areas"],
  },
];

export default function ClinicalCases() {
  const [cases, setCases] = useState(SAMPLE_CASES);
  const [selectedCase, setSelectedCase] = useState(null);
  const [stage, setStage] = useState(0);
  const [userDifferentials, setUserDifferentials] = useState([]);
  const [userDiagnosis, setUserDiagnosis] = useState("");
  const [showAnswer, setShowAnswer] = useState(false);
  const [filterSpecialty, setFilterSpecialty] = useState("");
  const [score, setScore] = useState(0);

  const filteredCases = filterSpecialty
    ? cases.filter((c) => c.specialty === filterSpecialty)
    : cases;

  function startCase(c) {
    setSelectedCase(c);
    setStage(0);
    setUserDifferentials([]);
    setUserDiagnosis("");
    setShowAnswer(false);
  }

  function addDifferential() {
    setUserDifferentials((prev) => [...prev, ""]);
  }

  function updateDifferential(idx, val) {
    setUserDifferentials((prev) => prev.map((d, i) => (i === idx ? val : d)));
  }

  function checkDiagnosis() {
    if (!selectedCase) return;
    let points = 0;
    const correctDx = selectedCase.diagnosis.toLowerCase();
    const userDx = userDiagnosis.toLowerCase();
    if (userDx && correctDx.includes(userDx.split(" ")[0])) points += 5;
    const matchedDiffs = userDifferentials.filter((d) =>
      selectedCase.differentials.some((cd) => cd.toLowerCase().includes(d.toLowerCase()))
    );
    points += matchedDiffs.length * 2;
    setScore((prev) => prev + points);
    setShowAnswer(true);
  }

  if (selectedCase) {
    const stages = ["Patient Profile", "History & Examination", "Investigations", "Your Assessment", "Discussion"];
    return (
      <div style={{ maxWidth: 800, margin: "0 auto", padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2>{selectedCase.title}</h2>
          <button className="ghost" onClick={() => setSelectedCase(null)}>← Back to Cases</button>
        </div>
        <div style={{ display: "flex", gap: 4, marginBottom: 24 }}>
          {stages.map((s, i) => (
            <div key={i} style={{
              flex: 1, padding: "8px 4px", textAlign: "center",
              background: i <= stage ? "rgba(239,68,68,0.2)" : "rgba(20,20,20,0.5)",
              border: i <= stage ? "1px solid #ef4444" : "1px solid #333",
              borderRadius: 8, fontSize: 11, color: i <= stage ? "#ef4444" : "#666",
            }}>{s}</div>
          ))}
        </div>

        {stage === 0 && (
          <div className="card">
            <h3>🧑 Patient Profile</h3>
            <p><strong>Age:</strong> {selectedCase.patient.age}</p>
            <p><strong>Sex:</strong> {selectedCase.patient.sex}</p>
            <p><strong>Occupation:</strong> {selectedCase.patient.occupation}</p>
            <p><strong>Presenting Complaint:</strong> {selectedCase.presenting}</p>
            <button style={{ borderColor: "#ef4444", color: "#ef4444" }} onClick={() => setStage(1)}>Next →</button>
          </div>
        )}

        {stage === 1 && (
          <div className="card">
            <h3>🔍 Examination Findings</h3>
            <p>{selectedCase.findings}</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="ghost" onClick={() => setStage(0)}>← Back</button>
              <button style={{ borderColor: "#ef4444", color: "#ef4444" }} onClick={() => setStage(2)}>Next →</button>
            </div>
          </div>
        )}

        {stage === 2 && (
          <div className="card">
            <h3>🔬 Investigations Ordered</h3>
            <ul>
              {selectedCase.investigations.map((inv, i) => <li key={i}>{inv}</li>)}
            </ul>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="ghost" onClick={() => setStage(1)}>← Back</button>
              <button style={{ borderColor: "#ef4444", color: "#ef4444" }} onClick={() => setStage(3)}>Next →</button>
            </div>
          </div>
        )}

        {stage === 3 && (
          <div className="card">
            <h3>🧠 Your Assessment</h3>
            <p className="muted" style={{ marginBottom: 12 }}>List your differential diagnoses:</p>
            {userDifferentials.map((d, i) => (
              <input key={i} value={d} onChange={(e) => updateDifferential(i, e.target.value)}
                placeholder={`Differential ${i + 1}`} style={{ display: "block", marginBottom: 8, width: "100%" }} />
            ))}
            <button className="ghost" onClick={addDifferential} style={{ marginBottom: 16 }}>+ Add Differential</button>
            <p className="muted" style={{ marginBottom: 8 }}>Your working diagnosis:</p>
            <input value={userDiagnosis} onChange={(e) => setUserDiagnosis(e.target.value)}
              placeholder="Enter your diagnosis" style={{ width: "100%", marginBottom: 16 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button className="ghost" onClick={() => setStage(2)}>← Back</button>
              <button style={{ borderColor: "#ef4444", color: "#ef4444" }} onClick={checkDiagnosis}>Submit →</button>
            </div>
          </div>
        )}

        {showAnswer && (
          <div className="card" style={{ marginTop: 16 }}>
            <h3>📋 Case Discussion</h3>
            <p><strong>Correct Diagnosis:</strong> {selectedCase.diagnosis}</p>
            <p><strong>Differential Diagnoses:</strong></p>
            <ul>{selectedCase.differentials.map((d, i) => <li key={i}>{d}</li>)}</ul>
            <p><strong>Management Plan:</strong> {selectedCase.management}</p>
            <p><strong>Clinical Pearls:</strong></p>
            <ul>{selectedCase.pearls.map((p, i) => <li key={i}>{p}</li>)}</ul>
            <p style={{ color: "#FFD700" }}>Score: +{score} XP</p>
            <button style={{ borderColor: "#ef4444", color: "#ef4444" }} onClick={() => setSelectedCase(null)}>Next Case →</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 16 }}>
      <h2>🩺 Clinical Case Simulations</h2>
      <p className="muted" style={{ marginBottom: 16 }}>
        Practice clinical reasoning with interactive patient cases. Work through history, examination, investigations, and diagnosis.
      </p>
      <div style={{ marginBottom: 16 }}>
        <select value={filterSpecialty} onChange={(e) => setFilterSpecialty(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 8, background: "#111", color: "#fff", border: "1px solid #333" }}>
          <option value="">All Specialties</option>
          {SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
        {filteredCases.map((c) => (
          <div key={c.id} className="card" style={{ cursor: "pointer" }} onClick={() => startCase(c)}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: "#ef4444" }}>{c.specialty}</span>
              <span style={{ fontSize: 12, color: "#FFD700" }}>{c.difficulty}</span>
            </div>
            <h3 style={{ fontSize: 16 }}>{c.title}</h3>
            <p className="muted" style={{ fontSize: 13 }}>{c.patient.age}yo {c.patient.sex} — {c.presenting.slice(0, 60)}...</p>
          </div>
        ))}
      </div>
    </div>
  );
}
