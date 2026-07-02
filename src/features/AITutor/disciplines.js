// Discipline metadata - defines academic fields supported by the AI Tutor
// Each discipline has a unique style, expected formatting, and reasoning approach.

export const DISCIPLINES = [
  {
    id: "sciences",
    label: "Natural Sciences",
    icon: "🔬",
    color: "#10b981",
    examples: ["Biology", "Chemistry", "Physics", "Earth Science", "Astronomy"],
    style: "Use scientific method framing. Include hypotheses, evidence, mechanisms. Use IUPAC/SI units. Show diagrams in ASCII when useful."
  },
  {
    id: "engineering",
    label: "Engineering & Technology",
    icon: "⚙️",
    color: "#f59e0b",
    examples: ["Mechanical", "Electrical", "Civil", "Computer Science", "Software Eng"],
    style: "Show equations, derivations, units. Provide step-by-step calculations. Use code blocks for algorithms. Emphasize practical applications."
  },
  {
    id: "mathematics",
    label: "Mathematics & Statistics",
    icon: "📐",
    color: "#FFD700",
    examples: ["Calculus", "Linear Algebra", "Statistics", "Discrete Math", "Probability"],
    style: "Use rigorous proofs. Show all steps. Use LaTeX-style notation in plain text (e.g., x^2, sqrt(x), integral). State assumptions and theorems used."
  },
  {
    id: "medicine",
    label: "Medicine & Health Sciences",
    icon: "⚕️",
    color: "#ef4444",
    examples: ["Anatomy", "Physiology", "Pharmacology", "Pathology", "Nursing"],
    style: "Use clinical reasoning. Include differential diagnoses when relevant. Cite mechanisms (cellular/molecular). Emphasize patient safety. Note: educational only, not medical advice."
  },
  {
    id: "law",
    label: "Law & Legal Studies",
    icon: "⚖️",
    color: "#DAA520",
    examples: ["Constitutional Law", "Criminal Law", "Contract Law", "Tort Law", "International Law"],
    style: "Use IRAC structure (Issue, Rule, Application, Conclusion). Cite case names and statutes when teaching. Acknowledge jurisdictional differences."
  },
  {
    id: "business",
    label: "Business & Economics",
    icon: "💼",
    color: "#FFD700",
    examples: ["Accounting", "Finance", "Marketing", "Management", "Microeconomics"],
    style: "Use case-study framing. Show financial calculations. Include real-world examples. Use frameworks (SWOT, Porter's Five Forces, 4Ps)."
  },
  {
    id: "humanities",
    label: "Humanities & Social Sciences",
    icon: "📚",
    color: "#ec4899",
    examples: ["History", "Philosophy", "Sociology", "Psychology", "Political Science"],
    style: "Use thesis-evidence-analysis structure. Reference primary sources, theories, and competing perspectives. Encourage critical thinking."
  },
  {
    id: "languages",
    label: "Languages & Literature",
    icon: "🌍",
    color: "#14b8a6",
    examples: ["English", "Linguistics", "French", "Comparative Lit", "Creative Writing"],
    style: "Provide examples in target language with translation. Explain grammar with contrastive examples. For literature, analyze themes, devices, context."
  },
  {
    id: "arts",
    label: "Arts & Design",
    icon: "🎨",
    color: "#f43f5e",
    examples: ["Fine Art", "Music Theory", "Architecture", "Film Studies", "Graphic Design"],
    style: "Reference movements, periods, and artists. Explain composition, theory, and technique. Connect form to meaning."
  },
  {
    id: "general",
    label: "General / Mixed",
    icon: "🎓",
    color: "#a78bfa",
    examples: ["General study skills", "Cross-disciplinary topics"],
    style: "Use clear plain language. Adapt examples to context. Provide structured explanations with headings."
  }
];

export function getDiscipline(id) {
  return DISCIPLINES.find(d => d.id === id) || DISCIPLINES[DISCIPLINES.length - 1];
}

// Heuristic auto-detection from a subject label (best-effort)
export function detectDiscipline(subjectLabel) {
  if (!subjectLabel) return "general";
  const s = subjectLabel.toLowerCase();
  if (/biolog|chem|physic|astrono|geolog|botany|zoolog/.test(s)) return "sciences";
  if (/engin|comput|software|electric|mechanic|civil|robotic/.test(s)) return "engineering";
  if (/math|calculus|algebra|statistic|probabil|geometry/.test(s)) return "mathematics";
  if (/medic|anatom|physiol|pharma|patholog|nurs|clinic|health/.test(s)) return "medicine";
  if (/law|legal|jurispr|constitu|criminal|tort/.test(s)) return "law";
  if (/business|account|financ|market|manage|econom/.test(s)) return "business";
  if (/histor|philosoph|sociolog|psycholog|politic|anthro/.test(s)) return "humanities";
  if (/english|linguist|french|spanish|german|literature|writing/.test(s)) return "languages";
  if (/art|music|architect|film|design|drama/.test(s)) return "arts";
  return "general";
}
