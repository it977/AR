export const DEFAULT_DUE_DAYS = 30

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'ເງິນສົດ (Cash)' },
  { value: 'bcel', label: 'BCEL' },
  { value: 'bcel2', label: 'BCEL 2' },
  { value: 'ldb', label: 'LDB Bank' },
]

export const PAYMENT_TYPES = [
  'Cash',
  'Transfer',
  'Cash/Transfer',
  'Transacted',
  'Deposit',
  'Advance',
]

export const PAYMENT_STATUSES = ['paid', 'pending', 'deposit', 'advance', 'overdue']

export const STATUS_LABELS = {
  paid: 'Paid',
  pending: 'Pending',
  deposit: 'Deposit',
  advance: 'Advance',
  overdue: 'Overdue',
}

export const AGING_BUCKETS = ['0-30', '31-60', '61-90', '90+']

export const COLLECTION_TERMS = [
  { key: 'pending_submission', label: 'Pending Insurance Submission', shortLabel: 'Pending Submission' },
  { key: 'pending_payment', label: 'Pending Insurance Payment', shortLabel: 'Pending Payment' },
  { key: 'denied', label: 'Denied Claims', shortLabel: 'Denied Claims' },
  { key: 'outstanding', label: 'Outstanding Receivables', shortLabel: 'Outstanding' },
  { key: 'current', label: 'Current Receivables', shortLabel: 'Current' },
  { key: 'past_due', label: 'Past Due Receivables', shortLabel: 'Past Due' },
]

export const SERVICE_FIELDS = [
  { key: 'svc_opd', label: 'OPD' },
  { key: 'svc_diag_image', label: 'Diag & Image' },
  { key: 'svc_ipd', label: 'IPD' },
  { key: 'svc_surg_ot', label: 'Surg / OT' },
  { key: 'svc_emergency', label: 'Emergency' },
  { key: 'svc_chronic', label: 'Chronic' },
  { key: 'svc_pharma', label: 'Pharma' },
  { key: 'svc_support', label: 'Support' },
  { key: 'svc_admin', label: 'Admin' },
  { key: 'svc_homecare', label: 'Home Care' },
]

export const AGING_GROUPS = [
  'Current Receivables',
  '1-15 Days',
  '16-30 Days',
  '31-45 Days',
  '46-90 Days',
]

export const AGING_LABELS = {
  'Current Receivables': 'Current Receivables',
  '1-15 Days': '1-15 Days',
  '16-30 Days': '16-30 Days',
  '31-45 Days': '31-45 Days',
  '46-90 Days': '46-90 Days',
}

export function getAgingLabel(group) {
  return AGING_LABELS[group] || group || AGING_LABELS['Current Receivables']
}

export function normalizeAgingGroup(value) {
  const text = String(value || '').trim()
  if (!text) return null
  const lower = text.toLowerCase()
  const match = Object.entries(AGING_LABELS).find(([key, label]) =>
    lower === key.toLowerCase() || lower === String(label).toLowerCase()
  )
  if (match) return match[0]
  if (lower === 'n' || lower === 'due on schedule') return 'Current Receivables'
  if (lower === 'pay in installments') return null
  if (lower === '0-15 days') return '1-15 Days'
  if (lower === '46-60+ days' || lower === '46-60 days' || lower === '46–60+ days') return '46-90 Days'
  if (lower === '90+' || lower === '90+ days') return '46-90 Days'
  return AGING_GROUPS.includes(text) ? text : null
}

export function todayIso() {
  return new Date().toISOString().split('T')[0]
}

