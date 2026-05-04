import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const teacherPass = await bcrypt.hash("teacher123", 10);
  const studentPass = await bcrypt.hash("student123", 10);

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

  const bio = await prisma.subject.upsert({
    where: { label: "BIO 111" },
    update: {},
    create: { label: "BIO 111", description: "Phylum Chordata & Class Pisces" },
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
