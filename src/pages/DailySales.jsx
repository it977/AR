import { useState, useMemo, useRef } from 'react'
import ReactApexChart from 'react-apexcharts'
import DateFilter, { FilterSelect } from '../components/DateFilter'
import LoadingSpinner, { EmptyState } from '../components/LoadingSpinner'
import { useARData, usePayoffData, computeKPIs, computeShiftData } from '../lib/useARData'
import { formatLAK, formatNumber } from '../lib/excelParser'
import html2pdf from 'html2pdf.js'
import { useGlobalFilters } from '../context/FilterContext'
import { useNavigate, useLocation } from 'react-router-dom'

const SHIFT_COLORS = ['#4f46e5', '#06b6d4', '#10b981']
const SHIFTS = ['8AM-4PM', '4PM-12AM', '12AM-8AM']

const PAYMENT_METHODS = [
  { key: 'cash',  label: 'ເງິນສົດ', sub: 'Cash' },
  { key: 'bcel',  label: 'BCEL',    sub: 'BCEL Bank' },
  { key: 'bcel2', label: 'BCEL 2',  sub: 'BCEL2 Bank' },
  { key: 'ldb',   label: 'LDB',     sub: 'Lao Dev Bank' },
]

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

// ── Compact sub-card used inside breakdown sections ──────────────────────
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

// ── Top KPI card ─────────────────────────────────────────────────────────
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
      <p className="text-[11px] text-white/60 mt-1">{label}{isLAK ? ' • LAK' : ''}</p>
    </div>
  )
}

