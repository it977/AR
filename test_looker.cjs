const XLSX = require('xlsx');

const wb = XLSX.readFile('Report AR Finance Test (1).xlsx');
const daily = XLSX.utils.sheet_to_json(wb.Sheets['Daily']);
const looker = XLSX.utils.sheet_to_json(wb.Sheets['Looker_Data']);

console.log('=== Testing if Looker_Data = Daily Income ===\n');

// Group Daily by date: Grand Total - Outstanding = Daily Income
const dailyByDate = {};
daily.forEach(r => {
  if (!r.Date) return;
  if (!dailyByDate[r.Date]) {
    dailyByDate[r.Date] = { grand_total: 0, debt: 0, billing: 0 };
  }
  dailyByDate[r.Date].grand_total += (r['Grand Total'] || 0);
  dailyByDate[r.Date].debt += (r['Outstanding Debt'] || 0);
  dailyByDate[r.Date].billing += ((r['Cash Received']||0) + (r['Transfer Payment by BCEL']||0) + (r['Transfer Payment by BCEL 2']||0) + (r['Transfer Payment by LDB']||0));
});

// Group Looker by date
const lookerByDate = {};
looker.forEach(r => {
  if (!r.Date) return;
  if (r.Category === 'Collected (Amount)') {
    if (!lookerByDate[r.Date]) lookerByDate[r.Date] = 0;
    lookerByDate[r.Date] += (r.Total_Value || 0);
  }
});

// Compare
console.log('Date | Daily Income (GT-Debt) | Looker Collected | Match?');
console.log('─'.repeat(70));

const dates = Object.keys(dailyByDate).slice(0, 20);
let dailyIncomeTotal = 0;
let lookerTotal = 0;

dates.forEach(date => {
  const d = dailyByDate[date];
  const dailyIncome = d.grand_total - d.debt;
  const lookerVal = lookerByDate[date] || 0;
  const match = Math.abs(dailyIncome - lookerVal) < 1000 ? '✓' : '✗';
  
  dailyIncomeTotal += dailyIncome;
  lookerTotal += lookerVal;
  
  console.log(`${date} | ${dailyIncome.toLocaleString().padEnd(18)} | ${lookerVal.toLocaleString().padEnd(16)} | ${match}`);
});

console.log('\n' + '─'.repeat(70));
console.log(`TOTALS: ${dailyIncomeTotal.toLocaleString()} | ${lookerTotal.toLocaleString()}`);

// Check if Looker matches billing collections instead
console.log('\n\n=== Testing if Looker_Data = Billing Collections ===\n');

console.log('Date | Billing Collections | Looker Collected | Match?');
console.log('─'.repeat(70));

const billingTotal = dates.reduce((s, date) => s + (dailyByDate[date]?.billing || 0), 0);
const lookerTotal2 = dates.reduce((s, date) => s + (lookerByDate[date] || 0), 0);

dates.forEach(date => {
  const d = dailyByDate[date];
  const lookerVal = lookerByDate[date] || 0;
  const match = Math.abs(d.billing - lookerVal) < 1000 ? '✓' : '✗';
  console.log(`${date} | ${d.billing.toLocaleString().padEnd(17)} | ${lookerVal.toLocaleString().padEnd(16)} | ${match}`);
});

console.log('\n' + '─'.repeat(70));
console.log(`TOTALS: ${billingTotal.toLocaleString()} | ${lookerTotal2.toLocaleString()}`);
