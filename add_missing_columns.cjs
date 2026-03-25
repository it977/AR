const XLSX = require('xlsx');

const wb = XLSX.readFile('Report AR Finance Test (1) - ALL_FIXED.xlsx');
const daily = XLSX.utils.sheet_to_json(wb.Sheets['Daily']);

console.log('Adding missing columns to Daily sheet...\n');

// Add missing columns with default values
const fixedDaily = daily.map(row => {
  // Calculate Total = Grand Total + Outstanding Debt (reverse calculation)
  const grandTotal = row['Grand Total'] || 0;
  const outstanding = row['Outstanding Debt'] || 0;
  const cash = row['Cash Received'] || 0;
  const bcel = row['Transfer Payment by BCEL'] || 0;
  const bcel2 = row['Transfer Payment by BCEL 2'] || 0;
  const ldb = row['Transfer Payment by LDB'] || 0;
  
  // Total = sum of all payments + outstanding
  const total = cash + bcel + bcel2 + ldb + outstanding;
  
  // Discounts = Total - Grand Total (if positive)
  const discounts = Math.max(0, total - grandTotal);
  
  return {
    'Date': row['Date'],
    'Week': row['Week'] || '',
    'Workload': row['Workload'],
    'Bill No': row['Bill No'],
    'Insite-Onsite': row['Insite-Onsite'] || '',
    'OPD-IPD': row['OPD-IPD'] || '',
    'Customer Type Code': row['Customer Type Code'],
    'Insurance': row['Insurance'],
    'HN': row['HN'],
    'Customer Name': row['Customer Name'],
    'Gender': row['Gender'],
    'OPD': 0,  // Service columns not in source data
    'Diag & Image Services': 0,
    'IPD': 0,
    'Surg / OT Services': 0,
    'Emergency Services': 0,
    'Chronic & Prev Services': 0,
    'Pharma & Consumables': 0,
    'Supporting & Ancillary Services': 0,
    'Admin & Non-Clinical Services': 0,
    'Home care Services': 0,
    'Total': total,
    'Discounts': discounts,
    'Grand Total': grandTotal,
    'Cash Received': cash,
    'Transfer Payment by BCEL': bcel,
    'Transfer Payment by BCEL2': bcel2,  // Use correct column name
    'Transfer Payment by LDB': ldb,
    'Outstanding Debt': outstanding,
    'Prepayment': 0,
    'Note': '',
    'Aging Group': row['Aging Group'] || '',
  };
});

// Update workbook
const dailyWS = XLSX.utils.json_to_sheet(fixedDaily);
wb.Sheets['Daily'] = dailyWS;

// Save fixed file
XLSX.writeFile(wb, 'Report AR Finance Test (1) - COMPLETE_COLUMNS.xlsx');
console.log('✅ Created: Report AR Finance Test (1) - COMPLETE_COLUMNS.xlsx');

// Calculate expected values
const totalSales = fixedDaily.reduce((s, r) => s + (r['Total'] || 0), 0);
const discounts = fixedDaily.reduce((s, r) => s + (r['Discounts'] || 0), 0);
const grandTotal = fixedDaily.reduce((s, r) => s + (r['Grand Total'] || 0), 0);

console.log('\n=== Expected Dashboard Values ===');
console.log('Total Sales:', totalSales.toLocaleString());
console.log('Discounts:', discounts.toLocaleString());
console.log('Grand Total:', grandTotal.toLocaleString());
console.log('\nUpload this file to see Total Sales and Discounts!');
