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

### 2026-06-22 - Payment Channel Actual Income still off by 300,000

Latest Payment Channel screenshot:

| Metric | App | Looker | Diff |
| --- | ---: | ---: | ---: |
| Actual Income | 48,128,225 | 47,828,225 | +300,000 |
| Daily Income | 43,947,600 | 43,647,600 | +300,000 |
| Debt Collection | 4,180,625 | 4,180,625 | 0 |
| Outstanding Balance | 10,522,750 | 10,522,750 | 0 |

Conclusion:

- Payment Channel still uses remaining balance for Actual Income:
  - `(Total Sales - Remaining Balance) + Collection`
- Looker uses Daily Income after same-day settled debt reclassification:
  - `(Total Sales - Initial Outstanding) + Collection`
- Same-day settled debt amount is `300,000`.

Next code action:

- Share same-day settled debt logic in `useARData.js`.
- Update Payment Channel to use initial outstanding plus same-day settled debt for Daily Income.
- Update Payment Channel Actual Income to use `dailyIncome + collection`, not `total sales - remaining balance + collection`.

Completed code action:

- Updated `src/pages/PaymentChannel.jsx` with same-day settled debt reclassification.
- Payment Channel `initialOutstandingForDailyIncome` now includes same-day settled INS debt amount.
- Payment Channel `actualIncomeTotal` now uses `dailyIncome + collectionStats.amount`.
- Verified `npm run build` passes.

### 2026-06-22 - Payment Channel still did not move after refresh

Latest screenshot still shows:

| Metric | App | Looker | Diff |
| --- | ---: | ---: | ---: |
| Actual Income | 48,128,225 | 47,828,225 | +300,000 |
| Daily Income | 43,947,600 | 43,647,600 | +300,000 |

New conclusion:

- The `300,000` is not being found by Payment Channel's INS-only same-day helper.
- Looker Outstanding page shows the 300,000 as a same-day collected debt bucket, and earlier charts indicated it can be in GN, not INS.
- Payment Channel also filtered `ar_debt` rows to only bill numbers present in the Daily bill view. That can drop same-day Pay off rows when Pay off exists without a matching Daily upload row.

Next code action:

- In Payment Channel, include `ar_debt` rows where `date_paid === date` in initial outstanding, even if their bill number is not present in the filtered Daily rows.

Completed code action:

- Updated `src/pages/PaymentChannel.jsx` so `initialOutstandingForDailyIncome` keeps same-day settled `ar_debt` rows (`date_paid === date`) even when the bill number is not in the filtered Daily rows.
- Verified `npm run build` passes.

### 2026-06-22 - Payment Channel still unchanged after same-day date check

Latest screenshot still shows `Actual Income = 48,128,225` and `Daily Income = 43,947,600`.

New root cause:

- Payment Channel used a raw string comparison for same-day debt rows:
  - `String(row.date).slice(0, 10) === String(row.date_paid).slice(0, 10)`
- This can fail when DB dates are stored/displayed as `DD/MM/YYYY`, or when payment is stored in `payment_1_date/payment_2_date/payment_3_date`.
- The correct test should use the existing date-range-aware helper `getDebtPaidAmountForDateRange()`.

Next code action:

- Include `ar_debt` rows in Payment Channel initial outstanding when they have paid amount in the selected report date range, even if their bill number is not present in Daily rows.

### 2026-06-22 (mid) - Same-day filter too narrow; cross-reference ar_debt

Symptom: after the previous fix shipped, Jun 19 still showed the same `+300,000 / -1 bill` gap. Jun 20 had the same shape. Past dates were also at risk.

Root cause:

- The detector required `customer_type === 'INS'`. Inspection of the Looker `Pay off` sheet (file `Report AR Finance Test (7).xlsx`) shows that of 59 same-day settled bills, 49 are `customer_type = 'GN'` and only 10 are `INS`. The INS-only filter dropped the GN case.
- The adjustment was added unconditionally to `lookerOutstanding`. For bills that DO have an `ar_debt` row, `outstandingRows` already counts them via `getDebtInitialAmount`; adding `sameDaySettledDebt` again would double-count.

