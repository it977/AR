-- Sync bills that have debt > 0 but not yet in ar_debt
-- Run once in Supabase SQL Editor

insert into ar_debt (
  date, bill_no, customer_type, insurance, hn, patient_name, gender, workload,
  grand_total, debt_amount, date_paid, submit_date,
  amount_paid, cash_paid, bcel_paid, bcel2_paid, ldb_paid,
  balance, due_date, aging_group, source_key
)
select
  b.date, b.bill_no, b.customer_type, b.insurance, b.hn, b.patient_name, b.gender, b.workload,
  b.grand_total,
  b.debt as debt_amount,
  b.date as date_paid,
  current_date as submit_date,
  coalesce(b.cash,0)+coalesce(b.bcel,0)+coalesce(b.bcel2,0)+coalesce(b.ldb,0) as amount_paid,
  coalesce(b.cash,0), coalesce(b.bcel,0), coalesce(b.bcel2,0), coalesce(b.ldb,0),
  b.debt as balance,
  (b.date + interval '30 days')::date as due_date,
  coalesce(b.aging_group, 'N') as aging_group,
  ('bill:' || b.bill_no) as source_key
from ar_bills b
where b.debt > 0
  and not exists (
    select 1 from ar_debt d where d.source_key = ('bill:' || b.bill_no)
  );
