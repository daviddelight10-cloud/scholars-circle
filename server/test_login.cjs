const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function testLogin() {
  const login = 'teacher';
  const password = 'teacher123';
  
  const user = await prisma.user.findFirst({
    where: { OR: [{ email: login }, { username: login }] },
  });
  
  if (!user) {
    console.log('User not found');
    await prisma.$disconnect();
    return;
  }
  
  console.log('User found:', user.username, user.email, user.isActivated);
  
  const ok = await bcrypt.compare(password, user.passwordHash);
  console.log('Password match:', ok);
  
  await prisma.$disconnect();
}

testLogin().catch(e => {
  console.error('Error:', e.message);
  prisma.$disconnect();
});