export function toNumber(value) {
  const parsed = parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function getTransferAmount(row = {}) {
  return toNumber(row.bcel) + toNumber(row.bcel2) + toNumber(row.ldb)
}

export function getDebtTransferAmount(row = {}) {
  return toNumber(row.bcel_paid) + toNumber(row.bcel2_paid) + toNumber(row.ldb_paid)
}

export function getBillingCollectedAmount(row = {}) {
  return toNumber(row.cash) + getTransferAmount(row) + toNumber(row.prepayment)
}

export function getDebtCollectedAmount(row = {}) {
  const channelTotal = toNumber(row.cash_paid) + getDebtTransferAmount(row)
  return channelTotal > 0 ? channelTotal : toNumber(row.amount_paid)
}

export function normalizePaymentType(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (!text) return null
  const lower = text.toLowerCase()
  const match = PAYMENT_TYPES.find(type => type.toLowerCase() === lower)
  if (match) return match
  if (lower === 'cash transfer' || lower === 'cash-transfer') return 'Cash/Transfer'
  if (lower === 'prepayment' || lower === 'deposit partial') return 'Deposit'
  if (lower === 'full advance' || lower === 'advance 100%') return 'Advance'
  if (lower === 'paid' || lower === 'complete' || lower === 'completed') return 'Transacted'
  return null
}

export function derivePaymentType(row = {}) {
  const explicit = normalizePaymentType(row.payment_type || row.payment_category)
  if (explicit) return explicit

  const grandTotal = toNumber(row.grand_total)
  const prepayment = toNumber(row.prepayment)
  const cash = toNumber(row.cash)
  const transfer = getTransferAmount(row)
  const debt = toNumber(row.balance ?? row.debt)
  const paidAtBilling = cash + transfer + prepayment

  if (prepayment > 0 && (grandTotal <= 0 || prepayment >= grandTotal)) return 'Advance'
  if (prepayment > 0 && prepayment < grandTotal) return 'Deposit'
  if (cash > 0 && transfer > 0) return 'Cash/Transfer'
  if (cash > 0) return 'Cash'
  if (transfer > 0) return 'Transfer'
  if (debt <= 0 && (paidAtBilling > 0 || row.debt_status === 'paid')) return 'Transacted'
  return 'Transacted'
}

export function getDepositAmount(row = {}) {
  const type = derivePaymentType(row)
  if (type !== 'Deposit') return 0
  const prepayment = toNumber(row.prepayment)
  if (prepayment > 0) return prepayment
  const collected = getBillingCollectedAmount(row)
  const grandTotal = toNumber(row.grand_total)
  return grandTotal > 0 ? Math.min(collected, grandTotal) : collected
}

export function getAdvanceAmount(row = {}) {
  const type = derivePaymentType(row)
  if (type !== 'Advance') return 0
  const prepayment = toNumber(row.prepayment)
  if (prepayment > 0) return prepayment
  const grandTotal = toNumber(row.grand_total)
  return grandTotal > 0 ? grandTotal : getBillingCollectedAmount(row)
}

export function addDays(dateStr, days = DEFAULT_DUE_DAYS) {
  if (!dateStr) return null
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return null
  date.setDate(date.getDate() + (Number(days) || 0))
  return date.toISOString().split('T')[0]
}

export function getDueDaysForInsurance(insuranceDueDays = {}, insurance) {
  if (!insurance) return DEFAULT_DUE_DAYS
  const direct = insuranceDueDays[insurance]
  const normalizedKey = Object.keys(insuranceDueDays).find(
    key => key.toLowerCase() === String(insurance).toLowerCase()
  )
  const value = direct ?? insuranceDueDays[normalizedKey]
  const days = Number(value)
  return Number.isFinite(days) && days > 0 ? days : DEFAULT_DUE_DAYS
}

export function calcDueDate(submitDate, insuranceDueDays = {}, insurance) {
  return addDays(submitDate, getDueDaysForInsurance(insuranceDueDays, insurance))
}

export function isDeniedClaim(row = {}) {
  const note = String(row.note || '').toLowerCase()
  return note.includes('denied') ||
    note.includes('reject') ||
    note.includes('rejected') ||
    note.includes('ປະຕິເສດ')
}

export function matchesCollectionTerm(row = {}, termKey, insuranceDueDays = {}) {
  const balance = toNumber(row.balance ?? row.debt)
  const dueDate = row.due_date || calcDueDate(row.submit_date || row.date, insuranceDueDays, row.insurance)
  const today = todayIso()

  if (termKey === 'pending_submission') return balance > 0 && !row.submit_date
  if (termKey === 'pending_payment') return balance > 0 && !!row.submit_date
  if (termKey === 'denied') return isDeniedClaim(row)
  if (termKey === 'outstanding') return balance > 0
  if (termKey === 'current') return balance > 0 && (!dueDate || dueDate >= today)
  if (termKey === 'past_due') return balance > 0 && !!dueDate && dueDate < today
  return true
}

export function computeCollectionTermSummary(rows = [], insuranceDueDays = {}) {
  return Object.fromEntries(COLLECTION_TERMS.map(term => {
    const termRows = rows.filter(row => matchesCollectionTerm(row, term.key, insuranceDueDays))
    const bills = new Set(termRows.map(row => row.bill_no || row.id).filter(Boolean)).size
    const amount = termRows.reduce((sum, row) => sum + toNumber(row.balance ?? row.debt), 0)
    return [term.key, { ...term, bills, amount }]
  }))
}

export function getCollectionStatus(row = {}, insuranceDueDays = {}) {
  const balance = toNumber(row.balance ?? row.debt)
  const dueDate = row.due_date || calcDueDate(row.submit_date || row.date, insuranceDueDays, row.insurance)

  if (isDeniedClaim(row)) {
    return { key: 'denied', label: 'Denied Claims', shortLabel: 'Denied Claims' }
  }
  if (balance <= 0) {
    return { key: 'paid', label: 'ຊຳລະແລ້ວ', shortLabel: 'Paid' }
  }
  if (!row.submit_date) {
    return { key: 'pending_submission', label: 'Pending Insurance Submission', shortLabel: 'Pending Submission' }
  }
  if (dueDate && dueDate < todayIso()) {
    return { key: 'past_due', label: 'Past Due Receivables', shortLabel: 'Past Due' }
  }
  return { key: 'pending_payment', label: 'Pending Insurance Payment', shortLabel: 'Pending Payment' }
}

export function calcDaysSince(dateStr) {
  if (!dateStr) return 0
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return 0
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000))
}

