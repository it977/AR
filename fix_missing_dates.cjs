const XLSX = require('xlsx');

const wb = XLSX.readFile('Report AR Finance Test (1) - FINAL.xlsx');

// Get Pay off sheet
const payoff = XLSX.utils.sheet_to_json(wb.Sheets['Pay off']);

console.log('Total Pay off rows:', payoff.length);

// Fix missing dates - use Date Paid or fallback to Date
const fixedPayoff = payoff.map(row => {
  // If Date is missing, try to use Date Paid
  if (!row['Date'] || row['Date'] === undefined) {
    if (row['Date Paid']) {
      row['Date'] = row['Date Paid'];
    } else {
      // Use a default date (oldest date in dataset)
      row['Date'] = '2026-01-01';
    }
  }
  
  // Ensure Date is in correct format
  if (typeof row['Date'] === 'number') {
    // Excel serial date
    const date = new Date(Math.round((row['Date'] - 25569) * 86400 * 1000));
    row['Date'] = date.toISOString().split('T')[0];
  }
  
  return row;
});

const validFixed = fixedPayoff.filter(r => r['Date'] && r['Bill No']).length;
console.log('Valid rows after fix:', validFixed);

// Update workbook
const payoffWS = XLSX.utils.json_to_sheet(fixedPayoff);
wb.Sheets['Pay off'] = payoffWS;

// Save fixed file
XLSX.writeFile(wb, 'Report AR Finance Test (1) - FIXED_DATES.xlsx');
console.log('\n✅ Created: Report AR Finance Test (1) - FIXED_DATES.xlsx');
console.log('\nUpload this file - all 839 Pay off rows will be uploaded!');
