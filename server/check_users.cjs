const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

prisma.user.findMany().then(users => {
  console.log('Users in database:');
  console.log(JSON.stringify(users, null, 2));
  prisma.$disconnect();
}).catch(e => {
  console.error('Error:', e.message);
  prisma.$disconnect();
});
