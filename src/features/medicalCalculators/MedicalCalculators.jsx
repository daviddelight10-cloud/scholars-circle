import { useState } from "react";

const CALCULATORS = [
  { id: "bmi", name: "BMI (Body Mass Index)", icon: "⚖️", category: "General" },
  { id: "egfr", name: "eGFR (Estimated GFR)", icon: "🧪", category: "Renal" },
  { id: "map", name: "Mean Arterial Pressure", icon: "🩺", category: "Cardiac" },
  { id: "wells_pe", name: "Wells Score (PE)", icon: "🫁", category: "Risk Score" },
  { id: "cha2ds2", name: "CHA₂DS₂-VASc", icon: "❤️", category: "Risk Score" },
  { id: "qtc", name: "QTc Correction", icon: "📈", category: "Cardiac" },
  { id: "anion_gap", name: "Anion Gap", icon: "⚡", category: "Electrolytes" },
  { id: "fluid_deficit", name: "Fluid Deficit (Dehydration)", icon: "💧", category: "General" },
];

function BMICalculator() {
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const bmi = weight && height ? (parseFloat(weight) / Math.pow(parseFloat(height) / 100, 2)).toFixed(1) : null;
  const category = bmi ? (bmi < 18.5 ? "Underweight" : bmi < 25 ? "Normal" : bmi < 30 ? "Overweight" : "Obese") : "";
  const color = bmi < 18.5 ? "#f59e0b" : bmi < 25 ? "#22c55e" : bmi < 30 ? "#f59e0b" : "#ef4444";
  return (
    <div>
      <label>Weight (kg): <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} style={inputStyle} /></label>
      <label>Height (cm): <input type="number" value={height} onChange={(e) => setHeight(e.target.value)} style={inputStyle} /></label>
      {bmi && <div style={{ textAlign: "center", marginTop: 16 }}>
        <div style={{ fontSize: 36, fontWeight: 700, color }}>{bmi}</div>
        <div style={{ color }}>{category}</div>
      </div>}
    </div>
  );
}

function EGFRCalculator() {
  const [age, setAge] = useState("");
  const [sex, setSex] = useState("male");
  const [creat, setCreat] = useState("");
  const sCr = parseFloat(creat);
  const a = parseFloat(age);
  const sexMult = sex === "female" ? 0.742 : 1;
  const eGFR = sCr && a ? Math.round(186 * Math.pow(sCr, -1.154) * Math.pow(a, -0.203) * sexMult) : null;
  const stage = eGFR ? (eGFR >= 90 ? "Stage 1 (Normal)" : eGFR >= 60 ? "Stage 2 (Mild)" : eGFR >= 30 ? "Stage 3 (Moderate)" : eGFR >= 15 ? "Stage 4 (Severe)" : "Stage 5 (ESRD)") : "";
  const color = eGFR >= 60 ? "#22c55e" : eGFR >= 30 ? "#f59e0b" : "#ef4444";
  return (
    <div>
      <label>Age (years): <input type="number" value={age} onChange={(e) => setAge(e.target.value)} style={inputStyle} /></label>
      <label>Sex: <select value={sex} onChange={(e) => setSex(e.target.value)} style={inputStyle}>
        <option value="male">Male</option><option value="female">Female</option>
      </select></label>
      <label>Serum Creatinine (μmol/L): <input type="number" value={creat} onChange={(e) => setCreat(e.target.value)} style={inputStyle} /></label>
      {eGFR && <div style={{ textAlign: "center", marginTop: 16 }}>
        <div style={{ fontSize: 36, fontWeight: 700, color }}>{eGFR} <span style={{ fontSize: 14 }}>mL/min/1.73m²</span></div>
        <div style={{ color }}>{stage}</div>
      </div>}
    </div>
  );
}

function MAPCalculator() {
  const [sbp, setSbp] = useState("");
  const [dbp, setDbp] = useState("");
  const map = sbp && dbp ? Math.round((parseFloat(sbp) + 2 * parseFloat(dbp)) / 3) : null;
  const status = map ? (map < 65 ? "Low (Hypoperfusion risk)" : map > 110 ? "High" : "Normal") : "";
  const color = map < 65 ? "#ef4444" : map > 110 ? "#f59e0b" : "#22c55e";
  return (
    <div>
      <label>Systolic BP (mmHg): <input type="number" value={sbp} onChange={(e) => setSbp(e.target.value)} style={inputStyle} /></label>
      <label>Diastolic BP (mmHg): <input type="number" value={dbp} onChange={(e) => setDbp(e.target.value)} style={inputStyle} /></label>
      {map && <div style={{ textAlign: "center", marginTop: 16 }}>
        <div style={{ fontSize: 36, fontWeight: 700, color }}>{map} <span style={{ fontSize: 14 }}>mmHg</span></div>
        <div style={{ color }}>{status}</div>
      </div>}
    </div>
  );
}

