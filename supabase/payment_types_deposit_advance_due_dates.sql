-- Payment type, deposit/advance collection, and onsite due date support.
-- Safe to run multiple times in Supabase SQL Editor.

alter table ar_bills add column if not exists payment_type text;
alter table ar_bills add column if not exists bill_issued_at timestamptz;
alter table ar_bills add column if not exists due_date date;
alter table ar_bills add column if not exists debt_status text;

alter table ar_debt add column if not exists insite_onsite text;
alter table ar_debt add column if not exists opd_ipd text;
alter table ar_debt add column if not exists payment_type text;

create index if not exists idx_ar_bills_payment_type on ar_bills(payment_type);
create index if not exists idx_ar_bills_due_date on ar_bills(due_date);
create index if not exists idx_ar_debt_due_date on ar_debt(due_date);

update ar_bills
set payment_type = case
  when coalesce(prepayment, 0) >= coalesce(grand_total, 0) and coalesce(prepayment, 0) > 0 then 'Advance'
  when coalesce(prepayment, 0) > 0 then 'Deposit'
  when coalesce(cash, 0) > 0 and coalesce(bcel, 0) + coalesce(bcel2, 0) + coalesce(ldb, 0) > 0 then 'Cash/Transfer'
  when coalesce(cash, 0) > 0 then 'Cash'
  when coalesce(bcel, 0) + coalesce(bcel2, 0) + coalesce(ldb, 0) > 0 then 'Transfer'
  else 'Transacted'
end
where payment_type is null or payment_type = '';

update ar_bills
set due_date = coalesce(date, current_date) + interval '30 days'
where due_date is null and insite_onsite = 'Onsite';

update ar_bills
set debt_status = case
  when payment_type = 'Advance' then 'advance'
  when payment_type = 'Deposit' then 'deposit'
  when coalesce(debt, 0) > 0 and due_date < current_date then 'overdue'
  when coalesce(debt, 0) > 0 then 'pending'
  else 'paid'
end;
