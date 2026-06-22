import { useState, useMemo } from 'react'
import ReactApexChart from 'react-apexcharts'
import KPICard from '../components/KPICard'
import DateFilter, { FilterSelect } from '../components/DateFilter'
import LoadingSpinner, { EmptyState } from '../components/LoadingSpinner'
import PDFButton from '../components/PDFButton'
import {
  usePayoffData,
  getDebtInitialAmount,
  getDebtPaidAmount,
  getLookerMaxDate,
  capToLookerMaxDate,
} from '../lib/useARData'
import { formatLAK, formatNumber } from '../lib/excelParser'
import { useGlobalFilters } from '../context/FilterContext'
import { calcAging, getAgingLabel, toNumber } from '../lib/debtUtils'

const CUSTOMER_TYPES = ['INS', 'GN', 'B2B', 'iNS']

function getCollectedAmount(row = {}) {
  return getDebtPaidAmount(row)
}

function toDebtReportRow(row = {}, source = 'debt') {
  if (source === 'bill') {
    const collected = toNumber(row.cash) + toNumber(row.bcel) + toNumber(row.bcel2) + toNumber(row.ldb) + toNumber(row.prepayment)
    const balance = toNumber(row.debt)
    return {
      ...row,
      debt_amount: collected + balance || toNumber(row.grand_total),
      amount_paid: collected,
      balance,
    }
  }

  const balance = toNumber(row.balance)
  const collected = getCollectedAmount(row)
  return {
    ...row,
    debt_amount: getDebtInitialAmount(row),
    amount_paid: collected,
    balance,
  }
}

function agingBadgeClass(group) {
  if (group === '46-90 Days') return 'bg-red-100 text-red-700'
  if (group === '31-45 Days') return 'bg-orange-100 text-orange-700'
  if (group === '16-30 Days') return 'bg-yellow-100 text-yellow-700'
  if (group === '1-15 Days') return 'bg-green-100 text-green-700'
  if (group === 'Current Receivables') return 'bg-sky-100 text-sky-700'
  return 'bg-slate-100 text-slate-600'
}