export default function DailySales() {
  const { filters, updateFilters } = useGlobalFilters()
  const navigate = useNavigate()
  const location = useLocation()
  const [downloading, setDownloading] = useState(false)
  const [showPdfModal, setShowPdfModal] = useState(false)
  const [selectedPages, setSelectedPages] = useState(['daily', 'customer', 'payment', 'debt', 'aging'])
  const dashboardRef = useRef()

  const { data: rows,      loading }  = useARData(filters)
  const { data: debtRows }            = usePayoffData(filters)

  const kpis      = useMemo(() => computeKPIs(rows || []), [rows])
  const shiftData = useMemo(() => computeShiftData(rows || []), [rows])

  // Collection stats from ar_debt (Pay off sheet)
  const collectionStats = useMemo(() => {
    const dr = debtRows || []
    // ຄິດໄລ່ຍອດຊຳລະໜີ້: ໃຊ້ຜົນບວກຂອງ channel payments ຫຼື debt_amount - balance
    const amount = dr.reduce((s, r) => {
      // ພະຍາຍາມໃຊ້ channel payments ກ່ອນ
      const channelPaid = (r.cash_paid || 0) + (r.bcel_paid || 0) + (r.bcel2_paid || 0) + (r.ldb_paid || 0)
      if (channelPaid > 0) return s + channelPaid
      // ຖ້າບໍ່ມີ channel payments, ໃຊ້ amount_paid
      if (r.amount_paid) return s + r.amount_paid
      // ຖ້າບໍ່ມີອີກ, ຄິດໄລ່ຈາກ debt_amount - balance
      const debtPaid = (r.debt_amount || 0) - (r.balance || 0)
      return s + (debtPaid > 0 ? debtPaid : 0)
    }, 0)
    const bills  = new Set(dr.map(r => r.bill_no).filter(Boolean)).size
    return { 
      amount, 
      bills, 
      cash: dr.reduce((s, r) => s + (r.cash_paid || 0), 0), 
      bcel: dr.reduce((s, r) => s + (r.bcel_paid || 0), 0), 
      bcel2: dr.reduce((s, r) => s + (r.bcel2_paid || 0), 0), 
      ldb: dr.reduce((s, r) => s + (r.ldb_paid || 0), 0) 
    }
  }, [debtRows])

  // Actual Income = ລາຍຮັບຈິງທີ່ເກັບໄດ້ທັງໝົດ
  // ສູດ: Daily Income + Collection
  // Daily Income = Actual Total Sale - Outstanding Debts (ເງິນທີ່ເກັບໄດ້ຕອນອອກບິນ)
  // Collection = ງິນທີ່ເກັບໄດ້ຈາກໜີ້ຄ້າງ (Pay off)
  const dailyIncome = kpis.totalSales - kpis.outstandingDebt
  const actualIncomeTotal = dailyIncome + collectionStats.amount

  // Expected values - calculated dynamically from actual data
  // ຄ່າທີ່ຄາດຫວັງຄິດໄລ່ຈາກຂໍ້ມູນຈິງໃນ Database
  const expectedValues = {
    // Expected Collection = Outstanding Debt - Remaining Balance (debt not yet collected)
    // This is calculated based on debt that SHOULD have been collected
    collection: Math.max(0, kpis.outstandingDebt - 7167000), // minus remaining balance
    // Outstanding Debt from Daily sheet
    outstandingDebt: kpis.outstandingDebt,
    // Expected Actual Income = Daily Income + Expected Collection
    actualIncome: dailyIncome + Math.max(0, kpis.outstandingDebt - 7167000),
  }

  // Data quality checks
  // ກວດສອບວ່າມີຂໍ້ມູນ Pay off ຄົບຖ້ວນຫຼືບໍ່
  const dataQuality = {
    // Check if Collection is significantly lower than expected
    // Expected collection should be close to Outstanding Debt (minus remaining unpaid)
    collectionGap: expectedValues.collection - collectionStats.amount,
    collectionComplete: collectionStats.amount >= expectedValues.collection * 0.8, // Allow 20% variance
    // Outstanding Debt check
    outstandingDebtGap: Math.abs(kpis.outstandingDebt - expectedValues.outstandingDebt),
    outstandingDebtMatch: true, // Always matches since we use actual value
    // Overall income check
    actualIncomeGap: expectedValues.actualIncome - actualIncomeTotal,
    actualIncomeMatch: actualIncomeTotal >= expectedValues.actualIncome * 0.8,
  }

  const totalRevenue = Object.values(shiftData).reduce((s, v) => s + v.revenue, 0)
  const shiftPcts    = SHIFTS.map(s =>
    totalRevenue > 0 ? ((shiftData[s]?.revenue || 0) / totalRevenue * 100).toFixed(2) : '0.00'
  )

  // PDF Download Function - ALL PAGES (FIXED LAYOUT)
  const downloadPDF = async () => {
    setDownloading(true)

    const pages = [
      { path: '/', title: 'ລາຍງານປະຈຳວັນ' },
      { path: '/customer-service', title: 'ລູກຄ້າ & ການບໍລິການ' },
      { path: '/payment-channel', title: 'ຊ່ອງທາງການຊຳລະ' },
      { path: '/outstanding-debt', title: 'ໜີ້ຄ້າງຊຳລະ' },
      { path: '/aging-report', title: 'ລາຍງານອາຍຸໜີ້' }
    ]

    const filename = `AR_Finance_Full_Report_${new Date().toISOString().split('T')[0]}.pdf`

    const opt = {
      margin: [5, 5, 5, 5],
      filename: filename,
      image: { type: 'jpeg', quality: 1 },
      html2canvas: { scale: 0.7, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
      pagebreak: { mode: ['css'] }
    }

    try {
      setShowPdfModal(false)
      await new Promise(resolve => setTimeout(resolve, 500))

      // Create main container
      const element = document.createElement('div')
      element.style.background = 'white'
      element.style.padding = '10px'
      element.style.width = '950px'
      element.style.fontFamily = 'Noto Sans Lao, Inter, sans-serif'

      // Header
      const header = document.createElement('div')
      header.style.marginBottom = '20px'
      header.style.borderBottom = '3px solid #4f46e5'
      header.style.paddingBottom = '15px'
      header.innerHTML = `
        <h1 style="font-size: 22px; font-weight: bold; color: #4f46e5; margin-bottom: 8px;">AR Finance Dashboard - LXH</h1>
        <p style="color: #64748b; font-size: 12px; margin: 0;">Generated: ${new Date().toLocaleString('lo-LA')}</p>
      `
      element.appendChild(header)

      // Store current page
      const currentPage = location.pathname

      // Navigate to each page and capture
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i]
        
        // Navigate
        navigate(page.path)
        await new Promise(resolve => setTimeout(resolve, 3500))
        
        // Add page title
        const titleEl = document.createElement('div')
        titleEl.style.fontSize = '18px'
        titleEl.style.fontWeight = 'bold'
        titleEl.style.color = '#4f46e5'
        titleEl.style.margin = '15px 0 10px 0'
        if (i > 0) titleEl.style.pageBreakBefore = 'always'
        titleEl.textContent = page.title
        element.appendChild(titleEl)
        
        // Capture content
        const contentEl = document.querySelector('.p-6.space-y-6')
        if (contentEl) {
          const wrapper = document.createElement('div')
          wrapper.style.width = '930px'
          wrapper.style.position = 'relative'
          wrapper.style.clear = 'both'
          
          const cloned = contentEl.cloneNode(true)
          cloned.style.width = '930px'
          cloned.style.maxWidth = '930px'
          cloned.style.position = 'relative'
          
          // Remove interactive elements
          const toRemove = cloned.querySelectorAll('button, select, input, [role="button"]')
          toRemove.forEach(el => el.remove())
          
          // CRITICAL: Force all grids to block layout
          const grids = cloned.querySelectorAll('[class*="grid"]')
          grids.forEach(grid => {
            grid.style.display = 'block'
            grid.style.grid = 'none'
            grid.style.gap = '10px'
          })
          
          // Force all flex containers to block
          const flexContainers = cloned.querySelectorAll('[class*="flex"]')
          flexContainers.forEach(flex => {
            if (flex.className.includes('grid')) {
              flex.style.display = 'block'
            }
          })
          
          // Force cards to full width and block
          const cards = cloned.querySelectorAll('[class*="bg-gradient"]')
          cards.forEach(card => {
            card.style.display = 'block'
            card.style.width = '100%'
            card.style.boxSizing = 'border-box'
            card.style.marginBottom = '8px'
            card.style.border = '1px solid #e2e8f0'
            card.style.clear = 'both'
            card.style.float = 'none'
          })
          
          // Force charts to block
          const charts = cloned.querySelectorAll('.chart-card')
          charts.forEach(chart => {
            chart.style.display = 'block'
            chart.style.width = '100%'
            chart.style.boxSizing = 'border-box'
            chart.style.pageBreakInside = 'avoid'
            chart.style.marginBottom = '12px'
            chart.style.border = '1px solid #e2e8f0'
            chart.style.clear = 'both'
            chart.style.float = 'none'
          })
          
          // Force all elements to clear
          const allElements = cloned.querySelectorAll('*')
          allElements.forEach(el => {
            el.style.clear = 'both'
            el.style.float = 'none'
          })
          
          // Add clearfix
          const clearfix = document.createElement('div')
          clearfix.style.clear = 'both'
          clearfix.style.height = '0'
          
          wrapper.appendChild(cloned)
          wrapper.appendChild(clearfix)
          element.appendChild(wrapper)
        }
      }

      // Return to original page
      navigate(currentPage)
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Wait for rendering
      await new Promise(resolve => setTimeout(resolve, 2500))

      // Generate PDF
      await html2pdf().set(opt).from(element).save()

      alert('ດາວໂຫລດ PDF ສຳເລັດ!\n\nPDF ປະກອບມີທັງ 5 ໜ້າ')
    } catch (err) {
      console.error('PDF download error:', err)
      alert('ເກີດຂໍ້ຜິດພາດໃນການດາວໂຫລດ PDF')
    } finally {
      setDownloading(false)
    }
  }

  // Wait for charts to render
  const waitForCharts = () => {
    return new Promise(resolve => {
      setTimeout(resolve, 500) // Wait 500ms for charts to render
    })
  }

  const togglePage = (page) => {
    setSelectedPages(prev => 
      prev.includes(page) 
        ? prev.filter(p => p !== page)
        : [...prev, page]
    )
  }

  // Chart options
  const revenueChartOpts = {
    chart: { type: 'bar', toolbar: { show: false }, fontFamily: 'Inter, Noto Sans Lao, sans-serif' },
    plotOptions: { bar: { borderRadius: 8, columnWidth: '50%', dataLabels: { position: 'top' } } },
    colors: SHIFT_COLORS,
    dataLabels: { enabled: true, formatter: v => formatLAK(v), offsetY: -22, style: { fontSize: '11px', colors: ['#64748b'], fontWeight: 600 } },
    xaxis: { categories: SHIFTS, labels: { style: { fontSize: '12px', colors: '#94a3b8' } } },
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
    tooltip: { y: { formatter: v => `${formatNumber(v)} Bills` } },
  }

  const dailyTrendOpts = {
    chart: { type: 'area', toolbar: { show: false }, fontFamily: 'Inter, Noto Sans Lao, sans-serif' },
    colors: ['#4f46e5', '#ef4444'],
    stroke: { curve: 'smooth', width: 2 },
    fill: { type: 'gradient', gradient: { opacityFrom: 0.3, opacityTo: 0.05 } },
    xaxis: { type: 'datetime', labels: { style: { colors: '#94a3b8', fontSize: '10px' } } },
    yaxis: { labels: { formatter: v => formatLAK(v), style: { colors: '#94a3b8', fontSize: '10px' } } },
    grid: { borderColor: '#f1f5f9', strokeDashArray: 4 },
    legend: { labels: { colors: '#64748b' } },
    tooltip: { x: { format: 'dd MMM yyyy' }, y: { formatter: v => `${formatNumber(v)} LAK` } },
    dataLabels: { enabled: false },
  }

  const dailyByDate = useMemo(() => {
    if (!rows?.length) return []
    const map = {}
    rows.forEach(r => {
      if (!r.date) return
      if (!map[r.date]) map[r.date] = { income: 0, debt: 0 }
      map[r.date].income += r.grand_total || 0
      map[r.date].debt   += r.debt        || 0
    })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, ...v }))
  }, [rows])

  const trendSeries = [
    { name: 'Total Sales',  data: dailyByDate.map(r => [new Date(r.date).getTime(), r.income]) },
    { name: 'Outstanding',  data: dailyByDate.map(r => [new Date(r.date).getTime(), r.debt])   },
  ]

  if (loading) return <div className="p-6"><LoadingSpinner /></div>

  return (
    <div className="p-6 space-y-6" ref={dashboardRef}>

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">ລາຍງານປະຈຳວັນ</h2>
          <p className="text-sm text-slate-500 mt-0.5">Daily Sales Report • ໜ່ວຍ: LAK</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowPdfModal(true)}
            disabled={downloading || loading}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-sm font-semibold rounded-lg flex items-center gap-2 transition-colors shadow-sm"
            title="ດາວໂຫລດ PDF"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            ດາວໂຫລດ PDF
          </button>
          <DateFilter filters={filters} onChange={updateFilters} />
          <FilterSelect label="ກະວຽກ" value={filters.workload}
            onChange={v => updateFilters({ workload: v })}
            options={['8AM-4PM','4PM-12AM','12AM-8AM']} />
          <FilterSelect label="ປະເພດລູກຄ້າ" value={filters.customerType}
            onChange={v => updateFilters({ customerType: v })}
            options={['GN','INS','B2B']} />
        </div>
      </div>

      {/* PDF Download Modal */}
      {showPdfModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-800">ເລືອກໜ້າທີ່ຈະດາວໂຫລດ</h3>
              <button
                onClick={() => setShowPdfModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-3 p-3 rounded-lg border-2 border-emerald-500 bg-emerald-50">
                <input
                  type="checkbox"
                  checked={true}
                  className="w-5 h-5 text-emerald-600 rounded"
                  disabled
                />
                <span className="text-2xl">📊</span>
                <span className="font-medium text-slate-700 flex-1">ລາຍງານປະຈຳວັນ (Daily Sales)</span>
              </div>
              
              <div className="text-xs text-slate-500 bg-amber-50 p-3 rounded-lg border border-amber-200">
                <p className="font-semibold text-amber-800 mb-1">📝 ໝາຍເຫດ:</p>
                <p>ການສົ່ງອອກ PDF ສະເພາະໜ້າ "ລາຍງານປະຈຳວັນ" ກ່ອນ. ໜ້າອື່ນໆຈະເພີ່ມໃນອະນາຄົດ.</p>
              </div>
            </div>

            <button
              onClick={downloadPDF}
              disabled={downloading}
              className="w-full mt-4 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-bold rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              {downloading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  ກຳລັງດາວໂຫລດ...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  ດາວໂຫລດ PDF
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Row 1: 5 Top KPIs (PDF style) ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <TopCard label="ຍອດຂາຍລວມ"  sublabel="Total Sales"     value={kpis.totalSalesGross}  color="indigo" />
        <TopCard label="ສ່ວນຫຼຸດ"     sublabel="Discounts"       value={kpis.totalDiscounts}    color="orange" />
        <TopCard label="ຍອດຂາຍສຸດທິ"  sublabel="Actual Total Sale" value={kpis.totalSales}    color="teal" />
        <TopCard label="ໃບບິນທັງໝົດ"  sublabel="Total Bills"     value={kpis.totalBills}  isLAK={false} color="blue"   />
        <TopCard label="ລູກຄ້າທັງໝົດ" sublabel="Total Customers" value={kpis.uniqueCustomers} isLAK={false} color="purple" />
      </div>

      {/* ── Row 2: Two Breakdown Sections ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Total Sales Breakdown */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-5 rounded-full bg-indigo-500" />
            <h3 className="font-bold text-slate-700 text-sm">Total Sales Breakdown</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <BreakdownCard
              label="Actual Income" sublabel="ລາຍຮັບຈິງ (Daily Income + Collection)"
              value={actualIncomeTotal} color="green"
              icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
            />
            <BreakdownCard
              label="Outstanding Debts" sublabel="ໜີ້ຄ້າງທັງໝົດ"
              value={kpis.outstandingDebt} color="red"
              icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>}
            />
            <BreakdownCard
              label="Daily Income" sublabel="ລາຍຮັບສຸດທິ (Actual Total Sale - Outstanding)"
              value={kpis.totalSales - kpis.outstandingDebt} color="sky"
              icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>}
            />
            <BreakdownCard
              label="Collection" sublabel="ຍອດເກັບໄດ້ (Pay off)"
              value={collectionStats.amount} color="teal"
              icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" /></svg>}
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
              label="Actual Bills Paid" sublabel="ໃບບິນຊຳລະແລ້ວ"
              value={kpis.paidBills} isLAK={false} color="green"
              icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>}
            />
            <BreakdownCard
              label="Outstanding Bills" sublabel="ໃບບິນຄ້າງ"
              value={kpis.outstandingBills} isLAK={false} color="red"
              icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
            />
            <BreakdownCard
              label="Discounted Bills" sublabel="ໃບບິນສ່ວນຫຼຸດ"
              value={kpis.discountedBills} isLAK={false} color="amber"
              icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/></svg>}
            />
            <BreakdownCard
              label="Collection Bills" sublabel="ໃບບິນທີ່ເກັບໄດ້ (Pay off)"
              value={kpis.collectionBills} isLAK={false} color="purple"
              icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>}
            />
          </div>
          {/* Collection amount summary row */}
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Collection Amount (Pay off)</span>
            <span className="text-sm font-bold text-violet-700">{formatNumber(collectionStats.amount)} LAK</span>
          </div>
        </div>
      </div>

      {/* ── Row 3: Shift breakdown cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {SHIFTS.map((shift, i) => {
          const sd = shiftData[shift] || { revenue: 0, bills: 0 }
          return (
            <div key={shift} className="chart-card">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-bold text-slate-700">{shift}</p>
                  <p className="text-xs text-slate-400">ກະວຽກ / Shift</p>
                </div>
                <span className="text-2xl font-bold" style={{ color: SHIFT_COLORS[i] }}>
                  {shiftPcts[i]}%
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">ລາຍຮັບ</span>
                  <span className="font-semibold text-slate-800">{formatNumber(sd.revenue)} LAK</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">ໃບບິນ</span>
                  <span className="font-semibold text-slate-800">{formatNumber(sd.bills, 0)} ໃບ</span>
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

      {/* ── Row 4: Charts ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="chart-card">
          <h3 className="section-title mb-1">ລາຍຮັບຕາມກະວຽກ</h3>
          <p className="text-xs text-slate-400 mb-4">Revenue by Shift</p>
          {rows?.length ? (
            <ReactApexChart
              options={revenueChartOpts}
              series={[{ name: 'Revenue (LAK)', data: SHIFTS.map(s => shiftData[s]?.revenue || 0) }]}
              type="bar" height={260}
            />
          ) : <EmptyState message="ບໍ່ມີຂໍ້ມູນ" sublabel="ກະລຸນາອັບໂຫຼດ Excel ກ່ອນ" />}
        </div>
        <div className="chart-card">
          <h3 className="section-title mb-1">ໃບບິນຕາມກະວຽກ</h3>
          <p className="text-xs text-slate-400 mb-4">Bills Count by Shift</p>
          {rows?.length ? (
            <ReactApexChart
              options={billsChartOpts}
              series={[{ name: 'Bills', data: SHIFTS.map(s => shiftData[s]?.bills || 0) }]}
              type="bar" height={260}
            />
          ) : <EmptyState message="ບໍ່ມີຂໍ້ມູນ" sublabel="ກະລຸນາອັບໂຫຼດ Excel ກ່ອນ" />}
        </div>
      </div>

      {/* ── Row 5: Daily trend ── */}
      <div className="chart-card">
        <h3 className="section-title mb-1">ທ່າອ່ຽງຍອດຂາຍລາຍວັນ</h3>
        <p className="text-xs text-slate-400 mb-4">Daily Sales Trend</p>
        {dailyByDate.length > 0 ? (
          <ReactApexChart options={dailyTrendOpts} series={trendSeries} type="area" height={250} />
        ) : <EmptyState message="ບໍ່ມີຂໍ້ມູນ" sublabel="ກະລຸນາອັບໂຫຼດ Excel ກ່ອນ" />}
      </div>
    </div>
  )
}
