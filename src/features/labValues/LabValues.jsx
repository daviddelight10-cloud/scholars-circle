import { useState, useMemo } from "react";

const LAB_CATEGORIES = [
  { id: "cbc", label: "Complete Blood Count", icon: "🩸" },
  { id: "lft", label: "Liver Function Tests", icon: "🫀" },
  { id: "rft", label: "Renal Function Tests", icon: "🧪" },
  { id: "electrolytes", label: "Electrolytes", icon: "⚡" },
  { id: "lipid", label: "Lipid Profile", icon: "🫙" },
  { id: "thyroid", label: "Thyroid Function", icon: "🦋" },
  { id: "coag", label: "Coagulation", icon: "🩹" },
  { id: "inflammatory", label: "Inflammatory Markers", icon: "🔥" },
  { id: "csf", label: "CSF Analysis", icon: "💧" },
  { id: "endocrine", label: "Endocrine", icon: "⚗️" },
];

const LAB_VALUES = [
  { parameter: "Haemoglobin (Hb)", category: "cbc", unit: "g/dL", male: "13.0-17.0", female: "12.0-15.0", critical_low: "<7.0", critical_high: ">20.0", interpretation: "Low: anaemia. High: polycythaemia, dehydration, high altitude." },
  { parameter: "White Blood Cell Count", category: "cbc", unit: "x10⁹/L", male: "4.0-11.0", female: "4.0-11.0", critical_low: "<1.5", critical_high: ">30.0", interpretation: "Low: leucopenia (viral, chemotherapy). High: infection, leukaemia, steroids." },
  { parameter: "Platelet Count", category: "cbc", unit: "x10⁹/L", male: "150-400", female: "150-400", critical_low: "<50", critical_high: ">1000", interpretation: "Low: thrombocytopenia (ITP, DIC, sepsis). High: thrombocytosis (infection, iron deficiency)." },
  { parameter: "MCV (Mean Corpuscular Volume)", category: "cbc", unit: "fL", male: "80-100", female: "80-100", critical_low: "<60", critical_high: ">120", interpretation: "Low: microcytic (iron deficiency, thalassaemia). High: macrocytic (B12/folate deficiency)." },
  { parameter: "Neutrophils", category: "cbc", unit: "%", male: "40-75", female: "40-75", critical_low: "<0.5 (absolute)", critical_high: ">90%", interpretation: "Low: neutropenia. High: bacterial infection, inflammation." },
  { parameter: "Lymphocytes", category: "cbc", unit: "%", male: "20-45", female: "20-45", critical_low: "—", critical_high: "—", interpretation: "High: viral infection, CLL. Low: HIV, immunosuppression." },
  { parameter: "Eosinophils", category: "cbc", unit: "%", male: "1-6", female: "1-6", critical_low: "—", critical_high: ">20%", interpretation: "High: allergy, parasitic infection, asthma." },

  { parameter: "ALT (Alanine Transaminase)", category: "lft", unit: "U/L", male: "10-40", female: "7-35", critical_low: "—", critical_high: ">1000", interpretation: "High: hepatocellular damage (hepatitis, drugs, alcohol)." },
  { parameter: "AST (Aspartate Transaminase)", category: "lft", unit: "U/L", male: "10-40", female: "8-35", critical_low: "—", critical_high: ">1000", interpretation: "High: liver damage, muscle injury, MI. AST:ALT >2 suggests alcohol." },
  { parameter: "Alkaline Phosphatase (ALP)", category: "lft", unit: "U/L", male: "40-130", female: "35-105", critical_low: "—", critical_high: ">400", interpretation: "High: cholestasis, bone disease, pregnancy. GGT helps differentiate." },
  { parameter: "Bilirubin (Total)", category: "lft", unit: "μmol/L", male: "3-21", female: "3-21", critical_low: "—", critical_high: ">340", interpretation: "High: pre-hepatic (haemolysis), hepatic (hepatitis), post-hepatic (obstruction)." },
  { parameter: "Albumin", category: "lft", unit: "g/L", male: "35-50", female: "35-50", critical_low: "<20", critical_high: "—", interpretation: "Low: liver disease, nephrotic syndrome, malnutrition, inflammation." },
  { parameter: "Total Protein", category: "lft", unit: "g/L", male: "60-80", female: "60-80", critical_low: "—", critical_high: "—", interpretation: "High: multiple myeloma, dehydration. Low: malnutrition, liver disease." },

  { parameter: "Urea", category: "rft", unit: "mmol/L", male: "2.5-7.0", female: "2.5-6.5", critical_low: "—", critical_high: ">30", interpretation: "High: dehydration, AKI, GI bleed, high protein diet. Low: liver failure, malnutrition." },
  { parameter: "Creatinine", category: "rft", unit: "μmol/L", male: "60-120", female: "50-100", critical_low: "—", critical_high: ">500", interpretation: "High: renal impairment. Use eGFR for better assessment." },
  { parameter: "eGFR", category: "rft", unit: "mL/min/1.73m²", male: ">90", female: ">90", critical_low: "<15", critical_high: "—", interpretation: "Stage 1: >90, Stage 2: 60-89, Stage 3: 30-59, Stage 4: 15-29, Stage 5: <15 (ESRD)." },
  { parameter: "Sodium (Na⁺)", category: "electrolytes", unit: "mmol/L", male: "135-145", female: "135-145", critical_low: "<120", critical_high: ">155", interpretation: "Low: SIADH, diuretics, vomiting. High: dehydration, diabetes insipidus." },
  { parameter: "Potassium (K⁺)", category: "electrolytes", unit: "mmol/L", male: "3.5-5.0", female: "3.5-5.0", critical_low: "<2.5", critical_high: ">6.5", interpretation: "Low: diuretics, vomiting, diarrhea. High: AKI, ACE inhibitors, Addison's." },
  { parameter: "Chloride (Cl⁻)", category: "electrolytes", unit: "mmol/L", male: "98-107", female: "98-107", critical_low: "—", critical_high: "—", interpretation: "Follows sodium. Low: vomiting. High: diarrhea, renal tubular acidosis." },
  { parameter: "Bicarbonate (HCO₃⁻)", category: "electrolytes", unit: "mmol/L", male: "22-29", female: "22-29", critical_low: "<10", critical_high: ">40", interpretation: "Low: metabolic acidosis (DKA, lactic acidosis, renal failure). High: metabolic alkalosis (vomiting)." },
  { parameter: "Calcium (Corrected)", category: "electrolytes", unit: "mmol/L", male: "2.20-2.60", female: "2.20-2.60", critical_low: "<1.5", critical_high: ">3.0", interpretation: "Low: hypoparathyroidism, vitamin D deficiency, CKD. High: malignancy, hyperparathyroidism." },
  { parameter: "Phosphate", category: "electrolytes", unit: "mmol/L", male: "0.8-1.5", female: "0.8-1.5", critical_low: "—", critical_high: "—", interpretation: "Low: refeeding syndrome, hyperparathyroidism. High: CKD, rhabdomyolysis." },
  { parameter: "Magnesium", category: "electrolytes", unit: "mmol/L", male: "0.7-1.0", female: "0.7-1.0", critical_low: "<0.4", critical_high: ">2.0", interpretation: "Low: PPI use, alcoholism, diarrhea. High: renal failure, magnesium therapy." },

  { parameter: "Total Cholesterol", category: "lipid", unit: "mmol/L", male: "<5.0", female: "<5.0", critical_low: "—", critical_high: ">7.5", interpretation: "High: cardiovascular risk. Target <4.0 in high-risk patients." },
  { parameter: "LDL Cholesterol", category: "lipid", unit: "mmol/L", male: "<3.0", female: "<3.0", critical_low: "—", critical_high: "—", interpretation: "Target <2.0 in high-risk, <1.8 in very high-risk patients." },
  { parameter: "HDL Cholesterol", category: "lipid", unit: "mmol/L", male: ">1.0", female: ">1.2", critical_low: "—", critical_high: "—", interpretation: "Higher is better. Low: cardiovascular risk, metabolic syndrome." },
  { parameter: "Triglycerides", category: "lipid", unit: "mmol/L", male: "<1.7", female: "<1.7", critical_low: "—", critical_high: ">10.0", interpretation: "High: obesity, diabetes, alcohol. >10: pancreatitis risk." },

  { parameter: "TSH", category: "thyroid", unit: "mIU/L", male: "0.4-4.0", female: "0.4-4.0", critical_low: "—", critical_high: ">100", interpretation: "High: hypothyroidism. Low: hyperthyroidism, pituitary disease." },
  { parameter: "Free T4", category: "thyroid", unit: "pmol/L", male: "10-22", female: "10-22", critical_low: "—", critical_high: "—", interpretation: "High: hyperthyroidism. Low: hypothyroidism." },
  { parameter: "Free T3", category: "thyroid", unit: "pmol/L", male: "3.5-6.5", female: "3.5-6.5", critical_low: "—", critical_high: "—", interpretation: "High: hyperthyroidism, T3 toxicosis. Low: hypothyroidism, severe illness." },

  { parameter: "PT (Prothrombin Time)", category: "coag", unit: "seconds", male: "11-14", female: "11-14", critical_low: "—", critical_high: ">30", interpretation: "High: warfarin, liver disease, vitamin K deficiency, DIC." },
  { parameter: "INR", category: "coag", unit: "ratio", male: "0.8-1.2", female: "0.8-1.2", critical_low: "—", critical_high: ">5.0", interpretation: "Target 2.0-3.0 for most indications, 2.5-3.5 for mechanical valves." },
  { parameter: "APTT", category: "coag", unit: "seconds", male: "25-35", female: "25-35", critical_low: "—", critical_high: ">80", interpretation: "High: heparin, haemophilia, DIC, lupus anticoagulant." },
  { parameter: "Fibrinogen", category: "coag", unit: "g/L", male: "2.0-4.0", female: "2.0-4.0", critical_low: "<1.0", critical_high: "—", interpretation: "Low: DIC, massive transfusion, liver disease. High: inflammation, pregnancy." },

  { parameter: "CRP (C-Reactive Protein)", category: "inflammatory", unit: "mg/L", male: "<5", female: "<5", critical_low: "—", critical_high: ">200", interpretation: "High: bacterial infection, inflammation, tissue damage. More specific than ESR." },
  { parameter: "ESR (Erythrocyte Sedimentation Rate)", category: "inflammatory", unit: "mm/hr", male: "<(age/2)", female: "<(age+10)/2", critical_low: "—", critical_high: ">100", interpretation: "High: infection, autoimmune disease, malignancy, multiple myeloma. Non-specific." },

  { parameter: "CSF Opening Pressure", category: "csf", unit: "cmH₂O", male: "10-20", female: "10-20", critical_low: "—", critical_high: ">25", interpretation: "High: meningitis, raised ICP, idiopathic intracranial hypertension." },
  { parameter: "CSF Protein", category: "csf", unit: "g/L", male: "0.15-0.45", female: "0.15-0.45", critical_low: "—", critical_high: ">1.0", interpretation: "High: bacterial meningitis, Guillain-Barre, MS. Low: CSF leak." },
  { parameter: "CSF Glucose", category: "csf", unit: "mmol/L", male: "2.2-4.4 (≈60% of serum)", female: "2.2-4.4", critical_low: "—", critical_high: "—", interpretation: "Low: bacterial meningitis, TB meningitis. Normal: viral meningitis." },
  { parameter: "CSF Cell Count", category: "csf", unit: "cells/μL", male: "<5", female: "<5", critical_low: "—", critical_high: "—", interpretation: "High neutrophils: bacterial. High lymphocytes: viral/TB. RBC: subarachnoid haemorrhage." },

  { parameter: "Fasting Blood Glucose", category: "endocrine", unit: "mmol/L", male: "3.9-6.1", female: "3.9-6.1", critical_low: "<2.5", critical_high: ">25", interpretation: "High: diabetes mellitus (>7.0), impaired fasting glucose (6.1-6.9). Low: hypoglycemia." },
  { parameter: "HbA1c", category: "endocrine", unit: "%", male: "<5.7", female: "<5.7", critical_low: "—", critical_high: ">10", interpretation: "5.7-6.4: pre-diabetes. ≥6.5: diabetes. Target <7.0 for most diabetics." },
  { parameter: "Cortisol (Morning)", category: "endocrine", unit: "nmol/L", male: "138-690", female: "138-690", critical_low: "<100 (9am)", critical_high: ">1500", interpretation: "Low: adrenal insufficiency. High: Cushing's syndrome." },
  { parameter: "PTH (Parathyroid Hormone)", category: "endocrine", unit: "pg/mL", male: "15-65", female: "15-65", critical_low: "—", critical_high: "—", interpretation: "High with high Ca: primary hyperparathyroidism. High with low Ca: secondary hyperparathyroidism." },
];

