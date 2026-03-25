import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'

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
      const { rows, total } = await fetchAllRows((from, to) => {
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
      console.log('✅ AR Data fetched:', rows.length, '/ Total in DB:', total)
      setData(rows)
    } catch (err) {
      console.error('AR data error:', err)
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

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const { rows } = await fetchAllRows((from, to) => {
          let q = supabase.from('ar_debt').select('*', { count: 'exact' }).order('date', { ascending: false })
          if (filters.dateFrom)     q = q.gte('date', filters.dateFrom)
          if (filters.dateTo)       q = q.lte('date', filters.dateTo)
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
  }, [filters.dateFrom, filters.dateTo, filters.agingGroup, filters.customerType, filters.insurance])

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
  const totalBills      = rows.length
  // uniqueCustomers = total patient visits (matches PDF "Total Customers" = row count, not unique HN)
  const uniqueCustomers = rows.length
  const cash   = rows.reduce((s, r) => s + (r.cash  || 0), 0)
  const bcel   = rows.reduce((s, r) => s + (r.bcel  || 0), 0)
  const bcel2  = rows.reduce((s, r) => s + (r.bcel2 || 0), 0)
  const ldb    = rows.reduce((s, r) => s + (r.ldb   || 0), 0)
  const outstandingDebt = rows.reduce((s, r) => s + (r.debt || 0), 0)
  // actualIncome = cash collected at billing time (cash + bcel + bcel2 + ldb)
  const actualIncome    = cash + bcel + bcel2 + ldb
  // dailyIncome = Actual Total Sale - Outstanding Debts
  const dailyIncome     = totalSales - outstandingDebt

  // Use debt_status column for accurate bill counts (matches PDF definitions)
  // null = paid in full at billing | 'pending' = still outstanding | 'paid' = collected via Pay off
  const paidBills        = rows.filter(r => !r.debt_status).length
  const outstandingBills = rows.filter(r => r.debt_status === 'pending').length
  const collectionBills  = rows.filter(r => r.debt_status === 'paid').length
  const discountedBills  = rows.filter(r => r.discounts && r.discounts > 0).length

  return {
    totalSalesGross, totalSales, totalDiscounts, totalBills, uniqueCustomers,
    actualIncome, outstandingDebt, dailyIncome,
    cash, bcel, bcel2, ldb,
    paidBills, outstandingBills, collectionBills, discountedBills,
  }
}

export function computeShiftData(rows = []) {
  const shifts = {
    '8AM-4PM':  { revenue: 0, bills: 0 },
    '4PM-12AM': { revenue: 0, bills: 0 },
    '12AM-8AM': { revenue: 0, bills: 0 },
  }
  rows.forEach(r => {
    if (shifts[r.workload]) {
      shifts[r.workload].revenue += r.grand_total || 0
      shifts[r.workload].bills   += 1
    }
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

export function computeAgingData(debtRows = []) {
  const buckets = {
    'N':          { balance: 0, bills: 0 },
    '0-15 Days':  { balance: 0, bills: 0 },
    '16-30 Days': { balance: 0, bills: 0 },
    '31-45 Days': { balance: 0, bills: 0 },
    '46-60+ Days':{ balance: 0, bills: 0 },
  }
  debtRows.forEach(r => {
    const g = r.aging_group || 'N'
    if (buckets[g]) {
      buckets[g].balance += r.balance || r.debt_amount || 0
      buckets[g].bills   += 1
    }
  })
  return buckets
}

export function computeAgingFromBills(rows = []) {
  const buckets = {
    'N':           { balance: 0, bills: 0 },
    '0-15 Days':   { balance: 0, bills: 0 },
    '16-30 Days':  { balance: 0, bills: 0 },
    '31-45 Days':  { balance: 0, bills: 0 },
    '46-60+ Days': { balance: 0, bills: 0 },
  }
  const now = Date.now()
  rows.forEach(r => {
    const days = r.date ? Math.max(0, Math.floor((now - new Date(r.date).getTime()) / 86400000)) : 0
    const key = days <= 0 ? 'N' : days <= 15 ? '0-15 Days' : days <= 30 ? '16-30 Days' : days <= 45 ? '31-45 Days' : '46-60+ Days'
    buckets[key].balance += r.debt || 0
    buckets[key].bills   += 1
  })
  return buckets
}
