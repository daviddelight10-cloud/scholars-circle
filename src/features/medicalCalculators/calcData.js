/**
 * Declarative calculator specs for the Medical Calculators tool.
 *
 * Each spec:
 *   id, name, short, icon, cat
 *   inputs[] —
 *     num   { key,label,type:"num",units:[[label,factorToBase]],min,max,step,hint }
 *     seg   { key,label,type:"seg",options:[[value,label]],default }
 *     check { key,label,type:"check",pts }
 *     radio { key,label,type:"radio",options:[{v,pts,lbl}] }   // pick one of N
 *   compute(v) → { value, unit, tone:"ok"|"warn"|"bad"|"info", label, sub, extra }
 *   formula, pearl, related[], cite — educational display fields.
 *
 * NOTE: values are for education — verify against local protocols.
 */

const r1 = (x) => Math.round(x * 10) / 10;
const r0 = (x) => Math.round(x);

export const CALC_CATEGORIES = [
  { id: "renal", label: "Renal & Electrolytes", icon: "⚡" },
  { id: "cardiac", label: "Cardiac", icon: "❤️" },
  { id: "resp", label: "Respiratory", icon: "🫁" },
  { id: "risk", label: "Risk Scores", icon: "📊" },
  { id: "neuro", label: "Neurology", icon: "🧠" },
  { id: "peds", label: "Paediatrics", icon: "👶" },
  { id: "general", label: "General & Metabolic", icon: "⚖️" },
  { id: "emergency", label: "Emergency & Trauma", icon: "🚨" },
];