export default function LabValues() {
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");

  const filteredValues = useMemo(() => {
    return LAB_VALUES.filter((v) => {
      const matchesSearch = !search || v.parameter.toLowerCase().includes(search.toLowerCase());
      const matchesCat = !filterCategory || v.category === filterCategory;
      return matchesSearch && matchesCat;
    });
  }, [search, filterCategory]);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 16 }}>
      <h2>🧪 Lab Values Reference</h2>
      <p className="muted" style={{ marginBottom: 16 }}>
        Normal ranges for common laboratory tests with clinical interpretation.
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search parameter..."
          style={{ flex: 1, padding: "10px 14px", borderRadius: 8, background: "#111", color: "#fff", border: "1px solid #333" }} />
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
          style={{ padding: "10px 14px", borderRadius: 8, background: "#111", color: "#fff", border: "1px solid #333" }}>
          <option value="">All Categories</option>
          {LAB_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
        </select>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #333" }}>
              <th style={{ textAlign: "left", padding: "8px 12px", color: "#94a3b8" }}>Parameter</th>
              <th style={{ textAlign: "left", padding: "8px 12px", color: "#94a3b8" }}>Unit</th>
              <th style={{ textAlign: "left", padding: "8px 12px", color: "#94a3b8" }}>Male Range</th>
              <th style={{ textAlign: "left", padding: "8px 12px", color: "#94a3b8" }}>Female Range</th>
              <th style={{ textAlign: "left", padding: "8px 12px", color: "#94a3b8" }}>Interpretation</th>
            </tr>
          </thead>
          <tbody>
            {filteredValues.map((v, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #222" }}>
                <td style={{ padding: "10px 12px", color: "#fff", fontWeight: 600 }}>{v.parameter}</td>
                <td style={{ padding: "10px 12px", color: "#94a3b8" }}>{v.unit}</td>
                <td style={{ padding: "10px 12px", color: "#22c55e" }}>{v.male}</td>
                <td style={{ padding: "10px 12px", color: "#22c55e" }}>{v.female}</td>
                <td style={{ padding: "10px 12px", color: "#cbd5e1", fontSize: 12 }}>{v.interpretation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ marginTop: 16, fontSize: 12, color: "#666", textAlign: "center" }}>
        Reference ranges may vary by laboratory. Always check your local lab's reference values.
      </p>
    </div>
  );
}
