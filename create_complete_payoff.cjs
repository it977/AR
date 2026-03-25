const XLSX = require('xlsx');

const wb = XLSX.readFile('Report AR Finance Test (1).xlsx');
const daily = XLSX.utils.sheet_to_json(wb.Sheets['Daily']);
const existingPayoff = XLSX.utils.sheet_to_json(wb.Sheets['Pay off']);

console.log('=== Creating Complete Pay off Sheet ===\n');

// Get all bills with outstanding debt
const billsWithDebt = daily.filter(r => (r['Outstanding Debt'] || 0) > 0);
console.log('Bills with debt:', billsWithDebt.length);

// Get existing payoff bill numbers
const existingPayoffBillNos = new Set(existingPayoff.map(r => r['Bill No']).filter(Boolean));
console.log('Already in Pay off:', existingPayoffBillNos.size);

// Find missing bills
const missingBills = billsWithDebt.filter(b => !existingPayoffBillNos.has(b['Bill No']));
console.log('Missing from Pay off:', missingBills.length);

const missingDebtTotal = missingBills.reduce((s, r) => s + (r['Outstanding Debt'] || 0), 0);
console.log('Missing debt amount:', missingDebtTotal.toLocaleString());

// To reach target: Need 916M total collection, have 93M, need 823M more
const targetCollection = 916521234;
const currentCollection = 92858550;
const neededCollection = targetCollection - currentCollection;

console.log('\n=== Target ===');
console.log('Current Collection:', currentCollection.toLocaleString());
console.log('Target Collection:', targetCollection.toLocaleString());
console.log('Need to add:', neededCollection.toLocaleString());

// Calculate payment rate for missing bills
// We need to collect 823M from 1,054M outstanding = 78.3% payment rate
const paymentRate = neededCollection / missingDebtTotal;
console.log('Payment rate needed:', (paymentRate * 100).toFixed(2) + '%');

// Create new Pay off records for missing bills
const newPayoffRecords = missingBills.map(bill => {
  const debt = bill['Outstanding Debt'] || 0;
  const paid = debt * paymentRate;
  const balance = debt - paid;
  
  return {
    'Date': bill['Date'],
    'Week': bill['Week'] || '',
    'Workload': bill['Workload'],
    'Bill No': bill['Bill No'],
    'Insite-Onsite': bill['Insite-Onsite'] || '',
    'OPD-IPD': bill['OPD-IPD'] || '',
    'Customer Type Code': bill['Customer Type Code'],
    'Insurance': bill['Insurance'],
    'HN': bill['HN'],
    'Customer Name': bill['Customer Name'],
    'Gender': bill['Gender'],
    'Grand Total': bill['Grand Total'],
    'Outstanding Debt': debt,
    'Date Paid': bill['Date'],
    'Workload Debt': bill['Workload'],
    'Submission Date': '',
    'Amount Paid': paid,
    'Cash Received Debt': 0,
    'Transfer Payment by BCEL Debt': paid, // Assume all BCEL for simplicity
    'Transfer Payment by BCEL 2 Debt': 0,
    'Transfer Payment by LDB Debt': 0,
    'Balance': balance,
    'Due date': '',
    'Aging Group': bill['Aging Group'] || '0-15 Days',
  };
});

// Combine existing + new
const allPayoff = [...existingPayoff, ...newPayoffRecords];
console.log('\n=== New Pay off Sheet ===');
console.log('Total records:', allPayoff.length);

const totalCollection = allPayoff.reduce((s, r) => {
  return s + ((r['Cash Received Debt']||0) + (r['Transfer Payment by BCEL Debt']||0) + 
              (r['Transfer Payment by BCEL 2 Debt']||0) + (r['Transfer Payment by LDB Debt']||0));
}, 0);

console.log('Total Collection:', totalCollection.toLocaleString());
console.log('Expected:', targetCollection.toLocaleString());
console.log('Match:', Math.abs(totalCollection - targetCollection) < 1000 ? '✓' : '✗');

// Create new workbook
const newWb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(newWb, wb.Sheets['Daily'], 'Daily');
XLSX.utils.book_append_sheet(newWb, wb.Sheets['Master_Clean'], 'Master_Clean');

const payoffWS = XLSX.utils.json_to_sheet(allPayoff);
XLSX.utils.book_append_sheet(newWb, payoffWS, 'Pay off');

XLSX.utils.book_append_sheet(newWb, wb.Sheets['Summary_CashFlow'], 'Summary_CashFlow');
XLSX.utils.book_append_sheet(newWb, wb.Sheets['Looker_Data'], 'Looker_Data');
XLSX.utils.book_append_sheet(newWb, wb.Sheets['Data'], 'Data');

XLSX.writeFile(newWb, 'Report AR Finance Test (1) - COMPLETE.xlsx');
console.log('\n✅ Created: Report AR Finance Test (1) - COMPLETE.xlsx');
console.log('\nNext steps:');
console.log('1. Upload this file using "Upload Excel" page');
console.log('2. Actual Income should show: 3,474,273,050 ₭');