function WellsPE() {
  const [answers, setAnswers] = useState({});
  const criteria = [
    { id: "clin_pe", text: "Clinical signs consistent with PE", points: 3 },
    { id: "alt_dx", text: "PE is the most likely diagnosis", points: 3 },
    { id: "hr", text: "Heart rate > 100 bpm", points: 1.5 },
    { id: "immob", text: "Immobilization ≥3 days or surgery in last 4 weeks", points: 1.5 },
    { id: "vte_hx", text: "Previous DVT or PE", points: 1.5 },
    { id: "hemoptysis", text: "Hemoptysis", points: 1 },
    { id: "cancer", text: "Active cancer (treatment within 6 months or palliative)", points: 1 },
  ];
  const score = criteria.reduce((sum, c) => sum + (answers[c.id] ? c.points : 0), 0);
  const risk = score < 2 ? "Low risk (PE unlikely)" : score <= 6 ? "Moderate risk" : "High risk (PE likely)";
  const color = score < 2 ? "#22c55e" : score <= 6 ? "#f59e0b" : "#ef4444";
  return (
    <div>
      {criteria.map((c) => (
        <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", cursor: "pointer" }}>
          <input type="checkbox" checked={!!answers[c.id]} onChange={(e) => setAnswers((p) => ({ ...p, [c.id]: e.target.checked }))} style={{ width: 20, height: 20 }} />
          <span style={{ color: "#cbd5e1", fontSize: 14 }}>{c.text} <span style={{ color: "#FFD700" }}>({c.points} pts)</span></span>
        </label>
      ))}
      <div style={{ textAlign: "center", marginTop: 16 }}>
        <div style={{ fontSize: 36, fontWeight: 700, color }}>{score}</div>
        <div style={{ color }}>{risk}</div>
      </div>
    </div>
  );
}

function CHA2DS2VASc() {
  const [answers, setAnswers] = useState({});
  const criteria = [
    { id: "chf", text: "Congestive heart failure", points: 1 },
    { id: "htn", text: "Hypertension", points: 1 },
    { id: "age75", text: "Age ≥ 75", points: 2 },
    { id: "dm", text: "Diabetes mellitus", points: 1 },
    { id: "stroke", text: "Prior stroke/TIA/thromboembolism", points: 2 },
    { id: "vasc", text: "Vascular disease (MI, PAD, aortic plaque)", points: 1 },
    { id: "age65", text: "Age 65-74", points: 1 },
    { id: "female", text: "Female sex", points: 1 },
  ];
  const score = criteria.reduce((sum, c) => sum + (answers[c.id] ? c.points : 0), 0);
  const risk = score === 0 ? "Low risk (0% annual stroke risk)" : score === 1 ? "Low-moderate risk (1.3%)" : score <= 3 ? "Moderate risk (4-6%)" : "High risk (consider anticoagulation)";
  const color = score <= 1 ? "#22c55e" : score <= 3 ? "#f59e0b" : "#ef4444";
  return (
    <div>
      {criteria.map((c) => (
        <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", cursor: "pointer" }}>
          <input type="checkbox" checked={!!answers[c.id]} onChange={(e) => setAnswers((p) => ({ ...p, [c.id]: e.target.checked }))} style={{ width: 20, height: 20 }} />
          <span style={{ color: "#cbd5e1", fontSize: 14 }}>{c.text} <span style={{ color: "#FFD700" }}>({c.points} pt{c.points > 1 ? "s" : ""})</span></span>
        </label>
      ))}
      <div style={{ textAlign: "center", marginTop: 16 }}>
        <div style={{ fontSize: 36, fontWeight: 700, color }}>{score}</div>
        <div style={{ color }}>{risk}</div>
      </div>
    </div>
  );
}

function QTcCalculator() {
  const [qt, setQt] = useState("");
  const [hr, setHr] = useState("");
  const rr = hr ? 60 / parseFloat(hr) : 0;
  const qtc = qt && hr ? (parseFloat(qt) / Math.sqrt(rr)).toFixed(0) : null;
  const status = qtc ? (qtc < 440 ? "Normal" : qtc < 470 ? "Borderline (males)" : qtc < 480 ? "Borderline (females)" : "Prolonged") : "";
  const color = qtc < 440 ? "#22c55e" : qtc < 480 ? "#f59e0b" : "#ef4444";
  return (
    <div>
      <label>QT interval (ms): <input type="number" value={qt} onChange={(e) => setQt(e.target.value)} style={inputStyle} /></label>
      <label>Heart rate (bpm): <input type="number" value={hr} onChange={(e) => setHr(e.target.value)} style={inputStyle} /></label>
      {qtc && <div style={{ textAlign: "center", marginTop: 16 }}>
        <div style={{ fontSize: 36, fontWeight: 700, color }}>{qtc} <span style={{ fontSize: 14 }}>ms</span></div>
        <div style={{ color }}>{status}</div>
      </div>}
    </div>
  );
}

