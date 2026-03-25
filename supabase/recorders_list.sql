-- Recorders lookup table
create table if not exists recorders_list (
  id   uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz default now()
);

alter table recorders_list enable row level security;

drop policy if exists "rec_select" on recorders_list;
drop policy if exists "rec_insert" on recorders_list;
drop policy if exists "rec_update" on recorders_list;
drop policy if exists "rec_delete" on recorders_list;

create policy "rec_select" on recorders_list for select using (true);
create policy "rec_insert" on recorders_list for insert with check (true);
create policy "rec_update" on recorders_list for update using (true);
create policy "rec_delete" on recorders_list for delete using (true);

-- Add recorded_by column to ar_bills
alter table ar_bills add column if not exists recorded_by text;
