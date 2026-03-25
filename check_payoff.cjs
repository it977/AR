const XLSX = require('xlsx');

const wb = XLSX.readFile('Report AR Finance Test (1) - FINAL.xlsx');
const payoff = XLSX.utils.sheet_to_json(wb.Sheets['Pay off']);

console.log('Pay off rows:', payoff.length);

// Check for rows without Bill No or Date
const validRows = payoff.filter(r => r['Bill No'] && r['Date']);
const invalidRows = payoff.filter(r => !r['Bill No'] || !r['Date']);

console.log('Valid rows (with Bill No + Date):', validRows.length);
console.log('Invalid rows (missing Bill No or Date):', invalidRows.length);

if (invalidRows.length > 0) {
  console.log('\nFirst 5 invalid rows:');
  invalidRows.slice(0, 5).forEach((r, i) => {
    console.log(`${i + 1}. Bill No: ${r['Bill No']}, Date: ${r['Date']}, Amount: ${r['Amount Paid']}`);
  });
}

// Check for duplicates
const seen = new Set();
const duplicates = [];
payoff.forEach(r => {
  const key = `${r['Bill No']}__${r['Date']}`;
  if (seen.has(key)) {
    duplicates.push(r);
  } else {
    seen.add(key);
  }
});

console.log('\nDuplicate rows:', duplicates.length);
if (duplicates.length > 0) {
  console.log('First 5 duplicates:');
  duplicates.slice(0, 5).forEach((r, i) => {
    console.log(`${i + 1}. Bill No: ${r['Bill No']}, Date: ${r['Date']}`);
  });
}

console.log('\nUnique rows after dedup:', seen.size);
