// Discipline metadata - defines academic fields supported by the AI Tutor
// Each discipline has a unique style, expected formatting, and reasoning approach.
// The core (hand-written) entries carry bespoke tutor styles; every other
// program in the discipline catalog is appended below with a category-level
// style so the picker and tutor cover all ~40 disciplines.
import { MEDICAL_PROGRAMS } from "../../lib/medicalPrograms.js";

const CORE_DISCIPLINES = [
  {
    id: "medicine",
    label: "Medicine & Surgery",
    icon: "🩺",
    color: "#ef4444",
    examples: ["Internal Medicine", "Surgery", "Obstetrics & Gynaecology", "Paediatrics", "Psychiatry"],
    style: "Use clinical reasoning. Include differential diagnoses when relevant. Cite mechanisms (cellular/molecular). Emphasize patient safety. Note: educational only, not medical advice."
  },
  {
    id: "anatomy",
    label: "Anatomy",
    icon: "🦴",
    color: "#ec4899",
    examples: ["Gross Anatomy", "Histology", "Embryology", "Neuroanatomy", "Osteology"],
    style: "Use regional and systemic approaches. Describe structures with spatial relationships. Include clinical correlations. Use anatomical terminology (Latin/Greek derivations when helpful)."
  },
  {
    id: "physiology",
    label: "Physiology",
    icon: "🫀",
    color: "#10b981",
    examples: ["Cardiovascular", "Respiratory", "Renal", "Endocrine", "Neurophysiology"],
    style: "Explain mechanisms at cellular and system levels. Use equations for physiological processes. Include clinical correlations (what happens when this fails)."
  },
  {
    id: "pharmacology",
    label: "Pharmacology",
    icon: "�",
    color: "#8b5cf6",
    examples: ["Pharmacokinetics", "Pharmacodynamics", "Drug Interactions", "Toxicology", "Clinical Pharmacy"],
    style: "Include drug class, mechanism of action, indications, contraindications, side effects, and interactions. Use generic names. Mention dosing principles. Note: educational only."
  },
  {
    id: "pathology",
    label: "Pathology",
    icon: "🔬",
    color: "#f59e0b",
    examples: ["General Pathology", "Systemic Pathology", "Histopathology", "Haematology", "Clinical Pathology"],
    style: "Describe disease processes from etiology through pathogenesis to morphological changes and clinical consequences. Include gross and microscopic descriptions."
  },
  {
    id: "microbiology",
    label: "Microbiology",
    icon: "🦠",
    color: "#14b8a6",
    examples: ["Bacteriology", "Virology", "Mycology", "Parasitology", "Immunology"],
    style: "Include organism characteristics, pathogenesis, clinical features, diagnosis, and treatment. Mention culture methods and antimicrobial sensitivity patterns."
  },
  {
    id: "nursing",
    label: "Nursing Science",
    icon: "💉",
    color: "#22c55e",
    examples: ["Medical-Surgical Nursing", "Community Health", "Maternal & Child Health", "Mental Health", "Nursing Foundations"],
    style: "Use nursing process (Assessment, Diagnosis, Planning, Implementation, Evaluation). Include care plans, patient education, and safety considerations. Emphasize evidence-based practice."
  },
  {
    id: "radiography",
    label: "Radiography & Radiological Sciences",
    icon: "📡",
    color: "#6366f1",
    examples: ["Radiographic Positioning", "Medical Imaging", "Radiotherapy", "Ultrasound", "MRI Physics"],
    style: "Include technical parameters (kVp, mAs, SID), positioning landmarks, radiation protection principles. Describe image evaluation criteria. Mention pathological appearances on imaging."
  },
  {
    id: "dentistry",
    label: "Dentistry",
    icon: "🦷",
    color: "#06b6d4",
    examples: ["Oral Surgery", "Restorative Dentistry", "Orthodontics", "Periodontology", "Prosthodontics"],
    style: "Include clinical procedures step-by-step, materials used, indications/contraindications. Describe oral manifestations of systemic diseases. Emphasize infection control."
  },
  {
    id: "physiotherapy",
    label: "Physiotherapy",
    icon: "�",
    color: "#f97316",
    examples: ["Orthopaedic Physio", "Neurological Physio", "Cardiopulmonary Physio", "Exercise Therapy", "Electrotherapy"],
    style: "Include assessment procedures, treatment techniques, exercise prescriptions, and rehabilitation protocols. Emphasize evidence-based practice and patient-centered care."
  },
  {
    id: "biochemistry",
    label: "Biochemistry",
    icon: "🧪",
    color: "#a855f7",
    examples: ["Metabolism", "Enzymology", "Molecular Biology", "Clinical Biochemistry", "Nutritional Biochemistry"],
    style: "Include metabolic pathways with enzymes and regulation. Explain biochemical basis of diseases. Use structural formulas when relevant. Link to clinical correlations."
  },
  {
    id: "sciences",
    label: "Basic Sciences (Pre-clinical)",
    icon: "🔬",
    color: "#10b981",
    examples: ["Biology", "Chemistry", "Physics"],
    style: "Use scientific method framing. Include hypotheses, evidence, mechanisms. Use IUPAC/SI units. Show diagrams in ASCII when useful. Focus on medical relevance."
  },
  {
    id: "general",
    label: "General Medical",
    icon: "🎓",
    color: "#a78bfa",
    examples: ["Study skills", "Exam preparation", "Cross-disciplinary medical topics"],
    style: "Use clear plain language. Adapt examples to medical context. Provide structured explanations with headings. Emphasize clinical relevance."
  }
];

