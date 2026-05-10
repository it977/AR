-- ============================================================
-- Fix RLS policies for GeneralSettings tables
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. recorders_list
alter table recorders_list enable row level security;

drop policy if exists "recorders_read"   on recorders_list;
drop policy if exists "recorders_insert" on recorders_list;
drop policy if exists "recorders_update" on recorders_list;
drop policy if exists "recorders_delete" on recorders_list;

create policy "recorders_read"   on recorders_list for select using (true);
create policy "recorders_insert" on recorders_list for insert with check (true);
create policy "recorders_update" on recorders_list for update using (true);
create policy "recorders_delete" on recorders_list for delete using (true);

-- 2. insurance_list
alter table insurance_list enable row level security;

drop policy if exists "insurance_read"   on insurance_list;
drop policy if exists "insurance_insert" on insurance_list;
drop policy if exists "insurance_update" on insurance_list;
drop policy if exists "insurance_delete" on insurance_list;

create policy "insurance_read"   on insurance_list for select using (true);
create policy "insurance_insert" on insurance_list for insert with check (true);
create policy "insurance_update" on insurance_list for update using (true);
create policy "insurance_delete" on insurance_list for delete using (true);

-- 3. app_config_options (ຮອງຮັບ authenticated users ດ້ວຍ)
drop policy if exists "config_read"   on app_config_options;
drop policy if exists "config_insert" on app_config_options;
drop policy if exists "config_update" on app_config_options;
drop policy if exists "config_delete" on app_config_options;

create policy "config_read"   on app_config_options for select using (true);
create policy "config_insert" on app_config_options for insert with check (true);
create policy "config_update" on app_config_options for update using (true);
create policy "config_delete" on app_config_options for delete using (true);
