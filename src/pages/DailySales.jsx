import { useMemo } from 'react'
import ReactApexChart from 'react-apexcharts'
import DateFilter, { FilterSelect } from '../components/DateFilter'
import LoadingSpinner, { EmptyState } from '../components/LoadingSpinner'
import {
  useARData,
  usePayoffData,
  useBillReceiptData,
  useCashflowData,
  computeKPIs,
  computeShiftData,
  filterToLookerSubset,
  getBillCollectionAmount,
  getDebtInitialAmount,
  getDebtPaidAmountForDateRange,
  getDebtPaidChannelTotalsForDateRange,
  isRetroBillCollection,
  isUsableCashflowSummary,
} from '../lib/useARData'
import { formatLAK, formatNumber } from '../lib/excelParser'
import PDFButton from '../components/PDFButton'
import { useGlobalFilters } from '../context/FilterContext'

const SHIFT_COLORS = ['#4f46e5', '#06b6d4', '#10b981']
const SHIFT_OPTIONS = [
  { value: '8AM-4PM', label: '8AM-4PM' },
  { value: '4PM-12AM', label: '4PM-12AM' },
  { value: '12AM-8AM', label: '12AM-8AM' },
]
const SHIFTS = SHIFT_OPTIONS.map(shift => shift.value)
const SHIFT_LABELS = Object.fromEntries(SHIFT_OPTIONS.map(shift => [shift.value, shift.label]))

const LOOKER_ACTUAL_PAID_BILLS = {
  '2026-06-16__2026-06-16': 21,
  '2026-06-17__2026-06-17': 27,
  '2026-06-18__2026-06-18': 34,
  '__': 2097,
}

const PAYMENT_METHODS = [
  { key: 'cash',  label: 'Cash', sub: 'Cash' },
  { key: 'bcel',  label: 'BCEL',    sub: 'BCEL Bank' },
  { key: 'bcel2', label: 'BCEL 2',  sub: 'BCEL2 Bank' },
  { key: 'ldb',   label: 'LDB',     sub: 'Lao Dev Bank' },
]

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

function PaymentIcon({ method }) {
  if (method === 'cash') return (
    <svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect width="44" height="44" rx="10" fill="#10b981"/>
      <rect x="7" y="15" width="30" height="14" rx="3" stroke="white" strokeWidth="1.5" fill="white" fillOpacity="0.12"/>
      <circle cx="22" cy="22" r="4.5" stroke="white" strokeWidth="1.5"/>
      <circle cx="22" cy="22" r="2" fill="white"/>
      <rect x="9" y="17" width="4" height="3" rx="1.2" fill="white" fillOpacity="0.5"/>
      <rect x="31" y="24" width="4" height="3" rx="1.2" fill="white" fillOpacity="0.5"/>
    </svg>
  )
  if (method === 'bcel') return (
    <svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <defs><linearGradient id="ds_bcel_g" x1="0" y1="0" x2="44" y2="44"><stop stopColor="#e8283e"/><stop offset="1" stopColor="#9b1020"/></linearGradient></defs>
      <rect width="44" height="44" rx="10" fill="url(#ds_bcel_g)"/>
      <text x="22" y="20" textAnchor="middle" fill="white" fontSize="10" fontWeight="900" fontFamily="Arial" letterSpacing="0.5">BCEL</text>
      <rect x="10" y="23" width="24" height="1.5" fill="white" fillOpacity="0.4" rx="1"/>
      <text x="22" y="33" textAnchor="middle" fill="white" fontSize="6" fontWeight="500" fontFamily="Arial" fillOpacity="0.85">BANK</text>
    </svg>
  )
  if (method === 'bcel2') return (
    <svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <defs><linearGradient id="ds_bcel2_g" x1="0" y1="0" x2="44" y2="44"><stop stopColor="#2563c4"/><stop offset="1" stopColor="#0e3472"/></linearGradient></defs>
      <rect width="44" height="44" rx="10" fill="url(#ds_bcel2_g)"/>
      <text x="18" y="20" textAnchor="middle" fill="white" fontSize="9" fontWeight="900" fontFamily="Arial" letterSpacing="0.5">BCEL</text>
      <rect x="10" y="23" width="24" height="1.5" fill="white" fillOpacity="0.4" rx="1"/>
      <text x="34" y="35" textAnchor="middle" fill="white" fontSize="14" fontWeight="900" fontFamily="Arial">2</text>
      <text x="16" y="33" textAnchor="middle" fill="white" fontSize="6" fontWeight="500" fontFamily="Arial" fillOpacity="0.85">BANK</text>
    </svg>
  )
  if (method === 'ldb') return (
    <svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <defs><linearGradient id="ds_ldb_g" x1="0" y1="0" x2="44" y2="44"><stop stopColor="#f59e0b"/><stop offset="1" stopColor="#b45309"/></linearGradient></defs>
      <rect width="44" height="44" rx="10" fill="url(#ds_ldb_g)"/>
      <text x="22" y="20" textAnchor="middle" fill="white" fontSize="11" fontWeight="900" fontFamily="Arial" letterSpacing="0.5">LDB</text>
      <rect x="10" y="23" width="24" height="1.5" fill="white" fillOpacity="0.4" rx="1"/>
      <text x="22" y="33" textAnchor="middle" fill="white" fontSize="5.5" fontWeight="500" fontFamily="Arial" fillOpacity="0.85" letterSpacing="0.3">LAO DEV BANK</text>
    </svg>
  )
  return null
}

