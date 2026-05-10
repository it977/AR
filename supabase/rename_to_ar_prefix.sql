-- ============================================================
-- Rename tables ໃຫ້ມີ ar_ prefix
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Rename tables
alter table if exists app_config_options rename to ar_config_options;
alter table if exists insurance_list     rename to ar_insurance_list;
alter table if exists recorders_list     rename to ar_recorders_list;

-- 2. Drop & recreate RLS policies (ຊື່ policy ຕ້ອງ unique ໃນ table ໃໝ່)
-- ar_config_options
drop policy if exists "config_read"   on ar_config_options;
drop policy if exists "config_insert" on ar_config_options;
drop policy if exists "config_update" on ar_config_options;
drop policy if exists "config_delete" on ar_config_options;
create policy "config_read"   on ar_config_options for select using (true);
create policy "config_insert" on ar_config_options for insert with check (true);
create policy "config_update" on ar_config_options for update using (true);
create policy "config_delete" on ar_config_options for delete using (true);

-- ar_insurance_list
drop policy if exists "insurance_read"   on ar_insurance_list;
drop policy if exists "insurance_insert" on ar_insurance_list;
drop policy if exists "insurance_update" on ar_insurance_list;
drop policy if exists "insurance_delete" on ar_insurance_list;
create policy "insurance_read"   on ar_insurance_list for select using (true);
create policy "insurance_insert" on ar_insurance_list for insert with check (true);
create policy "insurance_update" on ar_insurance_list for update using (true);
create policy "insurance_delete" on ar_insurance_list for delete using (true);

-- ar_recorders_list
drop policy if exists "recorders_read"   on ar_recorders_list;
drop policy if exists "recorders_insert" on ar_recorders_list;
drop policy if exists "recorders_update" on ar_recorders_list;
drop policy if exists "recorders_delete" on ar_recorders_list;
create policy "recorders_read"   on ar_recorders_list for select using (true);
create policy "recorders_insert" on ar_recorders_list for insert with check (true);
create policy "recorders_update" on ar_recorders_list for update using (true);
create policy "recorders_delete" on ar_recorders_list for delete using (true);
