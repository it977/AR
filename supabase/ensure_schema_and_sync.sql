-- ============================================================
-- ກວດສອບ ແລະ ເພີ່ມ columns ທີ່ຂາດ + sync ໜີ້ຂອງ ar_bills → ar_debt
-- ປອດໄພ run ຫຼາຍຄັ້ງ (idempotent)
-- ============================================================

-- 1. ar_bills: ເພີ່ມ columns ທີ່ code ໃຊ້ງານ
alter table ar_bills add column if not exists debt_status      text;
alter table ar_bills add column if not exists recorded_by      text;
alter table ar_bills add column if not exists recorded_by_debt text;
alter table ar_bills add column if not exists payment_type     text;
alter table ar_bills add column if not exists bill_issued_at   timestamptz;
alter table ar_bills add column if not exists payment_received_at date;
alter table ar_bills add column if not exists due_date         date;
alter table ar_insurance_list add column if not exists due_days integer not null default 30;
alter table ar_debt add column if not exists insite_onsite text;
alter table ar_debt add column if not exists opd_ipd text;
alter table ar_debt add column if not exists payment_type text;
alter table ar_debt add column if not exists payment_1_date date;
alter table ar_debt add column if not exists payment_1_method text;
alter table ar_debt add column if not exists payment_1_amount numeric(18,2) default 0;
alter table ar_debt add column if not exists payment_2_date date;
alter table ar_debt add column if not exists payment_2_method text;
alter table ar_debt add column if not exists payment_2_amount numeric(18,2) default 0;
alter table ar_debt add column if not exists payment_3_date date;
alter table ar_debt add column if not exists payment_3_method text;
alter table ar_debt add column if not exists payment_3_amount numeric(18,2) default 0;
alter table ar_config_options add column if not exists category text;
alter table ar_config_options add column if not exists label text;
alter table ar_config_options add column if not exists sort_order integer default 0;
alter table ar_config_options add column if not exists is_active boolean default true;

update ar_config_options
set
  category = coalesce(category, 'legacy'),
  value = coalesce(value, key),
  label = coalesce(label, value, key),
  sort_order = coalesce(sort_order, 0),
  is_active = coalesce(is_active, true)
where category is null
   or value is null
   or label is null
   or sort_order is null
   or is_active is null;

alter table ar_config_options alter column key drop not null;
alter table ar_config_options alter column category set not null;
alter table ar_config_options alter column sort_order set default 0;
alter table ar_config_options alter column is_active set default true;
create index if not exists idx_ar_config_options_category_sort
  on ar_config_options(category, sort_order);

-- 2. ອັບເດດ debt_status ຕາມ debt
update ar_bills set debt_status = 'pending' where (debt_status is null or debt_status = '') and debt > 0;
update ar_bills set debt_status = 'paid'    where (debt_status is null or debt_status = '') and (debt is null or debt <= 0);
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

-- 3. Sync ໃບບິນທີ່ມີໜີ້ → ar_debt (ບໍ່ duplicate)
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
  and b.customer_type = 'INS'
  and not exists (select 1 from ar_debt d where d.bill_no = b.bill_no);

-- 4. ສຳເລັດ
select
  (select count(*) from ar_bills) as total_bills,
  (select count(*) from ar_bills where debt > 0) as bills_with_debt,
  (select count(*) from ar_debt) as total_debt_records;
