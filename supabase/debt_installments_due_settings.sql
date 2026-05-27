-- Debt payment installments + insurance-specific due date settings
-- Run this once in Supabase SQL Editor before using the updated Debt Management UI.

alter table ar_insurance_list
  add column if not exists due_days integer not null default 30;

alter table ar_debt
  add column if not exists payment_1_date date,
  add column if not exists payment_1_method text,
  add column if not exists payment_1_amount numeric(18,2) default 0,
  add column if not exists payment_2_date date,
  add column if not exists payment_2_method text,
  add column if not exists payment_2_amount numeric(18,2) default 0,
  add column if not exists payment_3_date date,
  add column if not exists payment_3_method text,
  add column if not exists payment_3_amount numeric(18,2) default 0;

update ar_insurance_list
set due_days = 30
where due_days is null or due_days <= 0;

-- Recalculate missing due dates from the document submission date.
update ar_debt d
set due_date = (coalesce(d.submit_date, d.date) + (coalesce(i.due_days, 30) || ' days')::interval)::date
from ar_insurance_list i
where d.insurance = i.name
  and d.due_date is null
  and coalesce(d.submit_date, d.date) is not null;

update ar_debt
set due_date = (coalesce(submit_date, date) + interval '30 days')::date
where due_date is null
  and coalesce(submit_date, date) is not null;

update ar_debt
set aging_group = case
  when submit_date is null then 'N'
  when coalesce(amount_paid, 0) > 0 and coalesce(balance, 0) > 0 then 'Pay in installments'
  when current_date <= due_date then 'Due on schedule'
  when current_date - due_date <= 15 then '1-15 Days'
  when current_date - due_date <= 30 then '16-30 Days'
  when current_date - due_date <= 45 then '31-45 Days'
  else '46-60+ Days'
end
where due_date is not null or submit_date is null;
