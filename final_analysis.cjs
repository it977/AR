const XLSX = require('xlsx');

const wb = XLSX.readFile('Report AR Finance Test (1).xlsx');
const daily = XLSX.utils.sheet_to_json(wb.Sheets['Daily']);
const payoff = XLSX.utils.sheet_to_json(wb.Sheets['Pay off']);

console.log('=== DAILY SHEET ANALYSIS ===\n');

// Total grand total
const grandTotal = daily.reduce((s, r) => s + (r['Grand Total'] || 0), 0);
console.log('Grand Total (all bills):', grandTotal.toLocaleString());

// Total payments at billing
const cashTotal = daily.reduce((s, r) => s + (r['Cash Received'] || 0), 0);
const bcelTotal = daily.reduce((s, r) => s + (r['Transfer Payment by BCEL'] || 0), 0);
const bcel2Total = daily.reduce((s, r) => s + (r['Transfer Payment by BCEL 2'] || 0), 0);
const ldbTotal = daily.reduce((s, r) => s + (r['Transfer Payment by LDB'] || 0), 0);
const debtTotal = daily.reduce((s, r) => s + (r['Outstanding Debt'] || 0), 0);

console.log('\nPayment Breakdown at Billing:');
console.log('  Cash:', cashTotal.toLocaleString());
console.log('  BCEL:', bcelTotal.toLocaleString());
console.log('  BCEL 2:', bcel2Total.toLocaleString());
console.log('  LDB:', ldbTotal.toLocaleString());
console.log('  Total Billing Collections:', (cashTotal + bcelTotal + bcel2Total + ldbTotal).toLocaleString());
console.log('  Outstanding Debt:', debtTotal.toLocaleString());
console.log('  Check (Billing + Debt = Grand Total):', ((cashTotal + bcelTotal + bcel2Total + ldbTotal) + debtTotal).toLocaleString());

console.log('\n\n=== PAY OFF SHEET ANALYSIS ===\n');

const payoffRows = payoff.length;
console.log('Pay off Records:', payoffRows);

const payoffDebt = payoff.reduce((s, r) => s + (r['Outstanding Debt'] || 0), 0);
const payoffPaid = payoff.reduce((s, r) => s + (r['Amount Paid'] || 0), 0);
const payoffBalance = payoff.reduce((s, r) => s + (r['Balance'] || 0), 0);

console.log('\nPay off Breakdown:');
console.log('  Original Debt:', payoffDebt.toLocaleString());
console.log('  Amount Paid:', payoffPaid.toLocaleString());
console.log('  Balance Remaining:', payoffBalance.toLocaleString());
console.log('  Paid %:', (payoffPaid / payoffDebt * 100).toFixed(2) + '%');

// Payment method breakdown in Pay off
const payCash = payoff.reduce((s, r) => s + (r['Cash Received Debt'] || 0), 0);
const payBcel = payoff.reduce((s, r) => s + (r['Transfer Payment by BCEL Debt'] || 0), 0);
const payBcel2 = payoff.reduce((s, r) => s + (r['Transfer Payment by BCEL 2 Debt'] || 0), 0);
const payLdb = payoff.reduce((s, r) => s + (r['Transfer Payment by LDB Debt'] || 0), 0);

console.log('\nPay off by Method:');
console.log('  Cash Paid:', payCash.toLocaleString());
console.log('  BCEL Paid:', payBcel.toLocaleString());
console.log('  BCEL 2 Paid:', payBcel2.toLocaleString());
console.log('  LDB Paid:', payLdb.toLocaleString());
console.log('  Total:', (payCash + payBcel + payBcel2 + payLdb).toLocaleString());

console.log('\n\n=== ACTUAL INCOME CALCULATION ===\n');

const billingCollections = cashTotal + bcelTotal + bcel2Total + ldbTotal;
const debtCollections = payCash + payBcel + payBcel2 + payLdb;
const actualIncome = billingCollections + debtCollections;

console.log('Actual Income = Billing Collections + Debt Collections');
console.log('             =', billingCollections.toLocaleString(), '+', debtCollections.toLocaleString());
console.log('             =', actualIncome.toLocaleString());

console.log('\n\n=== EXPECTED vs ACTUAL ===\n');

const expectedActualIncome = 3474273050;
console.log('Expected Actual Income (from your design):', expectedActualIncome.toLocaleString());
console.log('Calculated Actual Income:', actualIncome.toLocaleString());
console.log('Difference:', (expectedActualIncome - actualIncome).toLocaleString());

console.log('\nThis means you need', (expectedActualIncome - billingCollections).toLocaleString(), 'in debt collections');
console.log('But you only have', debtCollections.toLocaleString(), 'in debt collections');
console.log('Missing:', (expectedActualIncome - billingCollections - debtCollections).toLocaleString());