function AnionGapCalculator() {
  const [na, setNa] = useState("");
  const [cl, setCl] = useState("");
  const [hco3, setHco3] = useState("");
  const gap = na && cl && hco3 ? (parseFloat(na) - parseFloat(cl) - parseFloat(hco3)).toFixed(0) : null;
  const status = gap ? (gap < 8 ? "Low" : gap <= 12 ? "Normal" : gap <= 20 ? "High (Mild)" : "High (Severe)") : "";
  const color = gap <= 12 ? "#22c55e" : gap <= 20 ? "#f59e0b" : "#ef4444";
  return (
    <div>
      <label>Sodium (mmol/L): <input type="number" value={na} onChange={(e) => setNa(e.target.value)} style={inputStyle} /></label>
      <label>Chloride (mmol/L): <input type="number" value={cl} onChange={(e) => setCl(e.target.value)} style={inputStyle} /></label>
      <label>Bicarbonate (mmol/L): <input type="number" value={hco3} onChange={(e) => setHco3(e.target.value)} style={inputStyle} /></label>
      {gap && <div style={{ textAlign: "center", marginTop: 16 }}>
        <div style={{ fontSize: 36, fontWeight: 700, color }}>{gap} <span style={{ fontSize: 14 }}>mmol/L</span></div>
        <div style={{ color }}>{status}</div>
        {gap > 12 && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 8 }}>Normal: 8-12. High gap suggests lactic acidosis, DKA, renal failure, or toxins.</div>}
      </div>}
    </div>
  );
}

function FluidDeficitCalculator() {
  const [weight, setWeight] = useState("");
  const [dehydration, setDehydration] = useState("5");
  const deficit = weight ? (parseFloat(weight) * parseFloat(dehydration) / 100 * 10).toFixed(0) : null;
  return (
    <div>
      <label>Weight (kg): <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} style={inputStyle} /></label>
      <label>Dehydration level:
        <select value={dehydration} onChange={(e) => setDehydration(e.target.value)} style={inputStyle}>
          <option value="3">Mild (3%)</option>
          <option value="5">Moderate (5%)</option>
          <option value="8">Severe (8%)</option>
          <option value="10">Very Severe (10%)</option>
        </select>
      </label>
      {deficit && <div style={{ textAlign: "center", marginTop: 16 }}>
        <div style={{ fontSize: 36, fontWeight: 700, color: "#3D7EFF" }}>{deficit} <span style={{ fontSize: 14 }}>mL</span></div>
        <div style={{ color: "#94a3b8" }}>Fluid deficit to replace over 24-48 hours</div>
        <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 8 }}>Give half in first 8 hours, remainder over next 16 hours. Add maintenance fluids.</div>
      </div>}
    </div>
  );
}

const inputStyle = { display: "block", marginBottom: 12, width: "100%", padding: "10px 14px", borderRadius: 8, background: "#111", color: "#fff", border: "1px solid #333" };

const CALC_COMPONENTS = {
  bmi: BMICalculator,
  egfr: EGFRCalculator,
  map: MAPCalculator,
  wells_pe: WellsPE,
  cha2ds2: CHA2DS2VASc,
  qtc: QTcCalculator,
  anion_gap: AnionGapCalculator,
  fluid_deficit: FluidDeficitCalculator,
};

export default function MedicalCalculators() {
  const [selected, setSelected] = useState(null);
  const [filterCat, setFilterCat] = useState("");

  const categories = [...new Set(CALCULATORS.map((c) => c.category))];
  const filtered = filterCat ? CALCULATORS.filter((c) => c.category === filterCat) : CALCULATORS;
  const ActiveCalc = selected ? CALC_COMPONENTS[selected.id] : null;

  if (selected) {
    return (
      <div style={{ maxWidth: 600, margin: "0 auto", padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2>{selected.icon} {selected.name}</h2>
          <button className="ghost" onClick={() => setSelected(null)}>← Back</button>
        </div>
        <div className="card">
          <ActiveCalc />
        </div>
        <p style={{ marginTop: 16, fontSize: 12, color: "#666", textAlign: "center" }}>
          For educational purposes only. Always verify calculations in clinical practice.
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 16 }}>
      <h2>🧮 Medical Calculators</h2>
      <p className="muted" style={{ marginBottom: 16 }}>
        Clinical calculators and risk scores for medical practice and exam preparation.
      </p>
      <div style={{ marginBottom: 16 }}>
        <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 8, background: "#111", color: "#fff", border: "1px solid #333" }}>
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 12 }}>
        {filtered.map((c) => (
          <div key={c.id} className="card" style={{ cursor: "pointer" }} onClick={() => setSelected(c)}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>{c.icon}</div>
            <h3 style={{ fontSize: 15 }}>{c.name}</h3>
            <p style={{ fontSize: 12, color: "#94a3b8" }}>{c.category}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
