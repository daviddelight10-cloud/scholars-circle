const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Get BIO 111 subject and questions
  const bio = await prisma.subject.findFirst({ 
    where: { label: 'BIO 111' },
    include: { 
      questions: { 
        select: { 
          id: true, 
          question: true,
          optionA: true,
          optionB: true,
          answerIndex: true
        } 
      } 
    } 
  });
  
  console.log('BIO 111 questions:', bio?.questions?.length || 0);
  console.log('\n--- First 30 questions ---\n');
  
  bio?.questions?.slice(0, 30).forEach((q, i) => {
    console.log(`${i+1}. ${q.question.substring(0, 80)}...`);
    console.log(`   Options: ${q.optionA?.substring(0,20)}, ${q.optionB?.substring(0,20)}...`);
    console.log('');
  });
  
  // Check for GST-like questions
  console.log('\n--- Checking for GST-related questions ---\n');
  const gstKeywords = ['Nigeria', 'government', 'constitution', 'political', 'citizen', 'democracy', 'federal', 'state', 'law', 'governance'];
  
  const possibleGst = bio?.questions?.filter(q => {
    const text = q.question.toLowerCase();
    return gstKeywords.some(kw => text.includes(kw.toLowerCase()));
  }) || [];
  
  console.log(`Found ${possibleGst.length} possible GST questions:`);
  possibleGst.forEach((q, i) => {
    console.log(`${i+1}. ${q.question}`);
    console.log('');
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(e => { console.error(e); prisma.$disconnect(); });
