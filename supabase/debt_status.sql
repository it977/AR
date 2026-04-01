-- Add debt_status column to ar_bills
alter table ar_bills add column if not exists debt_status text;

-- Backfill existing data
update ar_bills set debt_status = 'pending' where debt > 0;
update ar_bills set debt_status = 'paid'
  where debt = 0 and (cash > 0 or bcel > 0 or bcel2 > 0 or ldb > 0);
