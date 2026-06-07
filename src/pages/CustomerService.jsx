import { useState, useMemo } from 'react'
import ReactApexChart from 'react-apexcharts'
import KPICard, { CountCard } from '../components/KPICard'
import DateFilter, { FilterSelect } from '../components/DateFilter'
import LoadingSpinner, { EmptyState } from '../components/LoadingSpinner'
import PDFButton from '../components/PDFButton'
import { useARData, computeServiceData, computeServiceSummary, computeLocationSummary } from '../lib/useARData'
import { formatLAK, formatNumber } from '../lib/excelParser'
import { useGlobalFilters } from '../context/FilterContext'

const SHIFT_OPTIONS = [
  { value: '8AM-4PM', label: '08:00AM-16:00PM' },
  { value: '4PM-12AM', label: '16:00PM-21:00PM' },
  { value: '12AM-8AM', label: '21:00PM-08:00AM' },
]

const formatDonutBillLabel = (val, opts) => {
  const billCount = opts?.w?.config?.series?.[opts.seriesIndex] || 0
  return `${formatNumber(billCount)} bills (${val.toFixed(1)}%)`
}

const getBillPercent = (value, total) => {
  if (!total) return '0.0%'
  return `${((value / total) * 100).toFixed(1)}%`
}

function DonutBillSummary({ items }) {
  const total = items.reduce((sum, item) => sum + item.value, 0)

  return (
    <div className="mt-3 grid grid-cols-1 gap-2 text-sm">
      {items.map(item => (
        <div key={item.label} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="truncate font-medium text-slate-700">{item.label}</span>
          </div>
          <span className="whitespace-nowrap font-semibold text-slate-800">
            {formatNumber(item.value)} bills ({getBillPercent(item.value, total)})
          </span>
        </div>
      ))}
    </div>
  )
}

