-- ============================================================
-- Fix missing profiles table and promote admin@example.com
-- Run this in Supabase SQL Editor.
-- ============================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'viewer'
    check (role in ('admin', 'manager', 'staff', 'viewer')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_email on public.profiles(email);

alter table public.profiles enable row level security;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid()),
    'viewer'
  );
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
-- RBAC Management creates/updates public.profiles after the Auth user is
-- created, so do not attach a trigger that can block Supabase Auth signup.

insert into public.profiles (id, email, full_name, role)
select
  id,
  email,
  coalesce(raw_user_meta_data->>'full_name', email),
  'viewer'
from auth.users
on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(public.profiles.full_name, excluded.full_name),
      updated_at = now();

drop policy if exists "profiles_read_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own_name" on public.profiles;
drop policy if exists "profiles_admin_manage" on public.profiles;

create policy "profiles_read_own"
  on public.profiles for select
  using (auth.uid() = id or public.current_user_role() = 'admin');

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_own_name"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id and role = public.current_user_role());

create policy "profiles_admin_manage"
  on public.profiles for all
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

update public.profiles
set role = 'admin',
    updated_at = now()
where email = 'admin@example.com';

select id, email, full_name, role
from public.profiles
where email = 'admin@example.com';