Next code action:

- Pass `outstandingRows` into `getSameDaySettledDebtStats(viewRows, outstandingRows)`.
- Skip any bill whose `bill_no` already appears in `outstandingRows` — it is the Excel-`Pay off` case and is already counted.
- For bills NOT in `ar_debt` (settled directly in the app, no Pay off journal entry), require an insurance/debt marker: `customer_type === 'INS'` OR `insurance` set. This excludes plain GN cash sales while still catching app-settled insurance bills.

Completed code action:

- Updated `getSameDaySettledDebtStats()` signature to take `(viewRows, outstandingRows)`.
- Builds a `Set` of `outstandingRows` `bill_no` and excludes matches from the same-day adjustment to prevent double-counting.
- Removed the strict `INS`-only check and added `insurance` field as an alternative marker.
- Updated the caller in `DailySales.jsx` to pass `outstandingRows`.
- Verified `npm run build` passes.

### 2026-06-22 (later) - Cross-filter dropping same-day settlements from ar_debt path

Symptom: Jun 19 still shows `+300,000 / -1 bill` after the previous fix. Looker target values for Jun 19:

| Metric | App (still wrong) | Looker target |
| --- | ---: | ---: |
| Actual Income | 48,128,225 | 47,828,225 |
| Outstanding Debts | 10,522,750 | 10,822,750 |
| Daily Income | 43,947,600 | 43,647,600 |
| Outstanding Bills | 10 | 11 |

Re-analysis:

