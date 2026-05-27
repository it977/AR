export const DEFAULT_DUE_DAYS = 30

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'ເງິນສົດ (Cash)' },
  { value: 'bcel', label: 'BCEL' },
  { value: 'bcel2', label: 'BCEL 2' },
  { value: 'ldb', label: 'LDB Bank' },
]

export const AGING_GROUPS = [
  'N',
  'Due on schedule',
  'Pay in installments',
  '1-15 Days',
  '16-30 Days',
  '31-45 Days',
  '46-60+ Days',
]

export const AGING_LABELS = {
  N: 'ລໍຖ້າສົ່ງເອກະສານ',
  'Due on schedule': 'ຢູ່ໃນກຳນົດ',
  'Pay in installments': 'ຈ່າຍເປັນງວດ',
  '1-15 Days': '1-15 Days',
  '16-30 Days': '16-30 Days',
  '31-45 Days': '31-45 Days',
  '46-60+ Days': '46-60+ Days',
}

export function getAgingLabel(group) {
  return AGING_LABELS[group] || group || AGING_LABELS.N
}

export function normalizeAgingGroup(value) {
  const text = String(value || '').trim()
  if (!text) return null
  const lower = text.toLowerCase()
  const match = Object.entries(AGING_LABELS).find(([key, label]) =>
    lower === key.toLowerCase() || lower === String(label).toLowerCase()
  )
  if (match) return match[0]
  if (lower === '0-15 days') return '1-15 Days'
  return AGING_GROUPS.includes(text) ? text : null
}

export function todayIso() {
  return new Date().toISOString().split('T')[0]
}

export function toNumber(value) {
  const parsed = parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
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

export function calcOverdueAging(days) {
  if (days <= 0) return 'Due on schedule'
  if (days <= 15) return '1-15 Days'
  if (days <= 30) return '16-30 Days'
  if (days <= 45) return '31-45 Days'
  return '46-60+ Days'
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
  if (!row.submit_date) return 'N'

  const paid = toNumber(row.amount_paid)
  const balance = toNumber(row.balance ?? row.debt)
  const hasInstallmentPlan = countInstallmentRows(row) > 1 || (paid > 0 && balance > 0)
  if (hasInstallmentPlan) return 'Pay in installments'

  const dueDate = row.due_date || calcDueDate(row.submit_date, row.insuranceDueDays || {}, row.insurance)
  if (!dueDate) return 'N'

  const referenceDate = balance <= 0 && row.date_paid ? row.date_paid : todayIso()
  return calcOverdueAging(calcDaysBetween(dueDate, referenceDate))
}

export function calcOverdueDays(row = {}) {
  if (!row.submit_date) return 0
  const dueDate = row.due_date || calcDueDate(row.submit_date, row.insuranceDueDays || {}, row.insurance)
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
