const fs = require('fs');

const questions = JSON.parse(fs.readFileSync('bio111_200q_extracted.json', 'utf8'));

const dataJs = fs.readFileSync('src/data.js', 'utf8');

// Build the lines to insert (formatted like existing questions)
const newQLines = questions.map(q => {
  const opts = JSON.stringify(q.options);
  const exp = q.explanation.replace(/\\/g, '\\\\').replace(/`/g, '\\`');
  return `      {\n        q: ${JSON.stringify(q.q)},\n        options: ${opts},\n        answer: ${q.answer},\n        explanation: ${JSON.stringify(q.explanation)},\n        difficulty: "medium",\n        year: "2026",\n      },`;
}).join('\n');

// Find the closing of bio111 questions array (before bio112 section)
// We look for the pattern that ends bio111 questions
// Find the last question before bio112 — look for the closing of bio111's questions array
const bio112Idx = dataJs.indexOf('    id: "bio112"');
if (bio112Idx === -1) {
  console.error('Could not find bio112 in data.js');
  process.exit(1);
}

// Work backwards from bio112 to find '    ],' which closes bio111 questions array
const beforeBio112 = dataJs.slice(0, bio112Idx);
const closingBracketIdx = beforeBio112.lastIndexOf('    ],');
if (closingBracketIdx === -1) {
  console.error('Could not find closing bracket of bio111 questions');
  process.exit(1);
}

const before = dataJs.slice(0, closingBracketIdx);
const after = dataJs.slice(closingBracketIdx);

const newDataJs = before + '\n' + newQLines + '\n' + after;

fs.writeFileSync('src/data.js', newDataJs);
console.log(`Injected ${questions.length} questions into src/data.js`);