- The 300,000 bill MUST have an `ar_debt` entry — otherwise Looker would not have it in Outstanding either (Looker's Outstanding comes from the Pay off sheet).
- If the bill IS in `ar_debt`, the previous fix's same-day detector correctly skips it to avoid double-counting — so the adjustment becomes 0.
- That leaves the original `outstandingRows.filter(...)` path. That path applies a cross-filter: `allowedBillNos.has(r.bill_no)` — which drops any ar_debt row whose `bill_no` is not present in `viewRows`.
- A same-day settled bill can be missing from `viewRows` if (a) `filterToLookerSubset` hides its workload as "manual" or (b) the user re-uploaded the Pay off sheet without a matching Daily upload. In both cases Looker still shows the bill, but the app drops it.

Next code action:

- Relax the cross-filter so ar_debt rows where `date_paid === date` (same-day settled) are always included, regardless of viewRows membership.
- Other ar_debt rows still require viewRows membership (prevents stale ar_debt entries from leaking in).
- Keep the existing `sameDaySettledDebt` adjustment for the inverse case — bills in viewRows with channels but no ar_debt entry.
- Add diagnostic logging gated on `?debug=daily-sales` URL parameter so any future mismatch can be inspected without code changes.

Completed code action:

- Added `isSameDaySettled()` predicate inside `lookerOutstanding` and added `|| isSameDaySettled(r)` to the cross-filter.
- Updated the explanatory comment block above `lookerOutstanding`.
- Added a development-only `console.log('[DailySales] diag', ...)` block in `DailySales.jsx`, active only when the URL contains `?debug=daily-sales`. Dumps: viewRows count, outstandingRows count, `sameDaySettledDebt`, `lookerOutstanding`, raw `kpis`, every viewRows bill with channels > 0, every ar_debt row where `date_paid === date`.
- Verified `npm run build` passes.

How to verify on the live app:

1. Open Daily Sales for Jun 19, 2026 — the four metrics should now read `47,828,225 / 10,822,750 / 43,647,600 / 11`.
2. If they still don't, append `?debug=daily-sales` to the URL, open DevTools console (F12), and share the `[DailySales] diag` log. The two arrays `channelBillsInView` and `arDebtSameDay` identify exactly which bills are involved and whether the bill is in `viewRows` / `ar_debt`.

### 2026-06-22 (evening) - Still off; switch to on-page debug panel

Symptom: Jun 19 still shows the same `+300,000 / -1 bill` gap after the `isSameDaySettled` cross-filter relaxation. Looker target: `47,828,225 / 10,822,750 / 43,647,600 / 11`.

What this rules out:

- The same-day debt bill is NOT in `ar_debt` for Jun 19 — otherwise the `isSameDaySettled` relaxation would have picked it up.
- The bill in `ar_bills` does not satisfy the existing `INS` or `insurance` markers — otherwise `getSameDaySettledDebtStats` would have caught it.
- `Summary_CashFlow` (ar_cashflow) is not uploaded for Jun 19 — if it were, `canUseCashflowSummary` would set `cashflowInitialOutstanding` to Looker's value (10,822,750), and the displayed amount would match. Since the app's Daily Income reads `43,947,600` (= `totalSales − kpis.outstandingDebt`), we know it fell through to the non-cashflow path.

This means the 300,000 bill is stored in `ar_bills` as a plain cash sale (`debt = 0`, `channels > 0`, neither `INS` nor `insurance` set) AND has no `ar_debt` entry. From the app's data alone there is no marker that tells us "this was originally a debt bill" — Looker only knows because its source Excel still has the bill on the `Daily` sheet with `Outstanding Debt = 300,000`.

Schema check confirms it: `supabase/schema.sql` has no `debt_original` / `debt_amount` field on `ar_bills`. Only the current `debt` column. So we cannot recover the original amount from `ar_bills` once it has been zeroed.

Next code action:

- Replace the URL-gated console.log with a visible on-page diagnostic panel (also gated, `?debug=1`), so the user can screenshot it without opening DevTools.
- Panel dumps: row counts, `sameDaySettledDebt`, `lookerOutstanding`, the cashflow path values, raw `kpis`, the full list of `viewRows` bills with `debt > 0`, the full list of bills with `channels > 0` (with `inArDebt` flag), and the full `outstandingRows` list (with `sameDay` and `inViewRows` flags).
- Once the panel reveals which bill is the missing 300,000 one and which fields it has, we can choose the correct fix: extend the marker set (e.g., a new `payment_type` value, or a workload-only criterion), or instruct the user to re-upload `Pay off` / `Summary_CashFlow` for the affected date.

Completed code action:

- Removed the URL-gated `console.log` block.
- Added a `debugInfo` `useMemo` that builds the same dataset only when `?debug=1` is set.
- Added a yellow `<details>`-based debug panel at the top of `Daily Sales` page (above the header). Each section is collapsible to keep the page readable. Marked `data-pdf-hidden="true"` so it won't appear in PDF exports.
- Verified `npm run build` passes.

How to verify and report back:

1. Open Daily Sales for Jun 19, 2026.
2. Add `?debug=1` to the URL (full example: `http://localhost:5175/daily-sales?debug=1`).
3. A yellow box appears at the top with three collapsible sections. Expand all three.
4. Take a full-page screenshot and share it. The "Bills with channels > 0 in viewRows" array will reveal exactly which bill the user paid same-day and what marker fields it has (`customer_type`, `insurance`, `payment_type`, `debt_status`, `inArDebt`).
5. Based on that data we can either extend the detector or upload the missing `Pay off` / `Summary_CashFlow` row.

### 2026-06-22 (night) - Root cause: deferred-receipt (BCEL paid next day)

Debug panel for Jun 19 revealed the missing bill:

```
INV69302
  customer_type: "GN"
  insurance: ""
  payment_type: "Cash/Transfer"
  debt_status: "pending"
  debt: 0
  cash: 1,482,500
  bcel: 300,000
  bcel2: 0
  ldb: 0
  grand_total: 1,782,500
  bill_issued_at: 2026-06-19T22:48:00+00:00
  payment_received_at: 2026-06-20
  inArDebt: false
```

The 300,000 gap is INV69302's BCEL portion. The bill was issued at 22:48 on Jun 19, customer paid cash (1,482,500) that night, but the BCEL transfer (300,000) only landed in the account on Jun 20. Looker reads the original Daily sheet which had the BCEL as `Outstanding Debt` for Jun 19. The app has already reconciled the BCEL receipt — written `bcel = 300,000` and `debt = 0` — so it looks like a full cash sale.

The same pattern explains Jun 20's Collection = 300,000 (1 bill) in Looker: the same INV69302 BCEL appears as Collection on its receipt date.

This is NOT a same-day-settled-debt case (that was patterns A and B). It's a third pattern — deferred receipt — invisible to the previous heuristics because there is no `INS` / `insurance` marker on the bill. The signal is on the timestamps: `payment_received_at > date`.

`cashflowRows = 1` for Jun 19 but `outstanding_debt: 0` confirmed `Summary_CashFlow` does not carry an Outstanding value for this date (only Total Actual Income 1,671,000 for the 8AM-4PM shift), so the cashflow path cannot rescue us.

Next code action:

- Extend `getSameDaySettledDebtStats` with a "Pattern C" branch: any bill in `viewRows` where `payment_received_at > date` is treated as deferred-receipt. The deferred amount added to Outstanding is `bcel + bcel2 + ldb` (transfers can clear late; cash and prepayment are always immediate, so they are excluded).
- Keep the bill out of double-counting by still skipping any bill that already has an `ar_debt` entry (`outstandingRows`).

Completed code action:

- Rewrote the comment block above `getSameDaySettledDebtStats` to document patterns A / B / C.
- Added `isDeferredReceipt(row)` and `deferredAmount(row)` helpers inside the function.
- Pattern C takes precedence over Pattern B: if a bill matches the deferred-receipt timestamp test AND has a non-zero transfer amount, it is counted with only that transfer amount (not the full channel sum).
- Pattern B (INS / insurance) remains as the fallback for the in-app full-settlement case.
- Verified `npm run build` passes.

Expected result on Jun 19 after this fix:

- Suspect bill INV69302 matches Pattern C → adds 300,000 / 1 bill to `lookerOutstanding`.
- Outstanding Debts: 10,522,750 + 300,000 = `10,822,750` ✓
- Outstanding Bills: 10 + 1 = `11` ✓
- Daily Income: 54,470,350 − 10,822,750 = `43,647,600` ✓
- Actual Income: 43,647,600 + 4,180,625 = `47,828,225` ✓
- Actual Bills Paid: viewKpis.paidBills (40 − 11 = 29) + collectionBills (3) + sameDay (1) = `33` ✓ (matches Looker)

The same fix will retro-correct any past or future date where a transfer landed on a different day than the bill was issued — this is the "ລວມທັງວັນຜ່ານມານຳ" the user asked for.

### 2026-06-22 (night, follow-up) - Jun 19 right, Jun 20 wrong: retro-collection over-counts cash

User report: Jun 19 now matches Looker, but Jun 20 (and other dates) are wrong.

Jun 20 comparison:

| Metric | App | Looker | Diff |
| --- | ---: | ---: | ---: |
| Outstanding Debts | 14,916,500 | 14,916,500 | 0 |
| Daily Income | 37,953,500 | 37,953,500 | 0 |
| Collection | 1,782,500 | 300,000 | +1,482,500 |
| Actual Income | 39,736,000 | 38,253,500 | +1,482,500 |
| Actual Bills Paid | 29 | 26 | +3 |
| Collection Bills | 1 | 1 | 0 |

Two distinct over-counts emerged:

**1) Collection over by 1,482,500 (= cash portion of INV69302)**

