const XLSX = require('xlsx');

const wb = XLSX.readFile('Report AR Finance Test (1).xlsx');
const daily = XLSX.utils.sheet_to_json(wb.Sheets['Daily']);
const payoff = XLSX.utils.sheet_to_json(wb.Sheets['Pay off']);

console.log('=== Current Data ===');
console.log('Daily records:', daily.length);
console.log('Pay off records:', payoff.length);

// Find bills with outstanding debt that should have payoff records
const billsWithDebt = daily.filter(r => (r['Outstanding Debt'] || 0) > 0);
console.log('\nBills with outstanding debt:', billsWithDebt.length);
console.log('Total outstanding:', billsWithDebt.reduce((s,r) => s + (r['Outstanding Debt']||0), 0).toLocaleString());

// Check which bills already have payoff records
const existingPayoffBillNos = new Set(payoff.map(r => r['Bill No']).filter(Boolean));
console.log('\nBills already in Pay off:', existingPayoffBillNos.size);

// Find bills missing from Pay off
const missingBills = billsWithDebt.filter(b => !existingPayoffBillNos.has(b['Bill No']));
console.log('Bills missing from Pay off:', missingBills.length);
console.log('Missing outstanding amount:', missingBills.reduce((s,r) => s + (r['Outstanding Debt']||0), 0).toLocaleString());

// To reach 3,474M Actual Income, we need:
// Actual Income = Daily Income + Collection
// 3,474,273,050 = 2,557,751,816 + Collection
// Collection = 916,521,234

// Current collection: 92,858,550
// Missing collection: 821,323,684

console.log('\n=== To Reach Target ===');
console.log('Current Collection: 92,858,550');
console.log('Need Collection: 916,521,234');
console.log('Missing: 823,662,684');

// The missing 823M should come from debt payments
// But total outstanding is only 1,154M, and some is still unpaid

console.log('\n=== Reality Check ===');
console.log('Total Outstanding in Daily: 1,154,147,634');
console.log('If ALL outstanding was paid, Collection would be: 1,154,147,634');
console.log('But some balance remains unpaid (7,167,000 from current Pay off)');
console.log('So max possible Collection ≈ 1,147,000,000');
console.log('This would give Actual Income ≈ 2,557M + 1,147M = 3,704M');
console.log('');
console.log('⚠️ Your target 3,474M is BETWEEN current (2,650M) and max (3,704M)');
console.log('This means SOME debts were paid, but not all');
console.log('');
console.log('Question: How much debt was actually paid off?');
console.log('- If 916M was paid: Actual Income = 3,474M ✓ (your target)');
console.log('- If 93M was paid: Actual Income = 2,650M ✗ (current)');
