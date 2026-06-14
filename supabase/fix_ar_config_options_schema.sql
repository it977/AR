-- Align ar_config_options with the Settings page CRUD UI.
-- Safe to run multiple times.

alter table public.ar_config_options
  add column if not exists category text,
  add column if not exists label text,
  add column if not exists sort_order integer default 0,
  add column if not exists is_active boolean default true;

update public.ar_config_options
set
  category = coalesce(category, 'legacy'),
  value = coalesce(value, key),
  label = coalesce(label, value, key),
  sort_order = coalesce(sort_order, 0),
  is_active = coalesce(is_active, true)
where category is null
   or value is null
   or label is null
   or sort_order is null
   or is_active is null;

alter table public.ar_config_options
  alter column key drop not null,
  alter column category set not null,
  alter column sort_order set default 0,
  alter column is_active set default true;

create index if not exists idx_ar_config_options_category_sort
  on public.ar_config_options (category, sort_order);
