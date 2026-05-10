-- ============================================================
-- Fix missing AR tables and install audit logging
-- Run on remote Supabase when console shows REST 404 for ar_cashflow.
-- ============================================================

create table if not exists public.ar_cashflow (
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

create index if not exists idx_ar_cashflow_date on public.ar_cashflow(date);
create index if not exists idx_ar_cashflow_workload on public.ar_cashflow(workload);

alter table public.ar_cashflow enable row level security;

drop policy if exists "ar_cashflow_read" on public.ar_cashflow;
drop policy if exists "ar_cashflow_insert" on public.ar_cashflow;
drop policy if exists "ar_cashflow_update" on public.ar_cashflow;
drop policy if exists "ar_cashflow_delete" on public.ar_cashflow;

create policy "ar_cashflow_read" on public.ar_cashflow
  for select using (auth.uid() is not null);
create policy "ar_cashflow_insert" on public.ar_cashflow
  for insert with check (auth.uid() is not null);
create policy "ar_cashflow_update" on public.ar_cashflow
  for update using (auth.uid() is not null)
  with check (auth.uid() is not null);
create policy "ar_cashflow_delete" on public.ar_cashflow
  for delete using (public.current_user_role() = 'admin');

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  user_email text,
  action text not null,
  action_type text,
  entity_type text,
  entity_id text,
  bill_no text,
  patient_name text,
  amount numeric,
  details text,
  metadata jsonb not null default '{}'::jsonb,
  recorder text,
  user_agent text,
  ip_address inet,
  created_at timestamptz not null default now()
);

alter table public.activity_logs add column if not exists user_id text;
alter table public.activity_logs add column if not exists created_at timestamptz not null default now();
alter table public.activity_logs add column if not exists user_email text;
alter table public.activity_logs add column if not exists action_type text;
alter table public.activity_logs add column if not exists entity_type text;
alter table public.activity_logs add column if not exists entity_id text;
alter table public.activity_logs add column if not exists bill_no text;
alter table public.activity_logs add column if not exists patient_name text;
alter table public.activity_logs add column if not exists amount numeric;
alter table public.activity_logs add column if not exists recorder text;
alter table public.activity_logs add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.activity_logs add column if not exists user_agent text;
alter table public.activity_logs add column if not exists ip_address inet;

create index if not exists idx_activity_logs_created_at on public.activity_logs(created_at desc);
create index if not exists idx_activity_logs_user_id on public.activity_logs(user_id);
create index if not exists idx_activity_logs_action_type on public.activity_logs(action_type);
create index if not exists idx_activity_logs_entity on public.activity_logs(entity_type, entity_id);

alter table public.activity_logs enable row level security;

drop policy if exists "log_select" on public.activity_logs;
drop policy if exists "log_insert" on public.activity_logs;
drop policy if exists "activity_logs_admin_read" on public.activity_logs;
drop policy if exists "activity_logs_insert_authenticated" on public.activity_logs;

create policy "activity_logs_admin_read"
  on public.activity_logs for select
  using (public.current_user_role() = 'admin');

create policy "activity_logs_insert_authenticated"
  on public.activity_logs for insert
  with check (auth.uid() is not null);
