const fs = require('fs')
const path = require('path')
const XLSX = require('xlsx')

const src = process.argv[2] || path.join(process.cwd(), '.tmp', 'looker-live', 'google-sheet.xlsx')
const out = process.argv[3] || path.join(process.cwd(), 'public', 'looker-live-sync.json')

const MAP_BILLS = {
  'Date': 'date',
  'Week': 'week',
  'Workload': 'workload',
  'Bill No': 'bill_no',
  'Insite-Onsite': 'insite_onsite',
  'OPD-IPD': 'opd_ipd',
  'Customer Type Code': 'customer_type',
  'Insurance': 'insurance',
  'HN': 'hn',
  'Customer Name': 'patient_name',
  'Gender': 'gender',
  'OPD': 'svc_opd',
  'Diag & Image Services': 'svc_diag_image',
  'IPD': 'svc_ipd',
  'Surg / OT Services': 'svc_surg_ot',
  'Emergency Services': 'svc_emergency',
  'Chronic & Prev Services': 'svc_chronic',
  'Pharma & Consumables': 'svc_pharma',
  'Supporting & Ancillary Services': 'svc_support',
  'Admin & Non-Clinical Services': 'svc_admin',
  'Home care Services': 'svc_homecare',
  'Total': 'total',
  'Discounts': 'discounts',
  'Grand Total': 'grand_total',
  'Cash Received': 'cash',
  'Transfer Payment by BCEL': 'bcel',
  'Transfer Payment by BCEL2': 'bcel2',
  'Transfer Payment by LDB': 'ldb',
  'Outstanding Debt': 'debt',
  'Prepayment': 'prepayment',
  'Payment Type': 'payment_type',
  'Payment Category': 'payment_type',
  'Due date': 'due_date',
  'Due Date': 'due_date',
  'Bill Issued At': 'bill_issued_at',
  'Bill Issued DateTime': 'bill_issued_at',
  'Bill Issued Date Time': 'bill_issued_at',
  'Payment Received Date': 'payment_received_at',
  'Payment Received At': 'payment_received_at',
  'Received Date': 'payment_received_at',
  'Note': 'note',
  'Aging Group': 'aging_group',
  'Recorder': 'recorded_by',
}

const MAP_DEBT = {
  'Date': 'date',
  'Workload': 'workload',
  'Bill No': 'bill_no',
  'Insite-Onsite': 'insite_onsite',
  'OPD-IPD': 'opd_ipd',
  'Customer Type Code': 'customer_type',
  'Insurance': 'insurance',
  'HN': 'hn',
  'Customer Name': 'patient_name',
  'Gender': 'gender',
  'Grand Total': 'grand_total',
  'Outstanding Debt': 'debt_amount',
  'Date Paid': 'date_paid',
  'Workload Debt': 'workload',
  'Submission Date': 'submit_date',
  'Amount Paid': 'amount_paid',
  'Cash Received Debt': 'cash_paid',
  'Transfer Payment by BCEL Debt': 'bcel_paid',
  'Transfer Payment by BCEL2 Debt': 'bcel2_paid',
  'Transfer Payment by BCEL 2 Debt': 'bcel2_paid',
  'Transfer Payment by LDB Debt': 'ldb_paid',
  'Balance': 'balance',
  'Due date': 'due_date',
  'Due Date': 'due_date',
  'Payment Type': 'payment_type',
  'Payment Category': 'payment_type',
  'Payment 1 Date': 'payment_1_date',
  'Payment 1 Method': 'payment_1_method',
  'Payment 1 Amount': 'payment_1_amount',
  'Payment 2 Date': 'payment_2_date',
  'Payment 2 Method': 'payment_2_method',
  'Payment 2 Amount': 'payment_2_amount',
  'Payment 3 Date': 'payment_3_date',
  'Payment 3 Method': 'payment_3_method',
  'Payment 3 Amount': 'payment_3_amount',
  'Aging Group': 'aging_group',
}

const MAP_CASHFLOW = {
  'Date': 'date',
  'Workload': 'workload',
  'Total Actual Income': 'total_actual_income',
  'Balance': 'balance',
  'Cash Received': 'cash',
  'Transfer Payment by BCEL': 'bcel',
  'Transfer Payment by BCEL2': 'bcel2',
  'Transfer Payment by LDB': 'ldb',
  'Outstanding Debt': 'outstanding_debt',
}

const DATE_COLS = new Set(['date', 'date_paid', 'submit_date', 'due_date', 'payment_received_at', 'payment_1_date', 'payment_2_date', 'payment_3_date'])
const DATETIME_COLS = new Set(['bill_issued_at'])
const NUMERIC_COLS = new Set([
  'svc_opd', 'svc_diag_image', 'svc_ipd', 'svc_surg_ot', 'svc_emergency',
  'svc_chronic', 'svc_pharma', 'svc_support', 'svc_admin', 'svc_homecare',
  'total', 'discounts', 'grand_total', 'cash', 'bcel', 'bcel2', 'ldb',
  'debt', 'prepayment',
  'debt_amount', 'amount_paid', 'cash_paid', 'bcel_paid', 'bcel2_paid', 'ldb_paid', 'balance',
  'payment_1_amount', 'payment_2_amount', 'payment_3_amount',
  'total_actual_income', 'outstanding_debt',
])

