import { useState, useMemo } from 'react'
import ReactApexChart from 'react-apexcharts'
import KPICard from '../components/KPICard'
import DateFilter, { FilterSelect } from '../components/DateFilter'
import LoadingSpinner, { EmptyState } from '../components/LoadingSpinner'
import PDFButton from '../components/PDFButton'
import {
  useARData,
  usePayoffData,
  useBillReceiptData,
  useCashflowData,
  computeKPIs,
  computePaymentTypeSummary,
  filterToLookerSubset,
  getBillCollectionAmount,
  getDebtInitialAmount,
  getDebtPaidAmountForDateRange,
  getDebtPaidChannelTotalsForDateRange,
  isRetroBillCollection,
  isUsableCashflowSummary,
} from '../lib/useARData'
import { formatNumber } from '../lib/excelParser'
import { toNumber } from '../lib/debtUtils'
import { useGlobalFilters } from '../context/FilterContext'

function getSameDaySettledDebtStats(rows = []) {
  const debtRows = (rows || []).filter(row => {
    const customerType = String(row.customer_type || '').toUpperCase()
    const collected = getBillCollectionAmount(row)
    const remainingDebt = Number(row.debt || 0)
    return customerType === 'INS' && remainingDebt <= 0 && collected > 0
  })
  const billNos = new Set(debtRows.map(row => row.bill_no).filter(Boolean))
  return {
    amount: debtRows.reduce((sum, row) => sum + getBillCollectionAmount(row), 0),
    bills: billNos.size || debtRows.length,
  }
}

