-- ============================================================
-- Editable RBAC permissions for AR Finance
-- Run this in Supabase SQL Editor after fix_profiles_admin.sql.
-- ============================================================

alter table public.profiles
  add column if not exists active boolean not null default true;

update public.profiles
set active = true
where active is null;

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

alter table public.role_permissions enable row level security;
alter table public.user_permissions enable row level security;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select role
      from public.profiles
      where id = auth.uid()
        and active is true
    ),
    'inactive'
  );
$$;

drop policy if exists "role_permissions_read_authenticated" on public.role_permissions;
drop policy if exists "role_permissions_admin_manage" on public.role_permissions;
drop policy if exists "user_permissions_read_own_or_admin" on public.user_permissions;
drop policy if exists "user_permissions_admin_manage" on public.user_permissions;

create policy "role_permissions_read_authenticated"
  on public.role_permissions for select
  using (auth.uid() is not null);

create policy "role_permissions_admin_manage"
  on public.role_permissions for all
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

create policy "user_permissions_read_own_or_admin"
  on public.user_permissions for select
  using (auth.uid() = user_id or public.current_user_role() = 'admin');

create policy "user_permissions_admin_manage"
  on public.user_permissions for all
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
-- Keep auth signup simple: RBAC Management creates/updates public.profiles
-- after the Auth user is created. A profile-sync trigger here can block signup
-- with "Database error saving new user" if profiles/RLS changes later.

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
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token,
      is_super_admin,
      is_sso_user,
      is_anonymous
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
      provider_id,
      user_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    )
    values (
      target_id::text,
      target_id,
      jsonb_build_object(
        'sub', target_id::text,
        'email', normalized_email,
        'email_verified', true,
        'phone_verified', false
      ),
      'email',
      now(),
      now(),
      now()
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

insert into public.role_permissions (role, permissions)
values
  (
    'admin',
    array[
      'page.daily_sales',
      'page.customer_service',
      'page.payment_channel',
      'page.outstanding_debt',
      'page.aging_report',
      'page.bills',
      'page.debt',
      'page.upload',
      'page.rbac',
      'reports.view',
      'reports.export',
      'records.view',
      'records.write',
      'records.delete',
      'data.upload',
      'users.manage'
    ]
  ),
  (
    'manager',
    array[
      'page.daily_sales',
      'page.customer_service',
      'page.payment_channel',
      'page.outstanding_debt',
      'page.aging_report',
      'page.bills',
      'page.debt',
      'page.upload',
      'reports.view',
      'reports.export',
      'records.view',
      'records.write',
      'data.upload'
    ]
  ),
  (
    'staff',
    array[
      'page.daily_sales',
      'page.customer_service',
      'page.payment_channel',
      'page.outstanding_debt',
      'page.aging_report',
      'page.bills',
      'page.debt',
      'reports.view',
      'reports.export',
      'records.view',
      'records.write'
    ]
  ),
  (
    'viewer',
    array[
      'page.daily_sales',
      'page.customer_service',
      'page.payment_channel',
      'page.outstanding_debt',
      'page.aging_report',
      'reports.view',
      'reports.export'
    ]
  )
on conflict (role) do nothing;

select
  case
    when exists (
      select 1
      from pg_trigger
      where tgrelid = 'auth.users'::regclass
        and tgname = 'on_auth_user_created'
    )
    then 'ERROR: on_auth_user_created trigger still exists'
    else 'OK: auth signup trigger removed'
  end as auth_signup_check;
