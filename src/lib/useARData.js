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
// Hooks
// ============================================================

// Fetch ALL rows from a Supabase table in 1000-row batches (bypass API max_rows limit)
async function fetchAllRows(buildQuery) {
  const PAGE = 1000
  let allRows = []
  let from = 0
  let total = null
  while (true) {
    const { data: rows, error, count } = await buildQuery(from, from + PAGE - 1)
    if (error) throw error
    if (total === null && count != null) total = count
    if (rows?.length) allRows = allRows.concat(rows)
    if (!rows?.length || allRows.length >= (total ?? Infinity) || rows.length < PAGE) break
    from += PAGE
  }
  return { rows: allRows, total: total ?? allRows.length }
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
          if (filters.dateFrom)     q = q.gte(dateField, filters.dateFrom)
          if (filters.dateTo)       q = q.lte(dateField, filters.dateTo)
          if (filters.agingGroup)   q = q.eq('aging_group', filters.agingGroup)
          if (filters.customerType) q = q.eq('customer_type', filters.customerType)
          if (filters.insurance)    q = q.ilike('insurance', `%${filters.insurance}%`)
          return q.range(from, to)
        })
        setData(rows)
      } catch { setData([]) }
      setLoading(false)
    }
    load()
  }, [filters.dateFrom, filters.dateTo, filters.agingGroup, filters.customerType, filters.insurance, dateField])

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

export function computeKPIs(rows = []) {
  // totalSalesGross = sum of "Total" column (BEFORE discounts) — PDF "Total Sales"
  const totalSalesGross = rows.reduce((s, r) => s + (r.total      || 0), 0)
  const totalDiscounts  = rows.reduce((s, r) => s + (r.discounts  || 0), 0)
  // totalSales = sum of "Grand Total" (AFTER discounts) = totalSalesGross - totalDiscounts
  const totalSales      = rows.reduce((s, r) => s + (r.grand_total || 0), 0)
  const totalBills      = new Set(rows.map(r => r.bill_no).filter(Boolean)).size
  // uniqueCustomers = total patient visits (matches PDF "Total Customers" = row count, not unique HN)
  const uniqueCustomers = rows.length
  const cash   = rows.reduce((s, r) => s + (r.cash  || 0), 0)
  const bcel   = rows.reduce((s, r) => s + (r.bcel  || 0), 0)
  const bcel2  = rows.reduce((s, r) => s + (r.bcel2 || 0), 0)
  const ldb    = rows.reduce((s, r) => s + (r.ldb   || 0), 0)
  const prepayment = rows.reduce((s, r) => s + (r.prepayment || 0), 0)
  const outstandingDebt = rows.reduce((s, r) => s + (r.debt || 0), 0)
  // actualIncome = cash collected at billing time (cash + bcel + bcel2 + ldb)
  const actualIncome    = cash + bcel + bcel2 + ldb + prepayment
  // dailyIncome = Actual Total Sale - Outstanding Debts
  const dailyIncome     = totalSales - outstandingDebt

  // Use debt_status column for accurate bill counts (matches PDF definitions)
  // null = paid in full at billing | 'pending' = still outstanding | 'paid' = collected via Pay off
  const paidBills        = rows.filter(r => resolvePaymentStatus(r) === 'paid').length
  const outstandingBills = rows.filter(r => ['pending', 'overdue'].includes(resolvePaymentStatus(r))).length
  const collectionBills  = rows.filter(r => r.debt_status === 'paid').length
  const discountedBills  = rows.filter(r => r.discounts && r.discounts > 0).length

  return {
    totalSalesGross, totalSales, totalDiscounts, totalBills, uniqueCustomers,
    actualIncome, outstandingDebt, dailyIncome,
    cash, bcel, bcel2, ldb, prepayment,
    paidBills, outstandingBills, collectionBills, discountedBills,
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
    const g = calcAging(r)
    if (buckets[g]) {
      buckets[g].balance += balance
      buckets[g].bills   += 1
    }
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
