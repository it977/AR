-- Run this in Supabase SQL Editor to check your data

-- Check ar_bills table
SELECT 
  COUNT(*) as total_bills,
  SUM(cash) as total_cash,
  SUM(bcel) as total_bcel,
  SUM(bcel2) as total_bcel2,
  SUM(ldb) as total_ldb,
  SUM(debt) as total_debt,
  SUM(grand_total) as total_grand_total
FROM ar_bills;

-- Check ar_debt table  
SELECT 
  COUNT(*) as total_debt_records,
  SUM(debt_amount) as total_debt_amount,
  SUM(amount_paid) as total_amount_paid,
  SUM(cash_paid) as total_cash_paid,
  SUM(bcel_paid) as total_bcel_paid,
  SUM(bcel2_paid) as total_bcel2_paid,
  SUM(ldb_paid) as total_ldb_paid,
  SUM(balance) as total_balance
FROM ar_debt;

-- Expected Actual Income calculation:
-- (cash + bcel + bcel2 + ldb from ar_bills) + (cash_paid + bcel_paid + bcel2_paid + ldb_paid from ar_debt)
