-- ============================================================
-- ກວດສອບ ແລະ ເພີ່ມ columns ທີ່ຂາດ + sync ໜີ້ຂອງ ar_bills → ar_debt
-- ປອດໄພ run ຫຼາຍຄັ້ງ (idempotent)
-- ============================================================

-- 1. ar_bills: ເພີ່ມ columns ທີ່ code ໃຊ້ງານ
alter table ar_bills add column if not exists debt_status      text;
alter table ar_bills add column if not exists recorded_by      text;
alter table ar_bills add column if not exists recorded_by_debt text;
alter table ar_insurance_list add column if not exists due_days integer not null default 30;
alter table ar_debt add column if not exists payment_1_date date;
alter table ar_debt add column if not exists payment_1_method text;
alter table ar_debt add column if not exists payment_1_amount numeric(18,2) default 0;
alter table ar_debt add column if not exists payment_2_date date;
alter table ar_debt add column if not exists payment_2_method text;
alter table ar_debt add column if not exists payment_2_amount numeric(18,2) default 0;
alter table ar_debt add column if not exists payment_3_date date;
alter table ar_debt add column if not exists payment_3_method text;
alter table ar_debt add column if not exists payment_3_amount numeric(18,2) default 0;

-- 2. ອັບເດດ debt_status ຕາມ debt
update ar_bills set debt_status = 'pending' where (debt_status is null or debt_status = '') and debt > 0;
update ar_bills set debt_status = 'paid'    where (debt_status is null or debt_status = '') and (debt is null or debt <= 0);

-- 3. Sync ໃບບິນທີ່ມີໜີ້ → ar_debt (ບໍ່ duplicate)
insert into ar_debt (
  date, bill_no, customer_type, insurance, hn, patient_name, gender, workload,
  grand_total, debt_amount, date_paid, submit_date,
  amount_paid, cash_paid, bcel_paid, bcel2_paid, ldb_paid,
  balance, due_date, aging_group
)
select
  b.date, b.bill_no, b.customer_type, b.insurance, b.hn, b.patient_name, b.gender, b.workload,
  b.grand_total,
  b.debt as debt_amount,
  null as date_paid,
  current_date as submit_date,
  0 as amount_paid,
  0 as cash_paid, 0 as bcel_paid, 0 as bcel2_paid, 0 as ldb_paid,
  b.debt as balance,
  (current_date + (coalesce(i.due_days, 30) || ' days')::interval)::date as due_date,
  'Due on schedule' as aging_group
from ar_bills b
left join ar_insurance_list i on i.name = b.insurance
where b.debt > 0
  and not exists (select 1 from ar_debt d where d.bill_no = b.bill_no);

-- 4. ສຳເລັດ
select
  (select count(*) from ar_bills) as total_bills,
  (select count(*) from ar_bills where debt > 0) as bills_with_debt,
  (select count(*) from ar_debt) as total_debt_records;
