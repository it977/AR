import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import {
  AGING_BUCKETS,
  AGING_GROUPS,
  PAYMENT_STATUSES,
  SERVICE_FIELDS,
  calcAging,
  calcAgingBucket,
  derivePaymentType,
  getAdvanceAmount,
  getBillingCollectedAmount,
  getDebtCollectedAmount,
  getDepositAmount,
  resolvePaymentStatus,
  toNumber,
} from './debtUtils'

// ============================================================
// Retry wrapper for write operations
// ============================================================

export async function withRetry(fn, retries = 3) {
  let lastError
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const result = await fn()
      return result
    } catch (err) {
      lastError = err
      if (attempt < retries - 1) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
      }
    }
  }
  throw lastError
}

// ============================================================
// Hooks
// ============================================================

// Fetch ALL rows from a Supabase table in 1000-row batches with retry
async function fetchAllRows(buildQuery, retries = 3) {
  const PAGE = 1000
  let allRows = []
  let from = 0
  let total = null
  let attempt = 0
  while (true) {
    attempt = 0
    let success = false
    let rows, error, count
    while (attempt < retries) {
      const res = await buildQuery(from, from + PAGE - 1)
      rows = res.data; error = res.error; count = res.count
      if (!error) { success = true; break }
      attempt++
      if (attempt >= retries) throw error
      await new Promise(r => setTimeout(r, 1000 * attempt))
    }
    if (!success) throw error
    if (total === null && count != null) total = count
    if (rows?.length) allRows = allRows.concat(rows)
    if (!rows?.length || allRows.length >= (total ?? Infinity) || rows.length < PAGE) break
    from += PAGE
  }
  return { rows: allRows, total: total ?? allRows.length }
}