export default function OutstandingDebt() {
  const { filters, updateFilters } = useGlobalFilters()
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 15

  const { data: debtRows, loading } = usePayoffData(filters)

  const lookerMaxDate = useMemo(() => {
    return getLookerMaxDate(debtRows || [])
  }, [debtRows])

  const viewDebtRows = useMemo(() => {
    return capToLookerMaxDate(debtRows || [], lookerMaxDate, filters)
  }, [debtRows, lookerMaxDate, filters])

  const reportRows = useMemo(() => {
    return viewDebtRows.map(row => toDebtReportRow(row, 'debt'))
  }, [viewDebtRows])

  const outstanding = useMemo(() => {
    return (reportRows || []).filter(r => toNumber(r.balance) > 0)
  }, [reportRows])
  const reportTotals = useMemo(() => {
    return (reportRows || []).reduce((totals, row) => {
      const collected = getCollectedAmount(row) || toNumber(row.amount_paid)
      const balance = toNumber(row.balance)
      const total = getDebtInitialAmount(row)
      totals.totalOutstanding += total
      totals.totalCollected += collected
      totals.remainingBalance += balance
      return totals
    }, { totalOutstanding: 0, totalCollected: 0, remainingBalance: 0 })
  }, [reportRows])
  const totalOutstanding = useMemo(() => {
    return reportTotals.totalOutstanding
  }, [reportTotals])
  const totalCollected = useMemo(() =>
    reportTotals.totalCollected,
    [reportTotals]
  )

  // Remaining balance = sum of balance from ar_debt (Pay off sheet)
  const remainingBalance = useMemo(() =>
    reportTotals.remainingBalance,
    [reportTotals]
  )
  const totalDebtBills = useMemo(() =>
    (reportRows || []).length,
    [reportRows]
  )

  // By customer type - use ar_debt for balance
  const byType = useMemo(() => {
    const map = CUSTOMER_TYPES.reduce((acc, t) => ({ ...acc, [t]: { collected: 0, balance: 0 } }), {})
    ;(reportRows || []).forEach(r => {
      const t = r.customer_type
      if (!map[t]) return
      map[t].collected += getCollectedAmount(r) || toNumber(r.amount_paid)
      map[t].balance += toNumber(r.balance)
    })
    return map
  }, [reportRows])

  const byTypeChartOpts = {
    chart: { type: 'bar', toolbar: { show: false }, fontFamily: 'Inter, Noto Sans Lao, sans-serif' },
    plotOptions: { bar: { borderRadius: 6, columnWidth: '55%', dataLabels: { position: 'top' } } },
    colors: ['#4f46e5', '#ef4444'],
    xaxis: { categories: CUSTOMER_TYPES, labels: { style: { colors: '#94a3b8' } } },
    yaxis: { labels: { formatter: v => formatNumber(v), style: { colors: '#94a3b8', fontSize: '10px' } } },
    legend: { labels: { colors: '#64748b' }, position: 'top' },
    grid: { borderColor: '#f1f5f9', strokeDashArray: 4 },
    dataLabels: {
      enabled: true,
      formatter: v => formatLAK(v),
      offsetY: -18,
      style: { fontSize: '12px', fontWeight: 600, colors: ['#334155'] },
      background: { enabled: false },
    },
    tooltip: { y: { formatter: v => `${formatNumber(v)} LAK` } },
  }

  const trendOpts = {
    chart: { type: 'area', toolbar: { show: false }, fontFamily: 'Inter, Noto Sans Lao, sans-serif' },
    colors: ['#ef4444'],
    stroke: { curve: 'smooth', width: 2 },
    fill: { type: 'gradient', gradient: { opacityFrom: 0.3, opacityTo: 0.02 } },
    xaxis: { type: 'datetime', labels: { style: { colors: '#94a3b8', fontSize: '10px' } } },
    yaxis: { labels: { formatter: v => formatNumber(v), style: { colors: '#94a3b8', fontSize: '10px' } } },
    grid: { borderColor: '#f1f5f9', strokeDashArray: 4 },
    dataLabels: { enabled: false },
    tooltip: { x: { format: 'dd MMM yyyy' }, y: { formatter: v => `${formatNumber(v)} LAK` } },
  }

  const trendData = useMemo(() => {
    const map = {}
    // Use ar_debt for outstanding trend
    ;(reportRows || []).forEach(r => {
      if (!r.date) return
      if (!map[r.date]) map[r.date] = 0
      map[r.date] += toNumber(r.balance)
    })
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([d, v]) => [new Date(d).getTime(), v])
  }, [reportRows])

  const totalPages = Math.ceil(outstanding.length / PAGE_SIZE)
  const pageData = outstanding.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  if (loading) return <div className="p-6"><LoadingSpinner /></div>

  return (
    <div id="outstanding-debt-content" className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="section-title">Outstanding Debt</h2>
          <p className="text-sm text-slate-500">Outstanding debt report</p>
        </div>
        <div className="flex flex-wrap items-center gap-2" data-pdf-hidden="true">
          <PDFButton elementId="full-report-export" filename="AR_Finance_LXH_Report" label="Download PDF" />
          <DateFilter filters={filters} onChange={updateFilters} />
          <FilterSelect label="Customer Type" value={filters.customerType}
            onChange={v => updateFilters({ customerType: v })}
            options={CUSTOMER_TYPES} />
          <FilterSelect label="OPD/IPD" value={filters.opdIpd}
            onChange={v => updateFilters({ opdIpd: v })}
            options={['OPD','IPD']} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard label="Total Outstanding Debt" sublabel="Total outstanding amount"
          value={totalOutstanding} color="red" fullNumber
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" /></svg>}
          badge={`${formatNumber(totalDebtBills)} bills`} badgeColor="bg-red-100 text-red-700"
        />
        <KPICard label="Collected" sublabel="Collected"
          value={totalCollected} color="green" fullNumber
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
        />
        <KPICard label="Remaining Balance" sublabel="Remaining Balance"
          value={remainingBalance} color="orange" fullNumber
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="chart-card">
          <h3 className="section-title mb-1">Debt by Customer Type</h3>
          <p className="text-xs text-slate-400 mb-4">Outstanding debt by customer type</p>
          {reportRows?.length > 0 ? (
            <ReactApexChart
              options={byTypeChartOpts}
              series={[
                { name: 'Collected',  data: CUSTOMER_TYPES.map(t => byType[t]?.collected || 0) },
                { name: 'Remaining', data: CUSTOMER_TYPES.map(t => byType[t]?.balance   || 0) },
              ]}
              type="bar" height={260}
            />
          ) : <EmptyState message="No data" />}
        </div>

        <div className="chart-card">
          <h3 className="section-title mb-1">Outstanding Debt Trend</h3>
          <p className="text-xs text-slate-400 mb-4">Outstanding debt trend</p>
          {trendData.length > 0 ? (
            <ReactApexChart options={trendOpts} series={[{ name: 'Outstanding', data: trendData }]} type="area" height={260} />
          ) : <EmptyState message="No data" />}
        </div>
      </div>

      {/* Type breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { type: 'GN',  label: 'General (GN)',    color: '#4f46e5', bg: 'bg-indigo-50', border: 'border-indigo-100', text: 'text-indigo-700' },
          { type: 'INS', label: 'Insurance (INS)', color: '#06b6d4', bg: 'bg-sky-50',    border: 'border-sky-100',    text: 'text-sky-700' },
          { type: 'B2B', label: 'B2B',             color: '#f59e0b', bg: 'bg-amber-50',  border: 'border-amber-100',  text: 'text-amber-700' },
          { type: 'iNS', label: 'iNS',             color: '#ef4444', bg: 'bg-red-50',    border: 'border-red-100',    text: 'text-red-700' },
        ].map(({ type, label, color, bg, border, text }) => (
          <div key={type} className={`kpi-card ${bg} border ${border}`}>
            <div className="flex items-center justify-between">
              <span className={`font-bold text-lg ${text}`}>{type}</span>
              <span className="badge bg-white text-slate-600 border border-slate-200">{label}</span>
            </div>
            <div className="space-y-2 mt-1">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Collected</span>
                <span className="font-semibold text-slate-800">{formatNumber(byType[type]?.collected || 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Remaining</span>
                <span className="font-semibold text-red-600">{formatNumber(byType[type]?.balance || 0)}</span>
              </div>
              <div className="w-full bg-white/60 rounded-full h-2">
                {(() => {
                  const total = (byType[type]?.collected || 0) + (byType[type]?.balance || 0)
                  const pct = total > 0 ? (byType[type]?.collected || 0) / total * 100 : 0
                  return <div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                })()}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      {outstanding.length > 0 && (
        <div className="chart-card overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="section-title">Outstanding Debt List</h3>
              <p className="text-xs text-slate-400 mt-0.5">{formatNumber(totalDebtBills)} items</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-th">Date</th>
                  <th className="table-th">Bill No.</th>
                  <th className="table-th">HN</th>
                  <th className="table-th">Patient Name</th>
                  <th className="table-th">Type</th>
                  <th className="table-th">Insurance</th>
                  <th className="table-th text-right">Grand Total</th>
                  <th className="table-th text-right">Outstanding Debt</th>
                  <th className="table-th">Aging</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageData.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="table-td text-slate-500">{r.date}</td>
                    <td className="table-td font-mono text-xs font-semibold text-primary-600">{r.bill_no}</td>
                    <td className="table-td text-xs text-slate-500">{r.hn}</td>
                    <td className="table-td max-w-[160px] truncate">{r.patient_name}</td>
                    <td className="table-td">
                      <span className={`badge ${r.customer_type === 'INS' ? 'bg-sky-100 text-sky-700' : r.customer_type === 'B2B' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
                        {r.customer_type}
                      </span>
                    </td>
                    <td className="table-td text-xs text-slate-500">{r.insurance || '-'}</td>
                    <td className="table-td text-right font-mono text-xs">{formatNumber(r.grand_total)}</td>
                    <td className="table-td text-right font-mono text-xs font-semibold text-red-600">{formatNumber(r.balance ?? r.debt)}</td>
                    <td className="table-td">
                      {(() => {
                        const aging = calcAging(r)
                        return <span className={`badge text-[10px] ${agingBadgeClass(aging)}`}>{getAgingLabel(aging)}</span>
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-2" data-pdf-hidden="true">
              <p className="text-xs text-slate-500">
                {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, outstanding.length)} / {outstanding.length}
              </p>
              <div className="flex items-center gap-1">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="btn-secondary py-1 px-2 text-xs disabled:opacity-40">&lt;</button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const p = Math.min(Math.max(page - 2, 1) + i, totalPages)
                  return (
                    <button key={p} onClick={() => setPage(p)}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${p === page ? 'bg-primary-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-primary-300'}`}>
                      {p}
                    </button>
                  )
                })}
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="btn-secondary py-1 px-2 text-xs disabled:opacity-40">&gt;</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
