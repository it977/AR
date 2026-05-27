-- Auto backup for AR Finance data.
-- Schedule target: 23:00 Asia/Bangkok every day.

create table if not exists ar_data_backups (
  id uuid primary key default gen_random_uuid(),
  backup_date date not null,
  backup_time text not null default '23:00',
  backup_kind text not null default 'daily',
  source text not null default 'manual',
  counts jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (backup_date, backup_kind)
);

alter table ar_data_backups enable row level security;

drop policy if exists "ar_data_backups_read" on ar_data_backups;
drop policy if exists "ar_data_backups_insert" on ar_data_backups;
drop policy if exists "ar_data_backups_update" on ar_data_backups;
drop policy if exists "ar_data_backups_delete" on ar_data_backups;

create policy "ar_data_backups_read" on ar_data_backups
  for select using (auth.uid() is not null);

create policy "ar_data_backups_insert" on ar_data_backups
  for insert with check (auth.uid() is not null);

create policy "ar_data_backups_update" on ar_data_backups
  for update using (auth.uid() is not null);

create policy "ar_data_backups_delete" on ar_data_backups
  for delete using (public.current_user_role() = 'admin');

create or replace function public.create_ar_daily_backup(p_source text default 'scheduled')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_backup_date date := (now() at time zone 'Asia/Bangkok')::date;
  v_id uuid;
begin
  insert into ar_data_backups (
    backup_date,
    backup_time,
    backup_kind,
    source,
    counts,
    payload
  )
  values (
    v_backup_date,
    '23:00',
    'daily',
    p_source,
    jsonb_build_object(
      'ar_bills', (select count(*) from ar_bills),
      'ar_debt', (select count(*) from ar_debt),
      'ar_cashflow', (select count(*) from ar_cashflow),
      'ar_insurance_list', (select count(*) from ar_insurance_list),
      'ar_recorders_list', (select count(*) from ar_recorders_list),
      'ar_config_options', (select count(*) from ar_config_options)
    ),
    jsonb_build_object(
      'ar_bills', coalesce((select jsonb_agg(to_jsonb(t)) from ar_bills t), '[]'::jsonb),
      'ar_debt', coalesce((select jsonb_agg(to_jsonb(t)) from ar_debt t), '[]'::jsonb),
      'ar_cashflow', coalesce((select jsonb_agg(to_jsonb(t)) from ar_cashflow t), '[]'::jsonb),
      'ar_insurance_list', coalesce((select jsonb_agg(to_jsonb(t)) from ar_insurance_list t), '[]'::jsonb),
      'ar_recorders_list', coalesce((select jsonb_agg(to_jsonb(t)) from ar_recorders_list t), '[]'::jsonb),
      'ar_config_options', coalesce((select jsonb_agg(to_jsonb(t)) from ar_config_options t), '[]'::jsonb)
    )
  )
  on conflict (backup_date, backup_kind)
  do update set
    backup_time = excluded.backup_time,
    source = excluded.source,
    counts = excluded.counts,
    payload = excluded.payload,
    created_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

-- Supabase pg_cron normally runs in UTC. 16:00 UTC = 23:00 Asia/Bangkok.
do $$
begin
  create extension if not exists pg_cron;
exception when others then
  raise notice 'pg_cron is not available in this project: %', sqlerrm;
end $$;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'ar-finance-daily-backup-2300';

    perform cron.schedule(
      'ar-finance-daily-backup-2300',
      '0 16 * * *',
      $job$select public.create_ar_daily_backup('pg_cron_23_00');$job$
    );
  else
    raise notice 'pg_cron schema not found. Client-side backup fallback will still run when the app is open.';
  end if;
exception when others then
  raise notice 'Could not schedule pg_cron backup: %', sqlerrm;
end $$;
