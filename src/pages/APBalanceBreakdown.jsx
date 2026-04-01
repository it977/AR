import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import ReactApexCharts from 'react-apexcharts'
import LoadingSpinner from '../components/LoadingSpinner'

function fmt(v) { return new Intl.NumberFormat().format(v || 0) }
function fmtCompact(v) {
  if (v >= 1000000000) return (v / 1000000000).toFixed(1) + 'B'
  if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M'
  if (v >= 1000) return (v / 1000).toFixed(1) + 'K'
  return v.toString()
}

export default function APBalanceBreakdown() {
  const [loading, setLoading] = useState(true)
  const [apData, setApData] = useState([])
  const [filters, setFilters] = useState({
    status: '',
    vendor: '',
    dateFrom: '',
    dateTo: '',
  })

  useEffect(() => {
    fetchAPData()
  }, [filters])

  async function fetchAPData() {
    setLoading(true)
    let q = supabase.from('ap_bills').select('*')
    
    if (filters.status) q = q.eq('status', filters.status)
    if (filters.vendor) q = q.eq('vendor_name', filters.vendor)
    if (filters.dateFrom) q = q.gte('date', filters.dateFrom)
    if (filters.dateTo) q = q.lte('date', filters.dateTo)
    
    const { data, error } = await q
    if (!error && data) setApData(data)
    setLoading(false)
  }

  // KPIs
  const kpis = useMemo(() => {
    const totalAPBills = apData.length
    const totalAPAmount = apData.reduce((s, r) => s + (r.grand_total || 0), 0)
    const totalOutstandingBills = apData.filter(r => (r.balance || 0) > 0).length
    const totalOutstandingBalance = apData.reduce((s, r) => s + (r.balance || 0), 0)
    
    const today = new Date().toISOString().split('T')[0]
    const overdueBills = apData.filter(r => r.due_date && r.due_date < today && (r.balance || 0) > 0).length
    const overdueBalance = apData.filter(r => r.due_date && r.due_date < today && (r.balance || 0) > 0)
      .reduce((s, r) => s + (r.balance || 0), 0)
    
    return { totalAPBills, totalAPAmount, totalOutstandingBills, totalOutstandingBalance, overdueBills, overdueBalance }
  }, [apData])

  // By Vendor
  const byVendor = useMemo(() => {
    const groups = {}
    apData.forEach(r => {
      const vendor = r.vendor_name || 'Other'
      if (!groups[vendor]) groups[vendor] = { total: 0, outstanding: 0, bills: 0 }
      groups[vendor].total += (r.grand_total || 0)
      groups[vendor].outstanding += (r.balance || 0)
      groups[vendor].bills += 1
    })
    return groups
  }, [apData])

  // By Payment Status
  const byPaymentStatus = useMemo(() => {
    const groups = { overdue: { bills: 0, amount: 0 }, paid: { bills: 0, amount: 0 } }
    const today = new Date().toISOString().split('T')[0]
    
    apData.forEach(r => {
      const isOverdue = r.due_date && r.due_date < today && (r.balance || 0) > 0
      if (isOverdue) {
        groups.overdue.bills += 1
        groups.overdue.amount += (r.balance || 0)
      } else if ((r.balance || 0) <= 0) {
        groups.paid.bills += 1
        groups.paid.amount += (r.grand_total || 0)
      }
    })
    return groups
  }, [apData])

  const vendorChartOptions = {
    chart: { type: 'bar', height: 320, toolbar: { show: false } },
    plotOptions: { bar: { horizontal: true, columnWidth: '60%', borderRadius: 4 } },
    dataLabels: { enabled: false },
    stroke: { width: 0 },
    legend: { position: 'top', fontSize: '12px' },
    xaxis: { labels: { formatter: (v) => fmtCompact(v), style: { fontSize: '11px' } } },
    yaxis: { labels: { style: { fontSize: '11px' } } },
    tooltip: { y: { formatter: (v) => fmt(v) } },
    colors: ['#22d3ee', '#f87171'],
  }

  const statusChartOptions = {
    ...vendorChartOptions,
    colors: ['#2563eb', '#14b8a6'],
    plotOptions: { bar: { horizontal: false } },
  }

  if (loading) return <div className="p-6"><LoadingSpinner /></div>

  return (
    <div id="ap-balance-content" className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="section-title">Total AP Balance Breakdown</h2>
          <p className="text-xs text-slate-500 mt-0.5">ສະຫຼຸບຍອດຄ້າງຈ່າຍຕາມ Vendor</p>
        </div>
        <div className="flex items-center gap-2">
          <select 
            value={filters.status} 
            onChange={e => setFilters({...filters, status: e.target.value})}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none"
          >
            <option value="">Status (All)</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <input 
            type="text" 
            placeholder="Vendor Name..."
            value={filters.vendor}
            onChange={e => setFilters({...filters, vendor: e.target.value})}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none"
          />
          <input 
            type="date" 
            value={filters.dateFrom}
            onChange={e => setFilters({...filters, dateFrom: e.target.value})}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none"
          />
          <input 
            type="date" 
            value={filters.dateTo}
            onChange={e => setFilters({...filters, dateTo: e.target.value})}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none"
          />
          <button 
            onClick={() => setFilters({ status: '', vendor: '', dateFrom: '', dateTo: '' })}
            className="text-xs text-slate-500 hover:text-slate-800 underline"
          >
            Reset
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Total AP Bills" value={kpis.totalAPBills} isCount />
        <KpiCard label="Total AP Amount" value={kpis.totalAPAmount} color="text-cyan-700" />
        <KpiCard label="Total Outstanding Bills" value={kpis.totalOutstandingBills} isCount color="text-red-600" />
        <KpiCard label="Total Outstanding Balance" value={kpis.totalOutstandingBalance} color="text-red-600" />
        <KpiCard label="Total Overdue Bills" value={kpis.overdueBills} isCount color="text-amber-600" />
        <KpiCard label="Total Overdue Balance" value={kpis.overdueBalance} color="text-amber-600" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Total AP vs Outstanding Amount by Vendor */}
        <div className="bg-white rounded-xl border border-slate-100 p-4 lg:col-span-2">
          <h3 className="font-bold text-slate-700 text-sm mb-4">Total AP vs Outstanding Amount by Vendor</h3>
          <ReactApexCharts
            options={{
              ...vendorChartOptions,
              xaxis: { categories: Object.keys(byVendor) },
            }}
            series={[
              { name: 'Total Amount', data: Object.values(byVendor).map(v => v.total) },
              { name: 'Outstanding', data: Object.values(byVendor).map(v => v.outstanding) },
            ]}
            type="bar"
            height={320}
          />
        </div>

        <div className="space-y-5">
          {/* Total Bills by Payment Status */}
          <div className="bg-white rounded-xl border border-slate-100 p-4">
            <h3 className="font-bold text-slate-700 text-sm mb-4">Total Bills by Payment Status</h3>
            <ReactApexCharts
              options={{
                ...statusChartOptions,
                xaxis: { categories: ['Overdue', 'Paid'] },
              }}
              series={[
                { name: 'Bills', data: [byPaymentStatus.overdue.bills, byPaymentStatus.paid.bills] },
              ]}
              type="bar"
              height={140}
            />
          </div>

          {/* Outstanding Balance Proportion (Treemap-like) */}
          <div className="bg-white rounded-xl border border-slate-100 p-4">
            <h3 className="font-bold text-slate-700 text-sm mb-2">Outstanding Balance Proportion</h3>
            <div className="text-xs text-slate-500 mb-3">All: {fmt(kpis.totalOutstandingBalance)}</div>
            <div className="space-y-2">
              {Object.entries(byVendor)
                .filter(([, v]) => v.outstanding > 0)
                .sort((a, b) => b[1].outstanding - a[1].outstanding)
                .slice(0, 5)
                .map(([vendor, data], idx) => (
                  <div key={vendor} className="relative">
                    <div 
                      className={`h-8 rounded flex items-center px-2 text-xs font-semibold text-white transition-all ${
                        idx === 0 ? 'bg-blue-600' :
                        idx === 1 ? 'bg-blue-500' :
                        idx === 2 ? 'bg-blue-400' :
                        idx === 3 ? 'bg-blue-300' : 'bg-blue-200 text-blue-800'
                      }`}
                      style={{ width: `${Math.max(20, (data.outstanding / kpis.totalOutstandingBalance) * 100)}%` }}
                    >
                      {vendor}: {fmtCompact(data.outstanding)}
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function KpiCard({ label, value, isCount, color = 'text-slate-700' }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-3 text-center">
      <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">{label}</p>
      <p className={`text-lg font-bold mt-1 font-mono ${color}`}>
        {isCount ? value : fmt(value)}
      </p>
      {!isCount && <p className="text-[9px] text-slate-400 mt-0.5">LAK</p>}
    </div>
  )
}
