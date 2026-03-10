// Usage: node set-cookie.js <paste your cookie here>
// Example: node set-cookie.js "auth-refresh-token=eyJ..."
// Or just: node set-cookie.js eyJhbGci...

const fs = require('fs');
const path = require('path');

const cookie = process.argv.slice(2).join(' ').trim();

if (!cookie) {
  // Check current status
  const file = path.join(__dirname, '.axiom-cookie');
  try {
    const val = fs.readFileSync(file, 'utf-8').trim();
    if (val) {
      console.log('Axiom cookie is SET (' + val.length + ' chars)');
      console.log('Preview: ' + val.slice(0, 40) + '...');
    } else {
      console.log('Axiom cookie is EMPTY');
    }
  } catch {
    console.log('Axiom cookie is NOT SET');
  }
  console.log('\nUsage: node set-cookie.js <your-cookie-value>');
  console.log('       node set-cookie.js clear');
  process.exit(0);
}

const file = path.join(__dirname, '.axiom-cookie');

if (cookie === 'clear') {
  try { fs.unlinkSync(file); } catch {}
  console.log('Axiom cookie cleared.');
  process.exit(0);
}

fs.writeFileSync(file, cookie, 'utf-8');
console.log('Axiom cookie saved (' + cookie.length + ' chars)');
console.log('It will be picked up on the next search request — no restart needed.');
