-- ============================================================
-- AR Finance Dashboard - Supabase Auth + RBAC
-- Run in Supabase SQL Editor after enabling Email auth.
-- ============================================================

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'viewer'
    check (role in ('admin', 'manager', 'staff', 'viewer')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_profiles_role on profiles(role);

alter table profiles enable row level security;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from profiles where id = auth.uid()), 'viewer');
$$;

drop policy if exists "profiles_read_own" on profiles;
drop policy if exists "profiles_insert_own" on profiles;
drop policy if exists "profiles_update_own_name" on profiles;
drop policy if exists "profiles_admin_manage" on profiles;

create policy "profiles_read_own"
  on profiles for select
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_own_name"
  on profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id and role = public.current_user_role());

create policy "profiles_admin_manage"
  on profiles for all
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

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
-- Do not attach a profile-sync trigger to auth.users. RBAC Management creates
-- app profiles after signup, and trigger failures block Auth with
-- "Database error saving new user".

create or replace function public.has_role(allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = any(allowed_roles);
$$;

-- Optional stricter RLS for finance tables.
-- Run this block when all users have Supabase Auth accounts and profiles.
drop policy if exists "ar_bills_read" on ar_bills;
drop policy if exists "ar_bills_insert" on ar_bills;
drop policy if exists "ar_bills_update" on ar_bills;
drop policy if exists "ar_bills_delete" on ar_bills;

create policy "ar_bills_read" on ar_bills
  for select using (auth.uid() is not null and public.has_role(array['admin','manager','staff','viewer']));
create policy "ar_bills_insert" on ar_bills
  for insert with check (auth.uid() is not null and public.has_role(array['admin','manager','staff']));
create policy "ar_bills_update" on ar_bills
  for update using (auth.uid() is not null and public.has_role(array['admin','manager','staff']));
create policy "ar_bills_delete" on ar_bills
  for delete using (auth.uid() is not null and public.has_role(array['admin']));

drop policy if exists "ar_debt_read" on ar_debt;
drop policy if exists "ar_debt_insert" on ar_debt;
drop policy if exists "ar_debt_update" on ar_debt;
drop policy if exists "ar_debt_delete" on ar_debt;

create policy "ar_debt_read" on ar_debt
  for select using (auth.uid() is not null and public.has_role(array['admin','manager','staff','viewer']));
create policy "ar_debt_insert" on ar_debt
  for insert with check (auth.uid() is not null and public.has_role(array['admin','manager','staff']));
create policy "ar_debt_update" on ar_debt
  for update using (auth.uid() is not null and public.has_role(array['admin','manager','staff']));
create policy "ar_debt_delete" on ar_debt
  for delete using (auth.uid() is not null and public.has_role(array['admin']));

drop policy if exists "ar_cashflow_read" on ar_cashflow;
drop policy if exists "ar_cashflow_insert" on ar_cashflow;
drop policy if exists "ar_cashflow_update" on ar_cashflow;
drop policy if exists "ar_cashflow_delete" on ar_cashflow;

create policy "ar_cashflow_read" on ar_cashflow
  for select using (auth.uid() is not null and public.has_role(array['admin','manager','staff','viewer']));
create policy "ar_cashflow_insert" on ar_cashflow
  for insert with check (auth.uid() is not null and public.has_role(array['admin','manager']));
create policy "ar_cashflow_update" on ar_cashflow
  for update using (auth.uid() is not null and public.has_role(array['admin','manager']));
create policy "ar_cashflow_delete" on ar_cashflow
  for delete using (auth.uid() is not null and public.has_role(array['admin']));

-- Promote the first admin after creating the user in Supabase Auth:
-- update profiles set role = 'admin' where email = 'admin@example.com';
