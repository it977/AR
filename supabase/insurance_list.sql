-- Insurance companies lookup table
create table if not exists insurance_list (
  id   uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz default now()
);

alter table insurance_list enable row level security;

drop policy if exists "ins_select" on insurance_list;
drop policy if exists "ins_insert" on insurance_list;
drop policy if exists "ins_delete" on insurance_list;

create policy "ins_select" on insurance_list for select using (true);
create policy "ins_insert" on insurance_list for insert with check (true);
create policy "ins_delete" on insurance_list for delete using (true);

-- Seed data
insert into insurance_list (name) values
  ('Sokxay'),
  ('APA'),
  ('AGL'),
  ('Forte'),
  ('ST'),
  ('VT'),
  ('Zhongji'),
  ('Champa'),
  ('ICL'),
  ('Lanexang'),
  ('LVV'),
  ('Dhipaya'),
  ('Prudential'),
  ('Laothepchalem')
on conflict (name) do nothing;
