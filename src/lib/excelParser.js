import * as XLSX from 'xlsx'
import { summarizeInstallments, calcAging, normalizeAgingGroup } from './debtUtils'

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
  'Note': 'note',
  'Aging Group': 'aging_group',
  'Recorder': 'recorded_by',
  'Recorded By': 'recorded_by',
  'ຜູ້ບັນທຶກ': 'recorded_by',
}

const MAP_DEBT = {
  'Date': 'date',
  'Workload': 'workload',
  'Bill No': 'bill_no',
  'Customer Type Code': 'customer_type',
  'Insurance': 'insurance',
  'HN': 'hn',
  'Customer Name': 'patient_name',
  'Gender': 'gender',
  'Grand Total': 'grand_total',
  'Outstanding Debt': 'debt_amount',
  'Date Paid': 'date_paid',
  'Submission Date': 'submit_date',
  'Amount Paid': 'amount_paid',
  'Cash Received Debt': 'cash_paid',
  'Transfer Payment by BCEL Debt': 'bcel_paid',
  'Transfer Payment by BCEL2 Debt': 'bcel2_paid',
  'Transfer Payment by BCEL 2 Debt': 'bcel2_paid',
  'Transfer Payment by LDB Debt': 'ldb_paid',
  'Balance': 'balance',
  'Due date': 'due_date',
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

const DATE_COLS = new Set(['date', 'date_paid', 'submit_date', 'due_date', 'payment_1_date', 'payment_2_date', 'payment_3_date'])

const NUMERIC_COLS = new Set([
  'svc_opd','svc_diag_image','svc_ipd','svc_surg_ot','svc_emergency',
  'svc_chronic','svc_pharma','svc_support','svc_admin','svc_homecare',
  'total','discounts','grand_total','cash','bcel','bcel2','ldb',
  'debt','prepayment',
  'debt_amount','amount_paid','cash_paid','bcel_paid','bcel2_paid','ldb_paid','balance',
  'payment_1_amount','payment_2_amount','payment_3_amount',
  'total_actual_income','outstanding_debt',
])

function normalizeKeys(row) {
  const out = {}
  for (const [k, v] of Object.entries(row)) {
    out[k.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim()] = v
  }
  return out
}

function toIsoDate(val) {
  let y, m, d

  if (val instanceof Date) {
    y = val.getFullYear()
    m = val.getMonth() + 1
    d = val.getDate()
  } else if (typeof val === 'number') {
    const parsed = XLSX.SSF.parse_date_code(val)
    if (parsed?.y && parsed?.m && parsed?.d) {
      y = parsed.y; m = parsed.m; d = parsed.d
    }
  } else {
    const s = String(val).trim()
    const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (slash) {
      y = parseInt(slash[3]); m = parseInt(slash[2]); d = parseInt(slash[1])
    } else {
      const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
      if (iso) {
        y = parseInt(iso[1]); m = parseInt(iso[2]); d = parseInt(iso[3])
      } else {
        const parsed = new Date(s)
        if (parsed && !isNaN(parsed.getTime())) {
          y = parsed.getFullYear(); m = parsed.getMonth() + 1; d = parsed.getDate()
        }
      }
    }
  }

  if (!y || !m || !d) return null
  if (y < 2000 || m > 12 || d > 31) return null
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function parseRow(row, columnMap) {
  const out = {}
  for (const [excelCol, dbCol] of Object.entries(columnMap)) {
    const raw = row[excelCol]
    const val = raw === null || raw === undefined
      ? null
      : (typeof raw === 'string' ? raw.trim() : raw)

    if (val === null || val === '') {
      out[dbCol] = NUMERIC_COLS.has(dbCol) ? 0 : null
    } else if (DATE_COLS.has(dbCol)) {
      out[dbCol] = toIsoDate(val)
    } else if (NUMERIC_COLS.has(dbCol)) {
      if (typeof val === 'number') {
        out[dbCol] = isNaN(val) ? 0 : val
      } else {
        const n = parseFloat(String(val).replace(/,/g, ''))
        out[dbCol] = isNaN(n) ? 0 : n
      }
    } else if (dbCol === 'aging_group') {
      out[dbCol] = normalizeAgingGroup(val) || val
    } else {
      out[dbCol] = val
    }
  }
  return out
}

function makeSourceKey(sheetName, rowNumber, row) {
  return [
    sheetName,
    rowNumber,
    row.bill_no || '',
    row.date || '',
    row.workload || '',
  ].map(v => String(v).replace(/\s+/g, ' ').trim()).join('__')
}

function parseSheet(sheet, columnMap, addDebtStatus = false, sheetName = 'Sheet') {
  // Use formatted cell values so Google Sheets exported dates stay on their displayed day.
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null })
  const parsed = rows.map((r, index) => {
    const row = parseRow(normalizeKeys(r), columnMap)
    row.source_key = makeSourceKey(sheetName, index + 2, row)
    if (addDebtStatus) row.debt_status = (row.debt || 0) > 0 ? 'pending' : null
    return row
  }).filter(r => r.bill_no && r.date)

  return parsed
}

