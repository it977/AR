# AR Daily Sales Logic Fix Log

## Purpose

This file records every investigation and code action for the AR Daily Sales / Looker mismatch so future fixes do not repeat the same analysis.

## Target Case

- Date: `2026-06-19`
- App page: Daily Sales Report
- Looker comparison page: Daily Sales Report

## Looker Expected Values From Screenshot

| Metric | Looker |
| --- | ---: |
| Total Sales | 54,488,350 |
| Discounts | 18,000 |
| Actual Total Sale | 54,470,350 |
| Total Bills | 40 |
| Total Customers | 41 |
| Actual Income | 47,828,225 |
| Outstanding Debts | 10,822,750 |
| Actual Bills Paid | 33 |
| Outstanding Bills | 11 |
| Daily Income | 43,647,600 |
| Collection | 4,180,625 |
| Collection Bills | 3 |

## App Values Seen In Screenshot

| Metric | App |
| --- | ---: |
| Total Sales | 54,488,350 |
| Discounts | 18,000 |
| Actual Total Sale | 54,470,350 |
| Total Bills | 40 |
| Total Customers | 41 |
| Actual Income | 43,947,600 |
| Outstanding Debts | 10,522,750 |
| Actual Bills Paid | 30 |
| Outstanding Bills | 10 |
| Daily Income | 43,947,600 |
| Collection | 0 |
| Collection Bills | 0 |

## Confirmed Mismatch

The app matches Looker for the top sales row, but does not match debt and collection metrics.

Formula evidence:

```text
Looker Daily Income = Actual Total Sale - Initial Outstanding
43,647,600 = 54,470,350 - 10,822,750

Looker Collection = Actual Income - Daily Income
4,180,625 = 47,828,225 - 43,647,600
```

## Root Cause Notes

1. `ar_bills` must remain the original billing-day source. Debt payment updates must not overwrite `cash`, `bcel`, `bcel2`, `ldb`, or `debt` in `ar_bills`.
2. Debt payment activity belongs in `ar_debt` fields such as `amount_paid`, `cash_paid`, `bcel_paid`, `bcel2_paid`, `ldb_paid`, `date_paid`, and `balance`.
3. Existing DB rows may already be damaged from older code:
   - original `debt_amount` may have been overwritten with `balance`;
   - `amount_paid` may be missing;
   - `ar_bills.debt` may now show remaining balance instead of initial outstanding;
   - collection rows by `date_paid` may be absent.
4. Code can recover initial debt only when at least one of these exists:
   - correct `debt_amount`;
   - `balance + amount_paid`;
   - channel paid values;
   - `ar_cashflow` or another trusted Looker summary.
5. If all paid fields are missing and original debt was overwritten, code alone cannot reconstruct the missing collection amount without a source file or a repair table.

## Code Actions Already Taken

### 2026-06-22

- Added `getDebtInitialAmount()` in `src/lib/useARData.js`.
- Added `getDebtPaidAmount()` in `src/lib/useARData.js`.
- Added `isUsableCashflowSummary()` guard in `src/lib/useARData.js`.
- Updated `src/pages/DailySales.jsx` to use initial debt and paid helpers.
- Updated `src/pages/PaymentChannel.jsx` to use initial debt and paid helpers.
- Updated `src/pages/OutstandingDebt.jsx` to use initial debt and paid helpers.
- Updated `src/pages/DebtManagement.jsx` so debt payment save no longer overwrites `ar_bills.cash`, `ar_bills.bcel`, `ar_bills.bcel2`, `ar_bills.ldb`, or `ar_bills.debt`.
- Verified `npm run build` passes after changes.

## Current Blocker

The latest screenshot still shows:

```text
Collection = 0
Collection Bills = 0
Outstanding Debts = 10,522,750
```

This means the app currently cannot see Pay off rows for `date_paid = 2026-06-19`, or those rows no longer contain paid amount/channel data.

## Next Required Action

Add a repair/diagnostic path that identifies, for a selected date:

1. Daily rows from `ar_bills`.
2. Issue-date debt rows from `ar_debt.date`.
3. Collection rows from `ar_debt.date_paid`.
4. Cashflow rows from `ar_cashflow.date`.
5. Any rows where `debt_amount <= balance` and paid fields are empty, because those cannot reconstruct Looker collection.

If collection rows are missing, repair must be done from the original Pay off source or a trusted Looker summary.

## Action Log

### 2026-06-22 - User reports no visible change

Observed from latest screenshot that the app still shows:

