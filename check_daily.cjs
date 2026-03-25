const XLSX = require('xlsx');

const wb = XLSX.readFile('Report AR Finance Test (1) - FIXED_DATES.xlsx');
const daily = XLSX.utils.sheet_to_json(wb.Sheets['Daily']);

console.log('Total Daily rows:', daily.length);

// Check for rows without Bill No or Date
const validRows = daily.filter(r => r['Bill No'] && r['Date']);
const invalidRows = daily.filter(r => !r['Bill No'] || !r['Date']);

console.log('Valid rows (with Bill No + Date):', validRows.length);
console.log('Invalid rows (missing Bill No or Date):', invalidRows.length);

if (invalidRows.length > 0) {
  console.log('\nFirst 10 invalid rows:');
  invalidRows.slice(0, 10).forEach((r, i) => {
    console.log(`${i + 1}. Bill No: ${r['Bill No']}, Date: ${r['Date']}, Grand Total: ${r['Grand Total']}`);
  });
}

// Check for duplicates
const seen = new Map();
const duplicates = [];
daily.forEach(r => {
  const key = `${r['Bill No']}__${r['Date']}__${r['Workload']}`;
  if (seen.has(key)) {
    duplicates.push(r);
  } else {
    seen.set(key, r);
  }
});

console.log('\nDuplicate rows:', duplicates.length);
console.log('Unique rows after dedup:', seen.size);

// Calculate expected totals
const grandTotal = daily.reduce((s, r) => s + (r['Grand Total'] || 0), 0);
const cash = daily.reduce((s, r) => s + (r['Cash Received'] || 0), 0);
const bcel = daily.reduce((s, r) => s + (r['Transfer Payment by BCEL'] || 0), 0);
const ldb = daily.reduce((s, r) => s + (r['Transfer Payment by LDB'] || 0), 0);
const debt = daily.reduce((s, r) => s + (r['Outstanding Debt'] || 0), 0);

console.log('\n=== Expected Dashboard Values ===');
console.log('Total Sales (Grand Total):', grandTotal.toLocaleString());
console.log('Billing Collections (Cash+BCEL+LDB):', (cash + bcel + ldb).toLocaleString());
console.log('  - Cash:', cash.toLocaleString());
console.log('  - BCEL:', bcel.toLocaleString());
console.log('  - LDB:', ldb.toLocaleString());
console.log('Outstanding Debt:', debt.toLocaleString());
console.log('Daily Income (Grand Total - Debt):', (grandTotal - debt).toLocaleString());
