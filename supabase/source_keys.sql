-- Preserve every row from Google Sheets exports, even when Bill No repeats.
-- Run this once in the Supabase SQL Editor before uploading the corrected Excel file.

alter table ar_bills add column if not exists source_key text;
alter table ar_debt add column if not exists source_key text;

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
  source_key text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

update ar_bills
set source_key = 'legacy__ar_bills__' || id::text
where source_key is null;

update ar_debt
set source_key = 'legacy__ar_debt__' || id::text
where source_key is null;

alter table ar_bills alter column source_key set not null;
alter table ar_debt alter column source_key set not null;

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'ar_bills'::regclass
      and contype = 'u'
  loop
    execute format('alter table ar_bills drop constraint if exists %I', constraint_name);
  end loop;

  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'ar_debt'::regclass
      and contype = 'u'
  loop
    execute format('alter table ar_debt drop constraint if exists %I', constraint_name);
  end loop;
end $$;

create unique index if not exists ar_bills_source_key_uidx on ar_bills(source_key);
create unique index if not exists ar_debt_source_key_uidx on ar_debt(source_key);
create unique index if not exists ar_cashflow_source_key_uidx on ar_cashflow(source_key);

create index if not exists idx_ar_bills_bill_date_workload on ar_bills(bill_no, date, workload);
create index if not exists idx_ar_debt_bill_date on ar_debt(bill_no, date);
create index if not exists idx_ar_cashflow_date on ar_cashflow(date);
create index if not exists idx_ar_cashflow_workload on ar_cashflow(workload);

alter table ar_cashflow enable row level security;

drop policy if exists "ar_cashflow_read" on ar_cashflow;
drop policy if exists "ar_cashflow_insert" on ar_cashflow;
drop policy if exists "ar_cashflow_update" on ar_cashflow;
drop policy if exists "ar_cashflow_delete" on ar_cashflow;

create policy "ar_cashflow_read" on ar_cashflow for select using (true);
create policy "ar_cashflow_insert" on ar_cashflow for insert with check (true);
create policy "ar_cashflow_update" on ar_cashflow for update using (true);
create policy "ar_cashflow_delete" on ar_cashflow for delete using (true);