The retro-collection branch of `collectionStats` matches a deferred-receipt bill via `isRetroBillCollection` (any non-INS bill where `payment_received_at > date`) and adds its FULL `getBillCollectionAmount` = cash + bcel + bcel2 + ldb + prepayment. But the cash portion (1,482,500) was actually received on the bill's issue day, not the receipt day — only the transfer portion (300,000) is the late-landing money. Looker's Collection for the receipt date only includes the late portion.

**2) Actual Bills Paid over by 3 (= bills with deferred BCEL issued Jun 20)**

`actualPaidBills = viewKpis.paidBills + collectionBillCount + sameDaySettledDebt.bills`. Pattern C adds bills to `sameDaySettledDebt.bills` whenever a deferred-receipt is detected. For Jun 19, INV69302 had cash received same day (1,482,500), so counting it in Actual Bills Paid is correct (`33 = 29 + 3 + 1`). For Jun 20, the 3 Pattern C bills issued that day had no cash received Jun 20 (cash either 0 or the channel breakdown puts everything in deferred transfers), so Looker excludes them. Counting them gives `25 + 1 + 3 = 29` instead of the correct `26`.

Next code action:

- Retro-collection: change `retroAmount` to sum only `bcel + bcel2 + ldb` (deferred-channel portion), and zero out the cash field in `retroChannels`. This stops the Collection over-count for deferred-receipt bills on their receipt date.
- `getSameDaySettledDebtStats`: return a second count `paidBills` that includes Pattern B always, but Pattern C only when `cash > 0` (i.e., something WAS received on the issue day). Outstanding-bill count (`bills`) stays as-is — Pattern C bills are still in Outstanding regardless of cash.
- Update `actualPaidBills` to add `sameDaySettledDebt.paidBills` instead of `.bills`.

