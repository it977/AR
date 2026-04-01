import { supabase } from './supabase'

async function checkData() {
  console.log('=== Checking Database ===\n')
  
  // Check ar_bills
  const { data: bills, count: billsCount } = await supabase
    .from('ar_bills')
    .select('*', { count: 'exact', head: true })
  
  const { data: billsData } = await supabase
    .from('ar_bills')
    .select('cash, bcel, bcel2, ldb, debt, grand_total')
  
  const billingTotal = billsData?.reduce((s, r) => s + ((r.cash||0) + (r.bcel||0) + (r.bcel2||0) + (r.ldb||0)), 0) || 0
  const outstandingTotal = billsData?.reduce((s, r) => s + (r.debt||0), 0) || 0
  
  console.log('ar_bills:', billsCount, 'records')
  console.log('  Billing Collections:', billingTotal.toLocaleString())
  console.log('  Outstanding:', outstandingTotal.toLocaleString())
  
  // Check ar_debt
  const { data: debt, count: debtCount } = await supabase
    .from('ar_debt')
    .select('*', { count: 'exact', head: true })
  
  const { data: debtData } = await supabase
    .from('ar_debt')
    .select('cash_paid, bcel_paid, bcel2_paid, ldb_paid, amount_paid, balance')
  
  const collectionTotal = debtData?.reduce((s, r) => {
    return s + ((r.cash_paid||0) + (r.bcel_paid||0) + (r.bcel2_paid||0) + (r.ldb_paid||0))
  }, 0) || 0
  
  console.log('\nar_debt:', debtCount, 'records')
  console.log('  Collection:', collectionTotal.toLocaleString())
  
  // Calculate Actual Income
  const actualIncome = billingTotal + collectionTotal
  const dailyIncome = billingTotal
  console.log('\n=== Current Calculation ===')
  console.log('Daily Income:', dailyIncome.toLocaleString())
  console.log('Collection:', collectionTotal.toLocaleString())
  console.log('Actual Income:', actualIncome.toLocaleString())
  console.log('\n=== Target ===')
  console.log('Expected Actual Income: 3,474,273,050')
  console.log('Missing:', (3474273050 - actualIncome).toLocaleString())
}

checkData()
