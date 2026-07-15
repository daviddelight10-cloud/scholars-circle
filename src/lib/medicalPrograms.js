export const MEDICAL_PROGRAMS = [
  {
    id: "medicine",
    label: "Medicine & Surgery (MBBS)",
    icon: "🩺",
    color: "#ef4444",
    levels: ["100 (Pre-clinical)", "200 (Pre-clinical)", "300 (Pre-clinical)", "400 (Clinical)", "500 (Clinical)", "600 (Clinical / Internship)"],
    subjects: ["Anatomy", "Physiology", "Biochemistry", "Pharmacology", "Pathology", "Microbiology", "Community Medicine", "Internal Medicine", "Surgery", "Obstetrics & Gynaecology", "Paediatrics", "Psychiatry"],
  },
  {
    id: "mls",
    label: "Medical Laboratory Science (MLS)",
    icon: "🔬",
    color: "#3b82f6",
    levels: ["100 Level", "200 Level", "300 Level", "400 Level", "500 Level"],
    subjects: ["Clinical Biochemistry", "Haematology", "Medical Microbiology", "Histopathology", "Immunology", "Parasitology", "Virology", "Blood Transfusion Science"],
  },
  {
    id: "nursing",
    label: "Nursing Science (BNSc)",
    icon: "💉",
    color: "#22c55e",
    levels: ["100 Level", "200 Level", "300 Level", "400 Level", "500 Level"],
    subjects: ["Anatomy & Physiology", "Medical-Surgical Nursing", "Community Health Nursing", "Maternal & Child Health Nursing", "Mental Health Nursing", "Nursing Foundations", "Pharmacology for Nurses", "Nursing Research"],
  },
  {
    id: "radiography",
    label: "Radiography & Radiological Sciences",
    icon: "📡",
    color: "#8b5cf6",
    levels: ["100 Level", "200 Level", "300 Level", "400 Level", "500 Level"],
    subjects: ["Radiation Physics", "Anatomy for Radiographers", "Radiographic Positioning", "Medical Imaging", "Radiotherapy", "Ultrasound", "MRI Physics", "Radiation Protection"],
  },
  {
    id: "dentistry",
    label: "Dentistry (BDS)",
    icon: "🦷",
    color: "#06b6d4",
    levels: ["200 (Pre-clinical)", "300 (Pre-clinical)", "400 (Clinical)", "500 (Clinical)", "600 (Clinical)"],
    subjects: ["Oral Anatomy", "Oral Physiology", "Dental Materials", "Oral Pathology", "Oral Surgery", "Restorative Dentistry", "Orthodontics", "Paediatric Dentistry", "Periodontology", "Prosthodontics"],
  },
  {
    id: "physiotherapy",
    label: "Physiotherapy (B.PT)",
    icon: "💪",
    color: "#f59e0b",
    levels: ["100 Level", "200 Level", "300 Level", "400 Level", "500 Level"],
    subjects: ["Anatomy", "Physiology", "Kinesiology", "Electrotherapy", "Exercise Therapy", "Orthopaedic Physiotherapy", "Neurological Physiotherapy", "Cardiopulmonary Physiotherapy"],
  },
  {
    id: "anatomy",
    label: "Anatomy (B.Sc)",
    icon: "🦴",
    color: "#ec4899",
    levels: ["100 Level", "200 Level", "300 Level", "400 Level"],
    subjects: ["Gross Anatomy", "Histology", "Embryology", "Neuroanatomy", "Cytology", "Osteology", "Comparative Anatomy", "Anthropology"],
  },
  {
    id: "physiology",
    label: "Physiology (B.Sc)",
    icon: "🫀",
    color: "#10b981",
    levels: ["100 Level", "200 Level", "300 Level", "400 Level"],
    subjects: ["Cell Physiology", "Systemic Physiology", "Neurophysiology", "Endocrine Physiology", "Renal Physiology", "Cardiovascular Physiology", "Respiratory Physiology", "Gastrointestinal Physiology"],
  },
  {
    id: "biochemistry",
    label: "Biochemistry (B.Sc)",
    icon: "🧪",
    color: "#a855f7",
    levels: ["100 Level", "200 Level", "300 Level", "400 Level"],
    subjects: ["Biomolecules", "Enzymology", "Metabolism", "Clinical Biochemistry", "Molecular Biology", "Nutritional Biochemistry", "Medical Biochemistry", "Biotechnology"],
  },
  {
    id: "microbiology",
    label: "Microbiology (B.Sc)",
    icon: "🦠",
    color: "#14b8a6",
    levels: ["100 Level", "200 Level", "300 Level", "400 Level"],
    subjects: ["General Microbiology", "Medical Bacteriology", "Virology", "Mycology", "Parasitology", "Immunology", "Industrial Microbiology", "Epidemiology"],
  },
  {
    id: "dermatology",
    label: "Dermatology (Postgraduate)",
    icon: "🧬",
    color: "#f43f5e",
    levels: ["Resident Year 1", "Resident Year 2", "Resident Year 3", "Resident Year 4", "Fellowship"],
    subjects: ["Basic Dermatology", "Dermatopathology", "Cutaneous Surgery", "Cosmetic Dermatology", "Pediatric Dermatology", "Dermatologic Immunology", "Tropical Dermatology", "Photodermatology"],
  },
  {
    id: "paediatrics",
    label: "Paediatrics (Postgraduate)",
    icon: "👶",
    color: "#6366f1",
    levels: ["Resident Year 1", "Resident Year 2", "Resident Year 3", "Resident Year 4", "Fellowship"],
    subjects: ["Neonatology", "General Paediatrics", "Paediatric Cardiology", "Paediatric Infectious Diseases", "Paediatric Oncology", "Paediatric Neurology", "Paediatric Endocrinology", "Adolescent Medicine"],
  },
];