function hydrateDebtInstallments(row) {
  const installments = [1, 2, 3].map(number => ({
    date: row[`payment_${number}_date`],
    method: row[`payment_${number}_method`],
    amount: row[`payment_${number}_amount`],
  }))
  const summary = summarizeInstallments(installments)
  if (summary.total <= 0) return { ...row, aging_group: normalizeAgingGroup(row.aging_group) || calcAging(row) }

  const amountPaid = row.amount_paid || summary.total
  return {
    ...row,
    amount_paid: amountPaid,
    cash_paid: row.cash_paid || summary.channelTotals.cash,
    bcel_paid: row.bcel_paid || summary.channelTotals.bcel,
    bcel2_paid: row.bcel2_paid || summary.channelTotals.bcel2,
    ldb_paid: row.ldb_paid || summary.channelTotals.ldb,
    date_paid: row.date_paid || summary.latestDate,
    balance: row.balance || Math.max(0, (row.debt_amount || 0) - amountPaid),
    aging_group: normalizeAgingGroup(row.aging_group) || calcAging(row),
  }
}

export function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        // cellDates:false → date cells stay as Excel serial numbers; toIsoDate parses
        // them via XLSX.SSF.parse_date_code (timezone-safe). Enabling cellDates triggers
        // a SheetJS epoch drift that lands dates at 23:59:56 of the previous day.
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' })
        const result = { sheets: wb.SheetNames, bills: [], debt: [], cashflow: [], rawSheets: {} }

        wb.SheetNames.forEach(name => {
          const sheet = wb.Sheets[name]
          const preview = XLSX.utils.sheet_to_json(sheet, { defval: null })
          result.rawSheets[name] = preview.slice(0, 5)

          const lower = name.toLowerCase()
          if (lower.includes('daily')) {
            result.bills = parseSheet(sheet, MAP_BILLS, true, name)
          } else if (lower.includes('pay')) {
            const debtRows = parseSheet(sheet, MAP_DEBT, false, name).map(hydrateDebtInstallments)
            result.debt = debtRows
            result.billUpdates = debtRows
              .filter(r => r.bill_no && r.date)
              .map(d => ({
                bill_no: d.bill_no,
                date: d.date,
                debt_status: (d.balance ?? 0) > 0 ? 'pending' : 'paid',
              }))
          } else if (lower.includes('summary_cashflow')) {
            result.cashflow = parseSheet(sheet, MAP_CASHFLOW, false, name)
              .filter(r =>
                r.total_actual_income ||
                r.balance ||
                r.cash ||
                r.bcel ||
                r.bcel2 ||
                r.ldb ||
                r.outstanding_debt
              )
          }
        })

        resolve(result)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

export function formatNumber(num, decimals = 0) {
  if (num === null || num === undefined || isNaN(num)) return '0'
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num)
}

export function formatLAK(num) {
  if (!num) return '0'
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000) return `${(num / 1_000).toFixed(0)}K`
  return formatNumber(num)
}
