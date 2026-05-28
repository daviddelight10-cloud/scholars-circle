const fs = require('fs');
const path = 'c:\\Users\\Delight\\Downloads\\Phone Link\\scholar\'s circle\\server\\prisma\\schema.prisma';
let content = fs.readFileSync(path, 'utf8');

const enumText = `enum AnnouncementPriority {

  LOW

  NORMAL

  HIGH

  CRITICAL

}

`;

const pattern = /(enum AnnouncementCategory \{[^\}]+\}\n)/;
const match = content.match(pattern);
if (match) {
  const insertPos = match.index + match[0].length;
  content = content.slice(0, insertPos) + '\n' + enumText + content.slice(insertPos);
  fs.writeFileSync(path, content);
  console.log('Inserted AnnouncementPriority enum');
} else {
  console.log('Pattern not found');
}