function normalizeKeys(row) {
  const out = {}
  for (const [key, value] of Object.entries(row)) {
    out[key.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim()] = value
  }
  return out
}

function toIsoDate(value) {
  if (value == null || value === '') return null
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value)
    return parsed ? `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}` : null
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
  }
  const text = String(value).trim()
  let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (match) return `${match[1]}-${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}`
  match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/)
  if (match) return `${match[3]}-${String(match[2]).padStart(2, '0')}-${String(match[1]).padStart(2, '0')}`
  return null
}

function toIsoDateTime(value) {
  const date = toIsoDate(value)
  return date ? `${date}T00:00:00` : null
}

function toNumber(value) {
  if (value == null || value === '') return 0
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const parsed = Number(String(value).replace(/,/g, '').trim())
  return Number.isFinite(parsed) ? parsed : 0
}

function parseRow(row, map) {
  const source = normalizeKeys(row)
  const out = {}
  for (const [excelCol, dbCol] of Object.entries(map)) {
    const raw = source[excelCol]
    const value = typeof raw === 'string' ? raw.trim() : raw
    if (value == null || value === '') out[dbCol] = NUMERIC_COLS.has(dbCol) ? 0 : null
    else if (DATE_COLS.has(dbCol)) out[dbCol] = toIsoDate(value)
    else if (DATETIME_COLS.has(dbCol)) out[dbCol] = toIsoDateTime(value)
    else if (NUMERIC_COLS.has(dbCol)) out[dbCol] = toNumber(value)
    else out[dbCol] = value
  }
  return out
}

function sourceKey(sheetName, rowNumber, row) {
  return [sheetName, rowNumber, row.bill_no || '', row.date || '', row.workload || '']
    .map(value => String(value).replace(/\s+/g, ' ').trim())
    .join('__')
}

function paymentTotal(row) {
  return toNumber(row.cash) + toNumber(row.bcel) + toNumber(row.bcel2) + toNumber(row.ldb) + toNumber(row.prepayment)
}

function debtPaidTotal(row) {
  return toNumber(row.amount_paid) ||
    toNumber(row.cash_paid) + toNumber(row.bcel_paid) + toNumber(row.bcel2_paid) + toNumber(row.ldb_paid)
}

function billStatus(row) {
  if (toNumber(row.debt) > 0) return 'pending'
  if (paymentTotal(row) > 0) return 'paid'
  return 'pending'
}

function debtStatus(row) {
  if (toNumber(row.balance) > 0) return 'pending'
  if (debtPaidTotal(row) > 0) return 'paid'
  return 'pending'
}

function parseSheet(workbook, sheetName, map, options = {}) {
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) return []
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true })
  return rows.map((row, index) => {
    const parsed = parseRow(row, map)
    parsed.source_key = sourceKey(sheetName, index + 2, parsed)
    if (options.kind === 'bills') parsed.debt_status = billStatus(parsed)
    return parsed
  }).filter(row => row.date && (!options.requireBillNo || row.bill_no))
}

const wb = XLSX.readFile(src, { cellDates: false })
const bills = parseSheet(wb, 'Daily', MAP_BILLS, { kind: 'bills', requireBillNo: true })
const debt = parseSheet(wb, 'Pay off', MAP_DEBT, { requireBillNo: true }).map(row => ({
  ...row,
  amount_paid: toNumber(row.amount_paid) || debtPaidTotal(row),
  balance: toNumber(row.balance),
}))
const cashflow = parseSheet(wb, 'Summary_CashFlow', MAP_CASHFLOW, { requireBillNo: false })
  .filter(row => toNumber(row.total_actual_income) || toNumber(row.balance) || toNumber(row.cash) || toNumber(row.bcel) || toNumber(row.bcel2) || toNumber(row.ldb) || toNumber(row.outstanding_debt))

const maxBillDate = bills.reduce((max, row) => row.date && row.date > max ? row.date : max, '')
const cappedCashflow = maxBillDate ? cashflow.filter(row => !row.date || row.date <= maxBillDate) : cashflow
const billUpdates = debt
  .filter(row => row.bill_no && row.date)
  .map(row => ({ bill_no: row.bill_no, date: row.date, debt_status: debtStatus(row) }))

fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, JSON.stringify({
  generated_at: new Date().toISOString(),
  source: src,
  bills,
  debt,
  cashflow: cappedCashflow,
  billUpdates,
}, null, 2))

function sum(rows, field) {
  return rows.reduce((total, row) => total + toNumber(row[field]), 0)
}

console.log(`Wrote ${out}`)
console.log(`bills=${bills.length} debt=${debt.length} cashflow=${cappedCashflow.length} billUpdates=${billUpdates.length}`)
for (const date of ['2026-06-27', '2026-06-28', '2026-06-29']) {
  const day = bills.filter(row => row.date === date)
  const po = debt.filter(row => row.date === date)
  const paid = debt.filter(row => row.date_paid === date)
  const cf = cappedCashflow.filter(row => row.date === date)
  console.log(date, {
    bills: day.length,
    totalSales: sum(day, 'grand_total'),
    dailyDebt: sum(day, 'debt'),
    payoffIssued: po.length,
    payoffPaid: paid.length,
    cashflowRows: cf.length,
    cashflowIncome: sum(cf, 'total_actual_income'),
    cashflowOutstanding: sum(cf, 'outstanding_debt'),
  })
}
