import { useState, useMemo } from 'react'
import ReactApexChart from 'react-apexcharts'
import KPICard from '../components/KPICard'
import DateFilter, { FilterSelect } from '../components/DateFilter'
import LoadingSpinner, { EmptyState } from '../components/LoadingSpinner'
import PDFButton from '../components/PDFButton'
import { useARData, usePayoffData, computeAgingData, getLookerMaxDate, capToLookerMaxDate, getMissingDebtRowsFromBills } from '../lib/useARData'
import { formatLAK, formatNumber } from '../lib/excelParser'
import { useGlobalFilters } from '../context/FilterContext'
import { getAgingLabel } from '../lib/debtUtils'

const AGING_CONFIG = [
  { key: 'N', label: getAgingLabel('N'), color: '#0ea5e9', bg: 'bg-sky-50', border: 'border-sky-100', text: 'text-sky-700', badgeBg: 'bg-sky-100 text-sky-700' },
  { key: '0-15 Days', label: '0-15 Days', color: '#10b981', bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-700', badgeBg: 'bg-emerald-100 text-emerald-700' },
  { key: 'ຈ່າຍຕາມກຳນົດ', label: getAgingLabel('ຈ່າຍຕາມກຳນົດ'), color: '#6366f1', bg: 'bg-indigo-50', border: 'border-indigo-100', text: 'text-indigo-700', badgeBg: 'bg-indigo-100 text-indigo-700' },
  { key: 'Current Receivables', label: getAgingLabel('Current Receivables'), color: '#0ea5e9', bg: 'bg-sky-50', border: 'border-sky-100', text: 'text-sky-700', badgeBg: 'bg-sky-100 text-sky-700' },
  { key: '1-15 Days', label: '1-15 Days', color: '#10b981', bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-700', badgeBg: 'bg-emerald-100 text-emerald-700' },
  { key: '16-30 Days', label: '16-30 Days', color: '#f59e0b', bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-700', badgeBg: 'bg-amber-100 text-amber-700' },
  { key: '31-45 Days', label: '31-45 Days', color: '#f97316', bg: 'bg-orange-50', border: 'border-orange-100', text: 'text-orange-700', badgeBg: 'bg-orange-100 text-orange-700' },
  { key: '46-60+ Days', label: '46-60+ Days', color: '#ef4444', bg: 'bg-red-50', border: 'border-red-100', text: 'text-red-700', badgeBg: 'bg-red-100 text-red-700' },
  { key: '46-90 Days', label: '46-90 Days', color: '#ef4444', bg: 'bg-red-50', border: 'border-red-100', text: 'text-red-700', badgeBg: 'bg-red-100 text-red-700' },
]

export default function AgingReport() {
  const { filters, updateFilters } = useGlobalFilters()
  const [search, setSearch] = useState('')

  const { data: billRows, loading: billsLoading } = useARData(filters)
  const { data: debtRows, loading } = usePayoffData(filters)
  const lookerMaxDate = useMemo(() => getLookerMaxDate(debtRows || []), [debtRows])
  const reportRows = useMemo(() => {
    const cappedDebtRows = capToLookerMaxDate(debtRows || [], lookerMaxDate, filters)
    const missingDebtRows = getMissingDebtRowsFromBills(billRows || [], cappedDebtRows)
    return [...cappedDebtRows, ...missingDebtRows]
  }, [debtRows, billRows, lookerMaxDate, filters])
  const viewAgingData = useMemo(() => {
    return computeAgingData(reportRows)
  }, [reportRows])

  const activeAgingConfig = useMemo(() => {
    const active = AGING_CONFIG.filter(a =>
      (viewAgingData[a.key]?.balance || 0) > 0 || (viewAgingData[a.key]?.bills || 0) > 0
    )
    return active.length ? active : AGING_CONFIG
  }, [viewAgingData])
  const totalDebt = activeAgingConfig.reduce((s, a) => s + (viewAgingData[a.key]?.balance || 0), 0)
  const totalBills = activeAgingConfig.reduce((s, a) => s + (viewAgingData[a.key]?.bills || 0), 0)

  // By insurance company
  const byInsurance = useMemo(() => {
    const map = {}
    ;(reportRows || []).forEach(r => {
      if (!r.insurance) return
      if (!map[r.insurance]) map[r.insurance] = { balance: 0, bills: 0 }
      map[r.insurance].balance += r.balance || 0
      map[r.insurance].bills += 1
    })
    return Object.entries(map)
      .sort(([, a], [, b]) => b.balance - a.balance)
      .filter(([, v]) => v.balance > 0)
  }, [reportRows])

  const agingBarOpts = {
    chart: { type: 'bar', toolbar: { show: false }, fontFamily: 'Inter, Noto Sans Lao, sans-serif' },
    plotOptions: { bar: { borderRadius: 8, columnWidth: '50%', dataLabels: { position: 'top' } } },
    colors: activeAgingConfig.map(a => a.color),
    xaxis: {
      categories: activeAgingConfig.map(a => a.label),
      labels: { style: { colors: '#94a3b8', fontSize: '11px' } },
    },
    yaxis: { labels: { formatter: v => formatLAK(v), style: { colors: '#94a3b8', fontSize: '10px' } } },
    grid: { borderColor: '#f1f5f9', strokeDashArray: 4 },
    dataLabels: {
      enabled: true,
      formatter: v => formatLAK(v),
      offsetY: -22,
      style: { fontSize: '10px', colors: ['#64748b'], fontWeight: 600 },
    },
    tooltip: { y: { formatter: v => `${formatNumber(v)} LAK` } },
    fill: {
      type: 'gradient',
      gradient: { shade: 'light', type: 'vertical', opacityFrom: 1, opacityTo: 0.75 },
    },
  }

  const agingPieOpts = {
    chart: { type: 'donut', fontFamily: 'Inter, Noto Sans Lao, sans-serif' },
    labels: activeAgingConfig.map(a => a.label),
    colors: activeAgingConfig.map(a => a.color),
    legend: { position: 'bottom', labels: { colors: '#64748b' } },
    plotOptions: { pie: { donut: { size: '65%', labels: { show: true, total: { show: true, label: 'Total', color: '#64748b', formatter: () => formatLAK(totalDebt) } } } } },
    dataLabels: { formatter: val => `${val.toFixed(1)}%` },
    tooltip: { y: { formatter: v => `${formatNumber(v)} LAK` } },
  }

  const insuranceBarOpts = {
    chart: { type: 'bar', toolbar: { show: false }, fontFamily: 'Inter, Noto Sans Lao, sans-serif' },
    plotOptions: { bar: { borderRadius: 5, horizontal: true, barHeight: '60%' } },
    colors: ['#4f46e5'],
    xaxis: { labels: { formatter: v => formatLAK(v), style: { colors: '#94a3b8', fontSize: '10px' } } },
    yaxis: { labels: { style: { colors: '#475569', fontSize: '11px' } } },
    grid: { borderColor: '#f1f5f9', strokeDashArray: 4 },
    dataLabels: {
      enabled: true,
      formatter: v => formatLAK(v),
      style: { fontSize: '10px', colors: ['#fff'] },
      offsetX: 5,
    },
    tooltip: { y: { formatter: v => `${formatNumber(v)} LAK` } },
  }

  const filteredInsurance = byInsurance.filter(([name]) =>
    name.toLowerCase().includes(search.toLowerCase())
  )
  const insuranceTotal = byInsurance.reduce((sum, [, value]) => sum + value.balance, 0)

  if (loading || billsLoading) return <div className="p-6"><LoadingSpinner /></div>

  return (
    <div id="aging-report-content" className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="section-title">Aging Report</h2>
          <p className="text-sm text-slate-500">Aging Report</p>
        </div>
        <div className="flex flex-wrap items-center gap-2" data-pdf-hidden="true">
          <PDFButton elementId="full-report-export" filename="AR_Finance_LXH_Report" label="Download PDF" />
          <DateFilter filters={filters} onChange={updateFilters} />
          <FilterSelect label="Customer Type" value={filters.customerType}
            onChange={v => updateFilters({ customerType: v })}
            options={['GN','INS','B2B']} />
          <input
            type="text"
            value={filters.insurance || ''}
            onChange={e => updateFilters({ insurance: e.target.value })}
            placeholder="Search insurance..."
            className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100 h-[34px] w-36"
          />
        </div>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 gap-4">
        <KPICard
          label="Total Debt" sublabel="Total outstanding debt"
          value={totalDebt} color="red"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
          badge={`${totalBills} bills`} badgeColor="bg-red-100 text-red-700"
        />
        <div className="grid grid-cols-2 gap-4 col-span-1">
          {/* placeholder for layout balance */}
        </div>
      </div>

      {/* Aging bucket cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {activeAgingConfig.map(a => {
          const d = viewAgingData[a.key] || { balance: 0, bills: 0 }
          const pct = totalDebt > 0 ? (d.balance / totalDebt * 100).toFixed(1) : '0.0'
          return (
            <div key={a.key} className={`kpi-card ${a.bg} border ${a.border}`}>
              <div className="flex items-center justify-between">
                <span className={`text-2xl font-bold ${a.text}`}>{pct}%</span>
                <span className={`badge ${a.badgeBg}`}>{d.bills} bills</span>
              </div>
              <div>
                <p className={`text-xl font-bold ${a.text}`}>{formatLAK(d.balance)}</p>
                <p className="text-[10px] text-slate-400">LAK</p>
                <p className="text-sm font-semibold text-slate-700 mt-1">{a.label}</p>
              </div>
              <div className="w-full bg-white/60 rounded-full h-2">
                <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: a.color }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="chart-card xl:col-span-2">
          <h3 className="section-title mb-1">Debt by Aging Bucket</h3>
          <p className="text-xs text-slate-400 mb-4">Debt amount by aging bucket (LAK)</p>
          {totalDebt > 0 ? (
            <ReactApexChart
              options={agingBarOpts}
              series={[{ name: 'Balance', data: activeAgingConfig.map(a => viewAgingData[a.key]?.balance || 0) }]}
              type="bar" height={260}
            />
          ) : <EmptyState message="No data" sublabel="Please upload Excel first" />}
        </div>

        <div className="chart-card">
          <h3 className="section-title mb-1">Aging Share</h3>
          <p className="text-xs text-slate-400 mb-4">Aging proportion</p>
          {totalDebt > 0 ? (
            <ReactApexChart
              options={agingPieOpts}
              series={activeAgingConfig.map(a => viewAgingData[a.key]?.balance || 0)}
              type="donut" height={260}
            />
          ) : <EmptyState message="No data" />}
        </div>
      </div>

      {/* Insurance company breakdown */}
      <div className="chart-card">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="section-title">Outstanding Debt by Insurance Company</h3>
            <p className="text-xs text-slate-400 mt-0.5">Outstanding Debt by Insurance Company</p>
          </div>
          <input
            type="text"
            placeholder="Search company..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:border-primary-400 w-48"
          />
        </div>

        {byInsurance.length > 0 ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-th">#</th>
                    <th className="table-th">Insurance Company</th>
                    <th className="table-th text-right">Debt Amount (LAK)</th>
                    <th className="table-th text-right">Bills</th>
                    <th className="table-th text-right">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredInsurance.map(([name, v], i) => {
                    const pct = insuranceTotal > 0 ? (v.balance / insuranceTotal * 100).toFixed(1) : '0.0'
                    return (
                      <tr key={name} className="hover:bg-slate-50 transition-colors">
                        <td className="table-td text-slate-400 text-xs">{i + 1}</td>
                        <td className="table-td font-medium text-slate-800">{name}</td>
                        <td className="table-td text-right font-mono text-sm font-semibold text-slate-800">{formatNumber(v.balance)}</td>
                        <td className="table-td text-right text-slate-500">{v.bills}</td>
                        <td className="table-td text-right">
                          <div className="flex items-center justify-end gap-1">
                            <div className="w-12 bg-slate-100 rounded-full h-1.5">
                              <div className="h-1.5 rounded-full bg-primary-500" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-slate-500 w-8">{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {byInsurance.slice(0, 10).length > 0 && (
              <ReactApexChart
                options={{
                  ...insuranceBarOpts,
                  xaxis: { ...insuranceBarOpts.xaxis, categories: byInsurance.slice(0, 10).map(([n]) => n) },
                }}
                series={[{ name: 'Balance', data: byInsurance.slice(0, 10).map(([, v]) => v.balance) }]}
                type="bar" height={Math.max(250, byInsurance.slice(0, 10).length * 35)}
              />
            )}
          </div>
        ) : (
          <EmptyState message="No insurance data" sublabel="Please upload Excel (Pay off sheet) first" />
        )}
      </div>
    </div>
  )
}