const METHODS = [
  { key: 'cash',  label: 'Cash', sublabel: 'Cash',               color: '#10b981', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100' },
  { key: 'bcel',  label: 'BCEL',    sublabel: 'BCEL Bank Transfer',  color: '#cc1c2e', bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-100' },
  { key: 'bcel2', label: 'BCEL 2',  sublabel: 'BCEL2 Bank Transfer', color: '#1a56a0', bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-100' },
  { key: 'ldb',   label: 'LDB',     sublabel: 'Lao Dev Bank',        color: '#e07b00', bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-100' },
]

const SHIFT_OPTIONS = [
  { value: '8AM-4PM', label: '08:00AM-16:00PM' },
  { value: '4PM-12AM', label: '16:00PM-21:00PM' },
  { value: '12AM-8AM', label: '21:00PM-08:00AM' },
]

// Bank logo icons (SVG inline)
const BankIcon = ({ method }) => {
  if (method === 'cash') return (
    <svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect width="44" height="44" rx="12" fill="#10b981"/>
      <rect x="7" y="15" width="30" height="14" rx="3" stroke="white" strokeWidth="1.5" fill="white" fillOpacity="0.15"/>
      <circle cx="22" cy="22" r="4.5" stroke="white" strokeWidth="1.5"/>
      <circle cx="22" cy="22" r="2.2" fill="white"/>
      <rect x="9" y="17" width="4" height="4" rx="1.5" fill="white" fillOpacity="0.5"/>
      <rect x="31" y="23" width="4" height="4" rx="1.5" fill="white" fillOpacity="0.5"/>
      <text x="22" y="36" textAnchor="middle" fill="white" fontSize="6" fontWeight="700" fontFamily="Arial" fillOpacity="0.8">CASH</text>
    </svg>
  )
  if (method === 'bcel') return (
    <svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect width="44" height="44" rx="12" fill="#cc1c2e"/>
      <rect x="5" y="5" width="34" height="34" rx="8" fill="url(#bcel_grad)"/>
      <defs>
        <linearGradient id="bcel_grad" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#e8283e"/>
          <stop offset="1" stopColor="#9b1020"/>
        </linearGradient>
      </defs>
      <text x="22" y="19" textAnchor="middle" fill="white" fontSize="10" fontWeight="900" fontFamily="Arial, sans-serif" letterSpacing="0.5">BCEL</text>
      <rect x="10" y="22" width="24" height="1.5" fill="white" fillOpacity="0.5" rx="1"/>
      <text x="22" y="32" textAnchor="middle" fill="white" fontSize="6.5" fontWeight="500" fontFamily="Arial, sans-serif" fillOpacity="0.9" letterSpacing="0.3">BANK</text>
    </svg>
  )
  if (method === 'bcel2') return (
    <svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect width="44" height="44" rx="12" fill="#1a56a0"/>
      <rect x="5" y="5" width="34" height="34" rx="8" fill="url(#bcel2_grad)"/>
      <defs>
        <linearGradient id="bcel2_grad" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2563c4"/>
          <stop offset="1" stopColor="#0e3472"/>
        </linearGradient>
      </defs>
      <text x="18" y="19" textAnchor="middle" fill="white" fontSize="9" fontWeight="900" fontFamily="Arial, sans-serif" letterSpacing="0.5">BCEL</text>
      <rect x="10" y="22" width="24" height="1.5" fill="white" fillOpacity="0.5" rx="1"/>
      <text x="34" y="34" textAnchor="middle" fill="white" fontSize="14" fontWeight="900" fontFamily="Arial, sans-serif" fillOpacity="0.9">2</text>
      <text x="16" y="32" textAnchor="middle" fill="white" fontSize="6.5" fontWeight="500" fontFamily="Arial, sans-serif" fillOpacity="0.9" letterSpacing="0.3">BANK</text>
    </svg>
  )
  if (method === 'ldb') return (
    <svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect width="44" height="44" rx="12" fill="#e07b00"/>
      <rect x="5" y="5" width="34" height="34" rx="8" fill="url(#ldb_grad)"/>
      <defs>
        <linearGradient id="ldb_grad" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f59e0b"/>
          <stop offset="1" stopColor="#b45309"/>
        </linearGradient>
      </defs>
      <text x="22" y="19" textAnchor="middle" fill="white" fontSize="11" fontWeight="900" fontFamily="Arial, sans-serif" letterSpacing="0.5">LDB</text>
      <rect x="10" y="22" width="24" height="1.5" fill="white" fillOpacity="0.5" rx="1"/>
      <text x="22" y="32" textAnchor="middle" fill="white" fontSize="5.5" fontWeight="500" fontFamily="Arial, sans-serif" fillOpacity="0.9" letterSpacing="0.5">LAO DEV BANK</text>
    </svg>
  )
  return null
}

export default function PaymentChannel() {
  const { filters, updateFilters } = useGlobalFilters()

  const { data: rows, loading } = useARData(filters)
  // Two ar_debt views:
  //  - debtRows (date_paid) for cash-flow collection channels.
  //  - outstandingRows (date) for debt from bills issued in the filter date range.
  const { data: debtRows }        = usePayoffData({ ...filters, payoffDateField: 'date_paid' })
  const { data: billReceiptRows } = useBillReceiptData(filters)
  const { data: outstandingRows } = usePayoffData(filters)
  const { data: cashflowRows } = useCashflowData(filters)
  // Apply Looker-matching filter so totals match the Daily Sales dashboard.
  const lookerView = useMemo(() => filterToLookerSubset(rows || []), [rows])
  const viewRows = lookerView.rows
  const kpis = useMemo(() => computeKPIs(viewRows), [viewRows])
  const sameDaySettledDebt = useMemo(() => getSameDaySettledDebtStats(viewRows), [viewRows])
  // Use ar_bills (date in range) for payment-type breakdown — matches Looker (no retro receipts).
  const paymentTypeSummary = useMemo(() => computePaymentTypeSummary(viewRows), [viewRows])
  const depositCollection = paymentTypeSummary.Deposit?.amount || 0
  const advanceCollection = paymentTypeSummary.Advance?.amount || 0
  const hasUnsupportedCashflowFilters = !!(
    filters.customerType ||
    filters.gender ||
    filters.insiteOnsite ||
    filters.opdIpd ||
    filters.insurance ||
    filters.workloadDebt
  )
  const hasCashflow = !!cashflowRows?.length && !hasUnsupportedCashflowFilters
  const rawCashflowActualIncome = useMemo(() => {
    if (!hasCashflow) return 0
    return (cashflowRows || []).reduce((s, r) => s + (r.total_actual_income || 0), 0)
  }, [cashflowRows, hasCashflow])
  const rawCashflowInitialOutstanding = useMemo(() => {
    if (!hasCashflow) return 0
    return (cashflowRows || []).reduce((s, r) => s + (r.outstanding_debt || 0), 0)
  }, [cashflowRows, hasCashflow])
  const useCashflowSummary = useMemo(() => {
    if (!hasCashflow) return false
    return isUsableCashflowSummary({
      totalSales: kpis.totalSales,
      actualIncome: rawCashflowActualIncome,
      outstandingDebt: rawCashflowInitialOutstanding,
      fallbackDailyIncome: kpis.dailyIncome,
    })
  }, [hasCashflow, kpis.totalSales, kpis.dailyIncome, rawCashflowActualIncome, rawCashflowInitialOutstanding])
  const cashflowActualIncome = useCashflowSummary ? rawCashflowActualIncome : 0
  const cashflowInitialOutstanding = useCashflowSummary ? rawCashflowInitialOutstanding : 0

  // Collection stats from ar_debt — Amount Paid (canonical) per row, channel breakdown for display.
  const collectionStats = useMemo(() => {
    const dr = debtRows || []
    const paidRows = dr.filter(r => {
      return getDebtPaidAmountForDateRange(r, filters.dateFrom, filters.dateTo) > 0
    })
    const debtTotals = paidRows.reduce((sum, row) => {
      const rowTotals = getDebtPaidChannelTotalsForDateRange(row, filters.dateFrom, filters.dateTo)
      sum.amount += rowTotals.amount
      sum.cash += rowTotals.cash
      sum.bcel += rowTotals.bcel
      sum.bcel2 += rowTotals.bcel2
      sum.ldb += rowTotals.ldb
      return sum
    }, { amount: 0, cash: 0, bcel: 0, bcel2: 0, ldb: 0 })
    const debtBillNos = new Set(paidRows.map(row => row.bill_no).filter(Boolean))
    const retroRows = (billReceiptRows || [])
      .filter(isRetroBillCollection)
      .filter(row => !row.bill_no || !debtBillNos.has(row.bill_no))
    // Deferred-receipt retro: cash was received on the bill's issue day, only the
    // transfer portion (bcel / bcel2 / ldb) landed on the receipt date. Exclude cash
    // from the retro totals so it isn't double-counted on the receipt day. Matches
    // Looker's Collection breakdown (transfer-only for deferred bills).
    const retroTotals = retroRows.reduce((sum, row) => {
      const transferOnly = Number(row.bcel || 0) + Number(row.bcel2 || 0) + Number(row.ldb || 0)
      sum.amount += transferOnly
      sum.bcel += row.bcel || 0
      sum.bcel2 += row.bcel2 || 0
      sum.ldb += row.ldb || 0
      return sum
    }, { amount: 0, cash: 0, bcel: 0, bcel2: 0, ldb: 0 })
    return {
      amount: debtTotals.amount + retroTotals.amount,
      cash: debtTotals.cash + retroTotals.cash,
      bcel: debtTotals.bcel + retroTotals.bcel,
      bcel2: debtTotals.bcel2 + retroTotals.bcel2,
      ldb: debtTotals.ldb + retroTotals.ldb,
    }
  }, [debtRows, billReceiptRows, filters.dateFrom, filters.dateTo])

  // Deferred-receipt subtraction: bills where `payment_received_at > date` had their
  // transfer portion (bcel / bcel2 / ldb) actually land in the account on a later day.
  // For the issue date's Payment Channel view, those transfers should NOT count yet —
  // they will appear as Collection on their receipt date instead (handled via retroRows
  // in `collectionStats`). Cash is always immediate and stays in the issue-day total.
  const deferredFromIssue = useMemo(() => {
    let bcel = 0, bcel2 = 0, ldb = 0
    for (const row of viewRows || []) {
      if (!row.date || !row.payment_received_at) continue
      const issue = String(row.date).slice(0, 10)
      const received = String(row.payment_received_at).slice(0, 10)
      if (received > issue) {
        bcel  += Number(row.bcel  || 0)
        bcel2 += Number(row.bcel2 || 0)
        ldb   += Number(row.ldb   || 0)
      }
    }
    return { bcel, bcel2, ldb, amount: bcel + bcel2 + ldb }
  }, [viewRows])

  // Combine ar_bills channels (date in range) and ar_debt channels (date_paid in range). Matches Looker.
  const totals = useMemo(() => {
    const t = { cash: 0, bcel: 0, bcel2: 0, ldb: 0 }
    if (useCashflowSummary) {
      cashflowRows.forEach(r => {
        t.cash  += r.cash  || 0
        t.bcel  += r.bcel  || 0
        t.bcel2 += r.bcel2 || 0
        t.ldb   += r.ldb   || 0
      })
      return t
    }
    t.cash  = (kpis.cash  || 0) + collectionStats.cash
    t.bcel  = Math.max(0, (kpis.bcel  || 0) - deferredFromIssue.bcel)  + collectionStats.bcel
    t.bcel2 = Math.max(0, (kpis.bcel2 || 0) - deferredFromIssue.bcel2) + collectionStats.bcel2
    t.ldb   = Math.max(0, (kpis.ldb   || 0) - deferredFromIssue.ldb)   + collectionStats.ldb
    return t
  }, [kpis, collectionStats, cashflowRows, useCashflowSummary, deferredFromIssue])

  const methodCollected = totals.cash + totals.bcel + totals.bcel2 + totals.ldb
  const totalCollected = useCashflowSummary ? methodCollected : methodCollected + depositCollection
  const remainingBalance = useMemo(() => {
    if (useCashflowSummary) return (cashflowRows || []).reduce((s, r) => s + (r.balance || 0), 0)
    // Use ar_debt.debt_amount (initial) to match Looker — immune to post-billing edits.
    // Restrict to bills that survived the Looker filter so excluded bills don't leak in.
    const orows = outstandingRows || []
    if (!orows.length) return kpis.outstandingDebt
    const allowedBillNos = new Set(viewRows.map(r => r.bill_no).filter(Boolean))
    const filtered = allowedBillNos.size > 0
      ? orows.filter(r => allowedBillNos.has(r.bill_no))
      : orows
    return filtered.reduce((s, r) => s + toNumber(r.balance ?? r.debt), 0)
  }, [cashflowRows, outstandingRows, viewRows, useCashflowSummary, kpis.outstandingDebt])

  // Monthly breakdown
  const monthly = useMemo(() => {
    const map = {}
    if (useCashflowSummary) {
      cashflowRows.forEach(r => {
        if (!r.date) return
        const mo = r.date.slice(0, 7)
        if (!map[mo]) map[mo] = { cash: 0, bcel: 0, bcel2: 0, ldb: 0 }
        map[mo].cash  += r.cash  || 0
        map[mo].bcel  += r.bcel  || 0
        map[mo].bcel2 += r.bcel2 || 0
        map[mo].ldb   += r.ldb   || 0
      })
      return map
    }
    // ar_bills by issue date (Looker-filtered) — matches Daily Sales.
    viewRows.forEach(r => {
      if (!r.date) return
      const mo = String(r.date).slice(0, 7)
      if (!map[mo]) map[mo] = { cash: 0, bcel: 0, bcel2: 0, ldb: 0 }
      map[mo].cash  += r.cash  || 0
      map[mo].bcel  += r.bcel  || 0
      map[mo].bcel2 += r.bcel2 || 0
      map[mo].ldb   += r.ldb   || 0
    })
    ;(debtRows || []).forEach(r => {
      const rowTotals = getDebtPaidChannelTotalsForDateRange(r, filters.dateFrom, filters.dateTo)
      if (rowTotals.amount <= 0) return
      const mo = String(r.date_paid || r.payment_1_date || r.payment_2_date || r.payment_3_date || '').slice(0, 7)
      if (!mo) return
      if (!map[mo]) map[mo] = { cash: 0, bcel: 0, bcel2: 0, ldb: 0 }
      map[mo].cash += rowTotals.cash
      map[mo].bcel += rowTotals.bcel
      map[mo].bcel2 += rowTotals.bcel2
      map[mo].ldb += rowTotals.ldb
    })
    return map
  }, [viewRows, debtRows, cashflowRows, useCashflowSummary, filters.dateFrom, filters.dateTo])

  const months = Object.keys(monthly).sort()

  const trendOpts = {
    chart: { type: 'bar', stacked: false, toolbar: { show: false }, fontFamily: 'Inter, Noto Sans Lao, sans-serif' },
    plotOptions: { bar: { borderRadius: 6, columnWidth: '70%' } },
    colors: METHODS.map(m => m.color),
    xaxis: { categories: months, labels: { style: { colors: '#94a3b8', fontSize: '11px' } } },
    yaxis: { labels: { formatter: v => formatNumber(v), style: { colors: '#94a3b8', fontSize: '10px' } } },
    legend: { labels: { colors: '#64748b' }, position: 'top' },
    grid: { borderColor: '#f1f5f9', strokeDashArray: 4 },
    dataLabels: { enabled: false },
    tooltip: { y: { formatter: v => `${formatNumber(v)} LAK` } },
  }

  const pieOpts = {
    chart: { type: 'donut', fontFamily: 'Inter, Noto Sans Lao, sans-serif' },
    labels: METHODS.map(m => m.label),
    colors: METHODS.map(m => m.color),
    legend: { position: 'bottom', labels: { colors: '#64748b' } },
    plotOptions: { pie: { donut: { size: '65%', labels: { show: true, total: { show: true, label: 'Total', color: '#64748b', formatter: () => formatNumber(totalCollected) } } } } },
    dataLabels: { formatter: v => `${v.toFixed(1)}%` },
    tooltip: { y: { formatter: v => `${formatNumber(v)} LAK` } },
  }

  // Daily Income on Looker is Actual Total Sale - initial Outstanding Debt.
  // For Summary_CashFlow dates, read initial outstanding directly from that sheet so
  // Payment Channel still matches Looker even if ar_debt rows have not been reuploaded yet.
  const initialOutstandingForDailyIncome = useMemo(() => {
    const orows = outstandingRows || []
    if (!orows.length) return kpis.outstandingDebt + sameDaySettledDebt.amount
    const allowedBillNos = new Set(viewRows.map(r => r.bill_no).filter(Boolean))
    const hasDebtPaymentInRange = (row = {}) =>
      getDebtPaidAmountForDateRange(row, filters.dateFrom, filters.dateTo) > 0
    const filtered = allowedBillNos.size > 0
      ? orows.filter(r => allowedBillNos.has(r.bill_no) || hasDebtPaymentInRange(r))
      : orows
    return filtered.reduce((s, r) => s + getDebtInitialAmount(r), 0) + sameDaySettledDebt.amount + deferredFromIssue.amount
  }, [outstandingRows, viewRows, kpis.outstandingDebt, sameDaySettledDebt.amount, deferredFromIssue.amount, filters.dateFrom, filters.dateTo])

  const dailyIncome = useCashflowSummary && cashflowInitialOutstanding > 0
    ? Math.max(0, kpis.totalSales - cashflowInitialOutstanding)
    : kpis.totalSales - initialOutstandingForDailyIncome
  // Actual Income = Daily Income + Collection (Pay off). Matches Looker.
  const actualIncomeTotal = useCashflowSummary
    ? cashflowActualIncome
    : dailyIncome + collectionStats.amount
  const grandTotal = actualIncomeTotal + remainingBalance
  const collectedPct    = grandTotal > 0 ? (actualIncomeTotal / grandTotal * 100).toFixed(1) : '0.0'
  const outstandingPct  = grandTotal > 0 ? (remainingBalance / grandTotal * 100).toFixed(1) : '0.0'
  const cashflowCollectionAmount = useCashflowSummary
    ? Math.max(0, actualIncomeTotal - dailyIncome)
    : 0
  const effectiveCollectionStats = useCashflowSummary && cashflowCollectionAmount > collectionStats.amount
    ? { ...collectionStats, amount: cashflowCollectionAmount }
    : collectionStats
  const dailyIncomeCollected = dailyIncome

  if (loading) return <div className="p-6"><LoadingSpinner /></div>

  return (
    <div id="payment-channel-content" className="p-6 space-y-6">

      {/* -- Header -- */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Payment Channels</h2>
          <p className="text-sm text-slate-500 mt-0.5">Payment channel analysis - Unit: LAK</p>
        </div>
        <div className="flex flex-wrap items-center gap-2" data-pdf-hidden="true">
          <PDFButton elementId="full-report-export" filename="AR_Finance_LXH_Report" label="Download PDF" />
          <DateFilter filters={filters} onChange={updateFilters} />
          <FilterSelect label="Customer Type" value={filters.customerType}
            onChange={v => updateFilters({ customerType: v })}
            options={['GN','INS','B2B','iNS']} />
          <FilterSelect label="Shift" value={filters.workload}
            onChange={v => updateFilters({ workload: v })}
            options={SHIFT_OPTIONS} />
        </div>
      </div>

      {/* -- Row 1: 4 Summary KPI Cards -- */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Actual Income */}
        <div className="rounded-2xl p-5 text-white bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-lg shadow-indigo-200">
          <p className="text-xs font-semibold text-indigo-200 uppercase tracking-wider">Actual Income</p>
          <p className="text-xs text-indigo-200 mb-3">Actual Income</p>
          <p className="text-2xl font-extrabold leading-tight">{formatNumber(actualIncomeTotal)}</p>
          <p className="text-xs text-indigo-200 mt-1">= Collected + Pay off</p>
        </div>
        {/* Daily Income */}
        <div className="rounded-2xl p-5 text-white bg-gradient-to-br from-cyan-500 to-cyan-700 shadow-lg shadow-cyan-200">
          <p className="text-xs font-semibold text-cyan-200 uppercase tracking-wider">Daily Income</p>
          <p className="text-xs text-cyan-200 mb-3">Collected at billing (excl. pay off)</p>
          <p className="text-2xl font-extrabold leading-tight">{formatNumber(dailyIncomeCollected)}</p>
          <p className="text-xs text-cyan-200 mt-1">{totalCollected > 0 ? (dailyIncomeCollected / totalCollected * 100).toFixed(1) : '0.0'}% of collected</p>
        </div>
        {/* Pay off collection */}
        <div className="rounded-2xl p-5 text-white bg-gradient-to-br from-violet-500 to-violet-700 shadow-lg shadow-violet-200">
          <p className="text-xs font-semibold text-violet-200 uppercase tracking-wider">Debt Collection (Pay off)</p>
          <p className="text-xs text-violet-200 mb-3">Debt collection amount</p>
          <p className="text-2xl font-extrabold leading-tight">{formatNumber(effectiveCollectionStats.amount)}</p>
          <p className="text-xs text-violet-200 mt-1">From ar_debt</p>
        </div>
        <div className="rounded-2xl p-5 text-white bg-gradient-to-br from-amber-500 to-amber-700 shadow-lg shadow-amber-200">
          <p className="text-xs font-semibold text-amber-100 uppercase tracking-wider">All Dept Deposit</p>
          <p className="text-xs text-amber-100 mb-3">Collection from Deposit</p>
          <p className="text-2xl font-extrabold leading-tight">{formatNumber(depositCollection)}</p>
          <p className="text-xs text-amber-100 mt-1">{formatNumber(paymentTypeSummary.Deposit?.bills || 0)} bills</p>
        </div>
        {/* Outstanding */}
        <div className="rounded-2xl p-5 text-white bg-gradient-to-br from-rose-500 to-rose-700 shadow-lg shadow-rose-200">
          <p className="text-xs font-semibold text-rose-200 uppercase tracking-wider">Outstanding Debt</p>
          <p className="text-xs text-rose-200 mb-3">Outstanding Balance</p>
          <p className="text-2xl font-extrabold leading-tight">{formatNumber(remainingBalance)}</p>
          <p className="text-xs text-rose-200 mt-1">{outstandingPct}% of total</p>
        </div>
      </div>

      {/* -- Row 2: Payment Method Cards -- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {METHODS.map(m => {
          const val = totals[m.key] || 0
          const pct = totalCollected > 0 ? (val / totalCollected * 100).toFixed(1) : '0.0'
          return (
            <div key={m.key} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl overflow-hidden shadow-md shrink-0">
                  <BankIcon method={m.key} />
                </div>
                <span className="text-2xl font-extrabold" style={{ color: m.color }}>{pct}%</span>
              </div>
              <p className="text-xl font-bold text-slate-800">{formatNumber(val)}</p>
              <p className="text-xs text-slate-400 mb-3">LAK</p>
              <p className="text-sm font-semibold text-slate-700">{m.label}</p>
              <p className="text-xs text-slate-400 mb-3">{m.sublabel}</p>
              {/* Progress bar */}
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="h-2 rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: m.color }} />
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {['Cash', 'Transfer', 'Cash/Transfer', 'Transacted', 'Deposit', 'Advance'].map(type => {
          const data = paymentTypeSummary[type] || { bills: 0, amount: 0 }
          const amount = type === 'Deposit' ? depositCollection : type === 'Advance' ? advanceCollection : data.amount
          return (
            <div key={type} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-slate-700">{type}</p>
                <span className="badge bg-slate-100 text-slate-600">{formatNumber(data.bills)} bills</span>
              </div>
              <p className="mt-2 text-lg font-extrabold text-slate-800">{formatNumber(amount)}</p>
              <p className="text-[10px] text-slate-400">LAK</p>
            </div>
          )
        })}
      </div>

      {/* -- Row 3: Stacked bar proportion -- */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h3 className="font-bold text-slate-700 text-sm mb-1">SharePayment Channels</h3>
        <p className="text-xs text-slate-400 mb-4">Payment channel proportion</p>
        <div className="flex rounded-xl overflow-hidden h-8 mb-3">
          {METHODS.map(m => {
            const pct = totalCollected > 0 ? (totals[m.key] || 0) / totalCollected * 100 : 0
            return pct > 0 ? (
              <div key={m.key} style={{ width: `${pct}%`, backgroundColor: m.color }}
                className="flex items-center justify-center text-white text-xs font-bold transition-all"
                title={`${m.label}: ${pct.toFixed(1)}%`}>
                {pct > 8 ? `${pct.toFixed(0)}%` : ''}
              </div>
            ) : null
          })}
        </div>
        <div className="flex flex-wrap gap-4">
          {METHODS.map(m => (
            <div key={m.key} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: m.color }} />
              <span className="text-xs text-slate-600 font-medium">{m.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* -- Row 3b: Collected VS Outstanding  +  Cash VS Transfer -- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Collected vs Outstanding */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h3 className="font-bold text-slate-700 text-sm mb-1">Collected vs Outstanding Debt</h3>
          <p className="text-xs text-slate-400 mb-4">Collected (Amount) VS Outstanding (Balance)</p>
          <ReactApexChart
            options={{
              chart: { type: 'donut', fontFamily: 'Inter, Noto Sans Lao, sans-serif' },
              labels: ['Collected', 'Outstanding'],
              colors: ['#06b6d4', '#f43f5e'],
              legend: { position: 'bottom', labels: { colors: '#64748b' } },
              plotOptions: { pie: { donut: { size: '68%', labels: { show: true,
                total: { show: true, label: 'Total', color: '#64748b',
                  formatter: () => formatNumber(totalCollected + remainingBalance) }
              } } } },
              dataLabels: { formatter: v => `${v.toFixed(1)}%` },
              tooltip: { y: { formatter: v => `${formatNumber(v)} LAK` } },
            }}
            series={[totalCollected, remainingBalance]}
            type="donut" height={260}
          />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-cyan-50 border border-cyan-100 p-3 text-center">
              <p className="text-xs text-cyan-600 font-medium">Collected</p>
              <p className="text-base font-extrabold text-cyan-700">{formatNumber(totalCollected)}</p>
            </div>
            <div className="rounded-xl bg-rose-50 border border-rose-100 p-3 text-center">
              <p className="text-xs text-rose-600 font-medium">Outstanding</p>
              <p className="text-base font-extrabold text-rose-700">{formatNumber(remainingBalance)}</p>
            </div>
          </div>
        </div>

        {/* Cash vs Transfer */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h3 className="font-bold text-slate-700 text-sm mb-1">Cash vs Transfer</h3>
          <p className="text-xs text-slate-400 mb-4">Cash Received VS Bank Transfer</p>
          {(() => {
            const transfer = (totals.bcel || 0) + (totals.bcel2 || 0) + (totals.ldb || 0)
            const cash = totals.cash || 0
            const cashPct = totalCollected > 0 ? (cash / totalCollected * 100).toFixed(1) : '0.0'
            const tranPct = totalCollected > 0 ? (transfer / totalCollected * 100).toFixed(1) : '0.0'
            return (
              <>
                <ReactApexChart
                  options={{
                    chart: { type: 'donut', fontFamily: 'Inter, Noto Sans Lao, sans-serif' },
                    labels: ['Cash (Cash)', 'Transfer'],
                    colors: ['#10b981', '#4f46e5'],
                    legend: { position: 'bottom', labels: { colors: '#64748b' } },
                    plotOptions: { pie: { donut: { size: '68%', labels: { show: true,
                      total: { show: true, label: 'Total', color: '#64748b',
                        formatter: () => formatNumber(totalCollected) }
                    } } } },
                    dataLabels: { formatter: v => `${v.toFixed(1)}%` },
                    tooltip: { y: { formatter: v => `${formatNumber(v)} LAK` } },
                  }}
                  series={[cash, transfer]}
                  type="donut" height={260}
                />
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-center">
                    <p className="text-xs text-emerald-600 font-medium">Cash - {cashPct}%</p>
                    <p className="text-base font-extrabold text-emerald-700">{formatNumber(cash)}</p>
                  </div>
                  <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3 text-center">
                    <p className="text-xs text-indigo-600 font-medium">Transfer - {tranPct}%</p>
                    <p className="text-base font-extrabold text-indigo-700">{formatNumber(transfer)}</p>
                  </div>
                </div>
              </>
            )
          })()}
        </div>
      </div>

      {/* -- Row 4: Trend chart + Donut -- */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h3 className="font-bold text-slate-700 text-sm mb-1">Revenue Trend by Channel</h3>
          <p className="text-xs text-slate-400 mb-4">Monthly payment channel trend</p>
          {months.length > 0 ? (
            <ReactApexChart
              options={trendOpts}
              series={METHODS.map(m => ({ name: m.label, data: months.map(mo => monthly[mo]?.[m.key] || 0) }))}
              type="bar" height={280}
            />
          ) : <EmptyState message="No data" sublabel="Please upload Excel first" />}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h3 className="font-bold text-slate-700 text-sm mb-1">Channel Share</h3>
          <p className="text-xs text-slate-400 mb-4">Payment Method Share</p>
          {totalCollected > 0 ? (
            <ReactApexChart options={pieOpts} series={METHODS.map(m => totals[m.key] || 0)} type="donut" height={280} />
          ) : <EmptyState message="No data" />}
        </div>
      </div>

      {/* -- Row 5: Summary Table -- */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-700 text-sm">Payment Channel Summary</h3>
          <p className="text-xs text-slate-400">Payment channel summary</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="table-th">Channel</th>
                <th className="table-th text-right">Amount (LAK)</th>
                <th className="table-th text-right">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {METHODS.map(m => {
                const val = totals[m.key] || 0
                const pct = totalCollected > 0 ? (val / totalCollected * 100).toFixed(1) : '0.0'
                return (
                  <tr key={m.key} className="hover:bg-slate-50 transition-colors">
                    <td className="table-td">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg overflow-hidden shadow-sm shrink-0">
                          <BankIcon method={m.key} />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{m.label}</p>
                          <p className="text-xs text-slate-400">{m.sublabel}</p>
                        </div>
                      </div>
                    </td>
                    <td className="table-td text-right font-mono font-semibold text-slate-800">{formatNumber(val)}</td>
                    <td className="table-td text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-24 bg-slate-100 rounded-full h-2">
                          <div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: m.color }} />
                        </div>
                        <span className="text-sm font-bold w-12 text-right" style={{ color: m.color }}>{pct}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
              <tr className="hover:bg-slate-50 transition-colors">
                <td className="table-td">
                  <div>
                    <p className="font-semibold text-slate-800">All Dept collection from Deposit</p>
                    <p className="text-xs text-slate-400">Deposit</p>
                  </div>
                </td>
                <td className="table-td text-right font-mono font-semibold text-slate-800">{formatNumber(depositCollection)}</td>
                <td className="table-td text-right">
                  <span className="text-sm font-bold text-amber-600">
                    {totalCollected > 0 ? (depositCollection / totalCollected * 100).toFixed(1) : '0.0'}%
                  </span>
                </td>
              </tr>
              <tr className="bg-slate-50">
                <td className="table-td font-bold text-slate-700">Total Collected</td>
                <td className="table-td text-right font-mono font-bold text-slate-800">{formatNumber(totalCollected)}</td>
                <td className="table-td text-right font-bold text-slate-600">100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
