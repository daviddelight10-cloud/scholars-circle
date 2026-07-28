const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkOrphans() {
  const users = await prisma.user.findMany();
  const userIds = users.map(u => u.id);
  console.log('User IDs:', userIds);
  
  const progress = await prisma.userProgress.findMany();
  console.log('\nUserProgress records:', progress.length);
  progress.forEach(p => {
    if (!userIds.includes(p.userId)) {
      console.log('Orphan UserProgress:', p.id, 'userId:', p.userId);
    }
  });
  
  const timetable = await prisma.userTimetable.findMany();
  console.log('\nUserTimetable records:', timetable.length);
  timetable.forEach(t => {
    if (!userIds.includes(t.userId)) {
      console.log('Orphan UserTimetable:', t.id, 'userId:', t.userId);
    }
  });
  
  await prisma.$disconnect();
}

checkOrphans().catch(e => {
  console.error('Error:', e.message);
  prisma.$disconnect();
});
