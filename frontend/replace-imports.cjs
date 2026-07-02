const fs = require('fs');
const path = require('path');

function replaceInDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      replaceInDir(fullPath);
    } else if (fullPath.endsWith('.jsx') || fullPath.endsWith('.js')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      content = content.replace(/import api from '\.\.\/api';/g, "import api from '../services/apiClient';");
      fs.writeFileSync(fullPath, content);
    }
  }
}

replaceInDir(path.join(__dirname, 'src'));
console.log('Replaced imports successfully.');
