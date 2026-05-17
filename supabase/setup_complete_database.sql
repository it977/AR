-- ============================================================
-- AR Finance Dashboard — Complete Database Setup
-- For new Supabase instance: yomxctcjjlcujmowkhru
-- Run this ENTIRE script in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. Core Tables: ar_bills, ar_debt, ar_cashflow
-- ============================================================
create table if not exists ar_bills (
  id            uuid default gen_random_uuid() primary key,
  date          date,
  week          text,
  workload      text,
  bill_no       text,
  insite_onsite text,
  opd_ipd       text,
  customer_type text,
  insurance     text,
  hn            text,
  patient_name  text,
  gender        text,
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
  total           numeric(18,2) default 0,
  discounts       numeric(18,2) default 0,
  grand_total     numeric(18,2) default 0,
  cash            numeric(18,2) default 0,
  bcel            numeric(18,2) default 0,
  bcel2           numeric(18,2) default 0,
  ldb             numeric(18,2) default 0,
  debt            numeric(18,2) default 0,
  prepayment      numeric(18,2) default 0,
  note            text,
  aging_group     text,
  source_key      text,
  debt_status     text,
  recorded_by     text,
  recorded_by_debt text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique(source_key)
);

create index if not exists idx_ar_bills_date         on ar_bills(date);
create index if not exists idx_ar_bills_workload      on ar_bills(workload);
create index if not exists idx_ar_bills_customer_type on ar_bills(customer_type);
create index if not exists idx_ar_bills_insurance     on ar_bills(insurance);
create index if not exists idx_ar_bills_aging         on ar_bills(aging_group);
create index if not exists idx_ar_bills_bill_date_workload on ar_bills(bill_no, date, workload);

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
  debt_amount   numeric(18,2) default 0,
  date_paid       date,
  submit_date     date,
  amount_paid     numeric(18,2) default 0,
  cash_paid       numeric(18,2) default 0,
  bcel_paid       numeric(18,2) default 0,
  bcel2_paid      numeric(18,2) default 0,
  ldb_paid        numeric(18,2) default 0,
  balance         numeric(18,2) default 0,
  due_date        date,
  aging_group     text,
  source_key      text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique(source_key)
);

create index if not exists idx_ar_debt_date      on ar_debt(date);
create index if not exists idx_ar_debt_insurance on ar_debt(insurance);
create index if not exists idx_ar_debt_aging     on ar_debt(aging_group);
create index if not exists idx_ar_debt_type      on ar_debt(customer_type);
create index if not exists idx_ar_debt_bill_date on ar_debt(bill_no, date);

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
-- 2. Settings Tables
-- ============================================================
create table if not exists ar_config_options (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists ar_insurance_list (
  id   uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz default now()
);

create table if not exists ar_recorders_list (
  id   uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz default now()
);

-- Seed insurance data
insert into ar_insurance_list (name) values
  ('Sokxay'), ('APA'), ('AGL'), ('Forte'), ('ST'), ('VT'),
  ('Zhongji'), ('Champa'), ('ICL'), ('Lanexang'), ('LVV'),
  ('Dhipaya'), ('Prudential'), ('Laothepchalem')
on conflict (name) do nothing;

-- ============================================================
-- 3. Auth & Profiles
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'viewer'
    check (role in ('admin', 'manager', 'staff', 'viewer')),
  active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_email on public.profiles(email);

-- ============================================================
-- 4. RBAC Tables
-- ============================================================
create table if not exists public.role_permissions (
  role text primary key
    check (role in ('admin', 'manager', 'staff', 'viewer')),
  permissions text[] not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.user_permissions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  allowed_permissions text[] not null default '{}',
  denied_permissions text[] not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- 5. Activity Logs
-- ============================================================
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

create index if not exists idx_activity_logs_created_at on public.activity_logs(created_at desc);
create index if not exists idx_activity_logs_user_id on public.activity_logs(user_id);
create index if not exists idx_activity_logs_action_type on public.activity_logs(action_type);
create index if not exists idx_activity_logs_entity on public.activity_logs(entity_type, entity_id);

-- ============================================================
-- 6. Drop legacy AP tables
-- ============================================================
drop table if exists public.ap_payment cascade;
drop table if exists public.ap_register cascade;
drop table if exists public.ap_po cascade;
drop table if exists public.ap_pr cascade;
drop table if exists public.ap_vendors cascade;
drop table if exists public.ap_debt cascade;
drop table if exists public.ap_bills cascade;

-- ============================================================
-- 7. Helper Functions
-- ============================================================
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid() and active is true),
    'viewer'
  );
$$;

