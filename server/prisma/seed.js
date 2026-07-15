import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Seed demo users — skip if username/email already taken
  try {
    const teacherPass = await bcrypt.hash("teacher123", 10);
    await prisma.user.upsert({
      where: { email: "teacher@example.com" },
      update: {},
      create: {
        email: "teacher@example.com",
        username: "teacher",
        passwordHash: teacherPass,
        role: "TEACHER",
        isActivated: true,
      },
    });
  } catch (e) {
    if (e.code !== "P2002") throw e;
    console.log("Skipping demo teacher — username/email already exists.");
  }

  try {
    const studentPass = await bcrypt.hash("student123", 10);
    await prisma.user.upsert({
      where: { email: "student@example.com" },
      update: {},
      create: {
        email: "student@example.com",
        username: "student",
        passwordHash: studentPass,
        role: "STUDENT",
      },
    });
  } catch (e) {
    if (e.code !== "P2002") throw e;
    console.log("Skipping demo student — username/email already exists.");
  }

  // Seed medical departments (11 medical programs)
  const deptData = [
    { name: "Medicine & Surgery", icon: "🩺" },
    { name: "Medical Laboratory Science", icon: "🔬" },
    { name: "Nursing", icon: "💉" },
    { name: "Radiography", icon: "📡" },
    { name: "Dentistry", icon: "🦷" },
    { name: "Paediatrics", icon: "👶" },
    { name: "Dermatology", icon: "🧴" },
    { name: "Physiotherapy", icon: "🏃" },
    { name: "Biochemistry", icon: "🧬" },
    { name: "Anatomy", icon: "🦴" },
    { name: "Microbiology", icon: "🦠" },
  ];

  const depts = {};
  for (const d of deptData) {
    const dept = await prisma.department.upsert({
      where: { name: d.name },
      update: { icon: d.icon },
      create: d,
    });
    depts[d.name] = dept;
  }

  // Seed medical subjects
  const subjectData = [
    { label: "Anatomy", description: "Human body structure and organization", icon: "🦴", dept: "Anatomy", year: 1 },
    { label: "Physiology", description: "Normal body functions", icon: "🫀", dept: "Medicine & Surgery", year: 1 },
    { label: "Biochemistry", description: "Chemical processes in living organisms", icon: "🧬", dept: "Biochemistry", year: 1 },
    { label: "Pharmacology", description: "Drug actions and interactions", icon: "💊", dept: "Medicine & Surgery", year: 3 },
    { label: "Pathology", description: "Disease processes", icon: "🔬", dept: "Medicine & Surgery", year: 3 },
    { label: "Microbiology", description: "Microorganisms and infectious diseases", icon: "🦠", dept: "Microbiology", year: 2 },
    { label: "Internal Medicine", description: "Adult clinical medicine", icon: "🩺", dept: "Medicine & Surgery", year: 4 },
    { label: "Surgery", description: "Surgical principles and practice", icon: "🔪", dept: "Medicine & Surgery", year: 4 },
    { label: "Obstetrics & Gynaecology", description: "Women's reproductive health", icon: "🤰", dept: "Medicine & Surgery", year: 5 },
    { label: "Paediatrics", description: "Child health and diseases", icon: "👶", dept: "Paediatrics", year: 5 },
    { label: "Nursing Science", description: "Nursing practice and patient care", icon: "💉", dept: "Nursing", year: 1 },
    { label: "Radiography", description: "Medical imaging techniques", icon: "📡", dept: "Radiography", year: 2 },
    { label: "Dentistry", description: "Oral and dental health", icon: "🦷", dept: "Dentistry", year: 3 },
    { label: "Dermatology", description: "Skin diseases and treatment", icon: "🧴", dept: "Dermatology", year: 4 },
    { label: "Physiotherapy", description: "Physical rehabilitation and movement", icon: "🏃", dept: "Physiotherapy", year: 2 },
  ];

  const subjects = {};
  for (const s of subjectData) {
    const subj = await prisma.subject.upsert({
      where: { label: s.label },
      update: { departmentId: depts[s.dept].id, yearLevel: s.year, icon: s.icon },
      create: {
        label: s.label,
        description: s.description,
        icon: s.icon,
        departmentId: depts[s.dept].id,
        yearLevel: s.year,
      },
    });
    subjects[s.label] = subj;
  }

  // Seed medical sample questions
  const sampleQuestions = [
    {
      subjectLabel: "Anatomy",
      question: "Which cranial nerve provides taste sensation from the anterior two-thirds of the tongue?",
      optionA: "Glossopharyngeal (IX)", optionB: "Facial (VII)", optionC: "Vagus (X)", optionD: "Trigeminal (V)",
      answerIndex: 1, difficulty: "medium", explanation: "The facial nerve (CN VII) provides taste to anterior two-thirds via chorda tympani.", year: 2024,
    },
    {
      subjectLabel: "Physiology",
      question: "Normal resting membrane potential of a neuron is approximately:",
      optionA: "-90 mV", optionB: "-70 mV", optionC: "-55 mV", optionD: "+30 mV",
      answerIndex: 1, difficulty: "easy", explanation: "Resting membrane potential is approximately -70 mV, maintained by Na+/K+ ATPase.", year: 2024,
    },
    {
      subjectLabel: "Pharmacology",
      question: "Which receptor does salbutamol primarily act on?",
      optionA: "Alpha-1", optionB: "Beta-1", optionC: "Beta-2", optionD: "Muscarinic",
      answerIndex: 2, difficulty: "easy", explanation: "Salbutamol is a selective beta-2 agonist causing bronchodilation.", year: 2024,
    },
    {
      subjectLabel: "Pathology",
      question: "Which cell type is predominant in acute inflammation?",
      optionA: "Lymphocytes", optionB: "Neutrophils", optionC: "Macrophages", optionD: "Eosinophils",
      answerIndex: 1, difficulty: "easy", explanation: "Neutrophils predominate in acute inflammation (first 24-48h).", year: 2024,
    },
    {
      subjectLabel: "Microbiology",
      question: "Which staining technique identifies Mycobacterium tuberculosis?",
      optionA: "Gram stain", optionB: "Ziehl-Neelsen stain", optionC: "Giemsa stain", optionD: "India ink",
      answerIndex: 1, difficulty: "easy", explanation: "Ziehl-Neelsen (acid-fast) stain identifies Mycobacterium species.", year: 2024,
    },
    {
      subjectLabel: "Internal Medicine",
      question: "What is the diagnostic cutoff for fasting blood glucose in diabetes mellitus?",
      optionA: ">5.6 mmol/L", optionB: ">6.1 mmol/L", optionC: ">7.0 mmol/L", optionD: ">11.1 mmol/L",
      answerIndex: 2, difficulty: "easy", explanation: "Fasting plasma glucose >7.0 mmol/L on two occasions diagnoses diabetes.", year: 2024,
    },
    {
      subjectLabel: "Surgery",
      question: "Which sign is most suggestive of peritonitis on abdominal examination?",
      optionA: "Borborygmi", optionB: "Rebound tenderness", optionC: "Hepatomegaly", optionD: "Ascites",
      answerIndex: 1, difficulty: "easy", explanation: "Rebound tenderness (Blumberg's sign) indicates peritoneal inflammation.", year: 2024,
    },
    {
      subjectLabel: "Obstetrics & Gynaecology",
      question: "Magnesium sulfate is used in pre-eclampsia to:",
      optionA: "Lower blood pressure", optionB: "Prevent seizures", optionC: "Induce labor", optionD: "Reduce proteinuria",
      answerIndex: 1, difficulty: "medium", explanation: "Magnesium sulfate is the drug of choice for eclampsia prophylaxis.", year: 2024,
    },
    {
      subjectLabel: "Paediatrics",
      question: "In IMCI, a child classified as 'PINK' requires:",
      optionA: "Home management", optionB: "Treatment at health facility", optionC: "Urgent referral to hospital", optionD: "Observation only",
      answerIndex: 2, difficulty: "easy", explanation: "PINK classification means severe disease requiring urgent hospital referral.", year: 2024,
    },
    {
      subjectLabel: "Nursing Science",
      question: "The correct order of the nursing process is:",
      optionA: "Diagnosis, Assessment, Planning, Implementation, Evaluation", optionB: "Assessment, Diagnosis, Planning, Implementation, Evaluation", optionC: "Planning, Assessment, Diagnosis, Evaluation, Implementation", optionD: "Assessment, Planning, Diagnosis, Implementation, Evaluation",
      answerIndex: 1, difficulty: "easy", explanation: "The nursing process follows ADPIE: Assessment, Diagnosis, Planning, Implementation, Evaluation.", year: 2024,
    },
    {
      subjectLabel: "Biochemistry",
      question: "The net ATP yield from glycolysis of one glucose molecule is:",
      optionA: "2 ATP", optionB: "4 ATP", optionC: "32 ATP", optionD: "36 ATP",
      answerIndex: 0, difficulty: "easy", explanation: "Glycolysis produces 4 ATP but consumes 2, netting 2 ATP per glucose.", year: 2024,
    },
    {
      subjectLabel: "Radiography",
      question: "Which imaging modality does NOT use ionizing radiation?",
      optionA: "X-ray", optionB: "CT scan", optionC: "MRI", optionD: "Fluoroscopy",
      answerIndex: 2, difficulty: "easy", explanation: "MRI uses magnetic fields and radio waves, not ionizing radiation.", year: 2024,
    },
    {
      subjectLabel: "Dentistry",
      question: "The hardest tissue in the human body is:",
      optionA: "Dentin", optionB: "Enamel", optionC: "Cementum", optionD: "Bone",
      answerIndex: 1, difficulty: "easy", explanation: "Enamel is 96% inorganic hydroxyapatite, making it the hardest tissue.", year: 2024,
    },
    {
      subjectLabel: "Dermatology",
      question: "A raised, fluid-filled lesion greater than 1cm is called a:",
      optionA: "Vesicle", optionB: "Bulla", optionC: "Pustule", optionD: "Wheal",
      answerIndex: 1, difficulty: "easy", explanation: "A bulla is a fluid-filled blister >1cm. A vesicle is <1cm.", year: 2024,
    },
    {
      subjectLabel: "Physiotherapy",
      question: "In a normal gait cycle, the stance phase constitutes approximately:",
      optionA: "30%", optionB: "40%", optionC: "60%", optionD: "80%",
      answerIndex: 2, difficulty: "easy", explanation: "Stance phase is ~60% of the gait cycle, swing phase ~40%.", year: 2024,
    },
  ];

  for (const q of sampleQuestions) {
    const subj = subjects[q.subjectLabel];
    if (!subj) continue;
    await prisma.question.createMany({
      data: [{
        subjectId: subj.id,
        question: q.question,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        answerIndex: q.answerIndex,
        difficulty: q.difficulty,
        explanation: q.explanation,
        year: q.year,
      }],
      skipDuplicates: true,
    });
  }
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
