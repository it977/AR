const XLSX = require('xlsx');

// Read the Excel file
const wb = XLSX.readFile('Report AR Finance Test (1).xlsx');

// Get sheets
const daily = XLSX.utils.sheet_to_json(wb.Sheets['Daily']);
const payoff = XLSX.utils.sheet_to_json(wb.Sheets['Pay off']);
const looker = XLSX.utils.sheet_to_json(wb.Sheets['Looker_Data']);

console.log('=== ANALYZING DATA ===\n');

// Calculate billing collections from Daily sheet
const dailyBilling = daily.reduce((s, r) => {
  return s + ((r['Cash Received'] || 0) + 
              (r['Transfer Payment by BCEL'] || 0) + 
              (r['Transfer Payment by BCEL 2'] || 0) + 
              (r['Transfer Payment by LDB'] || 0));
}, 0);

// Get expected total from Looker_Data
const lookerCollected = looker
  .filter(r => r.Category === 'Collected (Amount)')
  .reduce((s, r) => s + (r.Total_Value || 0), 0);

// Current payoff collections
const currentPayoff = payoff.reduce((s, r) => {
  return s + ((r['Cash Received Debt'] || 0) + 
              (r['Transfer Payment by BCEL Debt'] || 0) + 
              (r['Transfer Payment by BCEL 2 Debt'] || 0) + 
              (r['Transfer Payment by LDB Debt'] || 0));
}, 0);

console.log('Billing Collections (from Daily):', dailyBilling.toLocaleString());
console.log('Expected Actual Income (Looker_Data):', lookerCollected.toLocaleString());
console.log('Current Pay off Collections:', currentPayoff.toLocaleString());
console.log('Missing Collections:', (lookerCollected - dailyBilling - currentPayoff).toLocaleString());
console.log('');

// The issue: Looker_Data "Collected (Amount)" includes BOTH billing + debt collections
// We need to understand what debt collections should be

// Calculate what debt collections should be
const expectedDebtCollections = lookerCollected - dailyBilling;
console.log('Expected Debt Collections:', expectedDebtCollections.toLocaleString());
console.log('Current Debt Collections:', currentPayoff.toLocaleString());
console.log('Gap:', (expectedDebtCollections - currentPayoff).toLocaleString());
console.log('');

// Check if there are bills with debt that should have been collected
const billsWithDebt = daily.filter(r => (r['Outstanding Debt'] || 0) > 0);
console.log('Bills with Outstanding Debt:', billsWithDebt.length);
console.log('Total Outstanding in Daily:', billsWithDebt.reduce((s, r) => s + (r['Outstanding Debt'] || 0), 0).toLocaleString());
console.log('');

// Check Pay off data
console.log('Pay off Records:', payoff.length);
const payoffDebtAmount = payoff.reduce((s, r) => s + (r['Outstanding Debt'] || 0), 0);
const payoffBalance = payoff.reduce((s, r) => s + (r['Balance'] || 0), 0);
console.log('Pay off - Original Debt:', payoffDebtAmount.toLocaleString());
console.log('Pay off - Balance Remaining:', payoffBalance.toLocaleString());
console.log('Pay off - Amount Paid:', (payoffDebtAmount - payoffBalance).toLocaleString());
console.log('');

// Check Looker_Data structure
console.log('=== Looker_Data Sample ===');
const lookerSample = looker.slice(0, 5);
console.log(JSON.stringify(lookerSample, null, 2));
