import { useState, useMemo } from "react";

const DRUG_DATABASE = [
  { name: "Paracetamol", class: "Analgesic / Antipyretic", generic: "Acetaminophen", indications: "Pain, fever", dosage: "500-1000mg PO QID (max 4g/day)", contraindications: "Severe hepatic impairment", sideEffects: "Hepatotoxicity (overdose), nausea", interactions: "Warfarin (increased INR)", pregnancy: "Safe in all trimesters" },
  { name: "Amoxicillin", class: "Antibiotic (Penicillin)", generic: "Amoxicillin", indications: "UTI, RTI, otitis media, dental infections", dosage: "500mg PO TID for 5-7 days", contraindications: "Penicillin allergy", sideEffects: "Diarrhea, rash, nausea", interactions: "Oral contraceptives (reduced efficacy), warfarin", pregnancy: "Safe (Category B)" },
  { name: "Metformin", class: "Antidiabetic (Biguanide)", generic: "Metformin HCl", indications: "Type 2 diabetes mellitus", dosage: "500mg PO BD, titrate to max 2g/day", contraindications: "Renal impairment (eGFR <30), DKA, severe heart failure", sideEffects: "GI upset, lactic acidosis (rare), B12 deficiency", interactions: "Contrast media (hold 48h), alcohol", pregnancy: "Not recommended (use insulin)" },
  { name: "Amlodipine", class: "Antihypertensive (CCB)", generic: "Amlodipine besylate", indications: "Hypertension, angina", dosage: "5mg PO OD, max 10mg OD", contraindications: "Cardiogenic shock, severe aortic stenosis", sideEffects: "Ankle edema, headache, flushing, palpitations", interactions: "Simvastatin (max 20mg), grapefruit juice", pregnancy: "Not recommended (Category C)" },
  { name: "Lisinopril", class: "Antihypertensive (ACE inhibitor)", generic: "Lisinopril", indications: "Hypertension, heart failure, post-MI", dosage: "10mg PO OD, max 40mg OD", contraindications: "Pregnancy, bilateral renal artery stenosis, angioedema history", sideEffects: "Dry cough, hyperkalemia, angioedema, hypotension", interactions: "NSAIDs (reduced effect), potassium-sparing diuretics", pregnancy: "Contraindicated (Category D)" },
  { name: "Artesunate", class: "Antimalarial", generic: "Artesunate", indications: "Severe malaria (IV/IM), uncomplicated malaria (PO)", dosage: "IV: 2.4mg/kg at 0, 12, 24h then daily. PO: 4mg/kg BD for 3 days", contraindications: "Known hypersensitivity", sideEffects: "Dizziness, tinnitus, nausea", interactions: "Mefloquine (additive QT prolongation)", pregnancy: "Safe in all trimesters (severe malaria)" },
  { name: "Ceftriaxone", class: "Antibiotic (Cephalosporin 3rd gen)", generic: "Ceftriaxone", indications: "Meningitis, sepsis, gonorrhea, typhoid", dosage: "IV/IM 1-2g OD (meningitis: 2g BD)", contraindications: "Cephalosporin allergy, neonatal jaundice", sideEffects: "Diarrhea, rash, biliary sludging, eosinophilia", interactions: "Calcium-containing solutions (fatal precipitate)", pregnancy: "Safe (Category B)" },
  { name: "Salbutamol", class: "Bronchodilator (Beta-2 agonist)", generic: "Salbutamol", indications: "Asthma, COPD exacerbation", dosage: "Inhaler: 100-200mcg PRN. Nebulizer: 2.5-5mg", contraindications: "Hypersensitivity to salbutamol", sideEffects: "Tremor, tachycardia, palpitations, hypokalemia", interactions: "Beta-blockers (antagonize), digoxin", pregnancy: "Safe (Category B)" },
  { name: "Omeprazole", class: "Proton Pump Inhibitor", generic: "Omeprazole", indications: "GERD, peptic ulcer, H. pylori eradication", dosage: "20-40mg PO OD", contraindications: "Hypersensitivity", sideEffects: "Headache, diarrhea, B12 deficiency (long-term), osteoporosis", interactions: "Clopidogrel (reduced effect), ketoconazole", pregnancy: "Category C (use if needed)" },
  { name: "Furosemide", class: "Loop Diuretic", generic: "Furosemide", indications: "Edema, heart failure, hypertension", dosage: "PO: 20-80mg. IV: 20-40mg slowly", contraindications: "Anuria, severe hypovolemia, hepatic coma", sideEffects: "Hypokalemia, hyponatremia, dehydration, ototoxicity (IV)", interactions: "Aminoglycosides (additive ototoxicity), digoxin", pregnancy: "Category C (use with caution)" },
  { name: "Diazepam", class: "Benzodiazepine", generic: "Diazepam", indications: "Anxiety, seizures, alcohol withdrawal, status epilepticus", dosage: "IV: 5-10mg slow. PO: 2-10mg TID", contraindications: "Myasthenia gravis, severe respiratory depression", sideEffects: "Sedation, respiratory depression, dependence", interactions: "Opioids (additive respiratory depression), alcohol", pregnancy: "Category D (avoid in 1st trimester)" },
  { name: "Insulin (Regular)", class: "Insulin", generic: "Human regular insulin", indications: "Diabetes mellitus, DKA, hyperkalemia", dosage: "SC: individualized. IV infusion: 0.1 U/kg/hr for DKA", contraindications: "Hypoglycemia", sideEffects: "Hypoglycemia, lipodystrophy, weight gain", interactions: "Beta-blockers (mask hypoglycemia), alcohol", pregnancy: "Safe (preferred in pregnancy)" },
  { name: "Aspirin", class: "Antiplatelet / NSAID", generic: "Acetylsalicylic acid", indications: "Antiplatelet (75-300mg), pain/fever (300-900mg)", dosage: "Antiplatelet: 75mg PO OD. Pain: 300-600mg PRN", contraindications: "Active peptic ulcer, children <16 (Reye's), bleeding disorders", sideEffects: "GI bleeding, tinnitus, bronchospasm", interactions: "Warfarin, NSAIDs (additive bleeding)", pregnancy: "Avoid in 3rd trimester" },
  { name: "Quinine", class: "Antimalarial", generic: "Quinine dihydrochloride", indications: "Severe malaria (when artesunate unavailable)", dosage: "IV: 20mg/kg loading over 4h, then 10mg/kg TID", contraindications: "Hypersensitivity, tinnitus, cardiac arrhythmias", sideEffects: "Cinchonism (tinnitus, headache, nausea), hypoglycemia, QT prolongation", interactions: "Mefloquine, digoxin", pregnancy: "Safe in all trimesters (severe malaria)" },
  { name: "Morphine", class: "Opioid Analgesic", generic: "Morphine sulfate", indications: "Severe pain, acute MI, pulmonary edema", dosage: "IV: 2.5-5mg titrated. PO: 5-20mg Q4H", contraindications: "Respiratory depression, paralytic ileus, head injury", sideEffects: "Respiratory depression, constipation, hypotension, sedation", interactions: "Benzodiazepines, alcohol (additive respiratory depression)", pregnancy: "Category C (use with caution)" },
  { name: "Gentamicin", class: "Antibiotic (Aminoglycoside)", generic: "Gentamicin sulfate", indications: "Gram-negative sepsis, endocarditis, UTI", dosage: "IV/IM: 3-5mg/kg OD (once-daily dosing)", contraindications: "Myasthenia gravis, pre-existing renal/hearing impairment", sideEffects: "Nephrotoxicity, ototoxicity, neuromuscular blockade", interactions: "Furosemide (additive ototoxicity), neuromuscular blockers", pregnancy: "Category D (avoid)" },
  { name: "Ranitidine", class: "H2 Receptor Antagonist", generic: "Ranitidine HCl", indications: "Peptic ulcer, GERD, stress ulcer prophylaxis", dosage: "PO: 150mg BD or 300mg ON. IV: 50mg TID", contraindications: "Hypersensitivity, acute porphyria", sideEffects: "Headache, dizziness, confusion (elderly)", interactions: "Ketoconazole (reduced absorption), warfarin", pregnancy: "Category B (use if needed)" },
  { name: "Hydrocortisone", class: "Corticosteroid", generic: "Hydrocortisone", indications: "Adrenal crisis, severe asthma, anaphylaxis, septic shock", dosage: "IV: 100-200mg stat then 50mg Q6H. PO: 20-240mg daily", contraindications: "Systemic fungal infection, live vaccines", sideEffects: "Immunosuppression, hyperglycemia, osteoporosis, adrenal suppression", interactions: "NSAIDs (GI bleeding), live vaccines", pregnancy: "Category C (use if needed)" },
  { name: "Magnesium Sulfate", class: "Anticonvulsant / Electrolyte", generic: "Magnesium sulfate", indications: "Eclampsia, severe pre-eclampsia, torsades de pointes", dosage: "IV: 4g loading over 5min, then 1g/hr infusion. IM: 5g each buttock", contraindications: "Myasthenia gravis, heart block, severe renal impairment", sideEffects: "Flushing, hypotension, respiratory depression, areflexia", interactions: "Calcium gluconate (antidote), neuromuscular blockers", pregnancy: "Drug of choice for eclampsia" },
  { name: "Sulfadoxine-Pyrimethamine", class: "Antimalarial", generic: "Sulfadoxine-Pyrimethamine (SP)", indications: "Uncomplicated malaria (areas with resistance: use as IPTp)", dosage: "PO: 3 tablets (1500mg sulfadoxine + 75mg pyrimethamine) single dose", contraindications: "Sulfa allergy, severe renal/hepatic impairment, infants <2 months", sideEffects: "Rash, Stevens-Johnson syndrome, bone marrow suppression, hepatitis", interactions: "Trimethoprim (additive folate antagonism)", pregnancy: "Used as IPTp in 2nd/3rd trimester" },
];

