const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

prisma.user.updateMany({
  where: { role: 'TEACHER' },
  data: { isActivated: true }
}).then(result => {
  console.log('Activated teachers:', result.count);
  return prisma.$disconnect();
}).catch(e => {
  console.error('Error:', e.message);
  prisma.$disconnect();
});
