import * as XLSX from 'xlsx'

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

const DATE_COLS = new Set(['date', 'date_paid', 'submit_date', 'due_date'])

const NUMERIC_COLS = new Set([
  'svc_opd','svc_diag_image','svc_ipd','svc_surg_ot','svc_emergency',
  'svc_chronic','svc_pharma','svc_support','svc_admin','svc_homecare',
  'total','discounts','grand_total','cash','bcel','bcel2','ldb',
  'debt','prepayment',
  'debt_amount','amount_paid','cash_paid','bcel_paid','bcel2_paid','ldb_paid','balance',
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
  if (val instanceof Date) {
    const y = val.getFullYear()
    const m = String(val.getMonth() + 1).padStart(2, '0')
    const d = String(val.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  if (typeof val === 'number') {
    const parsed = XLSX.SSF.parse_date_code(val)
    if (parsed?.y && parsed?.m && parsed?.d) {
      return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`
    }
  }

  const s = String(val).trim()
  const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slash) {
    return `${slash[3]}-${slash[2].padStart(2, '0')}-${slash[1].padStart(2, '0')}`
  }

  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`
  }

  const d = new Date(s)
  if (!d || isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false })
  const parsed = rows.map((r, index) => {
    const row = parseRow(normalizeKeys(r), columnMap)
    row.source_key = makeSourceKey(sheetName, index + 2, row)
    if (addDebtStatus) row.debt_status = (row.debt || 0) > 0 ? 'pending' : null
    return row
  }).filter(r => r.bill_no && r.date)

  return parsed
}

export function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: true })
        const result = { sheets: wb.SheetNames, bills: [], debt: [], cashflow: [], rawSheets: {} }

        wb.SheetNames.forEach(name => {
          const sheet = wb.Sheets[name]
          const preview = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false })
          result.rawSheets[name] = preview.slice(0, 5)

          const lower = name.toLowerCase()
          if (lower.includes('daily')) {
            result.bills = parseSheet(sheet, MAP_BILLS, true, name)
          } else if (lower.includes('pay')) {
            const debtRows = parseSheet(sheet, MAP_DEBT, false, name)
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
