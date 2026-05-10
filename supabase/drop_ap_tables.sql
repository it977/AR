-- ============================================================
-- Drop legacy AP tables from Supabase
-- Safe to run multiple times.
-- ============================================================

begin;

drop table if exists public.ap_payment cascade;
drop table if exists public.ap_register cascade;
drop table if exists public.ap_po cascade;
drop table if exists public.ap_pr cascade;
drop table if exists public.ap_vendors cascade;
drop table if exists public.ap_debt cascade;
drop table if exists public.ap_bills cascade;

commit;

-- Optional helper cleanup.
-- Uncomment only if you are sure no remaining trigger uses this function.
-- drop function if exists public.update_updated_at_column();

-- Optional verification.
-- select schemaname, tablename
-- from pg_tables
-- where schemaname = 'public' and tablename like 'ap_%'
-- order by tablename;