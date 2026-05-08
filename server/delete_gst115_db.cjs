process.env.DATABASE_URL = 'YOUR_DATABASE_URL_HERE';
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteGst115Questions() {
  try {
    // First, find the GST 115 subject
    const subject = await prisma.subject.findFirst({
      where: {
        OR: [
          { id: 'gst115' },
          { label: { contains: 'GST 115' } },
          { label: { contains: 'GST-115' } }
        ]
      }
    });
    
    if (subject) {
      console.log('Found GST 115 subject:', subject.id, subject.label);
      
      // Delete all questions for this subject
      const result = await prisma.question.deleteMany({
        where: { subjectId: subject.id }
      });
      
      console.log(`Deleted ${result.count} GST 115 questions from database`);
    } else {
      console.log('GST 115 subject not found in database');
      
      // List all subjects to help debug
      const allSubjects = await prisma.subject.findMany({
        select: { id: true, label: true }
      });
      console.log('\nAll subjects in database:');
      allSubjects.forEach(s => console.log(`- ${s.id}: ${s.label}`));
    }
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

deleteGst115Questions();