export const CALCS = [
  // ─── Renal & Electrolytes ───────────────────────────────
  {
    id: "egfr", name: "eGFR (CKD-EPI 2021)", short: "Kidney function from creatinine",
    icon: "🫘", cat: "renal",
    inputs: [
      { key: "age", label: "Age", type: "num", units: [["years", 1]], min: 18, max: 120 },
      { key: "sex", label: "Sex", type: "seg", default: "female", options: [["female", "♀ Female"], ["male", "♂ Male"]] },
      { key: "scr", label: "Serum creatinine", type: "num", units: [["µmol/L", 1 / 88.4], ["mg/dL", 1]], min: 0 },
    ],
    compute: (v) => {
      const female = v.sex === "female";
      const k = female ? 0.7 : 0.9;
      const a = female ? -0.241 : -0.302;
      const eGFR = 142 * Math.pow(Math.min(v.scr / k, 1), a) * Math.pow(Math.max(v.scr / k, 1), -1.2) * Math.pow(0.9938, v.age) * (female ? 1.012 : 1);
      const g = r0(eGFR);
      const stage = g >= 90 ? ["G1 — normal/high", "ok"] : g >= 60 ? ["G2 — mildly ↓", "ok"] : g >= 45 ? ["G3a — mild–moderate ↓", "warn"] : g >= 30 ? ["G3b — moderate–severe ↓", "warn"] : g >= 15 ? ["G4 — severely ↓", "bad"] : ["G5 — kidney failure", "bad"];
      return {
        value: g, unit: "mL/min/1.73m²", tone: stage[1], label: `CKD ${stage[0]}`,
        sub: g < 60 ? "CKD requires ≥3 months duration or damage markers. Adjust drug doses below 60; refer <30." : "Within normal range for age.",
      };
    },
    formula: "eGFR = 142 × min(Scr/κ,1)^α × max(Scr/κ,1)^−1.200 × 0.9938^Age × 1.012 [female]  (κ 0.7♀/0.9♂, α −0.241♀/−0.302♂)",
    pearl: "CKD-EPI 2021 is race-free and more accurate than MDRD — the current recommended estimating equation. Cockcroft-Gault is still used for drug dosing.",
    related: ["crcl", "fena"],
    cite: "Inker LA et al., NEJM 2021",
  },
  {
    id: "crcl", name: "Creatinine Clearance (Cockcroft-Gault)", short: "Renal drug dosing estimate",
    icon: "💊", cat: "renal",
    inputs: [
      { key: "age", label: "Age", type: "num", units: [["years", 1]], min: 15, max: 120 },
      { key: "sex", label: "Sex", type: "seg", default: "female", options: [["female", "♀ Female"], ["male", "♂ Male"]] },
      { key: "wt", label: "Weight", type: "num", units: [["kg", 1], ["lb", 0.4536]], min: 0 },
      { key: "scr", label: "Serum creatinine", type: "num", units: [["µmol/L", 1 / 88.4], ["mg/dL", 1]], min: 0 },
    ],
    compute: (v) => {
      const crcl = ((140 - v.age) * v.wt * (v.sex === "female" ? 0.85 : 1)) / (72 * v.scr);
      const c = r0(crcl);
      const tone = c >= 60 ? "ok" : c >= 30 ? "warn" : "bad";
      return {
        value: c, unit: "mL/min", tone, label: c >= 60 ? "Normal clearance" : c >= 30 ? "Reduced — check dose bands" : "Severe reduction",
        sub: "Most drug references dose by CrCl (C-G), not eGFR — use this for prescribing.",
        extra: [v.wt > 0 && "Note: use ideal/adjusted body weight in obesity — actual weight overestimates CrCl."],
      };
    },
    formula: "CrCl = (140 − age) × weight × (0.85 ♀) ÷ (72 × Scr mg/dL)",
    pearl: "Still the dosing standard in drug references (FDA labels) despite CKD-EPI being more accurate for staging.",
    related: ["egfr"],
    cite: "Cockcroft & Gault, Nephron 1976",
  },
  {
    id: "fena", name: "FENa (Fractional Na Excretion)", short: "Prerenal vs intrinsic AKI",
    icon: "🧂", cat: "renal",
    inputs: [
      { key: "una", label: "Urine Na", type: "num", units: [["mmol/L", 1]], min: 0 },
      { key: "pna", label: "Plasma Na", type: "num", units: [["mmol/L", 1]], min: 0 },
      { key: "ucr", label: "Urine creatinine", type: "num", units: [["mmol/L", 1], ["µmol/L", 0.001], ["mg/dL", 0.0113]], min: 0 },
      { key: "pcr", label: "Plasma creatinine", type: "num", units: [["µmol/L", 0.001], ["mg/dL", 0.0113], ["mmol/L", 1]], min: 0 },
    ],
    compute: (v) => {
      const fena = (v.una * v.pcr) / (v.pna * v.ucr) * 100;
      const f = r1(fena);
      return {
        value: f, unit: "%",
        tone: f < 1 ? "ok" : f <= 2 ? "warn" : "bad",
        label: f < 1 ? "Prerenal pattern" : f <= 2 ? "Indeterminate" : "Intrinsic renal (e.g. ATN)",
        sub: "Use consistent creatinine units — they cancel. Invalid on diuretics → use FEUrea instead.",
        extra: ["FENa <1% + BUN:Cr >20:1 strongly suggests prerenal AKI."],
      };
    },
    formula: "FENa = (UrineNa × PlasmaCr) ÷ (PlasmaNa × UrineCr) × 100",
    pearl: "Diuretics falsely raise FENa — FEUrea <35% is the prerenal marker in that setting.",
    related: ["egfr", "anion_gap"],
    cite: "Espinel, Arch Intern Med 1976",
  },
  {
    id: "anion_gap", name: "Anion Gap", short: "Metabolic acidosis workup",
    icon: "⚗️", cat: "renal",
    inputs: [
      { key: "na", label: "Sodium", type: "num", units: [["mmol/L", 1]], min: 0 },
      { key: "cl", label: "Chloride", type: "num", units: [["mmol/L", 1]], min: 0 },
      { key: "hco3", label: "Bicarbonate", type: "num", units: [["mmol/L", 1]], min: 0 },
      { key: "alb", label: "Albumin (optional)", type: "num", units: [["g/L", 1], ["g/dL", 10]], min: 0, optional: true },
    ],
    compute: (v) => {
      const ag = v.na - v.cl - v.hco3;
      const corrected = v.alb ? ag + 2.5 * (40 - v.alb) / 10 : null;
      const use = corrected ?? ag;
      return {
        value: r0(use), unit: "mmol/L",
        tone: use <= 12 ? "ok" : use <= 20 ? "warn" : "bad",
        label: use < 8 ? "Low gap" : use <= 12 ? "Normal (8–12)" : "High anion gap",
        sub: use > 12 ? "MUDPILES: Methanol, Uremia, DKA, Propylene glycol, Isoniazid/Iron, Lactate, Ethylene glycol, Salicylates." : "NAGMA causes: diarrhea, RTA, saline.",
        extra: corrected != null ? [`Albumin-corrected AG: ${r0(corrected)} (raw ${r0(ag)}) — albumin falls ~2.5 gap per 10g/L drop.`] : [],
      };
    },
    formula: "AG = Na − (Cl + HCO₃);  corrected = AG + 2.5×(4 − albumin g/dL)",
    pearl: "Always correct for albumin in sick patients — a 'normal' 14 can be a real HAGMA at albumin 20.",
    related: ["delta_ratio", "osmolar"],
    cite: "Standard chemistry",
  },
  {
    id: "delta_ratio", name: "Delta Ratio", short: "Mixed acid-base disorders",
    icon: "📐", cat: "renal",
    inputs: [
      { key: "ag", label: "Anion gap", type: "num", units: [["mmol/L", 1]], min: 0 },
      { key: "hco3", label: "Bicarbonate", type: "num", units: [["mmol/L", 1]], min: 0 },
    ],
    compute: (v) => {
      const dr = (v.ag - 12) / (24 - v.hco3);
      const d = r1(dr);
      return {
        value: d, unit: "",
        tone: "info",
        label: d < 0.4 ? "Pure NAGMA" : d < 0.8 ? "Mixed HAGMA + NAGMA" : d <= 2 ? "Pure high AG acidosis" : "HAGMA + metabolic alkalosis",
        sub: "Delta ratio compares the AG rise to the HCO₃ fall — mismatches reveal a second process.",
      };
    },
    formula: "Δ ratio = (AG − 12) ÷ (24 − HCO₃)",
    pearl: "Use after calculating an elevated anion gap — it exposes the hidden second disorder.",
    related: ["anion_gap"],
    cite: "Standard chemistry",
  },
  {
    id: "corrected_na", name: "Corrected Sodium (hyperglycemia)", short: "True Na at high glucose",
    icon: "🩸", cat: "renal",
    inputs: [
      { key: "na", label: "Measured Na", type: "num", units: [["mmol/L", 1]], min: 0 },
      { key: "glu", label: "Glucose", type: "num", units: [["mmol/L", 1], ["mg/dL", 0.0555]], min: 0 },
    ],
    compute: (v) => {
      const mgdl = v.glu * 18;
      const corr = v.na + 1.6 * (mgdl - 100) / 100;
      return {
        value: r1(corr), unit: "mmol/L",
        tone: Math.abs(corr - v.na) < 1 ? "ok" : "warn",
        label: Math.abs(corr - v.na) < 1 ? "Minimal correction" : corr < 135 ? "Still hyponatremic" : corr > 145 ? "True hypernatremia unmasked" : "Normalized",
        sub: `Translocational hyponatremia — each 100mg/dL glucose rise pulls Na down ~1.6 mmol/L (some use 2.4).`,
      };
    },
    formula: "Na_corrected = Na + 1.6 × (glucose mg/dL − 100)/100",
    pearl: "In DKA/HHS the corrected Na guides whether free water deficit is the real problem.",
    related: ["free_water", "anion_gap"],
    cite: "Katz 1973; Hillier 1999 (2.4 factor)",
  },
  {
    id: "free_water", name: "Free Water Deficit", short: "Hypernatremia correction estimate",
    icon: "💧", cat: "renal",
    inputs: [
      { key: "na", label: "Sodium", type: "num", units: [["mmol/L", 1]], min: 100 },
      { key: "wt", label: "Weight", type: "num", units: [["kg", 1], ["lb", 0.4536]], min: 0 },
      { key: "sex", label: "Sex", type: "seg", default: "male", options: [["male", "♂ Male"], ["female", "♀ Female"]] },
    ],
    compute: (v) => {
      const tbw = v.wt * (v.sex === "female" ? 0.5 : 0.6);
      const deficit = tbw * (v.na / 140 - 1);
      return {
        value: r1(Math.max(0, deficit)), unit: "L",
        tone: "info",
        label: `TBW ≈ ${r0(tbw)} L`,
        sub: "Correct ≤10–12 mmol/L Na per 24h to avoid cerebral edema; replace deficit + ongoing losses.",
      };
    },
    formula: "Deficit = TBW × (Na/140 − 1); TBW = weight × 0.6♂ / 0.5♀",
    pearl: "Severe chronic hypernatremia corrects slowly — the brain has already adapted.",
    related: ["corrected_na"],
    cite: "Adrogué & Madias, NEJM 2000",
  },
  {
    id: "osmolar", name: "Osmolal Gap", short: "Toxic alcohol workup",
    icon: "🧫", cat: "renal",
    inputs: [
      { key: "na", label: "Sodium", type: "num", units: [["mmol/L", 1]], min: 0 },
      { key: "glu", label: "Glucose", type: "num", units: [["mmol/L", 1], ["mg/dL", 0.0555]], min: 0 },
      { key: "bun", label: "Urea/BUN", type: "num", units: [["mmol/L urea", 1], ["mg/dL BUN", 0.357]], min: 0 },
      { key: "measured", label: "Measured osmolality", type: "num", units: [["mOsm/kg", 1]], min: 0 },
      { key: "etoh", label: "Ethanol (optional)", type: "num", units: [["mg/dL", 1], ["mmol/L", 4.6]], min: 0, optional: true },
    ],
    compute: (v) => {
      const calc = 2 * v.na + v.glu + v.bun + (v.etoh ? v.etoh / 4.6 : 0);
      const gap = v.measured - calc;
      return {
        value: r0(gap), unit: "mOsm/kg",
        tone: gap <= 10 ? "ok" : "bad",
        label: gap <= 10 ? "Normal (≤10)" : "Elevated osmolal gap",
        sub: gap > 10 ? "Think methanol, ethylene glycol, isopropanol, mannitol — early before osms metabolize to acid." : `Calculated osm: ${r0(calc)} mOsm/kg.`,
      };
    },
    formula: "Calc osm = 2Na + glucose + urea (+ EtOH/4.6);  gap = measured − calculated",
    pearl: "A rising AG + rising osmolal gap together is toxic alcohol until proven otherwise.",
    related: ["anion_gap"],
    cite: "Standard chemistry",
  },

  // ─── Cardiac ────────────────────────────────────────────
  {
    id: "map", name: "Mean Arterial Pressure", short: "Perfusion pressure from BP",
    icon: "🩺", cat: "cardiac",
    inputs: [
      { key: "sbp", label: "Systolic BP", type: "num", units: [["mmHg", 1]], min: 0, max: 300 },
      { key: "dbp", label: "Diastolic BP", type: "num", units: [["mmHg", 1]], min: 0, max: 200 },
    ],
    compute: (v) => {
      const map = (v.sbp + 2 * v.dbp) / 3;
      const m = r0(map);
      return {
        value: m, unit: "mmHg",
        tone: m < 65 ? "bad" : m > 110 ? "warn" : "ok",
        label: m < 65 ? "Low — hypoperfusion risk" : m > 110 ? "Elevated" : "Normal (65–110)",
        sub: "MAP <65 mmHg is the classic organ-perfusion threshold used in sepsis targets.",
      };
    },
    formula: "MAP = (SBP + 2×DBP) ÷ 3",
    pearl: "Sepsis-3 targets MAP ≥65 mmHg with vasopressors.",
    related: ["qtc"],
    cite: "Physiology standard",
  },
  {
    id: "qtc", name: "QTc Correction", short: "Corrected QT interval",
    icon: "📈", cat: "cardiac",
    inputs: [
      { key: "qt", label: "QT interval", type: "num", units: [["ms", 1]], min: 200, max: 800 },
      { key: "hr", label: "Heart rate", type: "num", units: [["bpm", 1]], min: 30, max: 220 },
      { key: "fx", label: "Formula", type: "seg", default: "bazett",
        options: [["bazett", "Bazett"], ["fridericia", "Fridericia"], ["framingham", "Framingham"]] },
    ],
    compute: (v) => {
      const rr = 60 / v.hr;
      const qtc = v.fx === "fridericia" ? v.qt / Math.cbrt(rr) : v.fx === "framingham" ? v.qt + 0.154 * (1 - rr) * 1000 : v.qt / Math.sqrt(rr);
      const q = r0(qtc);
      return {
        value: q, unit: "ms",
        tone: q < 450 ? "ok" : q < 500 ? "warn" : "bad",
        label: q < 440 ? "Normal" : q < 470 ? "Borderline (prolonged ♀>470)" : q < 500 ? "Prolonged" : "Markedly prolonged — torsades risk",
        sub: v.fx === "bazett" ? "Bazett overcorrects at high/low HR — Fridericia/Framingham preferred at extremes." : "More linear correction than Bazett at rate extremes.",
        extra: [">500ms → review QT-prolonging drugs (ondansetron, macrolides, antipsychotics) + K⁺/Mg²⁺."],
      };
    },
    formula: "Bazett QT/√RR · Fridericia QT/∛RR · Framingham QT + 154(1−RR)",
    pearl: "Bazett is default on ECGs but least accurate at extremes — always sanity-check at HR extremes.",
    related: ["map"],
    cite: "Bazett 1920; Fridericia 1920",
  },
  {
    id: "cha2ds2", name: "CHA₂DS₂-VASc", short: "AF stroke risk → anticoagulate?",
    icon: "❤️", cat: "cardiac",
    inputs: [
      { key: "chf", label: "Heart failure / LV dysfunction", type: "check", pts: 1 },
      { key: "htn", label: "Hypertension", type: "check", pts: 1 },
      { key: "age", label: "Age band", type: "radio", options: [
        { v: 0, pts: 0, lbl: "<65 years (+0)" },
        { v: 1, pts: 1, lbl: "65–74 years (+1)" },
        { v: 2, pts: 2, lbl: "≥75 years (+2)" }] },
      { key: "dm", label: "Diabetes mellitus", type: "check", pts: 1 },
      { key: "stroke", label: "Stroke/TIA/thromboembolism", type: "check", pts: 2 },
      { key: "vasc", label: "Vascular disease (MI, PAD, aortic plaque)", type: "check", pts: 1 },
      { key: "female", label: "Female sex", type: "check", pts: 1 },
    ],
    compute: (v) => {
      const s = (v.chf ? 1 : 0) + (v.htn ? 1 : 0) + (v.age ?? 0) + (v.dm ? 1 : 0)
        + (v.stroke ? 2 : 0) + (v.vasc ? 1 : 0) + (v.female ? 1 : 0);
      return {
        value: s, unit: "points",
        tone: s === 0 ? "ok" : s === 1 ? "warn" : "bad",
        label: s === 0 ? "Low risk — no anticoagulation" : s === 1 ? "Intermediate — consider (esp. males)" : "Anticoagulation recommended",
        sub: "Annual stroke risk ≈ score in % (score 2 ≈ 2.2%, 4 ≈ 4%, ≥6 ≈ 9.8%). Female sex alone doesn't mandate anticoagulation.",
        extra: ["Balance against HAS-BLED — bleeding risk score."],
      };
    },
    formula: "C HF1 HTN1 Age≥75 2× DM1 Stroke2× Vasc1 Age65–74 1 Female1",
    pearl: "Sex is a risk modifier not driver — 2020 ESC treats score ≥2 (♂) as the anticoagulation threshold.",
    related: ["hasbled"],
    cite: "Lip GYH et al., Chest 2010",
  },
  {
    id: "hasbled", name: "HAS-BLED", short: "Bleeding risk on anticoagulation",
    icon: "🩸", cat: "cardiac",
    inputs: [
      { key: "htn", label: "Uncontrolled hypertension (SBP >160)", type: "check", pts: 1 },
      { key: "renal", label: "Abnormal renal function (dialysis/Cr >200)", type: "check", pts: 1 },
      { key: "liver", label: "Abnormal liver function (cirrhosis, bili×2 + AST×3)", type: "check", pts: 1 },
      { key: "stroke", label: "Prior stroke", type: "check", pts: 1 },
      { key: "bleed", label: "Bleeding history/predisposition", type: "check", pts: 1 },
      { key: "inr", label: "Labile INR (on warfarin)", type: "check", pts: 1 },
      { key: "elderly", label: "Age >65", type: "check", pts: 1 },
      { key: "drugs", label: "Antiplatelets/NSAIDs", type: "check", pts: 1 },
      { key: "alcohol", label: "Alcohol excess (≥8 units/wk)", type: "check", pts: 1 },
    ],
    compute: (v) => {
      const s = Object.values(v).filter(Boolean).length;
      return {
        value: s, unit: "points",
        tone: s <= 2 ? "ok" : "warn",
        label: s <= 2 ? "Acceptable bleeding risk" : "High bleeding risk (≥3)",
        sub: "High score ≠ stop anticoagulation — it flags modifiable risks (BP, NSAIDs, alcohol, INR control).",
      };
    },
    formula: "1 pt each: Htn, Renal, Liver, Stroke, Bleed, Labile INR, Elderly, Drugs, Alcohol",
    pearl: "HAS-BLED identifies what to FIX — it's not a reason to deny anticoagulation.",
    related: ["cha2ds2"],
    cite: "Pisters R et al., Chest 2010",
  },
  {
    id: "heart", name: "HEART Score", short: "Chest pain MACE risk (ED)",
    icon: "💔", cat: "cardiac",
    inputs: [
      { key: "hx", label: "History", type: "radio", options: [
        { v: 0, pts: 0, lbl: "Slightly suspicious" },
        { v: 1, pts: 1, lbl: "Moderately suspicious" },
        { v: 2, pts: 2, lbl: "Highly suspicious" }] },
      { key: "ecg", label: "ECG", type: "radio", options: [
        { v: 0, pts: 0, lbl: "Normal" },
        { v: 1, pts: 1, lbl: "Non-specific repolarization" },
        { v: 2, pts: 2, lbl: "Significant ST depression" }] },
      { key: "age", label: "Age", type: "radio", options: [
        { v: 0, pts: 0, lbl: "<45" }, { v: 1, pts: 1, lbl: "45–64" }, { v: 2, pts: 2, lbl: "≥65" }] },
      { key: "rf", label: "Risk factors", type: "radio", options: [
        { v: 0, pts: 0, lbl: "None" },
        { v: 1, pts: 1, lbl: "1–2 factors" },
        { v: 2, pts: 2, lbl: "≥3 factors or known CAD" }] },
      { key: "trop", label: "Troponin", type: "radio", options: [
        { v: 0, pts: 0, lbl: "≤ ULN" },
        { v: 1, pts: 1, lbl: "1–3× ULN" },
        { v: 2, pts: 2, lbl: ">3× ULN" }] },
    ],
    compute: (v) => {
      const s = ["hx", "ecg", "age", "rf", "trop"].reduce((t, k) => t + (typeof v[k] === "number" ? v[k] : 0), 0);
      const n = Object.values(v).filter((x) => typeof x === "number").length;
      if (n < 5) return null;
      return {
        value: s, unit: "/10",
        tone: s <= 3 ? "ok" : s <= 6 ? "warn" : "bad",
        label: s <= 3 ? "Low — 0.9–1.7% MACE (early discharge path)" : s <= 6 ? "Moderate — 12–17% MACE (admit + serial trops)" : "High — 50–65% MACE (early invasive strategy)",
        sub: "HEART outperforms TIMI/GRACE for ED chest-pain triage when combined with a 0/3h troponin pathway.",
      };
    },
    formula: "History + ECG + Age + Risk factors + Troponin (0–2 each)",
    pearl: "A HEART ≤3 with serial negative troponins has <2% 6-week MACE — the safe-discharge zone.",
    related: ["qtc", "wells_pe"],
    cite: "Six AJ et al., Neth Heart J 2008",
  },

  // ─── Respiratory ────────────────────────────────────────
  {
    id: "curb65", name: "CURB-65", short: "Pneumonia severity → site of care",
    icon: "🫁", cat: "resp",
    inputs: [
      { key: "confusion", label: "New confusion (AMT ≤8)", type: "check", pts: 1 },
      { key: "urea", label: "Urea >7 mmol/L (BUN >19 mg/dL)", type: "check", pts: 1 },
      { key: "rr", label: "Respiratory rate ≥30", type: "check", pts: 1 },
      { key: "bp", label: "SBP <90 or DBP ≤60 mmHg", type: "check", pts: 1 },
      { key: "age", label: "Age ≥65", type: "check", pts: 1 },
    ],
    compute: (v) => {
      const s = Object.values(v).filter(Boolean).length;
      return {
        value: s, unit: "/5",
        tone: s <= 1 ? "ok" : s === 2 ? "warn" : "bad",
        label: s <= 1 ? "Low — consider outpatient (mortality <3%)" : s === 2 ? "Moderate — short admission/supervised (9%)" : "Severe — admit; assess ICU (15–40%)",
        sub: "CRB-65 drops the urea for community use — same thresholds.",
      };
    },
    formula: "Confusion + Urea>7 + RR≥30 + low BP + Age≥65 (1 pt each)",
    pearl: "Score drives disposition, not antibiotic choice — combine with local admission criteria.",
    related: ["wells_pe", "aa_grad"],
    cite: "Lim WS et al., Thorax 2003",
  },
  {
    id: "aa_grad", name: "A-a Gradient", short: "Hypoxemia localization",
    icon: "💨", cat: "resp",
    inputs: [
      { key: "age", label: "Age", type: "num", units: [["years", 1]], min: 0 },
      { key: "pao2", label: "PaO₂", type: "num", units: [["mmHg", 1], ["kPa", 7.5]], min: 0 },
      { key: "paco2", label: "PaCO₂", type: "num", units: [["mmHg", 1], ["kPa", 7.5]], min: 0 },
      { key: "fio2", label: "FiO₂", type: "num", units: [["%", 1], ["fraction", 100]], min: 21, max: 100 },
    ],
    compute: (v) => {
      const pAO2 = (v.fio2 / 100) * (760 - 47) - v.paco2 / 0.8;
      const aa = pAO2 - v.pao2;
      const expected = v.age / 4 + 4;
      return {
        value: r0(aa), unit: "mmHg",
        tone: aa <= expected ? "ok" : "warn",
        label: aa <= expected ? `Normal for age (expected ≤${r0(expected)})` : `Elevated (expected ≤${r0(expected)})`,
        sub: "Elevated A-a → V/Q mismatch, shunt, diffusion (PE, pneumonia, pulmonary edema). Normal A-a + hypoxemia → hypoventilation/altitude.",
      };
    },
    formula: "PAO₂ = FiO₂×(760−47) − PaCO₂/0.8;  A-a = PAO₂ − PaO₂;  expected ≈ age/4 + 4",
    pearl: "Elevated A-a means the problem is in the lungs/pulmonary circulation, not the drive to breathe.",
    related: ["curb65"],
    cite: "Alveolar gas equation",
  },
  {
    id: "perc", name: "PERC Rule", short: "PE rule-out in low-risk patients",
    icon: "🚫", cat: "resp",
    inputs: [
      { key: "age", label: "Age ≥50", type: "check", pts: 1 },
      { key: "hr", label: "HR ≥100", type: "check", pts: 1 },
      { key: "spo2", label: "SpO₂ <95% on room air", type: "check", pts: 1 },
      { key: "swelling", label: "Unilateral leg swelling", type: "check", pts: 1 },
      { key: "hemoptysis", label: "Hemoptysis", type: "check", pts: 1 },
      { key: "surgery", label: "Surgery/trauma within 4 weeks", type: "check", pts: 1 },
      { key: "vte", label: "Prior DVT/PE", type: "check", pts: 1 },
      { key: "hormone", label: "Estrogen use (OCP/HRT)", type: "check", pts: 1 },
    ],
    compute: (v) => {
      const s = Object.values(v).filter(Boolean).length;
      return {
        value: s, unit: "criteria met",
        tone: s === 0 ? "ok" : "warn",
        label: s === 0 ? "PERC negative — PE ruled out (if gestalt also low-risk)" : "PERC positive — cannot rule out; continue workup (D-dimer/imaging)",
        sub: "PERC only applies when pretest probability is already low — it's a rule-OUT, never a rule-in.",
      };
    },
    formula: "All 8 must be absent to rule out PE",
    pearl: "Validated to reduce missed-PE rate below the harm of CTPA (~1.8%) — but only in genuinely low-risk patients.",
    related: ["wells_pe", "wells_dvt"],
    cite: "Kline JA et al., J Thromb Haemost 2008",
  },
  {
    id: "wells_pe", name: "Wells Score (PE)", short: "Pulmonary embolism probability",
    icon: "🫁", cat: "risk",
    inputs: [
      { key: "clin_pe", label: "Clinical signs/symptoms of DVT", type: "check", pts: 3 },
      { key: "alt_dx", label: "PE is the most likely diagnosis", type: "check", pts: 3 },
      { key: "hr", label: "Heart rate >100", type: "check", pts: 1.5 },
      { key: "immob", label: "Immobilization ≥3d or surgery <4wk", type: "check", pts: 1.5 },
      { key: "vte", label: "Previous DVT/PE", type: "check", pts: 1.5 },
      { key: "hemoptysis", label: "Hemoptysis", type: "check", pts: 1 },
      { key: "cancer", label: "Active cancer (treatment ≤6mo or palliative)", type: "check", pts: 1 },
    ],
    compute: (v) => {
      const pts = { clin_pe: 3, alt_dx: 3, hr: 1.5, immob: 1.5, vte: 1.5, hemoptysis: 1, cancer: 1 };
      const s = Object.entries(v).reduce((t, [k, x]) => t + (x ? pts[k] || 0 : 0), 0);
      return {
        value: r1(s), unit: "points",
        tone: s <= 1 ? "ok" : s <= 6 ? "warn" : "bad",
        label: s < 2 ? "Low probability (~3.6%)" : s <= 6 ? "Moderate probability (~20%)" : "High probability (~66%)",
        sub: s <= 4 ? "Two-tier: ≤4 'PE unlikely' → D-dimer rules out." : "Two-tier: >4 'PE likely' → image (CTPA) directly.",
      };
    },
    formula: "3+3+1.5+1.5+1.5+1+1 → three-tier or two-tier cutoffs",
    pearl: "The most-weighted item is 'PE more likely than alternative' — gestalt still carries the score.",
    related: ["perc", "wells_dvt"],
    cite: "Wells PS et al., Thromb Haemost 2000",
  },
  {
    id: "wells_dvt", name: "Wells Score (DVT)", short: "DVT probability",
    icon: "🦵", cat: "risk",
    inputs: [
      { key: "cancer", label: "Active cancer (≤6mo)", type: "check", pts: 1 },
      { key: "paralysis", label: "Paralysis/paresis/recent immobilization of leg", type: "check", pts: 1 },
      { key: "bed", label: "Bedridden >3d or surgery <12wk", type: "check", pts: 1 },
      { key: "tender", label: "Tenderness along deep venous system", type: "check", pts: 1 },
      { key: "swollen_leg", label: "Entire leg swollen", type: "check", pts: 1 },
      { key: "calf", label: "Calf swelling >3cm vs other side (10cm below tibial tuberosity)", type: "check", pts: 1 },
      { key: "pitting", label: "Pitting edema (symptomatic leg only)", type: "check", pts: 1 },
      { key: "collateral", label: "Collateral superficial veins (non-varicose)", type: "check", pts: 1 },
      { key: "prev_dvt", label: "Previous documented DVT", type: "check", pts: 1 },
      { key: "alt_dx", label: "Alternative diagnosis more likely than DVT", type: "check", pts: -2 },
    ],
    compute: (v) => {
      const pts = { cancer: 1, paralysis: 1, bed: 1, tender: 1, swollen_leg: 1, calf: 1, pitting: 1, collateral: 1, prev_dvt: 1, alt_dx: -2 };
      const s = Object.entries(v).reduce((t, [k, x]) => t + (x ? pts[k] || 0 : 0), 0);
      return {
        value: r1(s), unit: "points",
        tone: s <= 0 ? "ok" : s <= 2 ? "warn" : "bad",
        label: s <= 0 ? "Low probability (~5%)" : s <= 2 ? "Moderate (~17%)" : "High (~53%)",
        sub: "Two-tier: ≤1 'unlikely' → D-dimer; ≥2 'likely' → ultrasound.",
      };
    },
    formula: "9 × +1 criteria, −2 if alternative diagnosis more likely",
    pearl: "Points against you: the −2 'alternative diagnosis' item is what makes Wells-DVT different from a symptom checklist.",
    related: ["wells_pe", "perc"],
    cite: "Wells PS et al., Lancet 1997",
  },

  // ─── Neurology ──────────────────────────────────────────
  {
    id: "gcs", name: "Glasgow Coma Scale", short: "Consciousness level",
    icon: "🧠", cat: "neuro",
    inputs: [
      { key: "eye", label: "Eye opening", type: "radio", options: [
        { v: 4, pts: 4, lbl: "E4 — Spontaneous" }, { v: 3, pts: 3, lbl: "E3 — To voice" },
        { v: 2, pts: 2, lbl: "E2 — To pain" }, { v: 1, pts: 1, lbl: "E1 — None" }] },
      { key: "verbal", label: "Verbal response", type: "radio", options: [
        { v: 5, pts: 5, lbl: "V5 — Oriented" }, { v: 4, pts: 4, lbl: "V4 — Confused" },
        { v: 3, pts: 3, lbl: "V3 — Inappropriate words" }, { v: 2, pts: 2, lbl: "V2 — Incomprehensible" },
        { v: 1, pts: 1, lbl: "V1 — None" }] },
      { key: "motor", label: "Motor response", type: "radio", options: [
        { v: 6, pts: 6, lbl: "M6 — Obeys commands" }, { v: 5, pts: 5, lbl: "M5 — Localizes" },
        { v: 4, pts: 4, lbl: "M4 — Withdraws" }, { v: 3, pts: 3, lbl: "M3 — Flexes (decorticate)" },
        { v: 2, pts: 2, lbl: "M2 — Extends (decerebrate)" }, { v: 1, pts: 1, lbl: "M1 — None" }] },
    ],
    compute: (v) => {
      const s = (v.eye || 0) + (v.verbal || 0) + (v.motor || 0);
      if (!v.eye || !v.verbal || !v.motor) return null;
      return {
        value: s, unit: `/15 (E${v.eye} V${v.verbal} M${v.motor})`,
        tone: s >= 13 ? "ok" : s >= 9 ? "warn" : "bad",
        label: s === 15 ? "Fully alert" : s >= 13 ? "Mild impairment" : s >= 9 ? "Moderate — airway watch" : "Severe — GCS ≤8, consider definitive airway",
        sub: "Report components (E4V5M6) not just the sum — 'GCS 10' hides whether eyes or motor drive it.",
      };
    },
    formula: "GCS = E(1–4) + V(1–5) + M(1–6)",
    pearl: "Intubated? Score as GCS 10T — document components separately.",
    related: ["apgar"],
    cite: "Teasdale & Jennett, Lancet 1974",
  },
  {
    id: "centor", name: "Centor / McIsaac (Strep)", short: "Strep throat probability",
    icon: "🦠", cat: "neuro",
    inputs: [
      { key: "exudate", label: "Tonsillar exudate/swelling", type: "check", pts: 1 },
      { key: "nodes", label: "Tender anterior cervical nodes", type: "check", pts: 1 },
      { key: "fever", label: "Fever >38°C", type: "check", pts: 1 },
      { key: "cough", label: "Absence of cough", type: "check", pts: 1 },
      { key: "age", label: "Age band", type: "radio", options: [
        { v: 1, pts: 1, lbl: "3–14 years (+1)" },
        { v: 0, pts: 0, lbl: "15–44 years (0)" },
        { v: -1, pts: -1, lbl: "≥45 years (−1)" }] },
    ],
    compute: (v) => {
      const s = ["exudate", "nodes", "fever", "cough"].filter((k) => v[k]).length + (v.age ?? 0);
      return {
        value: s, unit: "points",
        tone: s <= 1 ? "ok" : s <= 3 ? "warn" : "bad",
        label: s <= 0 ? "Strep unlikely — no test/antibiotics" : s <= 1 ? "Low — no testing needed" : s <= 3 ? "Moderate — rapid antigen test" : "High — test or empiric treatment",
        sub: "McIsaac modifies Centor with the age adjustment — children get +1, over-45s get −1.",
      };
    },
    formula: "Exudate + Nodes + Fever + No cough + Age modifier",
    pearl: "Viral features (cough, coryza, hoarseness) actively argue against strep — 'absence of cough' is a positive point.",
    related: ["alvarado"],
    cite: "McIsaac WJ et al., CMAJ 1998",
  },
  {
    id: "alvarado", name: "Alvarado (MANTRELS)", short: "Appendicitis likelihood",
    icon: "🔪", cat: "neuro",
    inputs: [
      { key: "migrate", label: "Migration of pain to RLQ", type: "check", pts: 1 },
      { key: "anorexia", label: "Anorexia", type: "check", pts: 1 },
      { key: "nausea", label: "Nausea/vomiting", type: "check", pts: 1 },
      { key: "tender", label: "RLQ tenderness", type: "check", pts: 2 },
      { key: "rebound", label: "Rebound tenderness", type: "check", pts: 1 },
      { key: "fever", label: "Fever ≥37.3°C", type: "check", pts: 1 },
      { key: "leuko", label: "Leukocytosis ≥10k", type: "check", pts: 2 },
      { key: "shift", label: "Left shift (neutrophilia >75%)", type: "check", pts: 1 },
    ],
    compute: (v) => {
      const pts = { migrate: 1, anorexia: 1, nausea: 1, tender: 2, rebound: 1, fever: 1, leuko: 2, shift: 1 };
      const s = Object.entries(v).reduce((t, [k, x]) => t + (x ? pts[k] || 0 : 0), 0);
      return {
        value: s, unit: "/10",
        tone: s <= 4 ? "ok" : s <= 6 ? "warn" : "bad",
        label: s <= 4 ? "Low — appendicitis unlikely" : s <= 6 ? "Equivocal — observe/image (US or CT)" : "High — surgical consult",
        sub: "MANTRELS: Migration, Anorexia, Nausea, Tenderness RLQ (×2), Rebound, Elevated temp, Leukocytosis (×2), Shift.",
      };
    },
    formula: "MANTRELS — tenderness & leukocytosis count double",
    pearl: "Ultrasound first in children/pregnancy; score alone shouldn't delay surgical review in the classic presentation.",
    related: ["centor"],
    cite: "Alvarado A, Ann Emerg Med 1986",
  },

  // ─── Paediatrics ────────────────────────────────────────
  {
    id: "apgar", name: "APGAR Score", short: "Newborn condition at 1 & 5 min",
    icon: "👶", cat: "peds",
    inputs: [
      { key: "appear", label: "Appearance (color)", type: "radio", options: [
        { v: 0, pts: 0, lbl: "0 — Blue/pale all over" },
        { v: 1, pts: 1, lbl: "1 — Pink body, blue extremities" },
        { v: 2, pts: 2, lbl: "2 — Completely pink" }] },
      { key: "pulse", label: "Pulse (heart rate)", type: "radio", options: [
        { v: 0, pts: 0, lbl: "0 — Absent" },
        { v: 1, pts: 1, lbl: "1 — <100 bpm" },
        { v: 2, pts: 2, lbl: "2 — ≥100 bpm" }] },
      { key: "grimace", label: "Grimace (reflex irritability)", type: "radio", options: [
        { v: 0, pts: 0, lbl: "0 — No response" },
        { v: 1, pts: 1, lbl: "1 — Grimace/weak cry" },
        { v: 2, pts: 2, lbl: "2 — Cough, sneeze, vigorous cry" }] },
      { key: "activity", label: "Activity (muscle tone)", type: "radio", options: [
        { v: 0, pts: 0, lbl: "0 — Limp" },
        { v: 1, pts: 1, lbl: "1 — Some flexion" },
        { v: 2, pts: 2, lbl: "2 — Active motion" }] },
      { key: "resp", label: "Respiration", type: "radio", options: [
        { v: 0, pts: 0, lbl: "0 — Absent" },
        { v: 1, pts: 1, lbl: "1 — Weak/irregular/gasping" },
        { v: 2, pts: 2, lbl: "2 — Strong cry" }] },
    ],
    compute: (v) => {
      const keys = ["appear", "pulse", "grimace", "activity", "resp"];
      if (keys.some((k) => v[k] == null)) return null;
      const s = keys.reduce((t, k) => t + v[k], 0);
      return {
        value: s, unit: "/10",
        tone: s >= 7 ? "ok" : s >= 4 ? "warn" : "bad",
        label: s >= 7 ? "Reassuring (7–10)" : s >= 4 ? "Moderately depressed — stimulate, consider PPV" : "Critically low — full resuscitation",
        sub: "Assess at 1 and 5 minutes; repeat q5min up to 20min if <7. APGAR doesn't predict outcome — it guides resuscitation.",
      };
    },
    formula: "Appearance + Pulse + Grimace + Activity + Respiration (0–2 each)",
    pearl: "The mnemonic IS the exam: Appearance, Pulse, Grimace, Activity, Respiration.",
    related: ["holliday"],
    cite: "Virginia Apgar, 1953",
  },
  {
    id: "holliday", name: "Maintenance Fluids (Holliday-Segar)", short: "Paediatric daily fluid",
    icon: "🍼", cat: "peds",
    inputs: [
      { key: "wt", label: "Weight", type: "num", units: [["kg", 1], ["lb", 0.4536]], min: 0, hint: "Child weight" },
    ],
    compute: (v) => {
      const w = v.wt;
      let daily, hourly;
      if (w <= 10) { daily = 100 * w; hourly = 4 * w; }
      else if (w <= 20) { daily = 1000 + 50 * (w - 10); hourly = 40 + 2 * (w - 10); }
      else { daily = 1500 + 20 * (w - 20); hourly = 60 + 1 * (w - 20); }
      return {
        value: r0(daily), unit: "mL/day",
        tone: "info",
        label: `≈ ${r1(hourly)} mL/hr`,
        sub: "100/50/20 mL per kg daily · 4/2/1 mL per kg hourly — add deficit and ongoing losses separately.",
      };
    },
    formula: "First 10kg:100mL/kg · next 10kg:50 · rest:20 — hourly: 4/2/1 rule",
    pearl: "Maintenance ≠ resuscitation — boluses are 20mL/kg on top, and post-op/sick kids may need 60–80% of this.",
    related: ["fluid_deficit"],
    cite: "Holliday & Segar, Pediatrics 1957",
  },
  {
    id: "fluid_deficit", name: "Fluid Deficit (dehydration)", short: "Volume to replace in dehydration",
    icon: "💧", cat: "peds",
    inputs: [
      { key: "wt", label: "Weight", type: "num", units: [["kg", 1], ["lb", 0.4536]], min: 0 },
      { key: "pct", label: "Estimated dehydration", type: "seg", default: "5", options: [
        ["3", "Mild (3%)"], ["5", "Moderate (5%)"], ["8", "Severe (8%)"], ["10", "Very severe (10%)"]] },
    ],
    compute: (v) => {
      const deficit = v.wt * (v.pct / 100) * 1000;
      return {
        value: r0(deficit), unit: "mL",
        tone: "info",
        label: `Give ${r0(deficit / 2)} mL in first 8h, ${r0(deficit / 2)} over next 16h`,
        sub: "Oral rehydration first when tolerated (50–100mL/kg over 4h). Add maintenance fluids on top.",
        extra: ["Signs at 5%: dry mucosa, ↓turgor; 8–10%: lethargy, sunken eyes, shock — IV boluses needed."],
      };
    },
    formula: "Deficit = weight × %dehydration (10kg @5% = 500mL)",
    pearl: "Clinical estimate is rough — weigh before/after if possible, and reassess turgor + urine output.",
    related: ["holliday"],
    cite: "Standard paediatric formula",
  },

  // ─── General & Metabolic ────────────────────────────────
  {
    id: "bmi", name: "BMI", short: "Body mass index",
    icon: "⚖️", cat: "general",
    inputs: [
      { key: "wt", label: "Weight", type: "num", units: [["kg", 1], ["lb", 0.4536]], min: 0 },
      { key: "ht", label: "Height", type: "num", units: [["cm", 1], ["inches", 2.54]], min: 0 },
    ],
    compute: (v) => {
      const bmi = v.wt / Math.pow(v.ht / 100, 2);
      return {
        value: r1(bmi), unit: "kg/m²",
        tone: bmi < 18.5 ? "warn" : bmi < 25 ? "ok" : bmi < 30 ? "warn" : "bad",
        label: bmi < 18.5 ? "Underweight" : bmi < 25 ? "Normal" : bmi < 30 ? "Overweight" : bmi < 35 ? "Obese class I" : bmi < 40 ? "Obese class II" : "Obese class III",
        sub: "Misses muscle mass, frame, and ethnicity differences — Asian thresholds are 2.5 lower.",
      };
    },
    formula: "BMI = weight(kg) ÷ height(m)²",
    pearl: "WHO Asian cutoffs: overweight ≥23, obese ≥27.5.",
    related: ["bsa"],
    cite: "Quetelet/WHO",
  },
  {
    id: "bsa", name: "Body Surface Area (Mosteller)", short: "BSA for dosing",
    icon: "📏", cat: "general",
    inputs: [
      { key: "wt", label: "Weight", type: "num", units: [["kg", 1], ["lb", 0.4536]], min: 0 },
      { key: "ht", label: "Height", type: "num", units: [["cm", 1], ["inches", 2.54]], min: 0 },
    ],
    compute: (v) => {
      const bsa = Math.sqrt((v.ht * v.wt) / 3600);
      return {
        value: r1(bsa * 10) / 10, unit: "m²",
        tone: "info",
        label: "Body surface area",
        sub: "Used for chemotherapy dosing, burns estimation, and some pediatric dosing.",
      };
    },
    formula: "BSA = √(height_cm × weight_kg ÷ 3600)",
    pearl: "Mosteller is the standard — simpler and as accurate as Dubois for clinical use.",
    related: ["bmi", "parkland"],
    cite: "Mosteller, NEJM 1987",
  },
  {
    id: "corrected_ca", name: "Corrected Calcium", short: "Albumin-adjusted calcium",
    icon: "🦴", cat: "general",
    inputs: [
      { key: "ca", label: "Total calcium", type: "num", units: [["mmol/L", 1], ["mg/dL", 0.25]], min: 0 },
      { key: "alb", label: "Albumin", type: "num", units: [["g/L", 1], ["g/dL", 10]], min: 0 },
    ],
    compute: (v) => {
      const corr = v.ca + 0.02 * (40 - v.alb);
      return {
        value: r1(corr * 10) / 10, unit: "mmol/L",
        tone: corr < 2.2 ? "warn" : corr <= 2.6 ? "ok" : "bad",
        label: corr < 2.2 ? "Corrected LOW" : corr <= 2.6 ? "Corrected normal" : "Corrected HIGH",
        sub: `Every 10g/L albumin drop overstates Ca by ~0.2 mmol/L — low albumin hides true hypercalcemia.`,
      };
    },
    formula: "Ca_corr = Ca + 0.02 × (40 − albumin g/L)",
    pearl: "Ionized Ca is the gold standard — correction formulas are a shortcut with real error bars.",
    related: ["anion_gap"],
    cite: "Standard correction",
  },
  {
    id: "phenytoin", name: "Corrected Phenytoin (Sheiner-Tozer)", short: "Level adjusted for albumin",
    icon: "💊", cat: "general",
    inputs: [
      { key: "pheny", label: "Measured phenytoin", type: "num", units: [["µmol/L", 1], ["µg/mL", 3.96]], min: 0 },
      { key: "alb", label: "Albumin", type: "num", units: [["g/L", 1], ["g/dL", 10]], min: 0 },
      { key: "esrd", label: "Severe renal impairment / ESRD", type: "seg", default: "no", options: [["no", "No (0.2)"], ["yes", "Yes (0.25)"]] },
    ],
    compute: (v) => {
      const denom = (v.esrd === "yes" ? 0.25 : 0.2) * (v.alb / 10) + 0.1;
      const corr = v.pheny / denom;
      return {
        value: r1(corr), unit: "µmol/L",
        tone: corr < 40 ? "warn" : corr <= 80 ? "ok" : "bad",
        label: corr < 40 ? "Subtherapeutic (target 40–80)" : corr <= 80 ? "In therapeutic range" : "Above range — toxicity risk",
        sub: "Phenytoin is highly albumin-bound — hypoalbuminemia means more free (active) drug than the total level shows.",
      };
    },
    formula: "Adj = measured ÷ (0.2 × alb g/dL + 0.1) — use 0.25 in ESRD",
    pearl: "Same logic explains 'toxic at therapeutic levels' in renal failure and malnutrition.",
    related: ["corrected_ca"],
    cite: "Sheiner & Tozer, 1978",
  },

  // ─── Emergency & Trauma ─────────────────────────────────
  {
    id: "parkland", name: "Parkland Formula (burns)", short: "24h fluid resuscitation",
    icon: "🔥", cat: "emergency",
    inputs: [
      { key: "wt", label: "Weight", type: "num", units: [["kg", 1], ["lb", 0.4536]], min: 0 },
      { key: "tbsa", label: "% TBSA burned", type: "num", units: [["%", 1]], min: 0, max: 100, hint: "Partial+full thickness only" },
    ],
    compute: (v) => {
      const total = 4 * v.wt * v.tbsa;
      return {
        value: r0(total), unit: "mL LR / 24h",
        tone: "info",
        label: `${r0(total / 2)} mL in first 8h · ${r0(total / 2)} mL over next 16h`,
        sub: "Clock starts at time of BURN not arrival. Titrate to urine output: ≥0.5mL/kg/hr adults, ≥1mL/kg/hr children.",
        extra: ["Indication: adults ≥15% TBSA, children ≥10%. Rule of 9s for adult TBSA estimation."],
      };
    },
    formula: "4mL × weight(kg) × %TBSA — half in first 8h from time of burn",
    pearl: "The formula is a starting point — urine output is the real target; over-resuscitation causes 'fluid creep' & compartment syndrome.",
    related: ["holliday", "fluid_deficit"],
    cite: "Baxter & Shires, 1968",
  },
  {
    id: "gcs_ped", name: "Winter's Formula (expected PaCO₂)", short: "Compensation check in acidosis",
    icon: "❄️", cat: "emergency",
    inputs: [
      { key: "hco3", label: "Measured HCO₃", type: "num", units: [["mmol/L", 1]], min: 0 },
      { key: "paco2", label: "Measured PaCO₂", type: "num", units: [["mmHg", 1], ["kPa", 7.5]], min: 0 },
    ],
    compute: (v) => {
      const expected = 1.5 * v.hco3 + 8;
      const inRange = Math.abs(v.paco2 - expected) <= 2;
      return {
        value: r1(expected), unit: "mmHg (±2)",
        tone: inRange ? "ok" : "warn",
        label: inRange ? "Appropriate compensation — pure metabolic acidosis" : v.paco2 > expected + 2 ? "Concurrent respiratory ACIDOSIS" : "Concurrent respiratory ALKALOSIS",
        sub: `Expected PaCO₂ ${r1(expected)} ±2 vs measured ${r1(v.paco2)} — mismatch = second disorder.`,
      };
    },
    formula: "Expected PaCO₂ = 1.5 × HCO₃ + 8 (±2)",
    pearl: "If compensation looks 'wrong', there's a second acid-base process — this is the exam-favorite check.",
    related: ["anion_gap", "delta_ratio"],
    cite: "Winter et al.",
  },
];

