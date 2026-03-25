const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

// Read Supabase config from .env
const fs = require('fs');
const envContent = fs.readFileSync('.env', 'utf-8');
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.+)/)[1].trim();
const supabaseKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.+)/)[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('=== Uploading Complete Pay off Data ===\n');

// Read the corrected Excel file
const wb = XLSX.readFile('Report AR Finance Test (1) - COMPLETE.xlsx');
const payoff = XLSX.utils.sheet_to_json(wb.Sheets['Pay off']);

console.log('Pay off records to upload:', payoff.length);

// Map Excel columns to database columns
const MAP_DEBT = {
  'Date': 'date',
  'Workload': 'workload',
  'Bill No': 'bill_no',
  'Customer Type Code': 'customer_type',
  'Insurance': 'insurance',
  'HN': 'hn',
  'Customer Name': 'patient_name',
  'Gender': 'gender',
  'Grand Total': 'grand_total',
  'Outstanding Debt': 'debt_amount',
  'Date Paid': 'date_paid',
  'Submission Date': 'submit_date',
  'Amount Paid': 'amount_paid',
  'Cash Received Debt': 'cash_paid',
  'Transfer Payment by BCEL Debt': 'bcel_paid',
  'Transfer Payment by BCEL 2 Debt': 'bcel2_paid',
  'Transfer Payment by LDB Debt': 'ldb_paid',
  'Balance': 'balance',
  'Due date': 'due_date',
  'Aging Group': 'aging_group',
};

// Convert Excel rows to database format
const debtRecords = payoff.map(row => {
  const record = {};
  for (const [excelCol, dbCol] of Object.entries(MAP_DEBT)) {
    let val = row[excelCol];
    if (val === null || val === undefined || val === '') {
      val = NUMERIC_COLS.has(dbCol) ? 0 : null;
    }
    if (dbCol === 'date' || dbCol === 'date_paid' || dbCol === 'submit_date' || dbCol === 'due_date') {
      if (val && typeof val === 'number') {
        // Excel serial date
        const date = new Date(Math.round((val - 25569) * 86400 * 1000));
        val = date.toISOString().split('T')[0];
      }
    }
    record[dbCol] = val;
  }
  return record;
});

const NUMERIC_COLS = new Set(['debt_amount', 'amount_paid', 'cash_paid', 'bcel_paid', 'bcel2_paid', 'ldb_paid', 'balance', 'grand_total']);

console.log('\nDeleting existing ar_debt records...');
const { error: deleteError } = await supabase.from('ar_debt').delete().not('id', 'is', null);
if (deleteError) {
  console.error('Error deleting:', deleteError.message);
} else {
  console.log('✓ Deleted all existing ar_debt records');
}

console.log('\nUploading new Pay off records...');
const BATCH_SIZE = 100;
let uploaded = 0;

for (let i = 0; i < debtRecords.length; i += BATCH_SIZE) {
  const batch = debtRecords.slice(i, i + BATCH_SIZE);
  const { error } = await supabase.from('ar_debt').insert(batch);
  if (error) {
    console.error('Error uploading batch:', error.message);
  } else {
    uploaded += batch.length;
    console.log(`  Uploaded ${uploaded}/${debtRecords.length} records...`);
  }
}

console.log('\n=== Upload Complete ===');
console.log('Uploaded:', uploaded, 'records');

// Verify
const { count } = await supabase.from('ar_debt').select('*', { count: 'exact', head: true });
console.log('Total in database:', count);

const { data: debtData } = await supabase.from('ar_debt').select('cash_paid, bcel_paid, bcel2_paid, ldb_paid');
const collectionTotal = debtData?.reduce((s, r) => {
  return s + ((r.cash_paid||0) + (r.bcel_paid||0) + (r.bcel2_paid||0) + (r.ldb_paid||0));
}, 0) || 0;

console.log('\nCollection Total:', collectionTotal.toLocaleString(), '₭');
console.log('Expected: 916,521,234 ₭');
console.log('Match:', Math.abs(collectionTotal - 916521234) < 1000 ? '✓ YES!' : '✗');
