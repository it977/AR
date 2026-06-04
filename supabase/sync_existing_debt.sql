-- Sync bills that have debt > 0 but not yet in ar_debt
-- Run once in Supabase SQL Editor

insert into ar_debt (
  date, bill_no, insite_onsite, opd_ipd, payment_type, customer_type, insurance, hn, patient_name, gender, workload,
  grand_total, debt_amount, date_paid, submit_date,
  amount_paid, cash_paid, bcel_paid, bcel2_paid, ldb_paid,
  balance, due_date, aging_group
)
select
  b.date, b.bill_no, b.insite_onsite, b.opd_ipd, b.payment_type, b.customer_type, b.insurance, b.hn, b.patient_name, b.gender, b.workload,
  b.grand_total,
  b.debt as debt_amount,
  null as date_paid,
  current_date as submit_date,
  0 as amount_paid,
  0 as cash_paid, 0 as bcel_paid, 0 as bcel2_paid, 0 as ldb_paid,
  b.debt as balance,
  (current_date + (coalesce(i.due_days, 30) || ' days')::interval)::date as due_date,
  'Current Receivables' as aging_group
from ar_bills b
left join ar_insurance_list i on i.name = b.insurance
where b.debt > 0
  and not exists (
    select 1 from ar_debt d where d.bill_no = b.bill_no
  );