export function calcDaysBetween(fromDateStr, toDateStr = todayIso()) {
  if (!fromDateStr || !toDateStr) return 0
  const from = new Date(fromDateStr)
  const to = new Date(toDateStr)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86400000))
}

export function calcAgingBucket(row = {}) {
  const amount = toNumber(row.balance ?? row.debt)
  const dueDate = row.due_date || calcDueDate(row.submit_date || row.date, row.insuranceDueDays || {}, row.insurance)
  const baseDate = dueDate || row.submit_date || row.date
  if (!baseDate || amount <= 0) return '0-30'
  const days = dueDate ? calcDaysBetween(dueDate, todayIso()) : calcDaysSince(baseDate)
  if (days <= 30) return '0-30'
  if (days <= 60) return '31-60'
  if (days <= 90) return '61-90'
  return '90+'
}

export function resolvePaymentStatus(row = {}) {
  const explicit = String(row.payment_status || '').trim().toLowerCase()
  if (PAYMENT_STATUSES.includes(explicit)) return explicit

  const paymentType = derivePaymentType(row)
  const explicitType = normalizePaymentType(row.payment_type || row.payment_category)
  if (paymentType === 'Advance' && (explicitType === 'Advance' || getAdvanceAmount(row) > 0)) return 'advance'
  if (paymentType === 'Deposit' && (explicitType === 'Deposit' || getDepositAmount(row) > 0)) return 'deposit'

  const balance = toNumber(row.balance ?? row.debt)
  const dueDate = row.due_date || calcDueDate(row.submit_date || row.date, row.insuranceDueDays || {}, row.insurance)
  if (balance > 0 && dueDate && calcDaysBetween(dueDate, todayIso()) > 0) return 'overdue'
  if (balance > 0 || row.debt_status === 'pending') return 'pending'
  return 'paid'
}

export function statusBadgeClass(status) {
  if (status === 'paid') return 'bg-emerald-100 text-emerald-700'
  if (status === 'deposit') return 'bg-amber-100 text-amber-700'
  if (status === 'advance') return 'bg-sky-100 text-sky-700'
  if (status === 'overdue') return 'bg-red-100 text-red-700'
  return 'bg-slate-100 text-slate-700'
}

