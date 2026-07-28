const fs = require('fs');
const d = fs.readFileSync('src/data.js', 'utf8');
const count = d.split('year: "2026"').length - 1;
console.log('year:2026 questions in data.js:', count);
