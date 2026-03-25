const XLSX = require('xlsx');

// Read the Excel file
const wb = XLSX.readFile('Report AR Finance Test (1).xlsx');

// Get sheets
const daily = XLSX.utils.sheet_to_json(wb.Sheets['Daily']);
const looker = XLSX.utils.sheet_to_json(wb.Sheets['Looker_Data']);
const summary = XLSX.utils.sheet_to_json(wb.Sheets['Summary_CashFlow']);

console.log('=== Understanding Looker_Data ===\n');

// Looker_Data has "Collected (Amount)" per Date + Workload
// This should equal: Billing collections + Debt collections for that day/shift

// Group Looker_Data by Date
const lookerByDate = {};
looker.forEach(r => {
  if (!r.Date) return;
  const date = r.Date;
  if (!lookerByDate[date]) {
    lookerByDate[date] = { collected: 0, outstanding: 0 };
  }
  if (r.Category === 'Collected (Amount)') {
    lookerByDate[date].collected += (r.Total_Value || 0);
  } else if (r.Category === 'Outstanding (Balance)') {
    lookerByDate[date].outstanding += (r.Total_Value || 0);
  }
});

// Group Daily by Date
const dailyByDate = {};
daily.forEach(r => {
  if (!r.Date) return;
  const date = r.Date;
  if (!dailyByDate[date]) {
    dailyByDate[date] = { billing: 0, debt: 0, grand_total: 0 };
  }
  dailyByDate[date].billing += ((r['Cash Received'] || 0) + 
                                 (r['Transfer Payment by BCEL'] || 0) + 
                                 (r['Transfer Payment by BCEL 2'] || 0) + 
                                 (r['Transfer Payment by LDB'] || 0));
  dailyByDate[date].debt += (r['Outstanding Debt'] || 0);
  dailyByDate[date].grand_total += (r['Grand Total'] || 0);
});

// Compare for first few dates
console.log('Date Comparison (Excel serial dates):');
const dates = Object.keys(lookerByDate).slice(0, 10);
dates.forEach(date => {
  const lookerData = lookerByDate[date];
  const dailyData = dailyByDate[date] || { billing: 0, debt: 0 };
  const diff = lookerData.collected - dailyData.billing;
  console.log(`Date ${date}:`);
  console.log(`  Looker Collected: ${lookerData.collected.toLocaleString()}`);
  console.log(`  Daily Billing: ${dailyData.billing.toLocaleString()}`);
  console.log(`  Difference (should be debt payoff): ${diff.toLocaleString()}`);
  console.log(`  Daily Outstanding: ${dailyData.debt.toLocaleString()}`);
  console.log('');
});

// Check Summary_CashFlow
console.log('\n=== Summary_CashFlow Analysis ===');
const summaryCollected = summary
  .filter(r => r.Category === 'Collected (Amount)')
  .reduce((s, r) => s + (r['Total Actual Income'] || 0), 0);
console.log('Summary_CashFlow Total Actual Income:', summaryCollected.toLocaleString());

// The key insight: Summary_CashFlow "Total Actual Income" per row
// should be the actual income for that Date+Workload combination
