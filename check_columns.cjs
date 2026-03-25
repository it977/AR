const XLSX = require('xlsx');

const wb = XLSX.readFile('Report AR Finance Test (1) - ALL_FIXED.xlsx');
const daily = XLSX.utils.sheet_to_json(wb.Sheets['Daily']);

console.log('=== Column Names in Daily Sheet ===\n');

// Get all unique column names
const allKeys = new Set();
daily.forEach(row => {
  Object.keys(row).forEach(key => allKeys.add(key));
});

console.log('Columns found:');
Array.from(allKeys).sort().forEach(key => {
  console.log(`  - "${key}"`);
});

// Check for expected columns
const expectedColumns = [
  'Total', 'Discounts', 'Grand Total', 'Cash Received',
  'Transfer Payment by BCEL', 'Transfer Payment by BCEL2', 'Transfer Payment by LDB',
  'OPD', 'IPD', 'Diag & Image Services', 'Surg / OT Services',
  'Emergency Services', 'Chronic & Prev Services', 'Pharma & Consumables',
  'Supporting & Ancillary Services', 'Admin & Non-Clinical Services', 'Home care Services'
];

console.log('\n=== Expected vs Actual ===');
expectedColumns.forEach(col => {
  const found = allKeys.has(col);
  console.log(`${found ? '✅' : '❌'} "${col}"`);
});

// Check first row data
console.log('\n=== First Row Sample ===');
console.log(JSON.stringify(daily[0], null, 2));