Completed code action:

- Edited the retro branch inside `collectionStats` (DailySales.jsx ~line 252):
  - `retroAmount = sum of (bcel + bcel2 + ldb)` per retro row, no cash.
  - `retroChannels` no longer accumulates `row.cash`; the rolled-up `cash` for Collection now reflects only debt-payment cash (not retro cash, which is bill-issue-day cash).
- Edited `getSameDaySettledDebtStats` to track and return `paidBills`:
  - Pattern B (INS / insurance fully settled in-app) → adds to both `bills` and `paidBills`.
  - Pattern C (deferred receipt) → adds to `bills` always, but to `paidBills` only when `cash > 0`.
- Edited `actualPaidBills` to consume `sameDaySettledDebt.paidBills`.
- Verified `npm run build` passes.

Expected result on Jun 20 after this fix:

- Collection: previous `1,782,500` → `300,000` (only the BCEL of INV69302) ✓
- Actual Income: previous `39,736,000` → `38,253,500` (`= 37,953,500 + 300,000`) ✓
- Actual Bills Paid: previous `29` → `26` (`= 25 + 1 + 0`) ✓
- Outstanding/Daily/Bills counts already match Looker; unchanged.

Cross-check on Jun 19 (should still match):

- INV69302 has `cash > 0` (1,482,500) → counts in `sameDaySettledDebt.paidBills` (= 1).
- Actual Bills Paid Jun 19 = `29 + 3 + 1 = 33` ✓ (unchanged from previous fix).

### 2026-06-22 (night, follow-up 2) - Payment Channel page over-counts BCEL by deferred portion

User report: Daily Sales fixed but `/payment-channel` page for Jun 19 still mismatched Looker.

| Metric (Jun 19) | App | Looker | Diff |
| --- | ---: | ---: | ---: |
| Actual Income | 48,128,225 | 47,828,225 | +300,000 |
| Cash | 29,435,700 | 29,432,100 | +3,600 |
| BCEL | 17,085,125 | 16,785,125 | +300,000 |
| BCEL 2 | 0 | 0 | 0 |
| LDB | 1,611,000 | 1,611,000 | 0 |
| Outstanding Balance | 10,522,750 | 10,522,750 | 0 |

Same root cause as Daily Sales but in a different code path. `PaymentChannel.jsx` `totals` derives from `kpis.cash + kpis.bcel + kpis.bcel2 + kpis.ldb` (sums ar_bills channels for the date range) plus `collectionStats` (debt-payment channels). It does NOT consult `payment_received_at`. So INV69302's BCEL (300,000) is in `kpis.bcel` for Jun 19 even though the transfer actually landed on Jun 20. The same retro-collection code in `collectionStats` over-counted cash on the receipt date.

Next code action:

- Add a `deferredFromIssue` aggregate to `PaymentChannel.jsx`: for each `viewRows` row where `payment_received_at > date`, sum the transfer channels (bcel + bcel2 + ldb). Cash is always immediate, so it stays.
- Subtract `deferredFromIssue.{bcel,bcel2,ldb}` from the issue-day channel totals (clamped at 0).
- Apply the same retro-collection fix as Daily Sales: in `collectionStats`, `retroAmount` = transfer-only; do not accumulate `cash` into retro channels.

