-- Sync bills that have debt > 0 but not yet in ar_debt
-- Run once in Supabase SQL Editor

insert into ar_debt (
  date, week, bill_no, insite_onsite, opd_ipd,
  customer_type, insurance, hn, patient_name, gender, workload,
  grand_total, debt_amount, submit_date,
  amount_paid, cash_paid, bcel_paid, bcel2_paid, ldb_paid,
  balance, aging_group
)
select
  b.date, b.week, b.bill_no, b.insite_onsite, b.opd_ipd,
  b.customer_type, b.insurance, b.hn, b.patient_name, b.gender, b.workload,
  b.grand_total, b.debt as debt_amount,
  current_date as submit_date,
  coalesce(b.cash,0)+coalesce(b.bcel,0)+coalesce(b.bcel2,0)+coalesce(b.ldb,0) as amount_paid,
  coalesce(b.cash,0), coalesce(b.bcel,0), coalesce(b.bcel2,0), coalesce(b.ldb,0),
  b.debt as balance,
  coalesce(b.aging_group, 'N') as aging_group
from ar_bills b
where b.debt > 0
  and not exists (
    select 1 from ar_debt d where d.bill_no = b.bill_no
  );
