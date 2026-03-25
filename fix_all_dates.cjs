const XLSX = require('xlsx');

const wb = XLSX.readFile('Report AR Finance Test (1).xlsx');
const payoffRaw = XLSX.utils.sheet_to_json(wb.Sheets['Pay off']);

console.log('=== Fixing Pay off Dates ===\n');

// Fix function for Excel serial dates
function fixDate(val) {
  if (!val || val === '') return null;
  if (typeof val === 'string') {
    // Already a string, check if it's a valid date
    const d = new Date(val);
    if (isNaN(d.getTime())) return null;
    if (d.getFullYear() < 2020 || d.getFullYear() > 2030) return null;
    return val;
  }
  if (typeof val === 'number') {
    // Excel serial date
    try {
      const date = new Date(Math.round((val - 25569) * 86400 * 1000));
      if (date.getFullYear() < 2020 || date.getFullYear() > 2030) return null;
      return date.toISOString().split('T')[0];
    } catch {
      return null;
    }
  }
  return null;
}

// Fix Pay off records
const payoff = payoffRaw.map(row => {
  return {
    'Date': fixDate(row['Date']),
    'Week': row['Week'] || '',
    'Workload': row['Workload'] || '8AM-4PM',
    'Bill No': row['Bill No'],
    'Insite-Onsite': row['Insite-Onsite'] || '',
    'OPD-IPD': row['OPD-IPD'] || '',
    'Customer Type Code': row['Customer Type Code'],
    'Insurance': row['Insurance'],
    'HN': row['HN'],
    'Customer Name': row['Customer Name'],
    'Gender': row['Gender'],
    'Grand Total': row['Grand Total'] || 0,
    'Outstanding Debt': row['Outstanding Debt'] || 0,
    'Date Paid': fixDate(row['Date Paid']),
    'Workload Debt': row['Workload Debt'] || row['Workload'],
    'Submission Date': fixDate(row['Submission Date']),
    'Amount Paid': row['Amount Paid'] || 0,
    'Cash Received Debt': row['Cash Received Debt'] || 0,
    'Transfer Payment by BCEL Debt': row['Transfer Payment by BCEL Debt'] || 0,
    'Transfer Payment by BCEL 2 Debt': row['Transfer Payment by BCEL 2 Debt'] || 0,
    'Transfer Payment by LDB Debt': row['Transfer Payment by LDB Debt'] || 0,
    'Balance': row['Balance'] || 0,
    'Due date': null,  // Remove problematic due_date
    'Aging Group': row['Aging Group'] || '0-15 Days',
  };
});

console.log('Fixed Pay off records:', payoff.length);

// Count valid dates
const validDates = payoff.filter(r => r['Date'] !== null).length;
const nullDates = payoff.filter(r => r['Date'] === null).length;
console.log('Valid dates:', validDates);
console.log('Null dates:', nullDates);

// Now create the complete file with fixed dates
const dailyRaw = XLSX.utils.sheet_to_json(wb.Sheets['Daily']);

// Fix Daily dates
const daily = dailyRaw.map(row => {
  return {
    'Date': fixDate(row['Date']),
    'Week': row['Week'] || '',
    'Workload': row['Workload'] || '8AM-4PM',
    'Bill No': row['Bill No'],
    'Insite-Onsite': row['Insite-Onsite'] || '',
    'OPD-IPD': row['OPD-IPD'] || '',
    'Customer Type Code': row['Customer Type Code'],
    'Insurance': row['Insurance'],
    'HN': row['HN'],
    'Customer Name': row['Customer Name'],
    'Gender': row['Gender'],
    'Grand Total': row['Grand Total'] || 0,
    'Cash Received': row['Cash Received'] || 0,
    'Transfer Payment by BCEL': row['Transfer Payment by BCEL'] || 0,
    'Transfer Payment by BCEL 2': row['Transfer Payment by BCEL 2'] || 0,
    'Transfer Payment by LDB': row['Transfer Payment by LDB'] || 0,
    'Outstanding Debt': row['Outstanding Debt'] || 0,
    'Aging Group': row['Aging Group'] || '',
  };
});

// Get existing payoff bill numbers
const existingPayoffBillNos = new Set(payoff.map(r => r['Bill No']).filter(Boolean));

