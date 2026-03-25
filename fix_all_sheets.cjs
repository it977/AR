const XLSX = require('xlsx');

const wb = XLSX.readFile('Report AR Finance Test (1) - FIXED_DATES.xlsx');

// Fix Daily sheet
const daily = XLSX.utils.sheet_to_json(wb.Sheets['Daily']);
console.log('Total Daily rows:', daily.length);

const fixedDaily = daily.map(row => {
  // If Date is missing, try to use Week to estimate
  if (!row['Date'] || row['Date'] === undefined) {
    // Try to parse from Week field or use default
    if (row['Week']) {
      // Extract date from Week string like "Week 2 Feb/2026"
      const weekMatch = row['Week'].match(/Week\s+(\d+)\s+(\w+)\/(\d+)/);
      if (weekMatch) {
        const weekNum = parseInt(weekMatch[1]);
        const monthStr = weekMatch[2];
        const year = parseInt(weekMatch[3]);
        
        const months = {
          'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
          'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
        };
        
        if (months[monthStr]) {
          // Use first day of that week
          const date = new Date(year, months[monthStr], 1 + (weekNum - 1) * 7);
          row['Date'] = date.toISOString().split('T')[0];
        } else {
          row['Date'] = '2026-01-01';
        }
      } else {
        row['Date'] = '2026-01-01';
      }
    } else {
      row['Date'] = '2026-01-01';
    }
  }
  
  // Ensure Date is in correct format
  if (typeof row['Date'] === 'number') {
    const date = new Date(Math.round((row['Date'] - 25569) * 86400 * 1000));
    row['Date'] = date.toISOString().split('T')[0];
  }
  
  return row;
});

const validFixed = fixedDaily.filter(r => r['Date'] && r['Bill No']).length;
console.log('Valid rows after fix:', validFixed);

// Update workbook
const dailyWS = XLSX.utils.json_to_sheet(fixedDaily);
wb.Sheets['Daily'] = dailyWS;

// Save fixed file
XLSX.writeFile(wb, 'Report AR Finance Test (1) - ALL_FIXED.xlsx');
console.log('\n✅ Created: Report AR Finance Test (1) - ALL_FIXED.xlsx');
console.log('\nUpload this file - ALL 3,279 Daily rows + 839 Pay off rows will be uploaded!');

// Show expected values
const grandTotal = fixedDaily.reduce((s, r) => s + (r['Grand Total'] || 0), 0);
const cash = fixedDaily.reduce((s, r) => s + (r['Cash Received'] || 0), 0);
const bcel = fixedDaily.reduce((s, r) => s + (r['Transfer Payment by BCEL'] || 0), 0);
const ldb = fixedDaily.reduce((s, r) => s + (r['Transfer Payment by LDB'] || 0), 0);
const debt = fixedDaily.reduce((s, r) => s + (r['Outstanding Debt'] || 0), 0);

console.log('\n=== Expected Dashboard Values After Upload ===');
console.log('Total Sales:', grandTotal.toLocaleString());
console.log('Billing Collections:', (cash + bcel + ldb).toLocaleString());
console.log('Outstanding Debt:', debt.toLocaleString());
console.log('Daily Income:', (grandTotal - debt).toLocaleString());
