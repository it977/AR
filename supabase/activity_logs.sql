create table if not exists activity_logs (
  id          uuid primary key default gen_random_uuid(),
  action      text not null,
  bill_no     text,
  patient_name text,
  amount      numeric,
  details     text,
  recorder    text,
  created_at  timestamptz default now()
);

alter table activity_logs enable row level security;
drop policy if exists "log_select" on activity_logs;
drop policy if exists "log_insert" on activity_logs;
create policy "log_select" on activity_logs for select using (true);
create policy "log_insert" on activity_logs for insert with check (true);
