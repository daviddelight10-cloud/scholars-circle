const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const questions = await prisma.question.findMany({
    where: { subjectId: 'gst115' }
  });
  console.log('GST 115 questions in DB:', questions.length);
  if (questions.length > 0) {
    console.log('\nFirst 5 questions:');
    questions.slice(0, 5).forEach((q, i) => {
      console.log(`${i + 1}. ${q.questionText?.substring(0, 80)}...`);
    });
  }
  await prisma.$disconnect();
}

check();
