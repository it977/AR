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

export default function APOutstandingBreakdown() {
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
      // ກອງສະເພາະທີ່ຍັງຄ້າງຈ່າຍ
      const outstanding = data.filter(r => (r.balance || 0) > 0)
      if (filters.aging) {
        const today = new Date()
        const dayAgo = (n) => new Date(today.getTime() - n * 86400000).toISOString().split('T')[0]
        let filtered = outstanding
        if (filters.aging === 'N') filtered = outstanding.filter(r => r.date >= dayAgo(0))
        else if (filters.aging === '0-15 Days') filtered = outstanding.filter(r => r.date >= dayAgo(15))
        else if (filters.aging === '16-30 Days') filtered = outstanding.filter(r => r.date >= dayAgo(30) && r.date < dayAgo(15))
        else if (filters.aging === '31-45 Days') filtered = outstanding.filter(r => r.date >= dayAgo(45) && r.date < dayAgo(30))
        else if (filters.aging === '46-60+ Days') filtered = outstanding.filter(r => r.date < dayAgo(45))
        setApData(filtered)
      } else {
        setApData(outstanding)
      }
    }
    setLoading(false)
  }

  // KPIs
  const kpis = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    const totalOutstandingBills = apData.length
    const totalOutstandingBalance = apData.reduce((s, r) => s + (r.balance || 0), 0)
    const overdueBills = apData.filter(r => r.due_date && r.due_date < today).length
    const overdueBalance = apData.filter(r => r.due_date && r.due_date < today).reduce((s, r) => s + (r.balance || 0), 0)
    
    return { totalOutstandingBills, totalOutstandingBalance, overdueBills, overdueBalance }
  }, [apData])

  // By Vendor
  const byVendor = useMemo(() => {
    const groups = {}
    apData.forEach(r => {
      const vendor = r.vendor_name || 'Other'
      if (!groups[vendor]) groups[vendor] = { outstanding: 0, bills: 0 }
      groups[vendor].outstanding += (r.balance || 0)
      groups[vendor].bills += 1
    })
    return groups
  }, [apData])

  // By Aging
  const byAging = useMemo(() => {
    const today = new Date()
    const groups = { '0-15 Days': { bills: 0, amount: 0 }, '16-30 Days': { bills: 0, amount: 0 }, '30+ Days': { bills: 0, amount: 0 } }
    
    apData.forEach(r => {
      const days = Math.floor((today - new Date(r.date).getTime()) / 86400000)
      let key = '30+ Days'
      if (days <= 15) key = '0-15 Days'
      else if (days <= 30) key = '16-30 Days'
      
      groups[key].bills += 1
      groups[key].amount += (r.balance || 0)
    })
    return groups
  }, [apData])

  // Outstanding Detail (table data)
  const outstandingDetail = useMemo(() => {
    return [...apData]
      .sort((a, b) => (b.balance || 0) - (a.balance || 0))
      .slice(0, 10)
  }, [apData])

  const vendorBarOptions = {
    chart: { type: 'bar', height: 320, toolbar: { show: false } },
    plotOptions: { bar: { horizontal: true, columnWidth: '60%', borderRadius: 4 } },
    dataLabels: { enabled: false },
    stroke: { width: 0 },
    legend: { position: 'top', fontSize: '12px' },
    xaxis: { labels: { formatter: (v) => fmtCompact(v), style: { fontSize: '11px' } } },
    yaxis: { labels: { style: { fontSize: '11px' } } },
    tooltip: { y: { formatter: (v) => fmt(v) } },
    colors: ['#fda4af', '#3b82f6'],
  }

  const agingChartOptions = {
    chart: { type: 'bar', height: 200, toolbar: { show: false } },
    plotOptions: { bar: { columnWidth: '60%', borderRadius: 4 } },
    dataLabels: { enabled: false },
    stroke: { width: 2, curve: 'smooth' },
    legend: { position: 'top', fontSize: '12px' },
    xaxis: { categories: Object.keys(byAging), labels: { style: { fontSize: '11px' } } },
    yaxis: [{ labels: { formatter: (v) => fmtCompact(v), style: { fontSize: '11px' } } }, { opposite: true, labels: { formatter: (v) => Math.floor(v), style: { fontSize: '11px' } } }],
    tooltip: { y: { formatter: (v) => fmt(v) } },
    colors: ['#f97316', '#06b6d4'],
  }

  if (loading) return <div className="p-6"><LoadingSpinner /></div>

  return (
    <div id="ap-outstanding-content" className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="section-title">Total Outstanding AP Breakdown</h2>
          <p className="text-xs text-slate-500 mt-0.5">ສະຫຼຸບຍອດຄ້າງຈ່າຍທີ່ຍັງບໍ່ທັນຊຳລະ</p>
        </div>
        <div className="flex items-center gap-2">
          <select 
            value={filters.aging} 
            onChange={e => setFilters({...filters, aging: e.target.value})}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none"
          >
            <option value="">Aging (All)</option>
            <option value="N">Current</option>
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Total Outstanding Bills" value={kpis.totalOutstandingBills} isCount color="text-red-600" />
        <KpiCard label="Total Outstanding Balance" value={kpis.totalOutstandingBalance} color="text-red-600" />
        <KpiCard label="Total Overdue Bills" value={kpis.overdueBills} isCount color="text-amber-600" />
        <KpiCard label="Total Overdue Balance" value={kpis.overdueBalance} color="text-amber-600" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Outstanding Amount and Bills by Vendor Name */}
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <h3 className="font-bold text-slate-700 text-sm mb-4">Outstanding Amount and Bills by Vendor Name</h3>
          <ReactApexCharts
            options={{
              ...vendorBarOptions,
              xaxis: { categories: Object.keys(byVendor) },
            }}
            series={[
              { name: 'Outstanding Amount', data: Object.values(byVendor).map(v => v.outstanding) },
              { name: 'Bills', data: Object.values(byVendor).map(v => v.bills) },
            ]}
            type="bar"
            height={320}
          />
        </div>

        <div className="space-y-5">
          {/* Outstanding Amount and Bills by Aging */}
          <div className="bg-white rounded-xl border border-slate-100 p-4">
            <h3 className="font-bold text-slate-700 text-sm mb-4">Outstanding Amount and Bills by Aging</h3>
            <ReactApexCharts
              options={agingChartOptions}
              series={[
                { name: 'Bills', type: 'column', data: Object.values(byAging).map(v => v.bills) },
                { name: 'Outstanding Amount', type: 'line', data: Object.values(byAging).map(v => v.amount) },
              ]}
              type="bar"
              height={200}
            />
          </div>

          {/* Outstanding Detail Table */}
          <div className="bg-white rounded-xl border border-slate-100 p-4">
            <h3 className="font-bold text-slate-700 text-sm mb-3">Outstanding Detail</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 px-2 text-slate-500">#</th>
                    <th className="text-left py-2 px-2 text-slate-500">Vendors</th>
                    <th className="text-left py-2 px-2 text-slate-500">Invoice No</th>
                    <th className="text-left py-2 px-2 text-slate-500">Due Date</th>
                    <th className="text-left py-2 px-2 text-slate-500">Aging</th>
                    <th className="text-right py-2 px-2 text-slate-500">Outstanding Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {outstandingDetail.map((row, idx) => (
                    <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="py-2 px-2 text-slate-400">{idx + 1}.</td>
                      <td className="py-2 px-2 font-medium">{row.vendor_name}</td>
                      <td className="py-2 px-2 font-mono text-primary-600">{row.invoice_no}</td>
                      <td className="py-2 px-2">{row.due_date}</td>
                      <td className="py-2 px-2">
                        <span className={`badge ${getAgingColor(row.aging_group)}`}>{row.aging_group || '30+ Days'}</span>
                      </td>
                      <td className="py-2 px-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="font-mono font-semibold text-red-600">{fmtCompact(row.balance)}</span>
                          <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-500 rounded-full" 
                              style={{ width: `${Math.min(100, (row.balance / kpis.totalOutstandingBalance) * 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="text-xs text-slate-400 text-right mt-2">1 - {outstandingDetail.length} / {apData.length}</div>
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

function getAgingColor(aging) {
  const colors = {
    'N': 'bg-slate-100 text-slate-600',
    '0-15 Days': 'bg-emerald-100 text-emerald-700',
    '16-30 Days': 'bg-yellow-100 text-yellow-700',
    '31-45 Days': 'bg-orange-100 text-orange-700',
    '46-60+ Days': 'bg-red-100 text-red-700',
  }
  return colors[aging] || 'bg-slate-100 text-slate-600'
}
