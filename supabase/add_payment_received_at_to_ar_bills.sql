-- Store the real received date for GN/manual bill payments.
-- Run this once in Supabase SQL Editor if older databases do not have the column yet.

alter table public.ar_bills
  add column if not exists payment_received_at date;

create index if not exists idx_ar_bills_payment_received_at
  on public.ar_bills (payment_received_at);

