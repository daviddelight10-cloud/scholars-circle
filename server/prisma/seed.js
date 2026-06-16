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

  // Seed departments
  const deptData = [
    { name: "Medicine", icon: "🩺" },
    { name: "Nursing", icon: "💉" },
    { name: "Medical Laboratory Science", icon: "🔬" },
    { name: "Pharmacy", icon: "💊" },
    { name: "Dentistry", icon: "🦷" },
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

  // Assign BIO 111 to Medicine Year 1
  const bio = await prisma.subject.upsert({
    where: { label: "BIO 111" },
    update: { departmentId: depts["Medicine"].id, yearLevel: 1 },
    create: {
      label: "BIO 111",
      description: "Phylum Chordata & Class Pisces",
      departmentId: depts["Medicine"].id,
      yearLevel: 1,
    },
  });

  await prisma.question.createMany({
    data: [
      {
        subjectId: bio.id,
        question: "Which is NOT a chordate characteristic?",
        optionA: "Notochord",
        optionB: "Dorsal hollow nerve cord",
        optionC: "Pharyngeal slits",
        optionD: "Ventral solid nerve cord",
        answerIndex: 3,
        difficulty: "medium",
        explanation: "Chordates have dorsal hollow nerve cords.",
        year: 2024,
      },
    ],
    skipDuplicates: true,
  });
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