// Category-level tutor styles for disciplines without a bespoke entry.
const CATEGORY_STYLES = {
  "health-med": "Use clinical and biomedical reasoning. Explain mechanisms at cellular/system level and link to clinical relevance. Note: educational only, not medical advice.",
  "allied-ph": "Use applied health-science reasoning. Emphasize diagnostic and procedural accuracy, laboratory safety, standards, and public-health context.",
  "law-biz": "Use analytical, principle-based reasoning. For law: cite statutes, cases and precedents (Nigerian where relevant) and structure arguments IRAC-style. For business/finance: show calculations step-by-step with real-world examples.",
  "engineering": "Use systematic problem-solving: state assumptions, derive formulas, keep units consistent, and work through numerical examples. Relate theory to practical engineering applications.",
  "sci-tech": "Explain from first principles. Use code examples, pseudocode, and complexity reasoning for computing topics; show algorithms step-by-step.",
  "social-hum": "Use structured essay-style reasoning: define key terms, present theories and frameworks, compare perspectives, and ground arguments in Nigerian and global examples.",
};

const coreIds = new Set(CORE_DISCIPLINES.map((d) => d.id));
const SYNTHESIZED = MEDICAL_PROGRAMS.filter((p) => !coreIds.has(p.id)).map((p) => ({
  id: p.id,
  label: p.label.replace(/\s*\(.*$/, "").trim(),
  icon: p.icon,
  color: p.color,
  examples: p.subjects.slice(0, 5),
  style: CATEGORY_STYLES[p.category] || "Explain clearly with structured headings and adapt examples to the student's field.",
}));

export const DISCIPLINES = [...CORE_DISCIPLINES, ...SYNTHESIZED];

export function getDiscipline(id) {
  return DISCIPLINES.find(d => d.id === id) || DISCIPLINES[0];
}

// Heuristic auto-detection from a subject label (best-effort)
export function detectDiscipline(subjectLabel) {
  if (!subjectLabel) return "medicine";
  const s = subjectLabel.toLowerCase();
  if (/anatom|osteolog|histolog|embryolog|neuroanatom/.test(s)) return "anatomy";
  if (/physiol/.test(s)) return "physiology";
  if (/pharma|drug|therap/.test(s)) return "pharmacology";
  if (/patholog|histopath|haemat/.test(s)) return "pathology";
  if (/microb|bacter|virolog|mycolog|parasit|immun/.test(s)) return "microbiology";
  if (/nurs/.test(s)) return "nursing";
  if (/radio|radiograph|imaging|ultrasound|mri/.test(s)) return "radiography";
  if (/dent|oral surg|orthodont|prosthodont|periodont/.test(s)) return "dentistry";
  if (/physio|rehab|exercise therap|electrotherap/.test(s)) return "physiotherapy";
  if (/biochem|metabol|enzym/.test(s)) return "biochemistry";
  // Non-medical checks must precede the broad medical patterns below
  // ("clinical" catches psychology, "structur" catches data structures).
  if (/psycholog|cognit/.test(s)) return "psychology";
  if (/program|algorithm|data struct|software|comput|database/.test(s)) return "computer-science";
  if (/law|legal|jurisprud|constitut|tort|contract|criminal law|evidence/.test(s)) return "law";
  if (/account|audit|taxat|financ/.test(s)) return "accounting";
  if (/econom|manag|business|market/.test(s)) return "economics";
  if (/circuit|power system|electr/.test(s)) return "elect-eng";
  if (/thermodynam|machine|fluid mech|manufactur/.test(s)) return "mech-eng";
  if (/structur|geotech|construct|survey|civil/.test(s)) return "civil-eng";
  if (/journal|media|communicat|public rel|broadcast/.test(s)) return "mass-comm";
  if (/politic|government|international rel/.test(s)) return "political-science";
  if (/optometr|ocular|vision/.test(s)) return "optometry";
  if (/nutrition|dietetic|food/.test(s)) return "nutrition";
  if (/public health|epidemiolog|biostat/.test(s)) return "public-health";
  if (/laborator|haematolog|blood|transfusion|cytolog/.test(s)) return "mls";
  if (/medic|surg|clinic|internal|obstetr|gynaec|paediat|psychiat/.test(s)) return "medicine";
  if (/biolog|chem|physic/.test(s)) return "sciences";
  return "medicine";
}
