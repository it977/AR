-- ============================================================
-- AR Finance Dashboard — Supabase Schema (LXH)
-- Project: it977's Project (ໃຊ້ຮ່ວມກັບ LIS tables)
-- Run in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. ar_bills — ໃບບິນ AR ລາຍວັນ (Daily Transactions)
-- ============================================================
create table if not exists ar_bills (
  id            uuid default gen_random_uuid() primary key,
  date          date,
  week          text,
  workload      text,  -- '8AM-4PM' | '4PM-12AM' | '12AM-8AM'
  bill_no       text,
  insite_onsite text,  -- 'Insite' | 'Onsite'
  opd_ipd       text,  -- 'OPD' | 'IPD'
  customer_type text,  -- 'GN' | 'INS' | 'B2B'
  insurance     text,
  hn            text,
  patient_name  text,
  gender        text,

  -- ລາຍຮັບຕາມການບໍລິການ (LAK)
  svc_opd               numeric(18,2) default 0,
  svc_diag_image        numeric(18,2) default 0,
  svc_ipd               numeric(18,2) default 0,
  svc_surg_ot           numeric(18,2) default 0,
  svc_emergency         numeric(18,2) default 0,
  svc_chronic           numeric(18,2) default 0,
  svc_pharma            numeric(18,2) default 0,
  svc_support           numeric(18,2) default 0,
  svc_admin             numeric(18,2) default 0,
  svc_homecare          numeric(18,2) default 0,

  -- ຍອດເງິນ (LAK)
  total           numeric(18,2) default 0,
  discounts       numeric(18,2) default 0,
  grand_total     numeric(18,2) default 0,
  cash            numeric(18,2) default 0,
  bcel            numeric(18,2) default 0,
  bcel2           numeric(18,2) default 0,
  ldb             numeric(18,2) default 0,
  debt            numeric(18,2) default 0,  -- outstanding_debt
  prepayment      numeric(18,2) default 0,
  note            text,
  aging_group     text,
  source_key      text,

  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),

  unique(source_key)
);

-- Index ສຳລັບ query ໄວ
create index if not exists idx_ar_bills_date         on ar_bills(date);
create index if not exists idx_ar_bills_workload      on ar_bills(workload);
create index if not exists idx_ar_bills_customer_type on ar_bills(customer_type);
create index if not exists idx_ar_bills_insurance     on ar_bills(insurance);
create index if not exists idx_ar_bills_aging         on ar_bills(aging_group);

-- ============================================================
-- 2. ar_debt — ໜີ້ຄ້າງ / ປະກັນ (Insurance & Debt Payoff)
-- ============================================================
create table if not exists ar_debt (
  id            uuid default gen_random_uuid() primary key,
  date          date,
  bill_no       text,
  customer_type text,
  insurance     text,
  hn            text,
  patient_name  text,
  gender        text,
  workload      text,

  grand_total   numeric(18,2) default 0,
  debt_amount   numeric(18,2) default 0,  -- original outstanding

  -- ການຊຳລະ
  date_paid       date,
  submit_date     date,
  amount_paid     numeric(18,2) default 0,
  cash_paid       numeric(18,2) default 0,
  bcel_paid       numeric(18,2) default 0,
  bcel2_paid      numeric(18,2) default 0,
  ldb_paid        numeric(18,2) default 0,

  -- ການຊຳລະເປັນງວດ (ສູງສຸດ 3 ຄັ້ງ)
  payment_1_date   date,
  payment_1_method text,
  payment_1_amount numeric(18,2) default 0,
  payment_2_date   date,
  payment_2_method text,
  payment_2_amount numeric(18,2) default 0,
  payment_3_date   date,
  payment_3_method text,
  payment_3_amount numeric(18,2) default 0,

  balance         numeric(18,2) default 0,  -- ຍອດຄ້າງ
  due_date        date,
  aging_group     text,  -- 'N' | 'Due on schedule' | 'Pay in installments' | '1-15 Days' | '16-30 Days' | '31-45 Days' | '46-60+ Days'
  source_key      text,

  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),

  unique(source_key)
);

create index if not exists idx_ar_debt_date      on ar_debt(date);
create index if not exists idx_ar_debt_insurance on ar_debt(insurance);
create index if not exists idx_ar_debt_aging     on ar_debt(aging_group);
create index if not exists idx_ar_debt_type      on ar_debt(customer_type);

-- ============================================================
-- 2b. ar_cashflow — Looker/Summary_CashFlow source
-- ============================================================
create table if not exists ar_cashflow (
  id uuid default gen_random_uuid() primary key,
  date date,
  workload text,
  total_actual_income numeric(18,2) default 0,
  balance numeric(18,2) default 0,
  cash numeric(18,2) default 0,
  bcel numeric(18,2) default 0,
  bcel2 numeric(18,2) default 0,
  ldb numeric(18,2) default 0,
  outstanding_debt numeric(18,2) default 0,
  source_key text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique(source_key)
);

create index if not exists idx_ar_cashflow_date on ar_cashflow(date);
create index if not exists idx_ar_cashflow_workload on ar_cashflow(workload);

-- ============================================================
-- 3. Row Level Security
-- ============================================================
alter table ar_bills enable row level security;
alter table ar_debt  enable row level security;
alter table ar_cashflow enable row level security;

-- ອ່ານໄດ້ທຸກຄົນ (ປ່ຽນເປັນ auth-based ໃນ production)
create policy "ar_bills_read"   on ar_bills for select using (true);
create policy "ar_bills_insert" on ar_bills for insert with check (true);
create policy "ar_bills_update" on ar_bills for update using (true);
create policy "ar_bills_delete" on ar_bills for delete using (true);

create policy "ar_debt_read"    on ar_debt  for select using (true);
create policy "ar_debt_insert"  on ar_debt  for insert with check (true);
create policy "ar_debt_update"  on ar_debt  for update using (true);
create policy "ar_debt_delete"  on ar_debt  for delete using (true);

create policy "ar_cashflow_read"   on ar_cashflow for select using (true);
create policy "ar_cashflow_insert" on ar_cashflow for insert with check (true);
create policy "ar_cashflow_update" on ar_cashflow for update using (true);
create policy "ar_cashflow_delete" on ar_cashflow for delete using (true);

-- ============================================================
-- 4. Views ທີ່ໃຊ້ງ່າຍ
-- ============================================================

-- KPI ລາຍວັນ ຕາມວັນທີ + ກະ
create or replace view v_ar_daily_kpi as
select
  date,
  workload,
  count(*)                                       as bills,
  count(distinct hn)                             as patients,
  sum(grand_total)                               as sales,
  sum(discounts)                                 as discounts,
  sum(cash + bcel + bcel2 + ldb)                 as collected,
  sum(debt)                                      as outstanding
from ar_bills
group by date, workload
order by date desc;

-- Aging summary
create or replace view v_ar_aging as
select
  aging_group,
  count(*)        as bills,
  sum(balance)    as balance
from ar_debt
group by aging_group
order by aging_group;

-- ໜີ້ຕາມບໍລິສັດປະກັນ
create or replace view v_ar_insurance_debt as
select
  insurance,
  count(*)     as bills,
  sum(balance) as balance
from ar_debt
where balance > 0
group by insurance
order by balance desc;
