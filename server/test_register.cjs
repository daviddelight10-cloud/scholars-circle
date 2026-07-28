const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testRegister() {
  try {
    const user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        username: 'testuser',
        passwordHash: '$2a$10$test',
        role: 'STUDENT',
        activationKey: 'TEST123',
        isActivated: false,
      },
    });
    console.log('Created user:', user.id, user.username);
    await prisma.user.delete({ where: { id: user.id } });
    console.log('Test user deleted');
  } catch (e) {
    console.error('Registration test error:', e.message, e.code);
  }
  await prisma.$disconnect();
}

testRegister();
