const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const subjects = await prisma.subject.findMany();
  console.log('Subjects:', subjects);
  
  for (const s of subjects) {
    const count = await prisma.question.count({ where: { subjectId: s.id } });
    console.log(`${s.label} (id: ${s.id}): ${count} questions`);
  }
  
  const bio111Questions = await prisma.question.findMany({ where: { subjectId: 1 } });
  console.log('\nBIO-111 questions:', bio111Questions.length);
}

main().then(() => prisma.$disconnect()).catch(console.error);
