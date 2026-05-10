-- ============================================================
-- Repair Supabase Auth signup for AR Finance RBAC
-- Run this if Add user shows:
-- "Database error saving new user" or "Auth trigger is blocking signup".
-- ============================================================

drop trigger if exists on_auth_user_created on auth.users;

do $$
declare
  trigger_to_drop record;
begin
  for trigger_to_drop in
    select n.nspname, c.relname, t.tgname
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_proc p on p.oid = t.tgfoid
    where n.nspname = 'auth'
      and c.relname in ('users', 'identities')
      and t.tgisinternal is false
  loop
    execute format(
      'drop trigger if exists %I on %I.%I',
      trigger_to_drop.tgname,
      trigger_to_drop.nspname,
      trigger_to_drop.relname
    );
  end loop;
end $$;

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

select
  coalesce(
    json_agg(
      json_build_object(
        'schema', n.nspname,
        'table', c.relname,
        'trigger', t.tgname,
        'function', p.proname
      )
    ),
    '[]'::json
  ) as remaining_custom_auth_triggers
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
join pg_proc p on p.oid = t.tgfoid
where n.nspname = 'auth'
  and c.relname in ('users', 'identities')
  and t.tgisinternal is false;
