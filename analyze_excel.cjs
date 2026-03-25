const XLSX = require('xlsx');
const wb = XLSX.readFile('Report AR Finance Test (1).xlsx');

const daily = XLSX.utils.sheet_to_json(wb.Sheets['Daily']);
const payoff = XLSX.utils.sheet_to_json(wb.Sheets['Pay off']);
const looker = XLSX.utils.sheet_to_json(wb.Sheets['Looker_Data']);

// Daily billing collections
const dailyBilling = daily.reduce((s,r) => s + ((r['Cash Received']||0) + (r['Transfer Payment by BCEL']||0) + (r['Transfer Payment by BCEL 2']||0) + (r['Transfer Payment by LDB']||0)), 0);

// Looker_Data collected
const lookerCollected = looker.filter(r => r.Category === 'Collected (Amount)').reduce((s,r) => s + (r.Total_Value||0), 0);

// Pay off collections
const payoffCollection = payoff.reduce((s,r) => s + ((r['Cash Received Debt']||0) + (r['Transfer Payment by BCEL Debt']||0) + (r['Transfer Payment by BCEL 2 Debt']||0) + (r['Transfer Payment by LDB Debt']||0)), 0);

console.log('=== ANALYSIS ===');
console.log('Daily Billing Collections:', dailyBilling.toLocaleString());
console.log('Looker_Data Collected (Expected Actual Income):', lookerCollected.toLocaleString());
console.log('Pay off Collections:', payoffCollection.toLocaleString());
console.log('');
console.log('Calculated Actual Income (Billing + Pay off):', (dailyBilling + payoffCollection).toLocaleString());
console.log('Expected Actual Income (from Looker_Data):', lookerCollected.toLocaleString());
console.log('');
console.log('DIFFERENCE:', (lookerCollected - (dailyBilling + payoffCollection)).toLocaleString());
console.log('');
console.log('=== CONCLUSION ===');
console.log('Your Pay off sheet is MISSING approximately', (lookerCollected - dailyBilling - payoffCollection).toLocaleString(), 'in debt collections!');
console.log('');
console.log('The Looker_Data sheet appears to include BOTH billing collections AND debt collections combined.');
console.log('This suggests Looker_Data "Collected (Amount)" = Actual Income');