export default function CustomerService() {
  const { filters, updateFilters } = useGlobalFilters()

  const { data: rows, loading } = useARData(filters)

  const stats = useMemo(() => {
    if (!rows?.length) return {}
    const total = rows.length
    const female = rows.filter(r => r.gender === 'Female' || r.gender === 'F').length
    const male = rows.filter(r => r.gender === 'Male' || r.gender === 'M').length
    const insite = rows.filter(r => r.insite_onsite === 'Insite').length
    const onsite = rows.filter(r => r.insite_onsite === 'Onsite').length
    const opd = rows.filter(r => r.opd_ipd === 'OPD').length
    const ipd = rows.filter(r => r.opd_ipd === 'IPD').length
    const gn = rows.filter(r => r.customer_type === 'GN').length
    const ins = rows.filter(r => r.customer_type === 'INS').length
    const b2b = rows.filter(r => r.customer_type === 'B2B').length
    return { total, female, male, insite, onsite, opd, ipd, gn, ins, b2b }
  }, [rows])

  const services = useMemo(() => computeServiceData(rows || []), [rows])
  const serviceSummary = useMemo(() => computeServiceSummary(rows || []), [rows])
  const locationSummary = useMemo(() => computeLocationSummary(rows || []), [rows])

  const serviceEntries = Object.entries(services)
    .sort(([, a], [, b]) => b - a)
    .filter(([, v]) => v > 0)

  const genderDonutOpts = {
    chart: { type: 'donut', fontFamily: 'Inter, Noto Sans Lao, sans-serif' },
    labels: ['Female', 'Male'],
    colors: ['#f472b6', '#60a5fa'],
    legend: {
      position: 'bottom',
      labels: { colors: '#64748b' },
      formatter: (seriesName, opts) => {
        const billCount = opts?.w?.globals?.series?.[opts.seriesIndex] || 0
        return `${seriesName} (${formatNumber(billCount)} bills)`
      },
    },
    plotOptions: {
      pie: {
        donut: {
          size: '65%',
          labels: {
            show: true,
            total: {
              show: true,
              label: 'Total',
              color: '#64748b',
              formatter: w => `${formatNumber(w.globals.seriesTotals.reduce((sum, value) => sum + value, 0))} bills`,
            },
          },
        },
      },
    },
    dataLabels: {
      formatter: formatDonutBillLabel,
      style: { fontSize: '11px', fontWeight: 700 },
    },
    tooltip: { y: { formatter: v => `${formatNumber(v)} bills` } },
  }

  const insiteDonutOpts = {
    ...genderDonutOpts,
    labels: ['Insite', 'Onsite'],
    colors: ['#818cf8', '#34d399'],
  }

  const serviceBarOpts = {
    chart: { type: 'bar', toolbar: { show: false }, fontFamily: 'Inter, Noto Sans Lao, sans-serif' },
    plotOptions: { bar: { borderRadius: 6, horizontal: true, barHeight: '65%', dataLabels: { position: 'bottom' } } },
    colors: ['#4f46e5'],
    xaxis: { labels: { formatter: v => formatLAK(v), style: { colors: '#94a3b8', fontSize: '10px' } } },
    yaxis: { labels: { style: { colors: '#475569', fontSize: '11px', fontWeight: 500 } } },
    grid: { borderColor: '#f1f5f9', strokeDashArray: 4 },
    dataLabels: {
      enabled: true,
      formatter: v => formatLAK(v),
      style: { fontSize: '10px', colors: ['#fff'] },
      offsetX: 5,
    },
    tooltip: { y: { formatter: v => `${formatNumber(v)} LAK` } },
  }

  const customerTypeOpts = {
    chart: { type: 'bar', toolbar: { show: false }, fontFamily: 'Inter, Noto Sans Lao, sans-serif' },
    plotOptions: { bar: { borderRadius: 8, columnWidth: '50%', dataLabels: { position: 'top' } } },
    colors: ['#4f46e5', '#06b6d4', '#f59e0b'],
    xaxis: { categories: ['GN', 'INS', 'B2B'], labels: { style: { colors: '#64748b', fontSize: '13px', fontWeight: 600 } } },
    yaxis: { labels: { style: { colors: '#94a3b8', fontSize: '11px' } } },
    grid: { borderColor: '#f1f5f9', strokeDashArray: 4 },
    legend: { show: false },
    dataLabels: {
      enabled: true,
      offsetY: -24,
      style: { fontSize: '13px', fontWeight: 700, colors: ['#334155'] },
      formatter: v => formatNumber(v),
    },
    tooltip: { y: { formatter: v => `${formatNumber(v)} people` } },
  }

  if (loading) return <div className="p-6"><LoadingSpinner /></div>

  return (
    <div id="customer-service-content" className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="section-title">Customer & Service Analysis</h2>
          <p className="text-sm text-slate-500">Customer and service analysis</p>
        </div>
        <div className="flex flex-wrap items-center gap-2" data-pdf-hidden="true">
          <PDFButton elementId="full-report-export" filename="AR_Finance_LXH_Report" label="Download PDF" />
          <DateFilter filters={filters} onChange={updateFilters} />
          <FilterSelect label="Shift" value={filters.workload}
            onChange={v => updateFilters({ workload: v })}
            options={SHIFT_OPTIONS} />
          <FilterSelect label="Customer Type" value={filters.customerType}
            onChange={v => updateFilters({ customerType: v })}
            options={['GN','INS','B2B']} />
          <FilterSelect label="Gender" value={filters.gender}
            onChange={v => updateFilters({ gender: v })}
            options={['Male','Female']} />
          <FilterSelect label="Insite/Onsite" value={filters.insiteOnsite}
            onChange={v => updateFilters({ insiteOnsite: v })}
            options={['Insite','Onsite']} />
          <FilterSelect label="OPD/IPD" value={filters.opdIpd}
            onChange={v => updateFilters({ opdIpd: v })}
            options={['OPD','IPD']} />
        </div>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <CountCard label="Total Customers" sublabel="Total customer count" value={stats.total} color="indigo"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
          isLAK={false}
        />
        <CountCard label="Female" sublabel="Female" value={stats.female} color="purple" isLAK={false}
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
        />
        <CountCard label="Male" sublabel="Male" value={stats.male} color="blue" isLAK={false}
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
        />
        <CountCard label="Insite" sublabel="Inside Hospital" value={stats.insite} color="green" isLAK={false}
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}
        />
        <CountCard label="OPD" sublabel="Out-Patient" value={stats.opd} color="sky" isLAK={false}
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>}
        />
        <CountCard label="IPD" sublabel="In-Patient" value={stats.ipd} color="orange" isLAK={false}
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {['Insite', 'Onsite'].map(location => {
          const item = locationSummary[location] || { bills: 0, amount: 0, averagePerBill: 0 }
          return (
            <div key={location} className="chart-card">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="section-title">{location}</h3>
                  <p className="text-xs text-slate-400">Bills, amount, and average per bill</p>
                </div>
                <span className="badge bg-slate-100 text-slate-700">{formatNumber(item.bills)} bills</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                  <p className="text-xs text-slate-500">Amount</p>
                  <p className="text-lg font-bold text-slate-800">{formatNumber(item.amount)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                  <p className="text-xs text-slate-500">Average / Bill</p>
                  <p className="text-lg font-bold text-slate-800">{formatNumber(item.averagePerBill)}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Donut charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="chart-card">
          <h3 className="section-title mb-1">Gender</h3>
          <p className="text-xs text-slate-400 mb-2">Gender Distribution</p>
          {stats.total > 0 ? (
            <>
              <ReactApexChart
                options={genderDonutOpts}
                series={[stats.female || 0, stats.male || 0]}
                type="donut" height={220}
              />
              <DonutBillSummary
                items={[
                  { label: 'Female', value: stats.female || 0, color: '#f472b6' },
                  { label: 'Male', value: stats.male || 0, color: '#60a5fa' },
                ]}
              />
            </>
          ) : <EmptyState message="No data" />}
        </div>

        <div className="chart-card">
          <h3 className="section-title mb-1">Insite / Onsite</h3>
          <p className="text-xs text-slate-400 mb-2">Location Type</p>
          {stats.total > 0 ? (
            <>
              <ReactApexChart
                options={insiteDonutOpts}
                series={[stats.insite || 0, stats.onsite || 0]}
                type="donut" height={220}
              />
              <DonutBillSummary
                items={[
                  { label: 'Insite', value: stats.insite || 0, color: '#818cf8' },
                  { label: 'Onsite', value: stats.onsite || 0, color: '#34d399' },
                ]}
              />
            </>
          ) : <EmptyState message="No data" />}
        </div>

        <div className="chart-card">
          <h3 className="section-title mb-1">Customer Type</h3>
          <p className="text-xs text-slate-400 mb-2">Customer Type</p>
          {stats.total > 0 ? (
            <ReactApexChart
              options={customerTypeOpts}
              series={[
                { name: 'GN', data: [stats.gn || 0, 0, 0] },
                { name: 'INS', data: [0, stats.ins || 0, 0] },
                { name: 'B2B', data: [0, 0, stats.b2b || 0] },
              ]}
              type="bar" height={220}
            />
          ) : <EmptyState message="No data" />}
        </div>
      </div>

      {/* Service Revenue */}
      <div className="chart-card">
        <h3 className="section-title mb-1">Revenue by Service</h3>
        <p className="text-xs text-slate-400 mb-4">Revenue by Service Type (LAK)</p>
        {serviceEntries.length > 0 ? (
          <ReactApexChart
            options={{
              ...serviceBarOpts,
              xaxis: { categories: serviceEntries.map(([k]) => k), ...serviceBarOpts.xaxis },
            }}
            series={[{ name: 'Revenue', data: serviceEntries.map(([, v]) => v) }]}
            type="bar" height={Math.max(280, serviceEntries.length * 40)}
          />
        ) : <EmptyState message="No data" sublabel="Please upload Excel first" />}
      </div>

      {/* Summary Table */}
      {serviceEntries.length > 0 && (
        <div className="chart-card overflow-hidden">
          <h3 className="section-title mb-4">Top 10 Services Summary</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-th rounded-tl-lg">Service</th>
                  <th className="table-th text-right">Bill</th>
                  <th className="table-th text-right">Revenue (LAK)</th>
                  <th className="table-th text-right">Average / Client</th>
                  <th className="table-th text-right rounded-tr-lg">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {serviceSummary.filter(s => s.amount > 0).map(service => {
                  const { label: name, amount: value } = service
                  const total = serviceEntries.reduce((s, [, v]) => s + v, 0)
                  const pct = total > 0 ? (value / total * 100).toFixed(1) : '0.0'
                  return (
                    <tr key={name} className="hover:bg-slate-50 transition-colors">
                      <td className="table-td font-medium">{name}</td>
                      <td className="table-td text-right font-mono text-slate-800">{formatNumber(service.bills)}</td>
                      <td className="table-td text-right font-mono text-slate-800">{formatNumber(value)}</td>
                      <td className="table-td text-right font-mono text-slate-800">{formatNumber(service.averagePerClient)}</td>
                      <td className="table-td text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 bg-slate-100 rounded-full h-1.5">
                            <div className="h-1.5 rounded-full bg-primary-500" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-slate-600 text-xs font-medium w-10 text-right">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