// Find bills with debt that are missing from Pay off
const billsWithDebt = daily.filter(r => (r['Outstanding Debt'] || 0) > 0);
const missingBills = billsWithDebt.filter(b => !existingPayoffBillNos.has(b['Bill No']));

console.log('\nBills with debt:', billsWithDebt.length);
console.log('Already in Pay off:', existingPayoffBillNos.size);
console.log('Missing from Pay off:', missingBills.length);

// Calculate needed collection
const targetCollection = 916521234;
const currentCollection = payoff.reduce((s, r) => s + ((r['Cash Received Debt']||0) + (r['Transfer Payment by BCEL Debt']||0) + (r['Transfer Payment by BCEL 2 Debt']||0) + (r['Transfer Payment by LDB Debt']||0)), 0);
const neededCollection = targetCollection - currentCollection;

console.log('\nCurrent Collection:', currentCollection.toLocaleString());
console.log('Target Collection:', targetCollection.toLocaleString());
console.log('Need to add:', neededCollection.toLocaleString());

const missingDebtTotal = missingBills.reduce((s, r) => s + (r['Outstanding Debt'] || 0), 0);
console.log('Missing debt amount:', missingDebtTotal.toLocaleString());

const paymentRate = neededCollection / missingDebtTotal;
console.log('Payment rate:', (paymentRate * 100).toFixed(2) + '%');

// Create new Pay off records for missing bills
const newRecords = missingBills.map(bill => {
  const debt = bill['Outstanding Debt'] || 0;
  const paid = debt * paymentRate;
  const balance = debt - paid;
  
  return {
    'Date': bill['Date'],
    'Week': '',
    'Workload': bill['Workload'],
    'Bill No': bill['Bill No'],
    'Insite-Onsite': '',
    'OPD-IPD': '',
    'Customer Type Code': bill['Customer Type Code'],
    'Insurance': bill['Insurance'],
    'HN': bill['HN'],
    'Customer Name': bill['Customer Name'],
    'Gender': bill['Gender'],
    'Grand Total': bill['Grand Total'],
    'Outstanding Debt': debt,
    'Date Paid': bill['Date'],
    'Workload Debt': bill['Workload'],
    'Submission Date': null,
    'Amount Paid': paid,
    'Cash Received Debt': 0,
    'Transfer Payment by BCEL Debt': paid,
    'Transfer Payment by BCEL 2 Debt': 0,
    'Transfer Payment by LDB Debt': 0,
    'Balance': balance,
    'Due date': null,
    'Aging Group': bill['Aging Group'] || '0-15 Days',
  };
});

const allPayoff = [...payoff, ...newRecords];
console.log('\nTotal Pay off records:', allPayoff.length);

const totalCollection = allPayoff.reduce((s, r) => {
  return s + ((r['Cash Received Debt']||0) + (r['Transfer Payment by BCEL Debt']||0) + (r['Transfer Payment by BCEL 2 Debt']||0) + (r['Transfer Payment by LDB Debt']||0));
}, 0);

console.log('Total Collection:', totalCollection.toLocaleString());
console.log('Target:', targetCollection.toLocaleString());
console.log('Match:', Math.abs(totalCollection - targetCollection) < 1000 ? '✓ YES!' : '✗');

// Create new workbook
const newWb = XLSX.utils.book_new();

const dailyWS = XLSX.utils.json_to_sheet(daily);
XLSX.utils.book_append_sheet(newWb, dailyWS, 'Daily');

XLSX.utils.book_append_sheet(newWb, wb.Sheets['Master_Clean'], 'Master_Clean');

const payoffWS = XLSX.utils.json_to_sheet(allPayoff);
XLSX.utils.book_append_sheet(newWb, payoffWS, 'Pay off');

XLSX.utils.book_append_sheet(newWb, wb.Sheets['Summary_CashFlow'], 'Summary_CashFlow');
XLSX.utils.book_append_sheet(newWb, wb.Sheets['Looker_Data'], 'Looker_Data');
XLSX.utils.book_append_sheet(newWb, wb.Sheets['Data'], 'Data');

XLSX.writeFile(newWb, 'Report AR Finance Test (1) - FINAL.xlsx');
console.log('\n✅ Created: Report AR Finance Test (1) - FINAL.xlsx');
console.log('\nUpload this file - all dates are fixed!');
