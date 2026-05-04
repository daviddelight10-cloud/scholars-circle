const fs = require('fs');
const path = require('path');

// Read the HTML file
const htmlContent = fs.readFileSync('bio111_200q.html', 'utf8');

// Find the ALLQ array start and end positions
const startMarker = 'const ALLQ = [';
const startIdx = htmlContent.lastIndexOf(startMarker);
if (startIdx === -1) {
  console.error('Could not find ALLQ array in HTML file');
  process.exit(1);
}

// Find the matching closing ]; by scanning from the opening [
let depth = 0;
let endIdx = -1;
for (let i = startIdx + startMarker.length - 1; i < htmlContent.length; i++) {
  if (htmlContent[i] === '[') depth++;
  else if (htmlContent[i] === ']') {
    depth--;
    if (depth === 0) {
      // Check if followed by ;
      endIdx = i + 1;
      break;
    }
  }
}

if (endIdx === -1) {
  console.error('Could not find end of ALLQ array');
  process.exit(1);
}

// Extract just the array literal [...]
const arrayLiteral = htmlContent.slice(startIdx + startMarker.length - 1, endIdx);
console.log('Array literal length:', arrayLiteral.length);

// Write to a temp file and require it
const tmpFile = path.resolve('_tmp_allq.cjs');
fs.writeFileSync(tmpFile, 'module.exports = ' + arrayLiteral + ';');

let ALLQ;
try {
  ALLQ = require(tmpFile);
} finally {
  fs.unlinkSync(tmpFile);
}

console.log('Parsed questions count:', ALLQ.length);

const questions = ALLQ.map(item => ({
  q: item.q,
  options: item.o,
  answer: item.a,
  explanation: item.e,
  difficulty: 'medium',
  year: '2026'
}));

console.log(`Extracted ${questions.length} questions`);

// Save to JSON file
fs.writeFileSync('bio111_200q_extracted.json', JSON.stringify(questions, null, 2));
console.log('Saved to bio111_200q_extracted.json');