create or replace function public.has_role(allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = any(allowed_roles);
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create or replace function public.admin_upsert_profile_by_email(
  p_email text,
  p_full_name text default null,
  p_role text default 'viewer',
  p_active boolean default true
)
returns table (
  id uuid,
  email text,
  full_name text,
  role text,
  active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user auth.users%rowtype;
begin
  if public.current_user_role() <> 'admin' then
    raise exception 'Only admins can add or update user profiles.';
  end if;

  if p_role not in ('admin', 'manager', 'staff', 'viewer') then
    raise exception 'Invalid role: %', p_role;
  end if;

  select *
  into target_user
  from auth.users
  where lower(auth.users.email) = lower(trim(p_email))
  limit 1;

  if target_user.id is null then
    raise exception 'Auth user with email % does not exist. Create the user in Authentication first.', p_email;
  end if;

  insert into public.profiles (id, email, full_name, role, active)
  values (
    target_user.id,
    target_user.email,
    coalesce(nullif(trim(p_full_name), ''), target_user.email),
    p_role,
    p_active
  )
  on conflict on constraint profiles_pkey do update
    set email = excluded.email,
        full_name = excluded.full_name,
        role = excluded.role,
        active = excluded.active,
        updated_at = now();

  return query
  select p.id, p.email, p.full_name, p.role, p.active, p.created_at, p.updated_at
  from public.profiles p
  where p.id = target_user.id;
end;
$$;

grant execute on function public.admin_upsert_profile_by_email(text, text, text, boolean) to authenticated;

create extension if not exists pgcrypto;

create or replace function public.admin_create_app_user(
  p_email text,
  p_password text,
  p_full_name text default null,
  p_role text default 'viewer',
  p_active boolean default true
)
returns table (
  id uuid,
  email text,
  full_name text,
  role text,
  active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  normalized_email text := lower(trim(p_email));
  target_user auth.users%rowtype;
  target_id uuid;
begin
  if public.current_user_role() <> 'admin' then
    raise exception 'Only admins can create users.';
  end if;

  if normalized_email = '' or normalized_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
    raise exception 'Invalid email address.';
  end if;

  if length(coalesce(p_password, '')) < 6 then
    raise exception 'Password must be at least 6 characters.';
  end if;

  if p_role not in ('admin', 'manager', 'staff', 'viewer') then
    raise exception 'Invalid role: %', p_role;
  end if;

  select *
  into target_user
  from auth.users
  where lower(auth.users.email) = normalized_email
  limit 1;

  if target_user.id is null then
    target_id := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change,
      email_change_token_new, recovery_token, is_super_admin,
      is_sso_user, is_anonymous
    )
    values (
      '00000000-0000-0000-0000-000000000000',
      target_id,
      'authenticated',
      'authenticated',
      normalized_email,
      crypt(p_password, gen_salt('bf')),
      now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      jsonb_build_object(
        'full_name', coalesce(nullif(trim(p_full_name), ''), normalized_email),
        'email_verified', true,
        'phone_verified', false
      ),
      now(),
      now(),
      '',
      '',
      '',
      '',
      false,
      false,
      false
    );

    insert into auth.identities (
      provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    )
    values (
      target_id::text, target_id,
      jsonb_build_object(
        'sub', target_id::text,
        'email', normalized_email,
        'email_verified', true,
        'phone_verified', false
      ),
      'email',
      now(), now(), now()
    );
  else
    target_id := target_user.id;

    update auth.users
    set encrypted_password = crypt(p_password, gen_salt('bf')),
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) ||
          jsonb_build_object(
            'full_name', coalesce(nullif(trim(p_full_name), ''), normalized_email),
            'email_verified', true,
            'phone_verified', false
          ),
        updated_at = now()
    where auth.users.id = target_id;
  end if;

  insert into public.profiles (id, email, full_name, role, active)
  values (
    target_id,
    normalized_email,
    coalesce(nullif(trim(p_full_name), ''), normalized_email),
    p_role,
    p_active
  )
  on conflict on constraint profiles_pkey do update
    set email = excluded.email,
        full_name = excluded.full_name,
        role = excluded.role,
        active = excluded.active,
        updated_at = now();

  return query
  select p.id, p.email, p.full_name, p.role, p.active, p.created_at, p.updated_at
  from public.profiles p
  where p.id = target_id;
end;
$$;

grant execute on function public.admin_create_app_user(text, text, text, text, boolean) to authenticated;

-- ============================================================
-- 8. Enable RLS on all tables
-- ============================================================
alter table ar_bills enable row level security;
alter table ar_debt  enable row level security;
alter table ar_cashflow enable row level security;
alter table ar_config_options enable row level security;
alter table ar_insurance_list enable row level security;
alter table ar_recorders_list enable row level security;
alter table public.profiles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_permissions enable row level security;
alter table public.activity_logs enable row level security;

-- ============================================================
-- 9. RLS Policies
-- ============================================================

-- ar_bills
drop policy if exists "ar_bills_read" on ar_bills;
drop policy if exists "ar_bills_insert" on ar_bills;
drop policy if exists "ar_bills_update" on ar_bills;
drop policy if exists "ar_bills_delete" on ar_bills;
create policy "ar_bills_read" on ar_bills for select using (auth.uid() is not null);
create policy "ar_bills_insert" on ar_bills for insert with check (auth.uid() is not null);
create policy "ar_bills_update" on ar_bills for update using (auth.uid() is not null);
create policy "ar_bills_delete" on ar_bills for delete using (public.current_user_role() = 'admin');

-- ar_debt
drop policy if exists "ar_debt_read" on ar_debt;
drop policy if exists "ar_debt_insert" on ar_debt;
drop policy if exists "ar_debt_update" on ar_debt;
drop policy if exists "ar_debt_delete" on ar_debt;
create policy "ar_debt_read" on ar_debt for select using (auth.uid() is not null);
create policy "ar_debt_insert" on ar_debt for insert with check (auth.uid() is not null);
create policy "ar_debt_update" on ar_debt for update using (auth.uid() is not null);
create policy "ar_debt_delete" on ar_debt for delete using (public.current_user_role() = 'admin');

-- ar_cashflow
drop policy if exists "ar_cashflow_read" on ar_cashflow;
drop policy if exists "ar_cashflow_insert" on ar_cashflow;
drop policy if exists "ar_cashflow_update" on ar_cashflow;
drop policy if exists "ar_cashflow_delete" on ar_cashflow;
create policy "ar_cashflow_read" on ar_cashflow for select using (auth.uid() is not null);
create policy "ar_cashflow_insert" on ar_cashflow for insert with check (auth.uid() is not null);
create policy "ar_cashflow_update" on ar_cashflow for update using (auth.uid() is not null);
create policy "ar_cashflow_delete" on ar_cashflow for delete using (public.current_user_role() = 'admin');

-- ar_config_options
drop policy if exists "config_read" on ar_config_options;
drop policy if exists "config_insert" on ar_config_options;
drop policy if exists "config_update" on ar_config_options;
drop policy if exists "config_delete" on ar_config_options;
create policy "config_read" on ar_config_options for select using (auth.uid() is not null);
create policy "config_insert" on ar_config_options for insert with check (auth.uid() is not null);
create policy "config_update" on ar_config_options for update using (auth.uid() is not null);
create policy "config_delete" on ar_config_options for delete using (public.current_user_role() = 'admin');

-- ar_insurance_list
drop policy if exists "insurance_read" on ar_insurance_list;
drop policy if exists "insurance_insert" on ar_insurance_list;
drop policy if exists "insurance_update" on ar_insurance_list;
drop policy if exists "insurance_delete" on ar_insurance_list;
create policy "insurance_read" on ar_insurance_list for select using (auth.uid() is not null);
create policy "insurance_insert" on ar_insurance_list for insert with check (auth.uid() is not null);
create policy "insurance_update" on ar_insurance_list for update using (auth.uid() is not null);
create policy "insurance_delete" on ar_insurance_list for delete using (public.current_user_role() = 'admin');

-- ar_recorders_list
drop policy if exists "recorders_read" on ar_recorders_list;
drop policy if exists "recorders_insert" on ar_recorders_list;
drop policy if exists "recorders_update" on ar_recorders_list;
drop policy if exists "recorders_delete" on ar_recorders_list;
create policy "recorders_read" on ar_recorders_list for select using (auth.uid() is not null);
create policy "recorders_insert" on ar_recorders_list for insert with check (auth.uid() is not null);
create policy "recorders_update" on ar_recorders_list for update using (auth.uid() is not null);
create policy "recorders_delete" on ar_recorders_list for delete using (public.current_user_role() = 'admin');

-- profiles
drop policy if exists "profiles_read_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own_name" on public.profiles;
drop policy if exists "profiles_admin_manage" on public.profiles;
create policy "profiles_read_own" on public.profiles for select using (auth.uid() = id or public.current_user_role() = 'admin');
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own_name" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id and role = public.current_user_role());
create policy "profiles_admin_manage" on public.profiles for all using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

-- role_permissions
drop policy if exists "role_permissions_read_authenticated" on public.role_permissions;
drop policy if exists "role_permissions_admin_manage" on public.role_permissions;
create policy "role_permissions_read_authenticated" on public.role_permissions for select using (auth.uid() is not null);
create policy "role_permissions_admin_manage" on public.role_permissions for all using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

-- user_permissions
drop policy if exists "user_permissions_read_own_or_admin" on public.user_permissions;
drop policy if exists "user_permissions_admin_manage" on public.user_permissions;
create policy "user_permissions_read_own_or_admin" on public.user_permissions for select using (auth.uid() = user_id or public.current_user_role() = 'admin');
create policy "user_permissions_admin_manage" on public.user_permissions for all using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

-- activity_logs
drop policy if exists "activity_logs_admin_read" on public.activity_logs;
drop policy if exists "activity_logs_insert_authenticated" on public.activity_logs;
create policy "activity_logs_admin_read" on public.activity_logs for select using (public.current_user_role() = 'admin');
create policy "activity_logs_insert_authenticated" on public.activity_logs for insert with check (auth.uid() is not null);

-- ============================================================
-- 10. Views
-- ============================================================
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

create or replace view v_ar_aging as
select
  aging_group,
  count(*)        as bills,
  sum(balance)    as balance
from ar_debt
group by aging_group
order by aging_group;

create or replace view v_ar_insurance_debt as
select
  insurance,
  count(*)     as bills,
  sum(balance) as balance
from ar_debt
where balance > 0
group by insurance
order by balance desc;

-- ============================================================
-- 11. Seed Role Permissions
-- ============================================================
insert into public.role_permissions (role, permissions)
values
  (
    'admin',
    array[
      'page.daily_sales', 'page.customer_service', 'page.payment_channel',
      'page.outstanding_debt', 'page.aging_report', 'page.bills',
      'page.debt', 'page.upload', 'page.rbac', 'page.settings',
      'reports.view', 'reports.export', 'records.view', 'records.write',
      'records.delete', 'data.upload', 'users.manage'
    ]
  ),
  (
    'manager',
    array[
      'page.daily_sales', 'page.customer_service', 'page.payment_channel',
      'page.outstanding_debt', 'page.aging_report', 'page.bills',
      'page.debt', 'page.upload', 'page.settings',
      'reports.view', 'reports.export', 'records.view', 'records.write',
      'data.upload'
    ]
  ),
  (
    'staff',
    array[
      'page.daily_sales', 'page.customer_service', 'page.payment_channel',
      'page.outstanding_debt', 'page.aging_report', 'page.bills',
      'page.debt', 'reports.view', 'reports.export',
      'records.view', 'records.write'
    ]
  ),
  (
    'viewer',
    array[
      'page.daily_sales', 'page.customer_service', 'page.payment_channel',
      'page.outstanding_debt', 'page.aging_report',
      'reports.view', 'reports.export'
    ]
  )
on conflict (role) do nothing;

-- ============================================================
-- 12. Sync existing debt from bills
-- ============================================================
update ar_bills set debt_status = 'pending' where (debt_status is null or debt_status = '') and debt > 0;
update ar_bills set debt_status = 'paid' where (debt_status is null or debt_status = '') and (debt is null or debt <= 0);

insert into ar_debt (
  date, bill_no, customer_type, insurance, hn, patient_name, gender, workload,
  grand_total, debt_amount, date_paid, submit_date,
  amount_paid, cash_paid, bcel_paid, bcel2_paid, ldb_paid,
  balance, due_date, aging_group
)
select
  b.date, b.bill_no, b.customer_type, b.insurance, b.hn, b.patient_name, b.gender, b.workload,
  b.grand_total, b.debt as debt_amount, b.date as date_paid, current_date as submit_date,
  coalesce(b.cash,0)+coalesce(b.bcel,0)+coalesce(b.bcel2,0)+coalesce(b.ldb,0) as amount_paid,
  coalesce(b.cash,0), coalesce(b.bcel,0), coalesce(b.bcel2,0), coalesce(b.ldb,0),
  b.debt as balance, (b.date + interval '30 days')::date as due_date,
  coalesce(b.aging_group, 'N') as aging_group
from ar_bills b
where b.debt > 0
  and not exists (select 1 from ar_debt d where d.bill_no = b.bill_no);

-- ============================================================
-- 13. Verification
-- ============================================================
select
  (select count(*) from ar_bills) as total_bills,
  (select count(*) from ar_debt) as total_debt_records,
  (select count(*) from ar_cashflow) as total_cashflow_records,
  (select count(*) from ar_insurance_list) as total_insurance_companies,
  (select count(*) from ar_recorders_list) as total_recorders,
  (select count(*) from public.profiles) as total_profiles,
  (select count(*) from public.role_permissions) as total_role_permissions;
