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

const AGING_LABELS = { 'N': '0-7 Days', '0-15 Days': '0-15 Days', '16-30 Days': '16-30 Days', '31-45 Days': '31-45 Days', '46-60+ Days': '30+ Days' }

export default function APPaidBreakdown() {
  const [loading, setLoading] = useState(true)
  const [apData, setApData] = useState([])
  const [filters, setFilters] = useState({
    aging: '',
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
    
    if (filters.vendor) q = q.eq('vendor_name', filters.vendor)
    if (filters.dateFrom) q = q.gte('date', filters.dateFrom)
    if (filters.dateTo) q = q.lte('date', filters.dateTo)
    
    const { data, error } = await q
    if (!error && data) {
      // ກອງສະເພາະທີ່ຈ່າຍແລ້ວ
      const paid = data.filter(r => (r.balance || 0) <= 0 && (r.total_paid || 0) > 0)
      if (filters.aging) {
        const today = new Date()
        const dayAgo = (n) => new Date(today.getTime() - n * 86400000).toISOString().split('T')[0]
        let filtered = paid
        if (filters.aging === 'N') filtered = paid.filter(r => r.date >= dayAgo(7))
        else if (filters.aging === '0-15 Days') filtered = paid.filter(r => r.date >= dayAgo(15))
        else if (filters.aging === '16-30 Days') filtered = paid.filter(r => r.date >= dayAgo(30) && r.date < dayAgo(15))
        else if (filters.aging === '31-45 Days') filtered = paid.filter(r => r.date >= dayAgo(45) && r.date < dayAgo(30))
        else if (filters.aging === '46-60+ Days') filtered = paid.filter(r => r.date < dayAgo(45))
        setApData(filtered)
      } else {
        setApData(paid)
      }
    }
    setLoading(false)
  }

  // KPIs
  const kpis = useMemo(() => {
    const totalPaidBills = apData.length
    const totalPaidAmount = apData.reduce((s, r) => s + (r.total_paid || r.grand_total || 0), 0)
    return { totalPaidBills, totalPaidAmount }
  }, [apData])

  // By Vendor
  const byVendor = useMemo(() => {
    const groups = {}
    apData.forEach(r => {
      const vendor = r.vendor_name || 'Other'
      if (!groups[vendor]) groups[vendor] = { bills: 0, amount: 0 }
      groups[vendor].bills += 1
      groups[vendor].amount += (r.total_paid || r.grand_total || 0)
    })
    return groups
  }, [apData])

  // By Vendor & Aging
  const byVendorAging = useMemo(() => {
    const today = new Date()
    const groups = {}
    apData.forEach(r => {
      const vendor = r.vendor_name || 'Other'
      const days = Math.floor((today - new Date(r.date).getTime()) / 86400000)
      let aging = '30+ Days'
      if (days <= 7) aging = '0-7 Days'
      else if (days <= 15) aging = '8-15 Days'
      else if (days <= 30) aging = '16-30 Days'
      else aging = '30+ Days'
      
      const key = `${vendor}-${aging}`
      if (!groups[key]) groups[key] = { vendor, aging, amount: 0 }
      groups[key].amount += (r.total_paid || r.grand_total || 0)
    })
    return groups
  }, [apData])

  const donutOptions = {
    chart: { type: 'donut', height: 200, toolbar: { show: false } },
    labels: Object.keys(byVendor),
    legend: { position: 'right', fontSize: '12px' },
    colors: ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#dbeafe'],
    dataLabels: { enabled: true, formatter: (v) => `${v.toFixed(0)}%` },
    plotOptions: { pie: { donut: { size: '60%' } } },
    tooltip: { y: { formatter: (v) => fmt(v) } },
  }

  const barChartOptions = {
    chart: { type: 'bar', height: 180, toolbar: { show: false } },
    plotOptions: { bar: { columnWidth: '60%', borderRadius: 4 } },
    dataLabels: { enabled: false },
    stroke: { width: 0 },
    legend: { position: 'top', fontSize: '12px' },
    xaxis: { labels: { style: { fontSize: '11px' } } },
    yaxis: { labels: { formatter: (v) => fmtCompact(v), style: { fontSize: '11px' } } },
    tooltip: { y: { formatter: (v) => fmt(v) } },
    colors: ['#2563eb'],
  }

  const agingBarOptions = {
    ...barChartOptions,
    colors: ['#2563eb', '#14b8a6', '#ec4899', '#f97316'],
  }

  if (loading) return <div className="p-6"><LoadingSpinner /></div>

  return (
    <div id="ap-paid-content" className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="section-title">Total AP Paid Breakdown</h2>
          <p className="text-xs text-slate-500 mt-0.5">ສະຫຼຸບຍອດທີ່ຈ່າຍແລ້ວຕາມ Vendor</p>
        </div>
        <div className="flex items-center gap-2">
          <select 
            value={filters.aging} 
            onChange={e => setFilters({...filters, aging: e.target.value})}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none"
          >
            <option value="">Aging (All)</option>
            <option value="N">0-7 Days</option>
            <option value="0-15 Days">0-15 Days</option>
            <option value="16-30 Days">16-30 Days</option>
            <option value="31-45 Days">31-45 Days</option>
            <option value="46-60+ Days">30+ Days</option>
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
            onClick={() => setFilters({ aging: '', vendor: '', dateFrom: '', dateTo: '' })}
            className="text-xs text-slate-500 hover:text-slate-800 underline"
          >
            Reset
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard label="Total Paid Bills" value={kpis.totalPaidBills} isCount />
        <KpiCard label="Total Paid Amount" value={kpis.totalPaidAmount} color="text-blue-700" />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Total Paid Amount by Vendor (Donut) */}
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <h3 className="font-bold text-slate-700 text-sm mb-4">Total Paid Amount by Vendor</h3>
          {Object.keys(byVendor).length > 0 ? (
            <ReactApexCharts
              options={donutOptions}
              series={Object.values(byVendor).map(v => v.amount)}
              type="donut"
              height={200}
            />
          ) : (
            <div className="h-[200px] flex items-center justify-center text-slate-400 text-sm">ບໍ່ມີຂໍ້ມູນ</div>
          )}
        </div>

        {/* Paid Amount by Vendor & Aging */}
        <div className="bg-white rounded-xl border border-slate-100 p-4 lg:col-span-2">
          <h3 className="font-bold text-slate-700 text-sm mb-4">Paid Amount by Vendor & Aging</h3>
          <ReactApexCharts
            options={{
              ...barChartOptions,
              xaxis: { categories: Object.keys(byVendor) },
            }}
            series={[
              { name: 'Paid Amount', data: Object.values(byVendor).map(v => v.amount) },
            ]}
            type="bar"
            height={180}
          />
        </div>
      </div>

      {/* Paid Amount by Vendor & Aging (Detailed) */}
      <div className="bg-white rounded-xl border border-slate-100 p-4">
        <h3 className="font-bold text-slate-700 text-sm mb-4">Paid Amount by Vendor & Aging (Detailed)</h3>
        <ReactApexCharts
          options={{
            ...agingBarOptions,
            xaxis: { categories: Object.keys(byVendor) },
          }}
          series={Object.entries(byVendor).map(([vendor]) => ({
            name: vendor,
            data: [Object.values(byVendorAging).filter(v => v.vendor === vendor).reduce((s, v) => s + v.amount, 0)]
          }))}
          type="bar"
          height={280}
        />
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
