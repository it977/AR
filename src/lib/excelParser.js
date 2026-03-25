import * as XLSX from 'xlsx'

// Excel column → Supabase column mapping for ar_bills (Daily sheet)
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

// Excel column → Supabase column mapping for ar_debt (Pay off sheet)
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
  'Transfer Payment by BCEL2 Debt':   'bcel2_paid',
  'Transfer Payment by BCEL 2 Debt': 'bcel2_paid',
  'Transfer Payment by LDB Debt': 'ldb_paid',
  'Balance': 'balance',
  'Due date': 'due_date',
  'Aging Group': 'aging_group',
}

const DATE_COLS = new Set(['date', 'date_paid', 'submit_date', 'due_date'])

// Numeric columns in ar_bills and ar_debt
const NUMERIC_COLS = new Set([
  'svc_opd','svc_diag_image','svc_ipd','svc_surg_ot','svc_emergency',
  'svc_chronic','svc_pharma','svc_support','svc_admin','svc_homecare',
  'total','discounts','grand_total','cash','bcel','bcel2','ldb',
  'debt','prepayment',
  'debt_amount','amount_paid','cash_paid','bcel_paid','bcel2_paid','ldb_paid','balance',
])

function parseRow(row, columnMap) {
  const out = {}
  for (const [excelCol, dbCol] of Object.entries(columnMap)) {
    const raw = row[excelCol]
    // Normalize: treat null/undefined/blank/whitespace-only as null
    const val = (raw === null || raw === undefined) ? null
      : (typeof raw === 'string' ? raw.trim() : raw)

    if (val === null || val === '' ) {
      out[dbCol] = NUMERIC_COLS.has(dbCol) ? 0 : null
    } else if (DATE_COLS.has(dbCol)) {
      let d
      if (val instanceof Date) {
        // raw:true + cellDates → real JS Date object from Excel serial (always correct)
        d = val
      } else {
        const s = String(val).trim()
        // ALWAYS try DD/MM/YYYY first — avoids JS mis-parsing "12/02/2026" as December
        const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
        if (slash) {
          d = new Date(`${slash[3]}-${slash[2].padStart(2,'0')}-${slash[1].padStart(2,'0')}`)
        } else {
          d = new Date(s)  // ISO "YYYY-MM-DD" or other unambiguous formats
        }
      }
      out[dbCol] = (!d || isNaN(d.getTime())) ? null : d.toISOString().split('T')[0]
    } else if (NUMERIC_COLS.has(dbCol)) {
      // Always coerce numeric cols — never send strings to Postgres numeric
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

function deduplicateRows(rows) {
  // Keep last occurrence of each (bill_no, date) pair
  const seen = new Map()
  rows.forEach(r => {
    if (r.bill_no && r.date) seen.set(`${r.bill_no}__${r.date}`, r)
  })
  return Array.from(seen.values())
}

function normalizeKeys(row) {
  const out = {}
  for (const [k, v] of Object.entries(row)) {
    // ລຶບ newline, collapse double-spaces, trim
    out[k.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim()] = v
  }
  return out
}

function parseSheet(sheet, columnMap, addDebtStatus = false) {
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true })
  const parsed = rows.map(r => {
    const row = parseRow(normalizeKeys(r), columnMap)
    if (addDebtStatus) row.debt_status = (row.debt || 0) > 0 ? 'pending' : null
    return row
  }).filter(r => r.bill_no && r.date)
  return deduplicateRows(parsed)
}

export function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: true })
        const result = { sheets: wb.SheetNames, bills: [], debt: [], rawSheets: {} }

        wb.SheetNames.forEach(name => {
          const sheet = wb.Sheets[name]
          const preview = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false })
          result.rawSheets[name] = preview.slice(0, 5)

          const lower = name.toLowerCase()
          if (lower.includes('daily')) {
            result.bills = parseSheet(sheet, MAP_BILLS, true)
          } else if (lower.includes('pay')) {
            const debtRows = parseSheet(sheet, MAP_DEBT)
            result.debt = debtRows
            // After Pay off upload, update debt_status ONLY — do NOT overwrite debt
            // ar_bills.debt must keep original outstanding from Daily sheet for KPI accuracy
            result.billUpdates = debtRows
              .filter(r => r.bill_no && r.date)
              .map(d => ({
                bill_no:     d.bill_no,
                date:        d.date,
                debt_status: (d.balance ?? 0) > 0 ? 'pending' : 'paid',
              }))
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
  if (num >= 1_000_000)     return `${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000)         return `${(num / 1_000).toFixed(0)}K`
  return formatNumber(num)
}