export const CALC_MAP = Object.fromEntries(CALCS.map((c) => [c.id, c]));

/** Whether a numeric input is filled (respects optional flag). */
export function inputFilled(v, spec) {
  const val = v[spec.key];
  if (val === "" || val == null) return !!spec.optional;
  return !Number.isNaN(parseFloat(val));
}

/** All required inputs for a calc filled? */
export function calcReady(calc, values) {
  return calc.inputs.every((i) => {
    if (i.type === "num") return i.optional ? true : values[i.key] !== "" && values[i.key] != null && !Number.isNaN(parseFloat(values[i.key]));
    if (i.type === "check") return true;
    return values[i.key] != null;
  });
}

/** Convert raw input map → compute-ready values in base units. */
export function toComputeValues(calc, raw) {
  const v = {};
  for (const i of calc.inputs) {
    if (i.type === "num") {
      const rawVal = raw[i.key];
      if (rawVal === "" || rawVal == null) continue;
      const num = parseFloat(rawVal);
      if (Number.isNaN(num)) continue;
      const unit = raw[`${i.key}__unit`] ?? i.units[0][0];
      const factor = i.units.find((u) => u[0] === unit)?.[1] ?? 1;
      v[i.key] = num * factor;
    } else if (i.type === "check") {
      v[i.key] = !!raw[i.key];
    } else {
      v[i.key] = raw[i.key] ?? i.default;
    }
  }
  return v;
}