function toDateOnly(value) {
  if (!value) return ''
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, '0')
    const d = String(value.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  const text = String(value).trim()
  let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (match) {
    return `${match[1]}-${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}`
  }

  match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/)
  if (match) {
    const first = Number(match[1])
    const second = Number(match[2])
    const month = first > 12 ? second : first
    const day = first > 12 ? first : second
    return `${match[3]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  return ''
}

function inDateRange(date, from, to) {
  if (!date) return false
  if (from && date < from) return false
  if (to && date > to) return false
  return true
}

function paymentEntryInRange(entry, from, to) {
  if (!from && !to) return toNumber(entry.amount) > 0
  return toNumber(entry.amount) > 0 && inDateRange(entry.date, from, to)
}

function normalizePaymentMethod(value) {
  const text = String(value || '').trim().toLowerCase()
  if (!text) return ''
  if (text.includes('bcel') && text.includes('2')) return 'bcel2'
  if (text.includes('bcel')) return 'bcel'
  if (text.includes('ldb')) return 'ldb'
  if (text.includes('cash') || text.includes('ເງິນສົດ')) return 'cash'
  return text
}

export function getBillReceiptDate(row = {}) {
  const explicitDate = toDateOnly(row.payment_received_at)
  if (explicitDate) return explicitDate
  return getBillingCollectedAmount(row) > 0 ? toDateOnly(row.date) : ''
}

export function isRetroBillCollection(row = {}) {
  if (String(row.customer_type || '').toUpperCase() === 'INS') return false
  const receiptDate = getBillReceiptDate(row)
  if (!receiptDate) return false
  const issuedDate = toDateOnly(row.bill_issued_at) || toDateOnly(row.date)
  return !issuedDate || receiptDate > issuedDate
}

export function getBillCollectionAmount(row = {}) {
  return getBillingCollectedAmount(row)
}

export function getDeferredReceiptTransferTotals(rows = []) {
  return (rows || []).reduce((totals, row) => {
    const issueDate = toDateOnly(row.date)
    const receiptDate = toDateOnly(row.payment_received_at)
    if (!issueDate || !receiptDate || receiptDate <= issueDate) return totals

    const late = getLateReceiptCollectionTotals(row)
    totals.cash += late.cash
    totals.bcel += late.bcel
    totals.bcel2 += late.bcel2
    totals.ldb += late.ldb
    totals.amount += late.amount
    return totals
  }, { cash: 0, bcel: 0, bcel2: 0, ldb: 0, amount: 0 })
}

export function getLateReceiptCollectionTotals(row = {}) {
  const cash = toNumber(row.cash)
  const bcel = toNumber(row.bcel)
  const bcel2 = toNumber(row.bcel2)
  const ldb = toNumber(row.ldb)
  const transfer = bcel + bcel2 + ldb

  if (cash > 0 && transfer > 0) {
    return { cash: 0, bcel, bcel2, ldb, amount: transfer }
  }

  return { cash, bcel, bcel2, ldb, amount: cash + transfer }
}

export function hasHistoricalDebtAgingMarker(row = {}) {
  const aging = String(row.aging_group || '').trim()
  if (!aging) return false
  const normalized = aging.toLowerCase()
  if (normalized === 'current receivables') return false
  if (aging === 'ຈ່າຍຕາມກຳນົດ') return false
  return /\d/.test(aging) || /day/i.test(aging)
}

export function getMissingDebtRowsFromBills(billRows = [], debtRows = []) {
  const debtBillSet = new Set(
    (debtRows || []).map(row => row.bill_no).filter(Boolean)
  )

  return (billRows || [])
    .filter(row => row.bill_no && !debtBillSet.has(row.bill_no))
    .map(row => {
      const collected = getBillCollectionAmount(row)
      const balance = toNumber(row.debt)
      const historicalPaidDebt = balance <= 0 && collected > 0 && hasHistoricalDebtAgingMarker(row)
      const openDebt = balance > 0
      if (!historicalPaidDebt && !openDebt) return null

      const debtAmount = openDebt ? balance : collected
      return {
        ...row,
        debt_amount: debtAmount,
        amount_paid: historicalPaidDebt ? collected : 0,
        cash_paid: historicalPaidDebt ? toNumber(row.cash) : 0,
        bcel_paid: historicalPaidDebt ? toNumber(row.bcel) : 0,
        bcel2_paid: historicalPaidDebt ? toNumber(row.bcel2) : 0,
        ldb_paid: historicalPaidDebt ? toNumber(row.ldb) : 0,
        balance: openDebt ? balance : 0,
      }
    })
    .filter(Boolean)
}

export function getSameDaySettledDebtStats(viewRows = [], outstandingRows = []) {
  const debtBillSet = new Set(
    (outstandingRows || []).map(row => row.bill_no).filter(Boolean)
  )
  const billsByNo = new Set()
  const paidBillsByNo = new Set()
  let amount = 0

  for (const row of viewRows || []) {
    if (row.bill_no && debtBillSet.has(row.bill_no)) continue
    if (toNumber(row.debt) > 0) continue

    const collected = getBillCollectionAmount(row)
    if (collected <= 0) continue

    const issueDate = toDateOnly(row.date)
    const receiptDate = toDateOnly(row.payment_received_at)
    const lateReceipt = receiptDate && issueDate && receiptDate > issueDate
      ? getLateReceiptCollectionTotals(row)
      : { amount: 0 }

    if (lateReceipt.amount > 0) {
      amount += lateReceipt.amount
      if (row.bill_no) {
        billsByNo.add(row.bill_no)
        if (toNumber(row.cash) > 0 && (toNumber(row.bcel) + toNumber(row.bcel2) + toNumber(row.ldb)) > 0) {
          paidBillsByNo.add(row.bill_no)
        }
      }
      continue
    }

    // Historical debt row that was later paid directly in Billing Management but
    // has no ar_debt snapshot. Keep it as issue-day Outstanding, matching Looker.
    if (hasHistoricalDebtAgingMarker(row)) {
      amount += collected
      if (row.bill_no) billsByNo.add(row.bill_no)
      continue
    }

    const customerType = String(row.customer_type || '').toUpperCase()
    const insurance = String(row.insurance || '').trim()
    if (customerType === 'INS' || insurance.length > 0) {
      amount += collected
      if (row.bill_no) {
        billsByNo.add(row.bill_no)
        paidBillsByNo.add(row.bill_no)
      }
    }
  }

  return { amount, bills: billsByNo.size, paidBills: paidBillsByNo.size }
}

export function isPaidOnIssueDate(row = {}) {
  if (getBillCollectionAmount(row) <= 0) return false
  const issueDate = toDateOnly(row.bill_issued_at) || toDateOnly(row.date)
  const receiptDate = toDateOnly(row.payment_received_at) || issueDate
  if (!issueDate || !receiptDate || receiptDate <= issueDate) return true

  return toNumber(row.cash) > 0 && (toNumber(row.bcel) + toNumber(row.bcel2) + toNumber(row.ldb)) > 0
}

export function useARData(filters = {}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { rows } = await fetchAllRows((from, to) => {
        let q = supabase.from('ar_bills').select('*', { count: 'exact' }).order('date', { ascending: false })
        if (filters.dateFrom)     q = q.gte('date', filters.dateFrom)
        if (filters.dateTo)       q = q.lte('date', filters.dateTo)
        if (filters.workload)     q = q.eq('workload', filters.workload)
        if (filters.customerType) q = q.eq('customer_type', filters.customerType)
        if (filters.gender)       q = q.eq('gender', filters.gender)
        if (filters.insiteOnsite) q = q.eq('insite_onsite', filters.insiteOnsite)
        if (filters.opdIpd)       q = q.eq('opd_ipd', filters.opdIpd)
        return q.range(from, to)
      })
      setData(rows)
    } catch (err) {
      setError(err.message)
      setData([])
    } finally {
      setLoading(false)
    }
  }, [filters.dateFrom, filters.dateTo, filters.workload, filters.customerType, filters.gender, filters.insiteOnsite, filters.opdIpd])

  useEffect(() => { fetchData() }, [fetchData])
  return { data, loading, error, refetch: fetchData }
}

export function useBillReceiptData(filters = {}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { rows } = await fetchAllRows((from, to) => {
        let q = supabase.from('ar_bills').select('*', { count: 'exact' }).order('date', { ascending: false })
        if (filters.workload) q = q.eq('workload', filters.workload)
        if (filters.customerType) q = q.eq('customer_type', filters.customerType)
        if (filters.gender) q = q.eq('gender', filters.gender)
        if (filters.insiteOnsite) q = q.eq('insite_onsite', filters.insiteOnsite)
        if (filters.opdIpd) q = q.eq('opd_ipd', filters.opdIpd)
        return q.range(from, to)
      })
      const filteredRows = rows.filter(row =>
        getBillingCollectedAmount(row) > 0 &&
        inDateRange(getBillReceiptDate(row), filters.dateFrom, filters.dateTo)
      )
      setData(filteredRows)
    } catch (err) {
      setError(err.message)
      setData([])
    } finally {
      setLoading(false)
    }
  }, [filters.dateFrom, filters.dateTo, filters.workload, filters.customerType, filters.gender, filters.insiteOnsite, filters.opdIpd])

  useEffect(() => { fetchData() }, [fetchData])
  return { data, loading, error, refetch: fetchData }
}

export function usePayoffData(filters = {}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  // ໃຫ້ caller ເລືອກ date column ໄດ້:
  //   'date'      → ວັນທີຂອງໃບບິນຕົ້ນສະບັບ (default — ໃຊ້ໃນ Aging/Outstanding/Debt Management)
  //   'date_paid' → ວັນທີຊຳລະ (ໃຊ້ໃນ Daily Sales/Payment Channel — cash flow view)
  const dateField = filters.payoffDateField || 'date'

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const { rows } = await fetchAllRows((from, to) => {
          let q = supabase.from('ar_debt').select('*', { count: 'exact' }).order(dateField, { ascending: false })
          if (dateField !== 'date_paid' && filters.dateFrom) q = q.gte(dateField, filters.dateFrom)
          if (dateField !== 'date_paid' && filters.dateTo) q = q.lte(dateField, filters.dateTo)
          if (filters.agingGroup)   q = q.eq('aging_group', filters.agingGroup)
          if (filters.customerType) q = q.eq('customer_type', filters.customerType)
          if (filters.insurance)    q = q.ilike('insurance', `%${filters.insurance}%`)
          if (filters.workloadDebt) q = q.eq('workload', filters.workloadDebt)
          return q.range(from, to)
        })
        const filteredRows = dateField === 'date_paid'
          ? rows.filter(row => hasDebtPaymentInDateRange(row, filters.dateFrom, filters.dateTo))
          : rows
        setData(filteredRows)
      } catch { setData([]) }
      setLoading(false)
    }
    load()
  }, [filters.dateFrom, filters.dateTo, filters.agingGroup, filters.customerType, filters.insurance, filters.workloadDebt, dateField])

  return { data, loading }
}

export function useCashflowData(filters = {}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const { rows } = await fetchAllRows((from, to) => {
          let q = supabase.from('ar_cashflow').select('*', { count: 'exact' }).order('date', { ascending: false })
          if (filters.dateFrom) q = q.gte('date', filters.dateFrom)
          if (filters.dateTo) q = q.lte('date', filters.dateTo)
          if (filters.workload) q = q.eq('workload', filters.workload)
          return q.range(from, to)
        })
        setData(rows)
      } catch {
        setData([])
      }
      setLoading(false)
    }
    load()
  }, [filters.dateFrom, filters.dateTo, filters.workload])

  return { data, loading }
}

export function useBillsDebtData(filters = {}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const { rows } = await fetchAllRows((from, to) => {
          let q = supabase.from('ar_bills').select('*', { count: 'exact' }).not('debt_status', 'is', null).order('date', { ascending: false })
          if (filters.dateFrom)     q = q.gte('date', filters.dateFrom)
          if (filters.dateTo)       q = q.lte('date', filters.dateTo)
          if (filters.customerType) q = q.eq('customer_type', filters.customerType)
          if (filters.insurance)    q = q.ilike('insurance', `%${filters.insurance}%`)
          return q.range(from, to)
        })
        setData(rows)
      } catch { setData([]) }
      setLoading(false)
    }
    load()
  }, [filters.dateFrom, filters.dateTo, filters.customerType, filters.insurance])

  return { data, loading }
}

// ============================================================
// Compute helpers (pure functions — no Supabase calls)
// ============================================================

export function getLookerMaxDate(rows = []) {
  return (rows || []).reduce((max, row) => (
    row.source_key && row.date && row.date > max ? row.date : max
  ), '')
}

export function capToLookerMaxDate(rows = [], maxDate = '', filters = {}) {
  if (!maxDate || filters.dateFrom || filters.dateTo) return rows || []
  return (rows || []).filter(row => !row.date || row.date <= maxDate)
}

export function getDebtInitialAmount(row = {}) {
  const explicit = toNumber(row.debt_amount)
  const balance = toNumber(row.balance ?? row.debt)
  const collected = getDebtCollectedAmount(row)
  if (explicit > 0) return explicit
  if (balance > 0 || collected > 0) return balance + collected
  return toNumber(row.grand_total)
}

export function isSameDayPaidBillingRow(row = {}) {
  const customerType = String(row.customer_type || '').toUpperCase()
  if (customerType === 'INS' || String(row.insurance || '').trim()) return false
  if (toNumber(row.debt) > 0) return false
  if (getBillCollectionAmount(row) <= 0) return false

  const issueDate = toDateOnly(row.bill_issued_at) || toDateOnly(row.date)
  const receiptDate = toDateOnly(row.payment_received_at)
  return !!issueDate && !!receiptDate && receiptDate <= issueDate
}

export function shouldExcludeIssueDebtRow(row = {}, billRows = []) {
  if (!row.bill_no) return false
  const rowDate = toDateOnly(row.date)
  const matchingBill = (billRows || []).find(bill =>
    bill.bill_no === row.bill_no && (!rowDate || toDateOnly(bill.date) === rowDate)
  )
  if (!matchingBill || !isSameDayPaidBillingRow(matchingBill)) return false
  return getBillCollectionAmount(matchingBill) >= getDebtInitialAmount(row)
}

export function getIssueOutstandingRows(debtRows = [], billRows = []) {
  return (debtRows || []).filter(row => !shouldExcludeIssueDebtRow(row, billRows))
}

export function getDebtPaidAmount(row = {}) {
  const direct = getDebtCollectedAmount(row)
  if (direct > 0) return direct
  const paid = getDebtInitialAmount(row) - toNumber(row.balance ?? row.debt)
  return paid > 0 ? paid : 0
}

function capPaymentEntriesToInitialDebt(row = {}, entries = []) {
  const initial = getDebtInitialAmount(row)
  const total = entries.reduce((sum, entry) => sum + toNumber(entry.amount), 0)
  if (initial <= 0 || total <= initial) return entries

  let remaining = initial
  return entries
    .map(entry => {
      const amount = Math.min(toNumber(entry.amount), remaining)
      remaining -= amount
      return { ...entry, amount }
    })
    .filter(entry => entry.amount > 0)
}

export function getDebtPaymentEntries(row = {}) {
  const installmentEntries = [1, 2, 3].map(number => ({
    number,
    date: toDateOnly(row[`payment_${number}_date`]),
    method: normalizePaymentMethod(row[`payment_${number}_method`]),
    amount: toNumber(row[`payment_${number}_amount`]),
  })).filter(entry => entry.amount > 0)

  if (installmentEntries.length) return capPaymentEntriesToInitialDebt(row, installmentEntries)

  const fallbackDate = toDateOnly(row.date_paid)
  const channelEntries = [
    { method: 'cash', amount: toNumber(row.cash_paid) },
    { method: 'bcel', amount: toNumber(row.bcel_paid) },
    { method: 'bcel2', amount: toNumber(row.bcel2_paid) },
    { method: 'ldb', amount: toNumber(row.ldb_paid) },
  ].filter(entry => entry.amount > 0)

  if (channelEntries.length) {
    return capPaymentEntriesToInitialDebt(row, channelEntries.map((entry, index) => ({
      number: index + 1,
      date: fallbackDate,
      ...entry,
    })))
  }

  const amount = getDebtPaidAmount(row)
  return amount > 0 ? capPaymentEntriesToInitialDebt(row, [{ number: 1, date: fallbackDate, method: '', amount }]) : []
}

export function getDebtPaidAmountForDateRange(row = {}, from = '', to = '') {
  return getDebtPaymentEntries(row)
    .filter(entry => paymentEntryInRange(entry, from, to))
    .reduce((sum, entry) => sum + toNumber(entry.amount), 0)
}

export function getDebtPaidChannelTotalsForDateRange(row = {}, from = '', to = '') {
  const totals = { cash: 0, bcel: 0, bcel2: 0, ldb: 0, amount: 0 }
  getDebtPaymentEntries(row)
    .filter(entry => paymentEntryInRange(entry, from, to))
    .forEach(entry => {
      const amount = toNumber(entry.amount)
      totals.amount += amount
      if (totals[entry.method] !== undefined) totals[entry.method] += amount
    })
  return totals
}

export function hasDebtPaymentInDateRange(row = {}, from = '', to = '') {
  return getDebtPaidAmountForDateRange(row, from, to) > 0
}

export function isUsableCashflowSummary({
  totalSales = 0,
  actualIncome = 0,
  outstandingDebt = 0,
  fallbackDailyIncome = 0,
} = {}) {
  const summaryDebt = toNumber(outstandingDebt)
  const dailyIncomeFromSummary = summaryDebt > 0
    ? Math.max(0, toNumber(totalSales) - summaryDebt)
    : toNumber(fallbackDailyIncome)
  const actual = toNumber(actualIncome)
  if (actual <= 0) return false

  // Summary_CashFlow can contain partial collection-only rows for dates whose Daily
  // rows came from another upload. Only trust it when it covers the billing-day
  // income implied by Actual Total Sale and initial Outstanding Debt.
  return actual + 0.5 >= dailyIncomeFromSummary
}

export function computeKPIs(rows = []) {
  // Looker-aligned: every metric derives from the same per-bill formula Looker uses.
  const totalSalesGross = rows.reduce((s, r) => s + (r.total      || 0), 0)
  const totalDiscounts  = rows.reduce((s, r) => s + (r.discounts  || 0), 0)
  const totalSales      = rows.reduce((s, r) => s + (r.grand_total || 0), 0)
  // Total Bills = distinct bill number. Total Customers/visits remains the row count.
  const totalBills      = new Set(rows.map(r => r.bill_no).filter(Boolean)).size
  const uniqueCustomers = rows.length
  const cash   = rows.reduce((s, r) => s + (r.cash  || 0), 0)
  const bcel   = rows.reduce((s, r) => s + (r.bcel  || 0), 0)
  const bcel2  = rows.reduce((s, r) => s + (r.bcel2 || 0), 0)
  const ldb    = rows.reduce((s, r) => s + (r.ldb   || 0), 0)
  const prepayment = rows.reduce((s, r) => s + (r.prepayment || 0), 0)
  // Daily Income = channels collected at billing time.
  const dailyIncome     = cash + bcel + bcel2 + ldb + prepayment
  // Outstanding = Actual Total Sale - Daily Income (initial debt, never reduced post-billing).
  const outstandingDebt = totalSales - dailyIncome
  const actualIncome    = dailyIncome

  // Looker formula (exclusive — bills are either paid or outstanding):
  //   paidBills        = bills with debt = 0 (no remaining)
  //   outstandingBills = bills with debt > 0
  // paidBills + outstandingBills = totalBills (always)
  const paidBills = rows.filter(r => (r.debt || 0) === 0).length
  const outstandingBills = rows.filter(r => (r.debt || 0) > 0).length
  const collectionBills  = rows.filter(r => r.debt_status === 'paid').length
  const discountedBills  = rows.filter(r => r.discounts && r.discounts > 0).length

  return {
    totalSalesGross, totalSales, totalDiscounts, totalBills, uniqueCustomers,
    actualIncome, outstandingDebt, dailyIncome,
    cash, bcel, bcel2, ldb, prepayment,
    paidBills, outstandingBills, collectionBills, discountedBills,
  }
}

export function computeBillReceiptStats(rows = []) {
  const cash = rows.reduce((s, r) => s + toNumber(r.cash), 0)
  const bcel = rows.reduce((s, r) => s + toNumber(r.bcel), 0)
  const bcel2 = rows.reduce((s, r) => s + toNumber(r.bcel2), 0)
  const ldb = rows.reduce((s, r) => s + toNumber(r.ldb), 0)
  const prepayment = rows.reduce((s, r) => s + toNumber(r.prepayment), 0)
  return {
    amount: cash + bcel + bcel2 + ldb + prepayment,
    bills: new Set(rows.map(r => r.bill_no).filter(Boolean)).size,
    cash,
    bcel,
    bcel2,
    ldb,
    prepayment,
  }
}

export function computeShiftData(rows = []) {
  const shifts = {
    '8AM-4PM':  { revenue: 0, bills: 0 },
    '4PM-12AM': { revenue: 0, bills: 0 },
    '12AM-8AM': { revenue: 0, bills: 0 },
    '12PM-8AM': { revenue: 0, bills: 0 },
  }
  const billsByShift = {}
  rows.forEach(r => {
    if (shifts[r.workload]) {
      shifts[r.workload].revenue += r.grand_total || 0
      if (!billsByShift[r.workload]) billsByShift[r.workload] = new Set()
      if (r.bill_no) billsByShift[r.workload].add(r.bill_no)
    }
  })
  Object.keys(shifts).forEach(shift => {
    shifts[shift].bills = billsByShift[shift]?.size || 0
  })
  return shifts
}

export function computeServiceData(rows = []) {
  const svc = {
    'OPD': 0, 'IPD': 0, 'Diag & Image': 0, 'Pharma': 0, 'Surg / OT': 0,
    'Emergency': 0, 'Chronic': 0, 'Home Care': 0, 'Admin': 0, 'Support': 0,
  }
  rows.forEach(r => {
    svc['OPD']         += r.svc_opd        || 0
    svc['IPD']         += r.svc_ipd        || 0
    svc['Diag & Image']+= r.svc_diag_image || 0
    svc['Pharma']      += r.svc_pharma     || 0
    svc['Surg / OT']   += r.svc_surg_ot   || 0
    svc['Emergency']   += r.svc_emergency  || 0
    svc['Chronic']     += r.svc_chronic    || 0
    svc['Home Care']   += r.svc_homecare   || 0
    svc['Admin']       += r.svc_admin      || 0
    svc['Support']     += r.svc_support    || 0
  })
  return svc
}

export function computePaymentTypeSummary(rows = []) {
  const init = {
    Cash: { bills: 0, amount: 0 },
    Transfer: { bills: 0, amount: 0 },
    'Cash/Transfer': { bills: 0, amount: 0 },
    Transacted: { bills: 0, amount: 0 },
    Deposit: { bills: 0, amount: 0 },
    Advance: { bills: 0, amount: 0 },
  }
  rows.forEach(row => {
    const type = derivePaymentType(row)
    const bucket = init[type] || init.Transacted
    bucket.bills += 1
    if (type === 'Deposit') bucket.amount += getDepositAmount(row)
    else if (type === 'Advance') bucket.amount += getAdvanceAmount(row)
    else bucket.amount += getBillingCollectedAmount(row) || (toNumber(row.balance ?? row.debt) <= 0 ? toNumber(row.grand_total) : 0)
  })
  return init
}

export function computeStatusSummary(rows = []) {
  const init = Object.fromEntries(PAYMENT_STATUSES.map(status => [status, { bills: 0, amount: 0 }]))
  rows.forEach(row => {
    const status = resolvePaymentStatus(row)
    const bucket = init[status] || init.pending
    const balance = toNumber(row.balance ?? row.debt)
    bucket.bills += 1
    if (status === 'deposit') bucket.amount += getDepositAmount(row) || balance
    else if (status === 'advance') bucket.amount += getAdvanceAmount(row)
    else if (status === 'paid') bucket.amount += getDebtCollectedAmount(row) || getBillingCollectedAmount(row) || toNumber(row.grand_total)
    else bucket.amount += balance
  })
  return init
}

export function computeAgingBucketData(rows = []) {
  const buckets = Object.fromEntries(AGING_BUCKETS.map(bucket => [bucket, { balance: 0, bills: 0 }]))
  rows.forEach(row => {
    const balance = toNumber(row.balance ?? row.debt)
    if (balance <= 0) return
    const bucket = calcAgingBucket(row)
    buckets[bucket].balance += balance
    buckets[bucket].bills += 1
  })
  return buckets
}

export function computeServiceSummary(rows = []) {
  return SERVICE_FIELDS.map(({ key, label }) => {
    const bills = new Set()
    const clients = new Set()
    let amount = 0
    rows.forEach(row => {
      const value = toNumber(row[key])
      if (value <= 0) return
      amount += value
      bills.add(row.bill_no || row.id || `${label}-${bills.size}`)
      clients.add(row.hn || row.patient_name || row.bill_no || row.id || `${label}-${clients.size}`)
    })
    const billCount = bills.size
    const clientCount = clients.size
    return {
      key,
      label,
      amount,
      bills: billCount,
      clients: clientCount,
      averagePerClient: clientCount > 0 ? amount / clientCount : 0,
    }
  }).sort((a, b) => b.amount - a.amount)
}

export function computeLocationSummary(rows = []) {
  const init = {
    Insite: { bills: new Set(), amount: 0 },
    Onsite: { bills: new Set(), amount: 0 },
  }
  rows.forEach(row => {
    const key = row.insite_onsite === 'Onsite' ? 'Onsite' : 'Insite'
    init[key].bills.add(row.bill_no || row.id || `${key}-${init[key].bills.size}`)
    init[key].amount += toNumber(row.grand_total)
  })
  return Object.fromEntries(Object.entries(init).map(([key, value]) => {
    const bills = value.bills.size
    return [key, {
      bills,
      amount: value.amount,
      averagePerBill: bills > 0 ? value.amount / bills : 0,
    }]
  }))
}

export function computeDebtCollectionStats(rows = []) {
  const cash = rows.reduce((s, r) => s + (r.cash_paid || 0), 0)
  const bcel = rows.reduce((s, r) => s + (r.bcel_paid || 0), 0)
  const bcel2 = rows.reduce((s, r) => s + (r.bcel2_paid || 0), 0)
  const ldb = rows.reduce((s, r) => s + (r.ldb_paid || 0), 0)
  const fallbackAmount = rows.reduce((s, r) => {
    const paid = getDebtCollectedAmount(r)
    if (paid > 0) return s + paid
    const debtPaid = toNumber(r.debt_amount) - toNumber(r.balance)
    return s + (debtPaid > 0 ? debtPaid : 0)
  }, 0)
  const channelAmount = cash + bcel + bcel2 + ldb
  return {
    amount: channelAmount > 0 ? channelAmount : fallbackAmount,
    bills: new Set(rows.map(r => r.bill_no).filter(Boolean)).size,
    cash,
    bcel,
    bcel2,
    ldb,
  }
}

export function computeAgingData(debtRows = []) {
  const buckets = Object.fromEntries(AGING_GROUPS.map(group => [group, { balance: 0, bills: 0 }]))
  // Aging report ສະແດງສະເພາະຍອດທີ່ຍັງຄ້າງຊຳລະ (balance > 0).
  // ໜີ້ທີ່ຊຳລະແລ້ວ (balance=0) ບໍ່ຄິດເຂົ້າ — ບໍ່ໃຊ່ "ໜີ້ຄ້າງ" ອີກຕໍ່ໄປ.
  debtRows.forEach(r => {
    const balance = r.balance || 0
    if (balance <= 0) return
    const g = r.aging_group || calcAging(r)
    if (!buckets[g]) buckets[g] = { balance: 0, bills: 0 }
    buckets[g].balance += balance
    buckets[g].bills   += 1
  })
  return buckets
}

export function computeAgingFromBills(rows = []) {
  const buckets = Object.fromEntries(AGING_GROUPS.map(group => [group, { balance: 0, bills: 0 }]))
  rows.forEach(r => {
    const key = calcAging(r)
    buckets[key].balance += r.debt || 0
    buckets[key].bills   += 1
  })
  return buckets
}