const DRUG_CLASSES = [...new Set(DRUG_DATABASE.map((d) => d.class))];

export default function DrugReference() {
  const [search, setSearch] = useState("");
  const [filterClass, setFilterClass] = useState("");
  const [selectedDrug, setSelectedDrug] = useState(null);

  const filteredDrugs = useMemo(() => {
    return DRUG_DATABASE.filter((d) => {
      const matchesSearch = !search ||
        d.name.toLowerCase().includes(search.toLowerCase()) ||
        d.generic.toLowerCase().includes(search.toLowerCase()) ||
        d.indications.toLowerCase().includes(search.toLowerCase());
      const matchesClass = !filterClass || d.class === filterClass;
      return matchesSearch && matchesClass;
    });
  }, [search, filterClass]);

  if (selectedDrug) {
    return (
      <div style={{ maxWidth: 700, margin: "0 auto", padding: 16 }}>
        <button className="ghost" onClick={() => setSelectedDrug(null)} style={{ marginBottom: 16 }}>← Back to Drug List</button>
        <div className="card">
          <h2 style={{ color: "#ef4444" }}>{selectedDrug.name}</h2>
          <p className="muted" style={{ marginBottom: 16 }}>Generic: {selectedDrug.generic} | Class: {selectedDrug.class}</p>
          <div style={{ display: "grid", gap: 12 }}>
            <div><strong>💊 Indications:</strong><p>{selectedDrug.indications}</p></div>
            <div><strong>📏 Dosage:</strong><p>{selectedDrug.dosage}</p></div>
            <div><strong>⚠️ Contraindications:</strong><p style={{ color: "#f59e0b" }}>{selectedDrug.contraindications}</p></div>
            <div><strong>Side Effects:</strong><p>{selectedDrug.sideEffects}</p></div>
            <div><strong>🔄 Interactions:</strong><p>{selectedDrug.interactions}</p></div>
            <div><strong>🤰 Pregnancy:</strong><p style={{ color: "#ec4899" }}>{selectedDrug.pregnancy}</p></div>
          </div>
        </div>
        <p style={{ marginTop: 16, fontSize: 12, color: "#666", textAlign: "center" }}>
          For educational purposes only. Always verify dosages and check local guidelines before prescribing.
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 16 }}>
      <h2>💊 Drug Reference</h2>
      <p className="muted" style={{ marginBottom: 16 }}>
        Searchable drug database with indications, dosages, contraindications, and interactions.
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search drug name, generic, or indication..."
          style={{ flex: 1, padding: "10px 14px", borderRadius: 8, background: "#111", color: "#fff", border: "1px solid #333" }} />
        <select value={filterClass} onChange={(e) => setFilterClass(e.target.value)}
          style={{ padding: "10px 14px", borderRadius: 8, background: "#111", color: "#fff", border: "1px solid #333" }}>
          <option value="">All Classes</option>
          {DRUG_CLASSES.sort().map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <p className="muted" style={{ marginBottom: 12, fontSize: 13 }}>{filteredDrugs.length} drugs found</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
        {filteredDrugs.map((d) => (
          <div key={d.name} className="card" style={{ cursor: "pointer" }} onClick={() => setSelectedDrug(d)}>
            <h3 style={{ fontSize: 16, color: "#ef4444" }}>{d.name}</h3>
            <p style={{ fontSize: 12, color: "#94a3b8" }}>{d.class}</p>
            <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>{d.indications.slice(0, 60)}...</p>
          </div>
        ))}
      </div>
    </div>
  );
}