| Metric | App |
| --- | ---: |
| Actual Income | 43,947,600 |
| Outstanding Debts | 10,522,750 |
| Actual Bills Paid | 30 |
| Outstanding Bills | 10 |
| Daily Income | 43,947,600 |
| Collection | 0 |
| Collection Bills | 0 |

Next code action:

- Keep this MD updated before code edits.
- Fix Pay off collection filtering so `usePayoffData({ payoffDateField: 'date_paid' })` does not depend only on `date_paid`.
- Include installment dates (`payment_1_date`, `payment_2_date`, `payment_3_date`) and only sum installment amounts that fall inside the selected report date.
- Update Daily Sales and Payment Channel to use date-range aware collection amount and channel totals.

Completed code action:

- Added payment-entry helpers in `src/lib/useARData.js`:
  - `getDebtPaymentEntries()`
  - `getDebtPaidAmountForDateRange()`
  - `getDebtPaidChannelTotalsForDateRange()`
  - `hasDebtPaymentInDateRange()`
- Updated `usePayoffData()` so collection mode (`payoffDateField: 'date_paid'`) fetches candidate rows first, then filters in JS by either:
  - `date_paid`, or
  - `payment_1_date`, `payment_2_date`, `payment_3_date`.
- Updated `src/pages/DailySales.jsx` collection metrics to use the new date-range helpers.
- Updated `src/pages/PaymentChannel.jsx` collection metrics and monthly collection totals to use the new date-range helpers.
- Verified `npm run build` passes after the changes.
- Tried a direct Node import smoke test for the helpers. It was blocked by Vite-style extensionless imports (`./supabase`) in Node, not by app compilation. `npm run build` remains the valid verification for this Vite app.
- Confirmed dev servers are listening on local ports including `5173`.
- Opened `http://127.0.0.1:5173/` with headless Chrome. It reached the app but stopped at the login screen because the user's existing browser session is not shared with headless Chrome, so KPI text could not be verified directly from automation.

Expected effect:

- If `ar_debt` has installment payment rows for `2026-06-19`, Daily Sales should now show those rows in `Collection` and `Collection Bills`.
- If the value still remains `0`, then the database currently has no paid amount/installment/date data for `2026-06-19`, and data repair from the original Pay off source is required.

### 2026-06-22 - User confirms values are still unchanged

Latest screenshot after refresh still shows:

| Metric | App |
| --- | ---: |
| Actual Income | 43,947,600 |
| Outstanding Debts | 10,522,750 |
| Actual Bills Paid | 30 |
| Outstanding Bills | 10 |
| Daily Income | 43,947,600 |
| Collection | 0 |
| Collection Bills | 0 |

Conclusion:

- The date-range/installment logic is now in code, but the selected DB rows still do not expose any collection amount for `2026-06-19`.
- Next action is not another formula tweak; inspect the live Supabase data/source upload rows for `ar_debt` and `ar_cashflow` to prove whether `2026-06-19` Pay off rows exist.

Investigation result:

- Direct Supabase anon query sees 0 rows because RLS requires the logged-in browser session. This explains why shell cannot inspect the same rows visible in the app.
- Local Excel scan:
  - `Report AR Finance Test (6).xlsx`, `(7).xlsx`, and `Looker AR/Report AR Finance Test (6).xlsx` contain only 2 Pay off rows for `2026-06-19`, total `1,671,000`, and no Daily rows.
  - `Report AR Finance Test (8).xlsx` contains no `2026-06-19` rows.
- PDF extraction from `Looker AR/19-06-2026.pdf` confirms Looker values:
  - Actual Income `47,828,225`
  - Outstanding Debts `10,822,750`
  - Daily Income `43,647,600`
  - Collection `4,180,625`
  - Collection Bills `3`
  - Outstanding page: Daily Collected `300,000`, Remaining Balance `10,522,750`
- Code search found another collection source already used by Bills Management: retro collections in `ar_bills.payment_received_at`.

Next code action:

- Add shared helpers for retro bill collections.
- Include `ar_bills.payment_received_at` retro collections in Daily Sales and Payment Channel collection totals, in addition to `ar_debt` Pay off rows.

Completed code action:

- Added `isRetroBillCollection()` and `getBillCollectionAmount()` in `src/lib/useARData.js`.
- `isRetroBillCollection()` follows the Bills Management rule: non-INS bill, has `payment_received_at`, and received date is after issue date.
- Updated `src/pages/DailySales.jsx`:
  - loads `useBillReceiptData(filters)`;
  - adds retro `ar_bills.payment_received_at` collection to Pay off collection;
  - avoids double counting when the same `bill_no` already exists in `ar_debt` paid rows.
