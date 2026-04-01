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

export default function APPOBreakdown() {
  const [loading, setLoading] = useState(true)
  const [apData, setApData] = useState([])
  const [filters, setFilters] = useState({
    status: '',
    department: '',
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
    if (filters.department) q = q.eq('department', filters.department)
    if (filters.vendor) q = q.eq('vendor_name', filters.vendor)
    if (filters.dateFrom) q = q.gte('date', filters.dateFrom)
    if (filters.dateTo) q = q.lte('date', filters.dateTo)
    
    const { data, error } = await q
    if (!error && data) setApData(data)
    setLoading(false)
  }

  // KPIs
  const kpis = useMemo(() => {
    const totalPOBills = apData.filter(r => r.po_no).length
    const totalPOAmount = apData.filter(r => r.po_no).reduce((s, r) => s + (r.grand_total || 0), 0)
    const approved = apData.filter(r => r.status === 'approved').length
    const revised = apData.filter(r => r.status === 'revised').length
    const pending = apData.filter(r => r.status === 'pending').length
    const rejected = apData.filter(r => r.status === 'rejected').length
    
    return { totalPOBills, totalPOAmount, approved, revised, pending, rejected }
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

  // By Vendor
  const byVendor = useMemo(() => {
    const groups = {}
    apData.forEach(r => {
      const vendor = r.vendor_name || 'Other'
      if (!groups[vendor]) groups[vendor] = { bills: 0, amount: 0 }
      groups[vendor].bills += 1
      groups[vendor].amount += (r.grand_total || 0)
    })
    return groups
  }, [apData])

  // PO Approval Status by Department
  const poByDeptStatus = useMemo(() => {
    const groups = {}
    apData.filter(r => r.po_no).forEach(r => {
      const dept = r.department || 'Other'
      if (!groups[dept]) groups[dept] = { bills: 0, amount: 0 }
      groups[dept].bills += 1
      groups[dept].amount += (r.grand_total || 0)
    })
    return groups
  }, [apData])

  // Revised PO by Vendor
  const revisedByVendor = useMemo(() => {
    const groups = {}
    apData.filter(r => r.status === 'revised').forEach(r => {
      const vendor = r.vendor_name || 'Other'
      if (!groups[vendor]) groups[vendor] = { bills: 0, amount: 0 }
      groups[vendor].bills += 1
      groups[vendor].amount += (r.grand_total || 0)
    })
    return groups
  }, [apData])

  const chartOptions = {
    chart: { type: 'bar', height: 280, toolbar: { show: false } },
    plotOptions: { bar: { columnWidth: '60%', borderRadius: 4 } },
    dataLabels: { enabled: false },
    stroke: { width: 0 },
    legend: { position: 'top', fontSize: '12px' },
    xaxis: { labels: { style: { fontSize: '11px' } } },
    yaxis: { labels: { formatter: (v) => fmtCompact(v), style: { fontSize: '11px' } } },
    tooltip: { y: { formatter: (v) => fmt(v) } },
    colors: ['#e11d48', '#06b6d4'],
  }

  const vendorChartOptions = {
    ...chartOptions,
    colors: ['#2563eb', '#c084fc'],
  }

  if (loading) return <div className="p-6"><LoadingSpinner /></div>

  return (
    <div id="ap-po-content" className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="section-title">Total PO Breakdown</h2>
          <p className="text-xs text-slate-500 mt-0.5">ສະຫຼຸບຍອດ PO ຕາມພະແນກ ແລະ Vendor</p>
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
          <input 
            type="text" 
            placeholder="Vendor..."
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
            onClick={() => setFilters({ status: '', department: '', vendor: '', dateFrom: '', dateTo: '' })}
            className="text-xs text-slate-500 hover:text-slate-800 underline"
          >
            Reset
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Total PO Bills" value={kpis.totalPOBills} isCount />
        <KpiCard label="Total PO Amount" value={kpis.totalPOAmount} color="text-cyan-700" />
        <KpiCard label="Bills PO Approve" value={kpis.approved} isCount color="text-emerald-600" />
        <KpiCard label="Bills PO Revised" value={kpis.revised} isCount color="text-violet-600" />
        <KpiCard label="Bills PO Pending" value={kpis.pending} isCount color="text-amber-600" />
        <KpiCard label="Bills PO Reject" value={kpis.rejected} isCount color="text-red-600" />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* PO Amount & Bills by Department */}
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <h3 className="font-bold text-slate-700 text-sm mb-4">PO Amount & Bills by Department</h3>
          <ReactApexCharts
            options={{
              ...chartOptions,
              xaxis: { categories: Object.keys(byDepartment) },
            }}
            series={[
              { name: 'Bills', data: Object.values(byDepartment).map(v => v.bills) },
              { name: 'Actual Amount', data: Object.values(byDepartment).map(v => v.amount) },
            ]}
            type="bar"
            height={280}
          />
        </div>

        {/* Total PO Amount by Vendor */}
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <h3 className="font-bold text-slate-700 text-sm mb-4">Total PO Amount by Vendor</h3>
          <ReactApexCharts
            options={{
              ...vendorChartOptions,
              xaxis: { categories: Object.keys(byVendor) },
            }}
            series={[
              { name: 'Bills', data: Object.values(byVendor).map(v => v.bills) },
              { name: 'Actual Amount', data: Object.values(byVendor).map(v => v.amount) },
            ]}
            type="bar"
            height={280}
          />
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* PO Approval Status by Department */}
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <h3 className="font-bold text-slate-700 text-sm mb-4">PO Approval Status by Department</h3>
          <ReactApexCharts
            options={{
              ...chartOptions,
              xaxis: { categories: Object.keys(poByDeptStatus) },
            }}
            series={[
              { name: 'Bills', data: Object.values(poByDeptStatus).map(v => v.bills) },
              { name: 'Actual Amount', data: Object.values(poByDeptStatus).map(v => v.amount) },
            ]}
            type="bar"
            height={280}
          />
        </div>

        {/* Revised PO by Vendor */}
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <h3 className="font-bold text-slate-700 text-sm mb-4">Revised PO by Vendor</h3>
          <ReactApexCharts
            options={{
              ...vendorChartOptions,
              xaxis: { categories: Object.keys(revisedByVendor) },
            }}
            series={[
              { name: 'Bills', data: Object.values(revisedByVendor).map(v => v.bills) },
              { name: 'Actual Amount', data: Object.values(revisedByVendor).map(v => v.amount) },
            ]}
            type="bar"
            height={280}
          />
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
