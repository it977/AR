const XLSX = require('xlsx');
const fs = require('fs');

// Read the FINAL Excel file
const filePath = 'Report AR Finance Test (1) - FINAL.xlsx';

if (!fs.existsSync(filePath)) {
  console.log('❌ File not found:', filePath);
  process.exit(1);
}

const wb = XLSX.readFile(filePath);
console.log('✅ File loaded:', filePath);
console.log('Sheets:', wb.SheetNames);

// Check Daily sheet
const daily = XLSX.utils.sheet_to_json(wb.Sheets['Daily']);
console.log('\n📊 Daily Sheet:');
console.log('  Rows:', daily.length);

const dailyTotal = daily.reduce((s, r) => s + (r['Grand Total'] || 0), 0);
const dailyCash = daily.reduce((s, r) => s + (r['Cash Received'] || 0), 0);
const dailyBcel = daily.reduce((s, r) => s + (r['Transfer Payment by BCEL'] || 0), 0);
const dailyLdb = daily.reduce((s, r) => s + (r['Transfer Payment by LDB'] || 0), 0);
const dailyDebt = daily.reduce((s, r) => s + (r['Outstanding Debt'] || 0), 0);

console.log('  Grand Total:', dailyTotal.toLocaleString());
console.log('  Cash:', dailyCash.toLocaleString());
console.log('  BCEL:', dailyBcel.toLocaleString());
console.log('  LDB:', dailyLdb.toLocaleString());
console.log('  Billing Collections:', (dailyCash + dailyBcel + dailyLdb).toLocaleString());
console.log('  Outstanding:', dailyDebt.toLocaleString());

// Check Pay off sheet
const payoff = XLSX.utils.sheet_to_json(wb.Sheets['Pay off']);
console.log('\n💳 Pay off Sheet:');
console.log('  Rows:', payoff.length);

const payoffPaid = payoff.reduce((s, r) => s + (r['Amount Paid'] || 0), 0);
const payoffBcel = payoff.reduce((s, r) => s + (r['Transfer Payment by BCEL Debt'] || 0), 0);

console.log('  Amount Paid:', payoffPaid.toLocaleString());
console.log('  BCEL Paid:', payoffBcel.toLocaleString());

// Calculate expected Actual Income
const billingCollections = dailyCash + dailyBcel + dailyLdb;
const debtCollections = payoffPaid;
const actualIncome = billingCollections + debtCollections;

console.log('\n💰 Expected Values:');
console.log('  Billing Collections:', billingCollections.toLocaleString());
console.log('  Debt Collections:', debtCollections.toLocaleString());
console.log('  Actual Income:', actualIncome.toLocaleString());
console.log('  Daily Income:', (dailyTotal - dailyDebt).toLocaleString());

console.log('\n✅ Upload this file to get these values in the dashboard!');
