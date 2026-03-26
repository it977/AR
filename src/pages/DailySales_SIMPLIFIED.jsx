import { useState, useMemo, useRef } from 'react'
import ReactApexChart from 'react-apexcharts'
import DateFilter, { FilterSelect } from '../components/DateFilter'
import LoadingSpinner, { EmptyState } from '../components/LoadingSpinner'
import { useARData, usePayoffData, computeKPIs, computeShiftData } from '../lib/useARData'
import { formatLAK, formatNumber } from '../lib/excelParser'
import html2pdf from 'html2pdf.js'
import { useGlobalFilters } from '../context/FilterContext'

const SHIFT_COLORS = ['#4f46e5', '#06b6d4', '#10b981']
const SHIFTS = ['8AM-4PM', '4PM-12AM', '12AM-8AM']

// ... rest of the existing code ...

export default function DailySales() {
  const { filters, updateFilters } = useGlobalFilters()
  const [downloading, setDownloading] = useState(false)
  const [showPdfModal, setShowPdfModal] = useState(false)
  const [selectedPages, setSelectedPages] = useState(['daily', 'customer', 'payment', 'debt', 'aging'])
  const dashboardRef = useRef()

  const { data: rows, loading } = useARData(filters)
  const { data: debtRows } = usePayoffData(filters)

  const kpis = useMemo(() => computeKPIs(rows || []), [rows])
  const shiftData = useMemo(() => computeShiftData(rows || []), [rows])

  // Collection stats from ar_debt (Pay off sheet)
  const collectionStats = useMemo(() => {
    const dr = debtRows || []
    const amount = dr.reduce((s, r) => {
      const channelPaid = (r.cash_paid || 0) + (r.bcel_paid || 0) + (r.bcel2_paid || 0) + (r.ldb_paid || 0)
      if (channelPaid > 0) return s + channelPaid
      if (r.amount_paid) return s + r.amount_paid
      const debtPaid = (r.debt_amount || 0) - (r.balance || 0)
      return s + (debtPaid > 0 ? debtPaid : 0)
    }, 0)
    const bills = new Set(dr.map(r => r.bill_no).filter(Boolean)).size
    return { 
      amount, 
      bills, 
      cash: dr.reduce((s, r) => s + (r.cash_paid || 0), 0), 
      bcel: dr.reduce((s, r) => s + (r.bcel_paid || 0), 0), 
      bcel2: dr.reduce((s, r) => s + (r.bcel2_paid || 0), 0), 
      ldb: dr.reduce((s, r) => s + (r.ldb_paid || 0), 0) 
    }
  }, [debtRows])

  // Actual Income = Daily Income + Collection
  const dailyIncome = kpis.totalSales - kpis.outstandingDebt
  const actualIncomeTotal = dailyIncome + collectionStats.amount

  const totalRevenue = Object.values(shiftData).reduce((s, v) => s + v.revenue, 0)
  const shiftPcts = SHIFTS.map(s =>
    totalRevenue > 0 ? ((shiftData[s]?.revenue || 0) / totalRevenue * 100).toFixed(2) : '0.00'
  )

  // PDF Download Function - SIMPLIFIED
  const downloadPDF = async () => {
    setDownloading(true)

    try {
      setShowPdfModal(false)
      await new Promise(resolve => setTimeout(resolve, 500))

      // Get current page content
      const contentEl = document.querySelector('.p-6.space-y-6')
      if (!contentEl) {
        alert('ບໍ່ພົບຂໍ້ມູນ')
        setDownloading(false)
        return
      }

      // Create clean container
      const element = document.createElement('div')
      element.style.background = 'white'
      element.style.padding = '10px'
      element.style.width = '950px'
      element.style.fontFamily = 'Noto Sans Lao, Inter, sans-serif'

      // Clone content
      const cloned = contentEl.cloneNode(true)
      cloned.style.width = '930px'
      cloned.style.position = 'relative'
      
      // Remove ALL interactive elements
      const toRemove = cloned.querySelectorAll('button, select, input, [role="button"], [class*="filter"]')
      toRemove.forEach(el => el.remove())
      
      // CRITICAL: Force all elements to block layout
      const allElements = cloned.querySelectorAll('*')
      allElements.forEach(el => {
        el.style.cssFloat = 'none'
        el.style.clear = 'both'
        el.style.position = 'relative'
      })
      
      // Force cards to stack vertically
      const cards = cloned.querySelectorAll('[class*="bg-gradient"]')
      cards.forEach(card => {
        card.style.display = 'block'
        card.style.float = 'none'
        card.style.clear = 'both'
        card.style.marginBottom = '10px'
        card.style.border = '1px solid #e2e8f0'
      })
      
      // Force grids to be block
      const grids = cloned.querySelectorAll('[class*="grid"]')
      grids.forEach(grid => {
        grid.style.display = 'block'
        grid.style.grid = 'none'
        grid.style.gap = '10px'
      })
      
      // Style charts
      const charts = cloned.querySelectorAll('.chart-card')
      charts.forEach(chart => {
        chart.style.display = 'block'
        chart.style.pageBreakInside = 'avoid'
        chart.style.marginBottom = '15px'
        chart.style.border = '1px solid #e2e8f0'
        chart.style.clear = 'both'
      })
      
      element.appendChild(cloned)

      const opt = {
        margin: [5, 5, 5, 5],
        filename: `AR_Finance_Report_${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 1 },
        html2canvas: { scale: 0.75, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
        pagebreak: { mode: ['css'] }
      }

      await new Promise(resolve => setTimeout(resolve, 1500))
      await html2pdf().set(opt).from(element).save()

      alert('ດາວໂຫລດ PDF ສຳເລັດ!')
    } catch (err) {
      console.error('PDF download error:', err)
      alert('ເກີດຂໍ້ຜິດພາດໃນການດາວໂຫລດ PDF')
    } finally {
      setDownloading(false)
    }
  }

  // ... rest of existing code ...