export function calcOverdueAging(days) {
  if (days <= 0) return 'Current Receivables'
  if (days <= 15) return '1-15 Days'
  if (days <= 30) return '16-30 Days'
  if (days <= 45) return '31-45 Days'
  return '46-90 Days'
}

export function countInstallmentRows(row = {}) {
  return [1, 2, 3].filter(number =>
    row[`payment_${number}_date`] ||
    row[`payment_${number}_method`] ||
    toNumber(row[`payment_${number}_amount`]) > 0
  ).length
}

export function calcAging(row = {}) {
  if (typeof row === 'string') return normalizeAgingGroup(row) || calcOverdueAging(calcDaysSince(row))

  const balance = toNumber(row.balance ?? row.debt)
  const dueDate = row.due_date || calcDueDate(row.submit_date || row.date, row.insuranceDueDays || {}, row.insurance)
  if (!dueDate) return calcOverdueAging(calcDaysSince(row.submit_date || row.date))

  const referenceDate = balance <= 0 && row.date_paid ? row.date_paid : todayIso()
  return calcOverdueAging(calcDaysBetween(dueDate, referenceDate))
}

export function calcOverdueDays(row = {}) {
  const dueDate = row.due_date || calcDueDate(row.submit_date || row.date, row.insuranceDueDays || {}, row.insurance)
  if (!dueDate) return 0
  const referenceDate = toNumber(row.balance ?? row.debt) <= 0 && row.date_paid ? row.date_paid : todayIso()
  return calcDaysBetween(dueDate, referenceDate)
}

export function normalizeInstallments(initial = {}) {
  const existing = [1, 2, 3].map(number => ({
    number,
    date: initial[`payment_${number}_date`] || '',
    method: initial[`payment_${number}_method`] || '',
    amount: toNumber(initial[`payment_${number}_amount`]),
  })).filter(item => item.date || item.method || item.amount > 0)

  if (existing.length) {
    return [...existing, ...Array.from({ length: 3 - existing.length }, (_, index) => ({
      number: existing.length + index + 1,
      date: '',
      method: '',
      amount: 0,
    }))].slice(0, 3)
  }

  const channelRows = [
    { method: 'cash', amount: toNumber(initial.cash_paid ?? initial.cash) },
    { method: 'bcel', amount: toNumber(initial.bcel_paid ?? initial.bcel) },
    { method: 'bcel2', amount: toNumber(initial.bcel2_paid ?? initial.bcel2) },
    { method: 'ldb', amount: toNumber(initial.ldb_paid ?? initial.ldb) },
  ].filter(row => row.amount > 0)

  const rows = channelRows.length
    ? channelRows.slice(0, 3).map((row, index) => ({
      number: index + 1,
      date: initial.date_paid || todayIso(),
      method: row.method,
      amount: row.amount,
    }))
    : [{ number: 1, date: initial.date_paid || todayIso(), method: '', amount: 0 }]

  return [...rows, ...Array.from({ length: 3 - rows.length }, (_, index) => ({
    number: rows.length + index + 1,
    date: '',
    method: '',
    amount: 0,
  }))].slice(0, 3)
}

export function summarizeInstallments(installments = []) {
  const active = installments
    .slice(0, 3)
    .map((item, index) => ({
      number: index + 1,
      date: item.date || null,
      method: item.method || null,
      amount: toNumber(item.amount),
    }))
    .filter(item => item.date || item.method || item.amount > 0)

  const channelTotals = { cash: 0, bcel: 0, bcel2: 0, ldb: 0 }
  active.forEach(item => {
    if (channelTotals[item.method] !== undefined) channelTotals[item.method] += item.amount
  })

  const total = active.reduce((sum, item) => sum + item.amount, 0)
  const latestDate = active.map(item => item.date).filter(Boolean).sort().at(-1) || null

  return { active, channelTotals, total, latestDate }
}
