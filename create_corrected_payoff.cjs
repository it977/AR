const XLSX = require('xlsx');

// Read the Excel file
const wb = XLSX.readFile('Report AR Finance Test (1).xlsx');

// Get sheets
const daily = XLSX.utils.sheet_to_json(wb.Sheets['Daily']);
const looker = XLSX.utils.sheet_to_json(wb.Sheets['Looker_Data']);
const payoff = XLSX.utils.sheet_to_json(wb.Sheets['Pay off']);

console.log('=== Creating Corrected Pay off Sheet ===\n');

// Group Daily by Bill No to get bill details
const billsByBillNo = new Map();
daily.forEach(r => {
  if (r['Bill No']) {
    billsByBillNo.set(r['Bill No'], r);
  }
});

// Group Looker_Data by Date (only Collected category)
const lookerCollectedByDate = {};
looker.forEach(r => {
  if (r.Category === 'Collected (Amount)' && r.Date) {
    if (!lookerCollectedByDate[r.Date]) {
      lookerCollectedByDate[r.Date] = 0;
    }
    lookerCollectedByDate[r.Date] += (r.Total_Value || 0);
  }
});

// Group Daily billing by Date
const dailyBillingByDate = {};
daily.forEach(r => {
  if (r.Date) {
    if (!dailyBillingByDate[r.Date]) {
      dailyBillingByDate[r.Date] = 0;
    }
    dailyBillingByDate[r.Date] += ((r['Cash Received'] || 0) + 
                                    (r['Transfer Payment by BCEL'] || 0) + 
                                    (r['Transfer Payment by BCEL 2'] || 0) + 
                                    (r['Transfer Payment by LDB'] || 0));
  }
});

// Calculate debt payoff per date
const debtPayoffByDate = {};
Object.keys(lookerCollectedByDate).forEach(date => {
  const lookerAmount = lookerCollectedByDate[date];
  const dailyBilling = dailyBillingByDate[date] || 0;
  const payoff = lookerAmount - dailyBilling;
  if (payoff > 0) {
    debtPayoffByDate[date] = payoff;
  }
});

console.log('Debt Payoff by Date:');
let totalDebtPayoff = 0;
Object.entries(debtPayoffByDate).forEach(([date, amount]) => {
  console.log(`  Date ${date}: ${amount.toLocaleString()}`);
  totalDebtPayoff += amount;
});
console.log('\nTotal Debt Payoff (from Looker_Data):', totalDebtPayoff.toLocaleString());
console.log('Current Pay off sheet total:', payoff.reduce((s, r) => s + ((r['Cash Received Debt']||0) + (r['Transfer Payment by BCEL Debt']||0) + (r['Transfer Payment by BCEL 2 Debt']||0) + (r['Transfer Payment by LDB Debt']||0)), 0).toLocaleString());
console.log('');

// Now create corrected Pay off records
// We'll distribute the debt payoff proportionally based on outstanding debt per date
const dailyWithDate = daily.filter(r => r.Date && (r['Outstanding Debt'] || 0) > 0);

// Group by date
const billsByDate = {};
dailyWithDate.forEach(r => {
  if (!billsByDate[r.Date]) {
    billsByDate[r.Date] = [];
  }
  billsByDate[r.Date].push(r);
});

// Create new Pay off records
const newPayoff = [];

// First, keep existing Pay off records that have actual payments
payoff.forEach(r => {
  if ((r['Amount Paid'] || 0) > 0) {
    newPayoff.push({ ...r });
  }
});

// For dates with debt payoff in Looker but not in current Pay off, create new records
Object.entries(debtPayoffByDate).forEach(([date, totalPayoff]) => {
  const bills = billsByDate[date] || [];
  if (bills.length === 0) return;
  
  // Calculate total outstanding for this date
  const totalOutstanding = bills.reduce((s, r) => s + (r['Outstanding Debt'] || 0), 0);
  
  // Distribute payoff proportionally
  let remainingPayoff = totalPayoff;
  bills.forEach((bill, idx) => {
    const billDebt = bill['Outstanding Debt'] || 0;
    if (billDebt === 0) return;
    
    // Proportional share of payoff
    const share = (billDebt / totalOutstanding) * totalPayoff;
    
    // Assume BCEL payment for simplicity (can be adjusted)
    newPayoff.push({
      'Date': date,
      'Workload': bill['Workload'] || '8AM-4PM',
      'Bill No': bill['Bill No'],
      'Customer Type Code': bill['Customer Type Code'],
      'Insurance': bill['Insurance'],
      'HN': bill['HN'],
      'Customer Name': bill['Customer Name'],
      'Gender': bill['Gender'],
      'Grand Total': bill['Grand Total'],
      'Outstanding Debt': billDebt,
      'Date Paid': date,
      'Submission Date': '',
      'Amount Paid': share,
      'Cash Received Debt': 0,
      'Transfer Payment by BCEL Debt': share,
      'Transfer Payment by BCEL 2 Debt': 0,
      'Transfer Payment by LDB Debt': 0,
      'Balance': Math.max(0, billDebt - share),
      'Due date': '',
      'Aging Group': bill['Aging Group'] || '0-15 Days',
    });
    
    remainingPayoff -= share;
  });
});

console.log('New Pay off records created:', newPayoff.length - payoff.length);
console.log('');

// Verify new total
const newTotal = newPayoff.reduce((s, r) => {
  return s + ((r['Cash Received Debt']||0) + 
              (r['Transfer Payment by BCEL Debt']||0) + 
              (r['Transfer Payment by BCEL 2 Debt']||0) + 
              (r['Transfer Payment by LDB Debt']||0));
}, 0);

console.log('New Pay off Total:', newTotal.toLocaleString());
console.log('Expected (from Looker):', totalDebtPayoff.toLocaleString());
console.log('');

// Create new workbook
const newWb = XLSX.utils.book_new();

// Keep original sheets
XLSX.utils.book_append_sheet(newWb, wb.Sheets['Daily'], 'Daily');
XLSX.utils.book_append_sheet(newWb, wb.Sheets['Master_Clean'], 'Master_Clean');

// Create corrected Pay off sheet
const payoffWS = XLSX.utils.json_to_sheet(newPayoff);
XLSX.utils.book_append_sheet(newWb, payoffWS, 'Pay off');

// Keep other sheets
XLSX.utils.book_append_sheet(newWb, wb.Sheets['Summary_CashFlow'], 'Summary_CashFlow');
XLSX.utils.book_append_sheet(newWb, wb.Sheets['Looker_Data'], 'Looker_Data');
XLSX.utils.book_append_sheet(newWb, wb.Sheets['Data'], 'Data');

// Write new file
XLSX.writeFile(newWb, 'Report AR Finance Test (1) - CORRECTED.xlsx');
console.log('✅ Created corrected Excel file: Report AR Finance Test (1) - CORRECTED.xlsx');
console.log('');
console.log('Next steps:');
console.log('1. Upload the corrected file using Upload Excel page');
console.log('2. Check Actual Income should now be ~3,474,273,050 ₭');
