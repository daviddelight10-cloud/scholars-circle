const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkProgress() {
  const progress = await prisma.userProgress.findMany();
  console.log('UserProgress records:');
  progress.forEach(p => {
    console.log('ID:', p.id, 'userId:', p.userId);
  });
  
  const timetable = await prisma.userTimetable.findMany();
  console.log('\nUserTimetable records:');
  timetable.forEach(t => {
    console.log('ID:', t.id, 'userId:', t.userId);
  });
  
  await prisma.$disconnect();
}

checkProgress().catch(e => {
  console.error('Error:', e.message);
  prisma.$disconnect();
});
