import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
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

const AGING_ORDER = ['N', '0-15 Days', '16-30 Days', '31-45 Days', '46-60+ Days']
const AGAGING_LABELS = { 'N': 'Current', '0-15 Days': '0-15 Days', '16-30 Days': '16-30 Days', '31-45 Days': '31-45 Days', '46-60+ Days': '30+ Days' }

export default function APDashboard() {
  const [loading, setLoading] = useState(true)
  const [apData, setApData] = useState([])
  const [filters, setFilters] = useState({
    status: '',
    department: '',
    vendor: '',
    aging: '',
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
    if (filters.department) q = q.eq('department', filters.department)
    if (filters.vendor) q = q.eq('vendor_name', filters.vendor)
    if (filters.dateFrom) q = q.gte('date', filters.dateFrom)
    if (filters.dateTo) q = q.lte('date', filters.dateTo)
    
    const { data, error } = await q
    if (!error && data) {
      if (filters.aging) {
        const today = new Date()
        const dayAgo = (n) => new Date(today.getTime() - n * 86400000).toISOString().split('T')[0]
        let filtered = data
        if (filters.aging === 'N') filtered = data.filter(r => r.date >= dayAgo(0))
        else if (filters.aging === '0-15 Days') filtered = data.filter(r => r.date >= dayAgo(15))
        else if (filters.aging === '16-30 Days') filtered = data.filter(r => r.date >= dayAgo(30) && r.date < dayAgo(15))
        else if (filters.aging === '31-45 Days') filtered = data.filter(r => r.date >= dayAgo(45) && r.date < dayAgo(30))
        else if (filters.aging === '46-60+ Days') filtered = data.filter(r => r.date < dayAgo(45))
        setApData(filtered)
      } else {
        setApData(data || [])
      }
    }
    setLoading(false)
  }

  // KPIs
  const kpis = useMemo(() => {
    const totalTickets = apData.length
    const totalPOBills = apData.filter(r => r.po_no).length
    const totalAP = apData.reduce((s, r) => s + (r.grand_total || 0), 0)
    const totalPOAmount = apData.filter(r => r.po_no).reduce((s, r) => s + (r.grand_total || 0), 0)
    const apMadeToday = apData.filter(r => r.date === new Date().toISOString().split('T')[0]).length
    
    const outstanding = apData.reduce((s, r) => s + (r.balance || 0), 0)
    const today = new Date().toISOString().split('T')[0]
    const overdueBills = apData.filter(r => r.due_date && r.due_date < today && (r.balance || 0) > 0).length
    const overdueAmount = apData.filter(r => r.due_date && r.due_date < today && (r.balance || 0) > 0)
      .reduce((s, r) => s + (r.balance || 0), 0)

    return { totalTickets, totalPOBills, totalAP, totalPOAmount, apMadeToday, outstanding, overdueBills, overdueAmount }
  }, [apData])

  // By Solved Time (Aging)
  const byAging = useMemo(() => {
    const today = new Date()
    const dayAgo = (n) => new Date(today.getTime() - n * 86400000).toISOString().split('T')[0]
    
    const groups = {
      'N': { bills: 0, amount: 0 },
      '0-15 Days': { bills: 0, amount: 0 },
      '16-30 Days': { bills: 0, amount: 0 },
      '30+ Days': { bills: 0, amount: 0 },
    }
    
    apData.forEach(r => {
      const days = Math.floor((today - new Date(r.date).getTime()) / 86400000)
      let key = '30+ Days'
      if (days <= 0) key = 'N'
      else if (days <= 15) key = '0-15 Days'
      else if (days <= 30) key = '16-30 Days'
      
      groups[key].bills += 1
      groups[key].amount += (r.balance || 0)
    })
    
    return groups
  }, [apData])

  // By Approve Status
  const byStatus = useMemo(() => {
    const groups = {}
    apData.forEach(r => {
      const status = r.status || 'pending'
      if (!groups[status]) groups[status] = { bills: 0, amount: 0 }
      groups[status].bills += 1
      groups[status].amount += (r.grand_total || 0)
    })
    return groups
  }, [apData])

  // By Department
  const byDepartment = useMemo(() => {
    const groups = {}
    apData.forEach(r => {
      const dept = r.department || 'Other'
      if (!groups[dept]) groups[dept] = { bills: 0, amount: 0 }
      groups[dept].bills += 1
      groups[dept].amount += (r.grand_total || 0)
    })
    return groups
  }, [apData])

  // Chart Options
  const chartOptions = {
    chart: { type: 'bar', height: 280, toolbar: { show: false } },
    plotOptions: { bar: { columnWidth: '60%', borderRadius: 4 } },
    dataLabels: { enabled: false },
    stroke: { width: 0 },
    legend: { position: 'top', fontSize: '12px' },
    xaxis: { labels: { style: { fontSize: '11px' } } },
    yaxis: { labels: { formatter: (v) => fmtCompact(v), style: { fontSize: '11px' } } },
    tooltip: { y: { formatter: (v) => fmt(v) } },
    colors: ['#f472b6', '#06b6d4'],
  }

  const statusChartOptions = {
    ...chartOptions,
    colors: ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
  }

  const deptChartOptions = {
    ...chartOptions,
    colors: ['#f472b6', '#06b6d4'],
  }

  if (loading) return <div className="p-6"><LoadingSpinner /></div>

  return (
    <div id="ap-dashboard-content" className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="section-title">Daily AP Summary Dashboard</h2>
          <p className="text-xs text-slate-500 mt-0.5">ຂໍ້ມູນ AP ແບບ real-time</p>
        </div>
        <div className="flex items-center gap-2">
          <select 
            value={filters.status} 
            onChange={e => setFilters({...filters, status: e.target.value})}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none"
          >
            <option value="">Approve Status (All)</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="revised">Revised</option>
          </select>
          <select 
            value={filters.department} 
            onChange={e => setFilters({...filters, department: e.target.value})}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none"
          >
            <option value="">Department (All)</option>
            <option value="Pharmacy">Pharmacy</option>
            <option value="IT Support">IT Support</option>
            <option value="Administration">Administration</option>
            <option value="Lab">Lab</option>
            <option value="Emergency Room">Emergency Room</option>
          </select>
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
            onClick={() => setFilters({ status: '', department: '', vendor: '', aging: '', dateFrom: '', dateTo: '' })}
            className="text-xs text-slate-500 hover:text-slate-800 underline"
          >
            Reset
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <KpiCard label="Total Tickets" value={kpis.totalTickets} isCount />
        <KpiCard label="Total PO Bills" value={kpis.totalPOBills} isCount />
        <KpiCard label="Total AP (Amount)" value={kpis.totalAP} color="text-slate-700" />
        <KpiCard label="Overdue Bills" value={kpis.overdueBills} isCount color="text-red-600" />
        <KpiCard label="AP Made Today" value={kpis.apMadeToday} isCount />
        <KpiCard label="Total PO Amount" value={kpis.totalPOAmount} color="text-cyan-700" />
        <KpiCard label="Total Outstanding" value={kpis.outstanding} color="text-red-600" />
        <KpiCard label="Overdue Amount" value={kpis.overdueAmount} color="text-red-600" />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Bills and Amount by Solved Time */}
        <div className="bg-white rounded-xl border border-slate-100 p-4" key="chart-aged">
          <h3 className="font-bold text-slate-700 text-sm mb-4">Bills and Amount by Solved Time</h3>
          <ReactApexCharts
            options={{
              ...chartOptions,
              xaxis: { categories: Object.keys(byAging).map(k => AGAGING_LABELS[k] || k) },
            }}
            series={[
              { name: 'Bills', data: Object.values(byAging).map(v => v.bills) },
              { name: 'Amount', data: Object.values(byAging).map(v => v.amount) },
            ]}
            type="bar"
            height={280}
          />
        </div>

        {/* Bills and Balance by Aging */}
        <div className="bg-white rounded-xl border border-slate-100 p-4" key="chart-aging">
          <h3 className="font-bold text-slate-700 text-sm mb-4">Bills and Balance by Aging</h3>
          <ReactApexCharts
            options={{
              ...chartOptions,
              xaxis: { categories: Object.keys(byAging).map(k => AGAGING_LABELS[k] || k) },
            }}
            series={[
              { name: 'Bills', data: Object.values(byAging).map(v => v.bills) },
              { name: 'Amount', data: Object.values(byAging).map(v => v.amount) },
            ]}
            type="bar"
            height={280}
          />
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Bills and Actual Amount by Approve Status */}
        <div className="bg-white rounded-xl border border-slate-100 p-4" key="chart-status">
          <h3 className="font-bold text-slate-700 text-sm mb-4">Bills and Actual Amount by Approve Status</h3>
          <ReactApexCharts
            options={{
              ...statusChartOptions,
              xaxis: { categories: Object.keys(byStatus) },
            }}
            series={[
              { name: 'Bills', data: Object.values(byStatus).map(v => v.bills) },
              { name: 'Actual Amount', data: Object.values(byStatus).map(v => v.amount) },
            ]}
            type="bar"
            height={280}
          />
        </div>

        {/* Bills and Total Amount by Department */}
        <div className="bg-white rounded-xl border border-slate-100 p-4" key="chart-dept">
          <h3 className="font-bold text-slate-700 text-sm mb-4">Bills and Total Amount by Department</h3>
          <ReactApexCharts
            options={{
              ...deptChartOptions,
              xaxis: { categories: Object.keys(byDepartment) },
            }}
            series={[
              { name: 'Bills', data: Object.values(byDepartment).map(v => v.bills) },
              { name: 'Total Amount', data: Object.values(byDepartment).map(v => v.amount) },
            ]}
            type="bar"
            height={280}
          />
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Link to="/ap-management" className="bg-primary-50 hover:bg-primary-100 p-4 rounded-xl border border-primary-200 text-center transition-colors">
          <p className="text-xs text-primary-600 font-semibold">AP Management</p>
          <p className="text-2xl font-bold text-primary-700 mt-1">→</p>
        </Link>
        <Link to="/ap-debt" className="bg-emerald-50 hover:bg-emerald-100 p-4 rounded-xl border border-emerald-200 text-center transition-colors">
          <p className="text-xs text-emerald-600 font-semibold">AP Debt Payment</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">→</p>
        </Link>
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