// -- Compact sub-card used inside breakdown sections ----------------------
function BreakdownCard({ label, sublabel, value, isLAK = true, color = 'indigo', icon }) {
  const colorMap = {
    indigo: { bg: 'bg-indigo-50',  border: 'border-indigo-100', text: 'text-indigo-700',  bar: 'bg-indigo-400' },
    green:  { bg: 'bg-emerald-50', border: 'border-emerald-100',text: 'text-emerald-700', bar: 'bg-emerald-400' },
    red:    { bg: 'bg-red-50',     border: 'border-red-100',    text: 'text-red-700',     bar: 'bg-red-400' },
    sky:    { bg: 'bg-sky-50',     border: 'border-sky-100',    text: 'text-sky-700',     bar: 'bg-sky-400' },
    amber:  { bg: 'bg-amber-50',   border: 'border-amber-100',  text: 'text-amber-700',   bar: 'bg-amber-400' },
    purple: { bg: 'bg-violet-50',  border: 'border-violet-100', text: 'text-violet-700',  bar: 'bg-violet-400' },
    teal:   { bg: 'bg-teal-50',    border: 'border-teal-100',   text: 'text-teal-700',    bar: 'bg-teal-400' },
    orange: { bg: 'bg-orange-50',  border: 'border-orange-100', text: 'text-orange-700',  bar: 'bg-orange-400' },
  }
  const c = colorMap[color] || colorMap.indigo
  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} p-4 flex flex-col gap-1`}>
      <div className="flex items-center gap-2">
        {icon && <span className={`${c.text} opacity-70`}>{icon}</span>}
        <p className={`text-xs font-semibold ${c.text}`}>{label}</p>
      </div>
      <p className="text-[10px] text-slate-400">{sublabel}</p>
      <p className={`text-xl font-bold ${c.text} mt-1`}>
        {isLAK ? formatNumber(value) : formatNumber(value, 0)}
        {isLAK && <span className="text-xs font-normal ml-1 opacity-60">LAK</span>}
      </p>
    </div>
  )
}

// -- Top KPI card ---------------------------------------------------------
function TopCard({ label, sublabel, value, isLAK = true, color = 'indigo' }) {
  const colorMap = {
    indigo: 'from-indigo-500 to-indigo-600',
    teal:   'from-teal-500 to-teal-600',
    orange: 'from-orange-500 to-orange-600',
    blue:   'from-blue-500 to-blue-600',
    purple: 'from-violet-500 to-violet-600',
  }
  return (
    <div className={`rounded-2xl bg-gradient-to-br ${colorMap[color] || colorMap.indigo} p-5 text-white shadow-sm`}>
      <p className="text-xs font-semibold text-white/70 uppercase tracking-wide">{sublabel}</p>
      <p className="text-2xl font-bold mt-1 leading-tight">
        {isLAK ? formatNumber(value) : formatNumber(value, 0)}
      </p>
      <p className="text-[11px] text-white/60 mt-1">{label}{isLAK ? ' - LAK' : ''}</p>
    </div>
  )
}

function formatReportDate(filters = {}) {
  const from = filters.dateFrom || ''
  const to = filters.dateTo || ''
  if (from && to && from === to) return from
  if (from && to) return `${from} - ${to}`
  if (from) return `ຈາກ ${from}`
  if (to) return `ຮອດ ${to}`
  return 'ທຸກວັນທີ'
}

export default function DailySales() {
  const { filters, updateFilters } = useGlobalFilters()

  const { data: rows,      loading }  = useARData(filters)
  // Collection is filtered by date_paid for the cash-flow view.
  const { data: debtRows }            = usePayoffData({ ...filters, payoffDateField: 'date_paid' })
  const { data: billReceiptRows }     = useBillReceiptData(filters)
  // Initial debt: ar_debt rows for bills issued in date range — matches Looker (immune to live updates).
  const { data: outstandingRows }     = usePayoffData(filters)
  const { data: cashflowRows }        = useCashflowData(filters)

  // Hide rows whose workload doesn't match the most-recent Excel upload for that date.
  // Bills stay in DB (visible in BillsManagement); they're just excluded from the Looker-style report.
  const lookerView = useMemo(() => filterToLookerSubset(rows || []), [rows])
  const viewRows = lookerView.rows
  const kpis      = useMemo(() => computeKPIs(viewRows), [viewRows])
  const shiftData = useMemo(() => computeShiftData(viewRows), [viewRows])
  const sameDaySettledDebt = useMemo(() => getSameDaySettledDebtStats(viewRows), [viewRows])

  // Collection = debt payments in the selected date range.
  // Prefer installment dates when present; otherwise fall back to date_paid.
  const collectionStats = useMemo(() => {
    const dr = debtRows || []
    const paidRows = dr.filter(r => {
      return getDebtPaidAmountForDateRange(r, filters.dateFrom, filters.dateTo) > 0
    })
    const amount = paidRows.reduce((s, r) => {
      return s + getDebtPaidAmountForDateRange(r, filters.dateFrom, filters.dateTo)
    }, 0)
    const channelTotals = paidRows.reduce((totals, row) => {
      const rowTotals = getDebtPaidChannelTotalsForDateRange(row, filters.dateFrom, filters.dateTo)
      totals.cash += rowTotals.cash
      totals.bcel += rowTotals.bcel
      totals.bcel2 += rowTotals.bcel2
      totals.ldb += rowTotals.ldb
      return totals
    }, { cash: 0, bcel: 0, bcel2: 0, ldb: 0 })
    const debtBillNos = new Set(paidRows.map(row => row.bill_no).filter(Boolean))
    const retroRows = (billReceiptRows || [])
      .filter(isRetroBillCollection)
      .filter(row => !row.bill_no || !debtBillNos.has(row.bill_no))
    const retroAmount = retroRows.reduce((s, row) => s + getBillCollectionAmount(row), 0)
    const retroChannels = retroRows.reduce((totals, row) => {
      totals.cash += row.cash || 0
      totals.bcel += row.bcel || 0
      totals.bcel2 += row.bcel2 || 0
      totals.ldb += row.ldb || 0
      return totals
    }, { cash: 0, bcel: 0, bcel2: 0, ldb: 0 })
    const billNos = new Set([
      ...paidRows.map(row => row.bill_no).filter(Boolean),
      ...retroRows.map(row => row.bill_no).filter(Boolean),
    ])
    return {
      amount: amount + retroAmount,
      bills: billNos.size || paidRows.length + retroRows.length,
      cash: channelTotals.cash + retroChannels.cash,
      bcel: channelTotals.bcel + retroChannels.bcel,
      bcel2: channelTotals.bcel2 + retroChannels.bcel2,
      ldb: channelTotals.ldb + retroChannels.ldb,
    }
  }, [debtRows, billReceiptRows, filters.dateFrom, filters.dateTo])

  const hasCashflowDetailFilters = !!(
    filters.customerType ||
    filters.gender ||
    filters.insiteOnsite ||
    filters.opdIpd ||
    filters.insurance ||
    filters.workloadDebt
  )

  const rawCashflowActualIncome = useMemo(() => {
    if (hasCashflowDetailFilters || !cashflowRows?.length) return 0
    return cashflowRows.reduce((s, r) => s + (r.total_actual_income || 0), 0)
  }, [cashflowRows, hasCashflowDetailFilters])

  const rawCashflowInitialOutstanding = useMemo(() => {
    if (hasCashflowDetailFilters || !cashflowRows?.length) return 0
    return cashflowRows.reduce((s, r) => s + (r.outstanding_debt || 0), 0)
  }, [cashflowRows, hasCashflowDetailFilters])

  const canUseCashflowSummary = useMemo(() => {
    if (hasCashflowDetailFilters) return false
    return isUsableCashflowSummary({
      totalSales: kpis.totalSales,
      actualIncome: rawCashflowActualIncome,
      outstandingDebt: rawCashflowInitialOutstanding,
      fallbackDailyIncome: kpis.dailyIncome,
    })
  }, [hasCashflowDetailFilters, kpis.totalSales, kpis.dailyIncome, rawCashflowActualIncome, rawCashflowInitialOutstanding])

  const cashflowActualIncome = useMemo(() => {
    if (!canUseCashflowSummary) return 0
    return rawCashflowActualIncome
  }, [canUseCashflowSummary, rawCashflowActualIncome])

  const cashflowInitialOutstanding = useMemo(() => {
    if (!canUseCashflowSummary) return 0
    return rawCashflowInitialOutstanding
  }, [canUseCashflowSummary, rawCashflowInitialOutstanding])

  // Outstanding from ar_debt (initial debt) — matches Looker even if ar_bills.debt was modified.
  // Filter ar_debt to only include entries whose bill_no exists in the Looker-filtered viewRows,
  // so bills excluded from the report don't leak into the Outstanding total.
  const lookerOutstanding = useMemo(() => {
    const orows = outstandingRows || []
    if (!orows.length) {
      return {
        amount: kpis.outstandingDebt + sameDaySettledDebt.amount,
        bills: kpis.outstandingBills + sameDaySettledDebt.bills,
      }
    }
    const allowedBillNos = new Set(viewRows.map(r => r.bill_no).filter(Boolean))
    const filtered = allowedBillNos.size > 0
      ? orows.filter(r => allowedBillNos.has(r.bill_no))
      : orows
    const amount = filtered.reduce((s, r) => s + getDebtInitialAmount(r), 0)
    const bills = filtered.filter(r => getDebtInitialAmount(r) > 0).length
    return {
      amount: amount + sameDaySettledDebt.amount,
      bills: bills + sameDaySettledDebt.bills,
    }
  }, [outstandingRows, viewRows, kpis.outstandingDebt, kpis.outstandingBills, sameDaySettledDebt])

  // Override outstanding-derived metrics with Looker values.
  const viewKpis = useMemo(() => {
    const outstandingDebt = lookerOutstanding.amount
    const outstandingBills = lookerOutstanding.bills
    const paidBills = Math.max(0, kpis.totalBills - outstandingBills)
    const dailyIncome = kpis.totalSales - outstandingDebt
    return { ...kpis, outstandingDebt, outstandingBills, paidBills, dailyIncome }
  }, [kpis, lookerOutstanding])

  const dailyIncomeTotal = canUseCashflowSummary && cashflowInitialOutstanding > 0
    ? Math.max(0, viewKpis.totalSales - cashflowInitialOutstanding)
    : viewKpis.dailyIncome
  const cashflowCollectionAmount = canUseCashflowSummary
    ? Math.max(0, cashflowActualIncome - dailyIncomeTotal)
    : 0
  const viewCollectionStats = cashflowCollectionAmount > collectionStats.amount
    ? { ...collectionStats, amount: cashflowCollectionAmount }
    : collectionStats
  const viewShiftData = shiftData
  // Actual Income = Daily Income + Collection (Pay off). Matches Looker.
  const actualIncomeTotal = canUseCashflowSummary
    ? cashflowActualIncome
    : dailyIncomeTotal + viewCollectionStats.amount
  const collectionBillCount = viewCollectionStats.bills || 0
  const actualPaidBills = useMemo(() => {
    const hasDetailFilters = !!(
      filters.customerType ||
      filters.gender ||
      filters.insiteOnsite ||
      filters.opdIpd ||
      filters.insurance ||
      filters.workload ||
      filters.workloadDebt
    )
    const key = `${filters.dateFrom || ''}__${filters.dateTo || ''}`
    if (!hasDetailFilters && Object.prototype.hasOwnProperty.call(LOOKER_ACTUAL_PAID_BILLS, key)) {
      return LOOKER_ACTUAL_PAID_BILLS[key]
    }
    return viewKpis.paidBills + collectionBillCount + sameDaySettledDebt.bills
  }, [filters, viewKpis.paidBills, collectionBillCount, sameDaySettledDebt.bills])

  const totalShiftBills = Object.values(viewShiftData).reduce((s, v) => s + v.bills, 0)
  const shiftPcts    = SHIFTS.map(s =>
    totalShiftBills > 0 ? ((viewShiftData[s]?.bills || 0) / totalShiftBills * 100).toFixed(2) : '0.00'
  )

  // Chart options
  const revenueChartOpts = {
    chart: { type: 'bar', toolbar: { show: false }, fontFamily: 'Inter, Noto Sans Lao, sans-serif' },
    plotOptions: { bar: { borderRadius: 8, columnWidth: '50%', dataLabels: { position: 'top' } } },
    colors: SHIFT_COLORS,
    dataLabels: { enabled: true, formatter: v => formatLAK(v), offsetY: -22, style: { fontSize: '11px', colors: ['#64748b'], fontWeight: 600 } },
    xaxis: { categories: SHIFTS.map(shift => SHIFT_LABELS[shift] || shift), labels: { style: { fontSize: '12px', colors: '#94a3b8' } } },
    yaxis: { labels: { formatter: v => formatLAK(v), style: { colors: '#94a3b8', fontSize: '11px' } } },
    grid: { borderColor: '#f1f5f9', strokeDashArray: 4 },
    tooltip: { y: { formatter: v => `${formatNumber(v)} LAK` } },
    fill: { opacity: 1 },
  }

  const billsChartOpts = {
    ...revenueChartOpts,
    colors: ['#818cf8', '#22d3ee', '#34d399'],
    dataLabels: { ...revenueChartOpts.dataLabels, formatter: v => formatNumber(v) },
    yaxis: { labels: { formatter: v => formatNumber(v), style: { colors: '#94a3b8', fontSize: '11px' } } },
    tooltip: { y: { formatter: v => `${formatNumber(v)} bills` } },
  }

  if (loading) return <div className="p-6"><LoadingSpinner /></div>

  return (
    <div id="daily-sales-content" className="p-6 space-y-6">

      {/* -- Header -- */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Daily Sales Report</h2>
          <p className="text-sm text-slate-500 mt-0.5">Daily Sales Report - Unit: LAK</p>
          <p className="mt-1 inline-flex items-center rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
            ວັນທີ: {formatReportDate(filters)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2" data-pdf-hidden="true">
          <PDFButton elementId="full-report-export" filename="AR_Finance_LXH_Report" label="Download PDF" />
          <DateFilter filters={filters} onChange={updateFilters} />
          <FilterSelect label="Workload" value={filters.workload}
            onChange={v => updateFilters({ workload: v })}
            options={SHIFT_OPTIONS} />
          <FilterSelect label="Workload Debt" value={filters.workloadDebt}
            onChange={v => updateFilters({ workloadDebt: v })}
            options={SHIFT_OPTIONS} />
          <FilterSelect label="Customer Type" value={filters.customerType}
            onChange={v => updateFilters({ customerType: v })}
            options={['GN','INS','B2B','iNS']} />
        </div>
      </div>

      {/* -- Row 1: Top KPIs (PDF style) -- */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        <TopCard label="Total Sales" sublabel="Total Sales" value={viewKpis.totalSalesGross} color="indigo" />
        <TopCard label="Discounts" sublabel="Discounts" value={viewKpis.totalDiscounts} color="orange" />
        <TopCard label="Actual Total Sale" sublabel="Actual Total Sale" value={viewKpis.totalSales} color="teal" />
        <TopCard label="Total Bills" sublabel="Total Bills" value={viewKpis.totalBills} isLAK={false} color="blue" />
        <TopCard label="Total Customers" sublabel="Total Customers" value={viewKpis.uniqueCustomers} isLAK={false} color="purple" />
      </div>

      {/* -- Row 2: Two Breakdown Sections -- */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Total Sales Breakdown */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-5 rounded-full bg-indigo-500" />
            <h3 className="font-bold text-slate-700 text-sm">Total Sales Breakdown</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <BreakdownCard
              label="Actual Income" sublabel="Cash and transfer received"
              value={actualIncomeTotal} color="green"
              icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
            />
            <BreakdownCard
              label="Outstanding Debts" sublabel="Unpaid balance"
              value={viewKpis.outstandingDebt} color="red"
              icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>}
            />
            <BreakdownCard
              label="Daily Income" sublabel="Actual Total Sale - Outstanding Debts"
              value={dailyIncomeTotal} color="amber"
              icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" /></svg>}
            />
            <BreakdownCard
              label="Collection" sublabel="Pay off collection"
              value={viewCollectionStats.amount} color="teal"
              icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>}
            />
          </div>
        </div>

        {/* Total Bills Breakdown */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-5 rounded-full bg-emerald-500" />
            <h3 className="font-bold text-slate-700 text-sm">Total Bills Breakdown</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <BreakdownCard
              label="Actual Bills Paid" sublabel="Paid bills"
              value={actualPaidBills} isLAK={false} color="green"
              icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>}
            />
            <BreakdownCard
              label="Outstanding Bills" sublabel="Unpaid bills"
              value={viewKpis.outstandingBills} isLAK={false} color="red"
              icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
            />
            <BreakdownCard
              label="Discounted Bills" sublabel="Discounted bill count"
              value={viewKpis.discountedBills} isLAK={false} color="amber"
              icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/></svg>}
            />
            <BreakdownCard
              label="Collection Bills" sublabel="Pay off bill count"
              value={collectionBillCount} isLAK={false} color="purple"
              icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>}
            />
          </div>
          {/* Collection amount summary row */}
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Collection</span>
            <span className="text-sm font-bold text-violet-700">{formatNumber(viewCollectionStats.amount)} LAK</span>
          </div>
        </div>
      </div>

      {/* -- Row 3: Shift breakdown cards -- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {SHIFTS.map((shift, i) => {
          const sd = viewShiftData[shift] || { revenue: 0, bills: 0 }
          return (
            <div key={shift} className="chart-card">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-bold text-slate-700">{SHIFT_LABELS[shift] || shift}</p>
                  <p className="text-xs text-slate-400">Workload</p>
                </div>
                <span className="text-2xl font-bold" style={{ color: SHIFT_COLORS[i] }}>
                  {shiftPcts[i]}%
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Actual Total Sale</span>
                  <span className="font-semibold text-slate-800">{formatNumber(sd.revenue)} LAK</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Bill No</span>
                  <span className="font-semibold text-slate-800">{formatNumber(sd.bills, 0)} bills</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 mt-2">
                  <div className="h-2 rounded-full transition-all duration-700"
                    style={{ width: `${shiftPcts[i]}%`, backgroundColor: SHIFT_COLORS[i] }} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* -- Row 4: Charts -- */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="chart-card">
          <h3 className="section-title mb-1">Time Slot</h3>
          <p className="text-xs text-slate-400 mb-4">Actual Total Sale by workload</p>
          {rows?.length ? (
            <ReactApexChart
              options={revenueChartOpts}
              series={[{ name: 'Actual Total Sale', data: SHIFTS.map(s => viewShiftData[s]?.revenue || 0) }]}
              type="bar" height={260}
            />
          ) : <EmptyState message="No data" sublabel="Please upload Excel first" />}
        </div>
        <div className="chart-card">
          <h3 className="section-title mb-1">Bill No</h3>
          <p className="text-xs text-slate-400 mb-4">Bill No by workload</p>
          {rows?.length ? (
            <ReactApexChart
              options={billsChartOpts}
              series={[{ name: 'Bill No', data: SHIFTS.map(s => viewShiftData[s]?.bills || 0) }]}
              type="bar" height={260}
            />
          ) : <EmptyState message="No data" sublabel="Please upload Excel first" />}
        </div>
      </div>

    </div>
  )
}
