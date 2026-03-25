const XLSX = require('xlsx');

const wb = XLSX.readFile('Report AR Finance Test (1) - COMPLETE.xlsx');

// Fix dates in Daily sheet
const daily = XLSX.utils.sheet_to_json(wb.Sheets['Daily']);
daily.forEach(row => {
  if (row['Date'] && typeof row['Date'] === 'number') {
    // Convert Excel serial to YYYY-MM-DD
    const date = new Date(Math.round((row['Date'] - 25569) * 86400 * 1000));
    row['Date'] = date.toISOString().split('T')[0];
  }
});

// Fix dates in Pay off sheet
const payoff = XLSX.utils.sheet_to_json(wb.Sheets['Pay off']);
payoff.forEach(row => {
  if (row['Date'] && typeof row['Date'] === 'number') {
    const date = new Date(Math.round((row['Date'] - 25569) * 86400 * 1000));
    row['Date'] = date.toISOString().split('T')[0];
  }
  if (row['Date Paid'] && typeof row['Date Paid'] === 'number') {
    const date = new Date(Math.round((row['Date Paid'] - 25569) * 86400 * 1000));
    row['Date Paid'] = date.toISOString().split('T')[0];
  }
});

// Create new workbook with fixed dates
const newWb = XLSX.utils.book_new();

// Update Daily sheet
const dailyWS = XLSX.utils.json_to_sheet(daily);
XLSX.utils.book_append_sheet(newWb, dailyWS, 'Daily');

// Keep Master_Clean from original
XLSX.utils.book_append_sheet(newWb, wb.Sheets['Master_Clean'], 'Master_Clean');

// Update Pay off sheet
const payoffWS = XLSX.utils.json_to_sheet(payoff);
XLSX.utils.book_append_sheet(newWb, payoffWS, 'Pay off');

// Keep other sheets
XLSX.utils.book_append_sheet(newWb, wb.Sheets['Summary_CashFlow'], 'Summary_CashFlow');
XLSX.utils.book_append_sheet(newWb, wb.Sheets['Looker_Data'], 'Looker_Data');
XLSX.utils.book_append_sheet(newWb, wb.Sheets['Data'], 'Data');

XLSX.writeFile(newWb, 'Report AR Finance Test (1) - FIXED.xlsx');
console.log('✅ Created: Report AR Finance Test (1) - FIXED.xlsx');
console.log('\nThis file has proper date formats (YYYY-MM-DD)');
console.log('Upload this file instead!');
