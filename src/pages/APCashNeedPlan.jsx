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

export default function APCashNeedPlan() {
  const [loading, setLoading] = useState(true)
  const [apData, setApData] = useState([])
  const [filters, setFilters] = useState({
    aging: '',
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
    const today = new Date()
    const day14 = new Date(today.getTime() + 14 * 86400000).toISOString().split('T')[0]
    
    // Urgent = overdue (due_date < today)
    const urgent = apData.filter(r => r.due_date && r.due_date < today.toISOString().split('T')[0])
    const urgentCashNeed = urgent.reduce((s, r) => s + (r.balance || 0), 0)
    
    // Next 14 days
    const next14 = apData.filter(r => r.due_date && r.due_date >= today.toISOString().split('T')[0] && r.due_date <= day14)
    const next14CashNeed = next14.reduce((s, r) => s + (r.balance || 0), 0)
    
    return {
      urgentCashNeed,
      urgentBills: urgent.length,
      next14CashNeed,
      next14Bills: next14.length,
    }
  }, [apData])

  // By Aging (for timeline)
  const byAging = useMemo(() => {
    const today = new Date()
    const groups = { '16-30 Days': { bills: 0, balance: 0 }, '30+ Days': { bills: 0, balance: 0 }, '8-15 Days': { bills: 0, balance: 0 } }
    
    apData.forEach(r => {
      const days = Math.floor((today - new Date(r.date).getTime()) / 86400000)
      let key = '30+ Days'
      if (days <= 15) key = '8-15 Days'
      else if (days <= 30) key = '16-30 Days'
      
      groups[key].bills += 1
      groups[key].balance += (r.balance || 0)
    })
    return groups
  }, [apData])

  // Table data (sorted by due date)
  const tableData = useMemo(() => {
    return [...apData]
      .sort((a, b) => new Date(a.due_date || '9999-12-31') - new Date(b.due_date || '9999-12-31'))
  }, [apData])

  const timelineOptions = {
    chart: { type: 'line', height: 280, toolbar: { show: false } },
    stroke: { curve: 'smooth', width: [3, 0] },
    fill: { type: ['solid', 'solid'], opacity: [1, 0.3] },
    legend: { position: 'top', fontSize: '12px' },
    xaxis: { categories: Object.keys(byAging), labels: { style: { fontSize: '11px' } } },
    yaxis: [{ labels: { formatter: (v) => fmtCompact(v), style: { fontSize: '11px' } } }, { opposite: true, labels: { formatter: (v) => Math.floor(v), style: { fontSize: '11px' } } }],
    tooltip: { y: { formatter: (v) => fmt(v) } },
    colors: ['#f97316', '#bae6fd'],
    markers: { size: 4, colors: ['#f97316'] },
  }

  if (loading) return <div className="p-6"><LoadingSpinner /></div>

  return (
    <div id="ap-cash-plan-content" className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="section-title">Cash Need / Payment Plan</h2>
          <p className="text-xs text-slate-500 mt-0.5">ແຜນການຈ່າຍເງິນ ແລະ ຄວາມຕ້ອງການເງິນສົດ</p>
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
            onClick={() => setFilters({ aging: '', status: '', vendor: '', dateFrom: '', dateTo: '' })}
            className="text-xs text-slate-500 hover:text-slate-800 underline"
          >
            Reset
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Urgent Cash Need" value={kpis.urgentCashNeed} color="text-red-600" />
        <KpiCard label="Bills Urgent Cash Need" value={kpis.urgentBills} isCount color="text-red-600" />
        <KpiCard label="Next 14 Days Cash Need" value={kpis.next14CashNeed} color="text-amber-600" />
        <KpiCard label="Bills Next 14Days Cash Need" value={kpis.next14Bills} isCount color="text-amber-600" />
      </div>

      {/* Cash Need Timeline */}
      <div className="bg-white rounded-xl border border-slate-100 p-4">
        <h3 className="font-bold text-slate-700 text-sm mb-4">Cash Need Timeline</h3>
        <ReactApexCharts
          options={timelineOptions}
          series={[
            { name: 'Balance', type: 'line', data: Object.values(byAging).map(v => v.balance) },
            { name: 'Bills', type: 'bar', data: Object.values(byAging).map(v => v.bills) },
          ]}
          type="line"
          height={280}
        />
      </div>

      {/* Payment Plan Table */}
      <div className="bg-white rounded-xl border border-slate-100 p-4">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left py-3 px-3 text-slate-500 font-semibold">#</th>
                <th className="text-left py-3 px-3 text-slate-500 font-semibold">Due Date</th>
                <th className="text-left py-3 px-3 text-slate-500 font-semibold">Vendor Name</th>
                <th className="text-left py-3 px-3 text-slate-500 font-semibold">Invoice No</th>
                <th className="text-left py-3 px-3 text-slate-500 font-semibold">Status</th>
                <th className="text-left py-3 px-3 text-slate-500 font-semibold">Aging</th>
                <th className="text-right py-3 px-3 text-slate-500 font-semibold">Balance</th>
              </tr>
            </thead>
            <tbody>
              {tableData.map((row, idx) => {
                const isOverdue = row.due_date && row.due_date < new Date().toISOString().split('T')[0]
                return (
                  <tr key={row.id} className={`border-b border-slate-50 hover:bg-slate-50 ${isOverdue ? 'bg-red-50' : ''}`}>
                    <td className="py-3 px-3 text-slate-400">{idx + 1}.</td>
                    <td className={`py-3 px-3 font-medium ${isOverdue ? 'text-red-600' : ''}`}>{row.due_date}</td>
                    <td className="py-3 px-3 font-semibold">{row.vendor_name}</td>
                    <td className="py-3 px-3 font-mono text-primary-600">{row.invoice_no}</td>
                    <td className="py-3 px-3">
                      <span className={`badge ${getStatusColor(row.status)}`}>{row.status}</span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`badge ${getAgingColor(row.aging_group)}`}>{row.aging_group || '30+ Days'}</span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className={`font-mono font-semibold ${isOverdue ? 'text-red-600' : 'text-slate-700'}`}>
                        {fmt(row.balance)}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="text-xs text-slate-400 text-right mt-3">
          1 - {tableData.length} / {apData.length}
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

function getStatusColor(status) {
  const colors = {
    pending: 'bg-amber-100 text-amber-700',
    approved: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-red-100 text-red-700',
    revised: 'bg-violet-100 text-violet-700',
  }
  return colors[status] || 'bg-slate-100 text-slate-600'
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