Completed code action:

- Added `deferredFromIssue` useMemo in `src/pages/PaymentChannel.jsx`.
- Updated `totals` to subtract `deferredFromIssue.bcel/bcel2/ldb` from `kpis.bcel/bcel2/ldb` (with `Math.max(0, ...)` guard).
- Updated the retro branch of `collectionStats` to use transfer-only amount and skip cash accumulation.
- Verified `npm run build` passes.

Expected result on Jun 19 Payment Channel:

- BCEL: previous `17,085,125` → `16,785,125` ✓ (drops INV69302's deferred 300,000)
- Actual Income: previous `48,128,225` → `47,828,225` ✓
- Outstanding Balance: unchanged at `10,522,750` ✓
- Cash: still `29,435,700` (the +3,600 vs Looker is a separate known discrepancy between `kpis.cash` and the Daily-sheet cash total; investigate separately if user flags it).

### 2026-06-22 (night, follow-up 3) - Payment Channel still kept Actual Income too high

User report: `/payment-channel` still showed `Actual Income = 48,128,225` after refresh, while Looker shows `47,828,225`.

Root cause found in `initialOutstandingForDailyIncome`:

- The Payment Channel page was checking same-day debt with raw date text:
  `String(row.date).slice(0, 10) === String(row.date_paid).slice(0, 10)`.
- That is too brittle because uploaded debt rows can store payment dates in different fields/formats (`date_paid`, installment payment dates, or parsed Excel dates).
- When this check misses a paid debt row, initial outstanding stays `10,522,750` instead of `10,822,750`.
- Then Daily Income becomes `54,470,350 - 10,522,750 = 43,947,600`, which is `300,000` too high.
- Actual Income becomes `43,947,600 + 4,180,625 = 48,128,225`, also `300,000` too high.

Completed code action:

- Replaced the raw same-day date comparison with the shared helper:
  `getDebtPaidAmountForDateRange(row, filters.dateFrom, filters.dateTo) > 0`.
- This makes Payment Channel include any `ar_debt` row that has a payment in the selected report date range, matching how Collection is already detected.
- Added `filters.dateFrom` and `filters.dateTo` to the memo dependencies so date changes recompute the outstanding base.

Expected result on Jun 19 Payment Channel:

- Initial Outstanding for Daily Income: `10,522,750` -> `10,822,750`
- Daily Income: `43,947,600` -> `43,647,600`
- Actual Income: `48,128,225` -> `47,828,225`

### 2026-06-22 (night, follow-up 4) - BCEL fixed but Actual Income still high

User report: after the previous commit, `/payment-channel` shows BCEL correctly at `16,785,125`, but `Actual Income` still shows `48,128,225` instead of `47,828,225`.

What this proves:

- `deferredFromIssue` is working for the channel card because BCEL dropped by `300,000`.
- The remaining error is not the payment-channel total anymore.
- The remaining error is the Daily Income formula:
  `dailyIncome = kpis.totalSales - initialOutstandingForDailyIncome`.
- `initialOutstandingForDailyIncome` still missed the same `300,000` deferred transfer, so it stayed `10,522,750` instead of `10,822,750`.

Completed code action:

- Added `amount` to the existing `deferredFromIssue` aggregate (`bcel + bcel2 + ldb`).
- Added `deferredFromIssue.amount` to `initialOutstandingForDailyIncome`.
- This mirrors Looker's accounting rule:
  - On the bill issue date, late-arriving transfer channels are Outstanding.
  - On the receipt date, late-arriving transfer channels are Collection.
  - Cash remains on the bill issue date.

Expected result on Jun 19 Payment Channel:

- `initialOutstandingForDailyIncome = 10,522,750 + 300,000 = 10,822,750`
- `Daily Income = 54,470,350 - 10,822,750 = 43,647,600`
- `Actual Income = 43,647,600 + 4,180,625 = 47,828,225`