- Updated `src/pages/PaymentChannel.jsx`:
  - loads `useBillReceiptData(filters)`;
  - adds retro bill collection channels to `cash/bcel/bcel2/ldb` totals.
- Verified `npm run build` passes.

Expected effect:

- If the missing `3,880,625` is stored as non-INS retro bill receipts in `ar_bills.payment_received_at`, Actual Income and payment channels should now move from app value `43,947,600` toward Looker `47,828,225`.
- If Outstanding Debts still remains `10,522,750` instead of `10,822,750`, the remaining missing piece is the `300,000` same-day debt collected amount shown on Looker's Outstanding page. That amount requires either a preserved `ar_debt.amount_paid/payment_*` row or a trusted Looker cashflow/summary row; it cannot be inferred safely from overwritten `ar_bills.debt` alone.

### 2026-06-22 - User shows Bills Management receipt rows exist

Screenshots from Bills Management show receipt-date rows for `2026-06-19`:

| Bill No | Issue Date | Receipt Date | Amount |
| --- | --- | --- | ---: |
| INV68985 | 2026-06-11 | 2026-06-19 | 2,509,625 |
| INV69261 | 2026-06-18 | 2026-06-19 | 766,000 |
| INV69260 | 2026-06-18 | 2026-06-19 | 905,000 |

Total: `4,180,625`, exactly the Looker Collection value.

Next code action:

- Make Daily Sales collection use receipt-date GN bill rows directly from `ar_bills.payment_received_at`.
- Ensure `Collection Bills` counts these 3 receipt bills.
- Keep `ar_debt` Pay off rows only for insurance/debt payoff collections to avoid double counting.

Additional root cause found:

- Bills Management modal displays receipt dates as `19/06/2026`.
- Daily Sales filter date is ISO (`2026-06-19`).
- Existing `toDateOnly()` only sliced strings and did not normalize `DD/MM/YYYY` to ISO, so receipt rows could be rejected before they reached `Collection Bills`.

Next code action:

- Normalize date strings in `useARData.js` so both `YYYY-MM-DD` and `DD/MM/YYYY` compare as ISO.
- In retro collection checks, fall back from invalid `bill_issued_at` to `date`.

Completed code action:

- Updated `toDateOnly()` in `src/lib/useARData.js` to normalize:
  - `YYYY-MM-DD`
  - `DD/MM/YYYY`
  - JavaScript `Date`
- Updated `isRetroBillCollection()` to use `toDateOnly(row.bill_issued_at) || toDateOnly(row.date)`, so malformed/empty issue timestamps do not block valid receipt-date rows.
- Verified `npm run build` passes.

### 2026-06-22 - Collection fixed, but income/outstanding still off by 300,000

Latest app values after Collection fix:

| Metric | App | Looker | Diff |
| --- | ---: | ---: | ---: |
| Actual Income | 48,128,225 | 47,828,225 | +300,000 |
| Outstanding Debts | 10,522,750 | 10,822,750 | -300,000 |
| Daily Income | 43,947,600 | 43,647,600 | +300,000 |
| Actual Bills Paid | 33 | 33 | 0 |
| Outstanding Bills | 10 | 11 | -1 |
| Collection | 4,180,625 | 4,180,625 | 0 |
| Collection Bills | 3 | 3 | 0 |

Conclusion:

- Collection is now correct.
- The remaining mismatch is exactly `300,000`.
- This matches Looker Outstanding page behavior: `Total Outstanding 10,822,750`, `Daily Collected 300,000`, `Remaining Balance 10,522,750`.
- App currently treats this same-day settled debt bill as daily income. Looker treats it as initial outstanding, with balance reduced to zero.

Next code action:

- In Daily Sales, identify same-day settled debt bills from daily rows:
  - insurance/debt customer type (`INS`/`iNS`);
  - remaining `debt <= 0`;
  - has collected channel amount;
  - bill date is in the selected Daily Sales date range.
- Add those amounts to initial Outstanding Debts and subtract them from Daily Income.
- Add those bill counts back to Actual Bills Paid so the paid count stays aligned after outstanding bills increase.

Completed code action:

- Added `getSameDaySettledDebtStats()` in `src/pages/DailySales.jsx`.
- Daily Sales now reclassifies same-day settled INS debt rows:
  - adds amount to `Outstanding Debts`;
  - increases `Outstanding Bills`;
  - lowers `Daily Income` through the existing formula `Actual Total Sale - Outstanding Debts`;
  - keeps `Actual Bills Paid` aligned by adding those settled debt bills back after outstanding bill count increases.
- Verified `npm run build` passes.