export function getProgram(id) {
  return MEDICAL_PROGRAMS.find((p) => p.id === id) || MEDICAL_PROGRAMS[0];
}

export function getProgramSubjects(programId) {
  const program = getProgram(programId);
  return program ? program.subjects : [];
}

export const MEDICAL_BADGES = [
  { id: "anatomy_master", icon: "🦴", label: "Anatomy Master", desc: "Complete 50 Anatomy questions correctly" },
  { id: "pharma_pro", icon: "💊", label: "Pharma Pro", desc: "Complete 50 Pharmacology questions correctly" },
  { id: "clinical_reasoner", icon: "🧠", label: "Clinical Reasoner", desc: "Solve 10 clinical case simulations" },
  { id: "osce_ready", icon: "🏥", label: "OSCE Ready", desc: "Complete 5 OSCE practice stations" },
  { id: "drug_expert", icon: "💉", label: "Drug Expert", desc: "Review 50 drug reference entries" },
  { id: "lab_wizard", icon: "🧪", label: "Lab Wizard", desc: "Master 20 lab value interpretations" },
  { id: "first_diagnosis", icon: "🔍", label: "First Diagnosis", desc: "Complete your first clinical case" },
  { id: "differential_dx", icon: "⚖️", label: "Differential Thinker", desc: "List 3+ differentials in a clinical case" },
  { id: "rotation_survivor", icon: "🏥", label: "Rotation Survivor", desc: "Complete a full clinical rotation study path" },
  { id: "code_blue", icon: "🚨", label: "Code Blue", desc: "Score 100% on an emergency medicine quiz" },
];

export const MEDICAL_TABS = [
  "today", "practice", "clinical-cases", "osce", "aitutor", "drug-ref", "lab-values", "analytics", "research-hub",
];

export const MEDICAL_TAB_LABELS = {
  today: "🏠 Home",
  practice: "📚 Q-Bank",
  "clinical-cases": "🩺 Clinical Cases",
  osce: "🏥 OSCE Prep",
  aitutor: "🤖 AI Tutor",
  "drug-ref": "💊 Drug Reference",
  "lab-values": "🧪 Lab Values",
  analytics: "📊 Progress",
  "research-hub": "📁 Resource Hub",
  classroom: "🏫 Classroom",
  bank: "🏦 Question Bank",
  flashcards: "🃏 Flashcards",
  lecturers: "👨‍⚕️ Clinicians",
  leaderboard: "🏆 Leaderboard",
  gamification: "⚔️ Arena",
  studygroups: "👥 Study Groups",
  notes: "📝 Notes",
  achievements: "🏅 Badges",
  timetable: "🗓️ Schedule",
  discuss: "💬 Discussion",
  settings: "⚙️ Settings",
  profile: "👤 Profile",
  notifications: "🔔 Notifications",
  "teacher-questions": "📝 My Questions",
  "campus-comm": "📢 Announcements",
  premium: "💎 Premium",
  "medical-calculators": "🧮 Med Calculators",
};
