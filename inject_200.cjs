const fs = require('fs');
const raw = require('./q200_raw.json');

const newQuestions = raw.map(q => ({
  q: q.q,
  options: q.o.map(o => o.replace(/^[A-D]\.\s+/, '')),
  answer: 'ABCD'.indexOf(q.a[0]),
  explanation: q.e,
  difficulty: 'medium',
  year: '2026'
}));

let dataJs = fs.readFileSync('src/data.js', 'utf8');

// Remove previously added year:"2026" questions from bio111 section
const bio112Marker = '  {\n    id: "bio112"';
const bio112Pos = dataJs.indexOf(bio112Marker);
const bio111Part = dataJs.slice(0, bio112Pos);

const first2026 = bio111Part.indexOf('\n        year: "2026"');
if (first2026 !== -1) {
  const blockStart = bio111Part.lastIndexOf('\n      {', first2026);
  dataJs = dataJs.slice(0, blockStart) + '\n    ],\n  },\n' + dataJs.slice(bio112Pos);
  console.log('Removed old year:2026 questions');
}

// Find injection point (closing ], of bio111 questions)
const bio112Pos2 = dataJs.indexOf(bio112Marker);
const bio111Part2 = dataJs.slice(0, bio112Pos2);
const closingBracketPos = bio111Part2.lastIndexOf('\n    ],');

const newQLines = newQuestions.map(q =>
  `      {\n        q: ${JSON.stringify(q.q)},\n        options: ${JSON.stringify(q.options)},\n        answer: ${q.answer},\n        explanation: ${JSON.stringify(q.explanation)},\n        difficulty: "medium",\n        year: "2026",\n      },`
).join('\n');

const newDataJs = dataJs.slice(0, closingBracketPos) + '\n' + newQLines + dataJs.slice(closingBracketPos);
fs.writeFileSync('src/data.js', newDataJs);
console.log(`Injected ${newQuestions.length} questions into BIO-111`);
