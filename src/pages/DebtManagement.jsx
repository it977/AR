import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { logAction } from '../lib/log'
import Modal, { ConfirmDialog, ConfirmCodeDialog } from '../components/Modal'
import DebtPaymentForm from '../components/forms/DebtPaymentForm'
import BillForm from '../components/forms/BillForm'
import Can from '../components/Can'
import { PERMISSIONS } from '../lib/rbac'
import { parseExcelFile } from '../lib/excelParser'
import { upsertRows, syncDebtStatus } from '../lib/excelUpload'

const PAYOFF_HEADERS = [
  'Date','Week','Workload','Bill No','Insite-Onsite','OPD-IPD',
  'Customer Type Code','Insurance','HN','Customer Name','Gender',
  'Grand Total','Outstanding Debt','Date Paid','Workload Debt','Submission Date',
  'Amount Paid','Cash Received Debt','Transfer Payment by BCEL Debt',
  'Transfer Payment by BCEL 2 Debt','Transfer Payment by LDB Debt',
  'Balance','Due date',
  'Payment 1 Date','Payment 1 Method','Payment 1 Amount',
  'Payment 2 Date','Payment 2 Method','Payment 2 Amount',
  'Payment 3 Date','Payment 3 Method','Payment 3 Amount',
  'Aging Group',
]
const SAMPLE_PAYOFF = [
  [new Date(2026, 0, 1),'Week 1','8AM-4PM','BILL-INS001','Insite','OPD','INS','APA','HN002','ນາງສີ','Female',
   500000,500000,new Date(2026, 0, 10),'',new Date(2026, 0, 10),200000,0,200000,0,0,300000,new Date(2026, 1, 9),
   new Date(2026, 0, 10),'bcel',200000,'','','','','','Current Receivables'],
]
// Columns in PAYOFF_HEADERS that should be formatted as dates
const PAYOFF_DATE_COLS = ['Date','Date Paid','Submission Date','Due date','Payment 1 Date','Payment 2 Date','Payment 3 Date']
function downloadDebtTemplate() {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([PAYOFF_HEADERS, ...SAMPLE_PAYOFF], { cellDates: true })
  ws['!cols'] = PAYOFF_HEADERS.map((h) => ({ wch: PAYOFF_DATE_COLS.includes(h) ? 12 : 18 }))
  // Apply DD/MM/YYYY format to all date columns in the sample row
  PAYOFF_DATE_COLS.forEach(h => {
    const idx = PAYOFF_HEADERS.indexOf(h)
    if (idx < 0) return
    const addr = XLSX.utils.encode_cell({ r: 1, c: idx })
    if (ws[addr]) ws[addr].z = 'dd/mm/yyyy'
  })
  XLSX.utils.book_append_sheet(wb, ws, 'Pay off')
  XLSX.writeFile(wb, 'AR_Debt_Template_LXH.xlsx')
}
import {
  AGING_GROUPS,
  COLLECTION_TERMS,
  DEFAULT_DUE_DAYS,
  calcAging,
  calcOverdueDays,
  calcDueDate,
  computeCollectionTermSummary,
  getCollectionStatus,
  getDebtCollectedAmount,
  getAgingLabel,
  resolvePaymentStatus,
  statusBadgeClass,
  todayIso,
  toNumber,
} from '../lib/debtUtils'

function fmt(v) { return new Intl.NumberFormat().format(v || 0) }
function dateOnly(value) {
  if (!value) return ''
  const text = String(value)
  const match = text.match(/\d{4}-\d{2}-\d{2}/)
  if (match) return match[0]
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}
function getPaidAmount(row = {}) {
  const direct = getDebtCollectedAmount(row)
  if (direct > 0) return direct
  const debtDelta = toNumber(row.debt_amount) - toNumber(row.balance)
  if (debtDelta > 0) return debtDelta
  if (toNumber(row.balance) <= 0) return toNumber(row.debt_amount) || toNumber(row.grand_total)
  return 0
}
function getDebtPaymentChannels(row = {}) {
  return [
    { label: 'Cash', amount: toNumber(row.cash_paid), className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    { label: 'BCEL1', amount: toNumber(row.bcel_paid), className: 'bg-red-50 text-red-700 border-red-200' },
    { label: 'BCEL2', amount: toNumber(row.bcel2_paid), className: 'bg-rose-50 text-rose-700 border-rose-200' },
    { label: 'LDB', amount: toNumber(row.ldb_paid), className: 'bg-sky-50 text-sky-700 border-sky-200' },
  ].filter(channel => channel.amount > 0)
}

const AGING_COLOR = {
  'Current Receivables': 'bg-sky-100 text-sky-700',
  '1-15 Days':  'bg-emerald-100 text-emerald-700',
  '16-30 Days': 'bg-yellow-100 text-yellow-700',
  '31-45 Days': 'bg-orange-100 text-orange-700',
  '46-90 Days':'bg-red-100 text-red-700',
}
const AGING_SHORT = {
  'Current Receivables': 'Current',
  '1-15 Days': '1-15d',
  '16-30 Days': '16-30d',
  '31-45 Days': '31-45d',
  '46-90 Days': '46-90d',
}
const STATUS_SHORT = {
  pending_submission: 'Submit',
  pending_payment: 'Pending',
  denied: 'Denied',
  outstanding: 'Outstanding',
  current: 'Current',
  past_due: 'Overdue',
  paid: 'Paid',
}
const COLLECTION_STATUS_OPTIONS = [
  ...COLLECTION_TERMS.map(term => ({ value: term.key, label: term.label })),
  { value: 'paid', label: 'ຊຳລະແລ້ວ' },
]
const actionThCls = 'table-th sticky right-0 z-20 bg-slate-50 text-center shadow-[-10px_0_18px_-16px_rgba(15,23,42,0.45)]'
const actionTdCls = 'table-td sticky right-0 z-10 bg-white group-hover:bg-slate-50 shadow-[-10px_0_18px_-16px_rgba(15,23,42,0.45)]'

async function fetchAllDebtRows(buildQuery) {
  const PAGE = 1000
  let all = []
  let from = 0
  let expectedTotal = null

  while (true) {
    const { data, count, error } = await buildQuery(from, from + PAGE - 1)
    if (error) throw error
    if (expectedTotal === null) expectedTotal = count ?? 0
    if (data?.length) all = all.concat(data)
    if (!data?.length || all.length >= expectedTotal || data.length < PAGE) break
    from += PAGE
  }

  return all
}

function matchesAgingFilter(row, aging, insuranceDueDays = {}) {
  if (!aging) return true
  if (toNumber(row.balance) <= 0) return false
  const dueDate = row.due_date || calcDueDate(row.submit_date || row.date, insuranceDueDays, row.insurance)
  return calcAging({ ...row, due_date: dueDate, insuranceDueDays }) === aging
}

function collectionStatusBadgeClass(key) {
  if (key === 'denied') return 'bg-rose-100 text-rose-700 border border-rose-200'
  if (key === 'paid') return 'bg-emerald-100 text-emerald-700 border border-emerald-200'
  if (key === 'pending_submission') return 'bg-slate-100 text-slate-700 border border-slate-200'
  if (key === 'past_due') return 'bg-red-100 text-red-700 border border-red-200'
  if (key === 'pending_payment') return 'bg-sky-100 text-sky-700 border border-sky-200'
  return 'bg-slate-100 text-slate-700 border border-slate-200'
}

function applyDebtQueryFilters(query, filters) {
  const {
    search,
    statusFilter,
    paymentTypeFilter,
    insuranceFilter,
    dateFrom,
    dateTo,
    paidDateFrom,
    paidDateTo,
  } = filters

  query = query.eq('customer_type', 'INS')
  if (search) query = query.or(`bill_no.ilike.%${search}%,patient_name.ilike.%${search}%`)
  const today = todayIso()
  if (statusFilter === 'pending_submission') query = query.gt('balance', 0).is('submit_date', null)
  if (statusFilter === 'pending_payment') query = query.gt('balance', 0).not('submit_date', 'is', null)
  if (statusFilter === 'denied') query = query.or('note.ilike.%denied%,note.ilike.%reject%,note.ilike.%rejected%,note.ilike.%ປະຕິເສດ%')
  if (statusFilter === 'outstanding') query = query.gt('balance', 0)
  if (statusFilter === 'current') query = query.gt('balance', 0).or(`due_date.is.null,due_date.gte.${today}`)
  if (statusFilter === 'past_due') query = query.gt('balance', 0).lt('due_date', today)
  if (statusFilter === 'paid') query = query.lte('balance', 0)
  if (paymentTypeFilter) query = query.eq('payment_type', paymentTypeFilter)
  if (insuranceFilter) query = query.eq('insurance', insuranceFilter)
  if (dateFrom) query = query.gte('date', dateFrom)
  if (dateTo) query = query.lte('date', dateTo)
  if (paidDateFrom) query = query.gte('date_paid', paidDateFrom)
  if (paidDateTo) query = query.lte('date_paid', paidDateTo)
  return query
}

function buildDebtExportRow(row, insuranceDueDays, index) {
  const debt = toNumber(row.balance)
  const dueDate = row.due_date || calcDueDate(row.submit_date || row.date, insuranceDueDays, row.insurance)
  const agingRow = { ...row, due_date: dueDate, insuranceDueDays }
  const collectionStatus = getCollectionStatus(agingRow, insuranceDueDays)
  const paymentStatus = resolvePaymentStatus(agingRow)
  const currentAging = calcAging(agingRow)
  const paymentChannels = getDebtPaymentChannels(row)
    .map(channel => `${channel.label}: ${fmt(channel.amount)}`)
    .join(' / ')

  return {
    '#': index + 1,
    'Bill No': row.bill_no || '',
    'Bill Date': row.date || '',
    'Paid Date': row.date_paid || '',
    'Patient Name': row.patient_name || '',
    'Customer Type': row.customer_type || '',
    Insurance: row.insurance || '',
    'Grand Total': toNumber(row.grand_total),
    'Outstanding Debt': debt,
    'Payment Channels': paymentChannels,
    'Submission Date': row.submit_date || '',
    'Due Date': dueDate || '',
    'Overdue Days': calcOverdueDays(agingRow),
    Aging: getAgingLabel(currentAging),
    Status: collectionStatus?.label || paymentStatus || (debt <= 0 ? 'Paid' : 'Due'),
  }
}

const TERM_CARD_STYLE = {
  pending_submission: {
    box: 'border-slate-200 bg-white hover:bg-slate-50',
    active: 'border-slate-400 bg-slate-50',
    icon: 'bg-slate-100 text-slate-600',
    count: 'text-slate-800',
  },
  pending_payment: {
    box: 'border-sky-100 bg-sky-50/70 hover:bg-sky-50',
    active: 'border-sky-300 bg-sky-50',
    icon: 'bg-sky-100 text-sky-700',
    count: 'text-sky-700',
  },
  denied: {
    box: 'border-rose-100 bg-rose-50/70 hover:bg-rose-50',
    active: 'border-rose-300 bg-rose-50',
    icon: 'bg-rose-100 text-rose-700',
    count: 'text-rose-700',
  },
  outstanding: {
    box: 'border-amber-100 bg-amber-50/70 hover:bg-amber-50',
    active: 'border-amber-300 bg-amber-50',
    icon: 'bg-amber-100 text-amber-700',
    count: 'text-amber-700',
  },
  current: {
    box: 'border-emerald-100 bg-emerald-50/70 hover:bg-emerald-50',
    active: 'border-emerald-300 bg-emerald-50',
    icon: 'bg-emerald-100 text-emerald-700',
    count: 'text-emerald-700',
  },
  past_due: {
    box: 'border-red-100 bg-red-50/70 hover:bg-red-50',
    active: 'border-red-300 bg-red-50',
    icon: 'bg-red-100 text-red-700',
    count: 'text-red-700',
  },
  paid_today: {
    box: 'border-violet-100 bg-violet-50/70 hover:bg-violet-50',
    active: 'border-violet-300 bg-violet-50',
    icon: 'bg-violet-100 text-violet-700',
    count: 'text-violet-700',
  },
}

function TermIcon({ keyName }) {
  const base = 'w-4 h-4'
  if (keyName === 'pending_submission') return (
    <svg className={base} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6M7 3h6l5 5v13H7a2 2 0 01-2-2V5a2 2 0 012-2z" />
    </svg>
  )
  if (keyName === 'pending_payment') return (
    <svg className={base} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-2.21 0-4 .9-4 2s1.79 2 4 2 4 .9 4 2-1.79 2-4 2m0-10v2m0 8v2M4 6h16M4 20h16" />
    </svg>
  )
  if (keyName === 'denied') return (
    <svg className={base} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M4.93 4.93l14.14 14.14M12 3a9 9 0 019 9 8.96 8.96 0 01-2.64 6.36M6.34 18.36A9 9 0 0112 3" />
    </svg>
  )
  if (keyName === 'outstanding') return (
    <svg className={base} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16l-3-2-3 2-3-2-3 2z" />
    </svg>
  )
  if (keyName === 'current') return (
    <svg className={base} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3M5 11h14M6 21h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
  if (keyName === 'paid_today') return (
    <svg className={base} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  )
  return (
    <svg className={base} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function ChannelStrip({ label, metric, color }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-1 rounded-md border border-slate-100 bg-white px-1.5 py-0.5">
      <div className="flex min-w-0 items-center gap-0.5">
        <span className={`h-2 w-2 shrink-0 rounded-full ${color}`} />
        <span className="shrink-0 text-[8px] font-bold leading-tight text-slate-500">{label}</span>
      </div>
      <div className="flex min-w-0 flex-col items-end justify-center">
        <span className="truncate font-mono text-[8px] font-bold leading-tight text-slate-800">{fmt(metric.amount)}</span>
        <span className="shrink-0 text-[7px] leading-tight text-slate-400">{fmt(metric.bills)} Bills</span>
      </div>
    </div>
  )
}

export default function DebtManagement() {
  const [rows, setRows]       = useState([])
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(0)
  const [pageSize, setPageSize] = useState(50)  // ເພີ່ມ: ເລືອກຈຳນວນແຖວ
  const [loading, setLoading] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [exporting, setExporting] = useState(false)

  const [search, setSearch]     = useState('')
  const [aging, setAging]       = useState('')
  const [statusFilter, setStatusFilter] = useState('')  // Collection workflow status
  const [paymentTypeFilter, setPaymentTypeFilter] = useState('')
  const [insuranceFilter, setInsuranceFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')
  const [paidDateFrom, setPaidDateFrom] = useState('')
  const [paidDateTo, setPaidDateTo]     = useState('')

  const [modal, setModal]         = useState(null)
  const [editModal, setEditModal] = useState(null)
  const [viewModal, setViewModal] = useState(null)
  const [delTarget, setDelTarget] = useState(null)
  const [delAll, setDelAll]       = useState(false)

  const fileRef = useRef(null)
  const [uploadState, setUploadState] = useState(null)
  const [mismatchDialog, setMismatchDialog] = useState(null)

  const [collectionSummary, setCollectionSummary] = useState(() => computeCollectionTermSummary([]))
  const [paidSummary, setPaidSummary] = useState({
    bills: 0,
    amount: 0,
    channels: {
      cash: { amount: 0, bills: 0 },
      bcel: { amount: 0, bills: 0 },
      bcel2: { amount: 0, bills: 0 },
      ldb: { amount: 0, bills: 0 },
    },
  })
  const [outstandingSummary, setOutstandingSummary] = useState({ bills: 0, amount: 0 })
  const [insuranceDueDays, setInsuranceDueDays] = useState({})

  const insuranceOptions = useMemo(
    () => [...new Set(Object.keys(insuranceDueDays).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b)),
    [insuranceDueDays],
  )

  const fetchInsuranceDueDays = useCallback(async () => {
    const { data, error } = await supabase.from('ar_insurance_list').select('name,due_days')
    if (error) {
      const fallback = await supabase.from('ar_insurance_list').select('name')
      setInsuranceDueDays(Object.fromEntries((fallback.data || []).map(item => [item.name, DEFAULT_DUE_DAYS])))
      return
    }
    setInsuranceDueDays(Object.fromEntries((data || []).map(item => [item.name, item.due_days || DEFAULT_DUE_DAYS])))
  }, [])

  const fetchKpis = useCallback(async () => {
    // ດຶງຂໍ້ມູນຈາກ ar_debt (Pay off)
    async function fetchAll(buildQuery) {
      const PAGE = 1000
      let all = [], from = 0, total = null
      while (true) {
        const { data, count, error } = await buildQuery(from, from + PAGE - 1)
        if (error) throw error
        if (total === null && count != null) total = count
        if (data?.length) all = all.concat(data)
        if (!data?.length || all.length >= (total ?? Infinity) || data.length < PAGE) break
        from += PAGE
      }
      return all
    }

    const summaryColumns = 'id,bill_no,date,insurance,note,submit_date,due_date,balance,debt_amount,grand_total,date_paid,amount_paid,cash_paid,bcel_paid,bcel2_paid,ldb_paid'
    const fallbackColumns = 'id,bill_no,date,insurance,submit_date,due_date,balance,debt_amount,grand_total,date_paid,amount_paid,cash_paid,bcel_paid,bcel2_paid,ldb_paid'
    let debtData = []
    try {
      debtData = await fetchAll((f, t) =>
        supabase.from('ar_debt').select(summaryColumns, { count: 'exact' }).eq('customer_type', 'INS').range(f, t)
      )
    } catch (err) {
      if (!String(err.message || '').includes('note')) throw err
      debtData = await fetchAll((f, t) =>
        supabase.from('ar_debt').select(fallbackColumns, { count: 'exact' }).eq('customer_type', 'INS').range(f, t)
      )
    }

    const paidRows = debtData.filter(row => {
      const paidDate = dateOnly(row.date_paid)
      if (paidDateFrom || paidDateTo) {
        if (!paidDate) return false
        if (paidDateFrom && paidDate < paidDateFrom) return false
        if (paidDateTo && paidDate > paidDateTo) return false
        return true
      }
      return getPaidAmount(row) > 0 || toNumber(row.balance) <= 0
    })
    const outstandingRows = debtData.filter(row => toNumber(row.balance) > 0)
    const paidChannels = {
      cash: { amount: 0, bills: 0 },
      bcel: { amount: 0, bills: 0 },
      bcel2: { amount: 0, bills: 0 },
      ldb: { amount: 0, bills: 0 },
    }
    paidRows.forEach(row => {
      const channelAmounts = [
        ['cash', Number(row.cash_paid) || 0],
        ['bcel', Number(row.bcel_paid) || 0],
        ['bcel2', Number(row.bcel2_paid) || 0],
        ['ldb', Number(row.ldb_paid) || 0],
      ]
      channelAmounts.forEach(([key, amount]) => {
        if (amount <= 0) return
        paidChannels[key].amount += amount
        paidChannels[key].bills += 1
      })
    })
    const paidAmount = paidRows.reduce((sum, row) => sum + getPaidAmount(row), 0)

    setCollectionSummary(computeCollectionTermSummary(debtData, insuranceDueDays))
    setPaidSummary({
      bills: paidRows.length,
      amount: paidAmount,
      channels: paidChannels,
    })
    setOutstandingSummary({
      bills: outstandingRows.length,
      amount: outstandingRows.reduce((sum, row) => sum + toNumber(row.balance), 0),
    })
  }, [insuranceDueDays, paidDateFrom, paidDateTo])

  const fetchRows = useCallback(async () => {
    setLoading(true)
    const buildQuery = (from, to) => applyDebtQueryFilters(
      supabase.from('ar_debt').select('*', { count: 'exact' }),
      { search, aging, statusFilter, paymentTypeFilter, insuranceFilter, dateFrom, dateTo, paidDateFrom, paidDateTo },
    )
      .order('date', { ascending: false })
      .order('bill_no', { ascending: false })
      .range(from, to)

    try {
      if (aging) {
        const data = await fetchAllDebtRows(buildQuery)
        const filtered = data.filter(row => matchesAgingFilter(row, aging, insuranceDueDays))
        setRows(filtered.slice(page * pageSize, page * pageSize + pageSize))
        setTotal(filtered.length)
      } else {
        const { data, count, error } = await buildQuery(page * pageSize, page * pageSize + pageSize - 1)
        if (error) throw error
        setRows(data || [])
        setTotal(count || 0)
      }
    } catch (error) {
      if (statusFilter === 'denied' && String(error.message || '').includes('note')) {
        setRows([])
        setTotal(0)
      }
    }
    setLoading(false)
  }, [search, aging, statusFilter, paymentTypeFilter, insuranceFilter, dateFrom, dateTo, paidDateFrom, paidDateTo, page, pageSize, insuranceDueDays])

  useEffect(() => { fetchRows(); fetchKpis() }, [fetchRows, fetchKpis])
  useEffect(() => { fetchInsuranceDueDays() }, [fetchInsuranceDueDays])

  async function handleSubmit(form) {
    setSaving(true)
    const collected = (form.cash||0)+(form.bcel||0)+(form.bcel2||0)+(form.ldb||0)
    const paymentRows = form.installments || []
    const installmentPayload = {}
    ;[0, 1, 2].forEach(index => {
      const row = paymentRows[index] || {}
      const number = index + 1
      installmentPayload[`payment_${number}_date`] = row.date || null
      installmentPayload[`payment_${number}_method`] = row.method || null
      installmentPayload[`payment_${number}_amount`] = row.amount || 0
    })

    // 1) Update ar_debt (form.id ແມ່ນ ar_debt id)
    const debtUpdate = {
      cash_paid: form.cash || 0,
      bcel_paid: form.bcel || 0,
      bcel2_paid: form.bcel2 || 0,
      ldb_paid: form.ldb || 0,
      amount_paid: collected,
      balance: form.debt || 0,
      date_paid: form.date_paid || null,
      submit_date: form.submit_date || null,
      due_date: form.due_date || null,
      aging_group: form.aging_group,
      ...installmentPayload,
    }
    const { error: debtErr } = await supabase.from('ar_debt').update(debtUpdate).eq('id', form.id)

    // 2) Update ar_bills (ຫາໂດຍ bill_no)
    if (!debtErr) {
      const billUpdate = {
        cash: form.cash || 0,
        bcel: form.bcel || 0,
        bcel2: form.bcel2 || 0,
        ldb: form.ldb || 0,
        debt: form.debt || 0,
        debt_status: form.debt_status,
        payment_received_at: form.date_paid || null,
        aging_group: form.aging_group,
        note: form.note,
      }
      let billPayload = { ...billUpdate, recorded_by_debt: form.recorded_by_debt }
      let { error: billSyncErr } = await supabase.from('ar_bills').update(billPayload).eq('bill_no', form.bill_no)
      if (billSyncErr && String(billSyncErr.message || '').includes('recorded_by_debt')) {
        billPayload = { ...billUpdate }
        ;({ error: billSyncErr } = await supabase.from('ar_bills').update(billPayload).eq('bill_no', form.bill_no))
      }
      if (billSyncErr && String(billSyncErr.message || '').includes('payment_received_at')) {
        const fallbackBillUpdate = { ...billPayload }
        delete fallbackBillUpdate.payment_received_at
        await supabase.from('ar_bills').update(fallbackBillUpdate).eq('bill_no', form.bill_no)
      }
    }

    setSaving(false)
    if (!debtErr) {
      logAction({ action: 'ຊຳລະໜີ້', bill_no: form.bill_no, patient_name: form.patient_name, amount: collected, details: (form.debt||0)===0 ? 'ຊຳລະຄົບ' : 'ຊຳລະບາງສ່ວນ', recorder: form.recorded_by_debt })
      setModal(null); fetchRows(); fetchKpis()
    } else alert('Error: ' + debtErr.message)
  }

  async function openEditModal(row) {
    let bill = null
    try {
      let query = supabase
        .from('ar_bills')
        .select('*')
        .eq('bill_no', row.bill_no)
      if (row.date) query = query.eq('date', row.date)
      if (row.workload) query = query.eq('workload', row.workload)
      let { data, error } = await query.maybeSingle()
      if (error && String(error.message || '').includes('JSON object requested')) {
        ;({ data, error } = await supabase
          .from('ar_bills')
          .select('*')
          .eq('bill_no', row.bill_no)
          .limit(1)
          .maybeSingle())
      }
      if (!error) bill = data
    } catch (_) {}

    setModal({
      mode: 'edit-payment',
      row: {
      ...row,
      ...(bill || {}),
      balance: row.balance,
      debt_amount: row.debt_amount,
      submit_date: row.submit_date || '',
      due_date: row.due_date || bill?.due_date || '',
      date_paid: row.date_paid || '',
      recorded_by_debt: row.recorded_by_debt || '',
      },
    })
  }

  async function handleEditSubmit(form) {
    setSaving(true)
    const newDebt = form.debt || 0
    const debt_status = resolvePaymentStatus({ ...form, debt: newDebt })
    // ກັ່ນຕອງເອົາແຕ່ ar_bills columns
    const billCols = ['date','week','workload','bill_no','customer_type','insite_onsite','opd_ipd',
      'insurance','hn','patient_name','gender',
      'svc_opd','svc_diag_image','svc_ipd','svc_surg_ot','svc_emergency','svc_chronic','svc_pharma','svc_support','svc_admin','svc_homecare',
      'total','discounts','grand_total','cash','bcel','bcel2','ldb','debt','prepayment','payment_type','bill_issued_at','payment_received_at','due_date','note','aging_group','recorded_by']
    const payload = { debt_status }
    for (const k of billCols) if (form[k] !== undefined) payload[k] = form[k]
    const { error } = await supabase.from('ar_bills').update(payload).eq('bill_no', form.bill_no)

    // Sync ar_debt ໃຫ້ຕົງກັນ
    if (!error) {
      const collected = (form.cash||0)+(form.bcel||0)+(form.bcel2||0)+(form.ldb||0)
      try {
        await supabase.from('ar_debt').update({
          date: form.date, customer_type: form.customer_type, insurance: form.insurance,
          insite_onsite: form.insite_onsite, opd_ipd: form.opd_ipd, payment_type: form.payment_type,
          hn: form.hn, patient_name: form.patient_name, gender: form.gender, workload: form.workload,
          grand_total: form.grand_total, debt_amount: form.debt,
          amount_paid: collected, cash_paid: form.cash||0, bcel_paid: form.bcel||0,
          bcel2_paid: form.bcel2||0, ldb_paid: form.ldb||0,
          balance: form.debt,
          submit_date: form.submit_date || null,
          due_date: form.due_date || null,
          aging_group: form.aging_group,
        }).eq('bill_no', form.bill_no)
      } catch (e) {}
    }

    setSaving(false)
    if (!error) { setEditModal(null); fetchRows(); fetchKpis() }
    else alert('Error: ' + error.message)
  }

  async function handleDelete() {
    setSaving(true)
    const { error } = await supabase.from('ar_debt').delete().eq('id', delTarget.id)
    setSaving(false)
    if (!error) {
      logAction({ action: 'ລົບໜີ້', bill_no: delTarget.bill_no, patient_name: delTarget.patient_name, amount: delTarget.debt })
      setDelTarget(null); fetchRows(); fetchKpis()
    } else alert('Error: ' + error.message)
  }

  async function handleDeleteAll() {
    setSaving(true)
    const { error } = await supabase.from('ar_debt').delete().not('id', 'is', null)
    setSaving(false)
    if (!error) { 
      logAction({ action: 'ລົບໜີ້ທັງໝົດ', details: 'ລຶບທັງໝົດຈາກ ar_debt' })
      setDelAll(false); fetchRows(); fetchKpis() 
    }
    else alert('Error: ' + error.message)
  }

  async function handleExcelUpload(file) {
    if (!file) return
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      alert('ກະລຸນາເລືອກໄຟລ .xlsx ຫຼື .xls ເທົ່ານັ້ນ')
      return
    }

    // 1) Parse Excel file
    let parsed
    try {
      parsed = await parseExcelFile(file)
    } catch (err) {
      alert('ອ່ານໄຟລບໍ່ສຳເລັດ: ' + err.message)
      return
    }
    const debt = parsed.debt || []
    if (!debt.length) {
      alert('ບໍ່ພົບຂໍ້ມູນໃນ sheet "Pay off" — ກວດສອບໂຄງສ້າງໄຟລ')
      return
    }

    // 2) Pre-flight: ກວດ bill_no, patient_name, insurance ກົງກັນ + ກວດຍອດໜີ້ເກີນ
    const norm = (v) => String(v ?? '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
    let issues = []
    try {
      const billNos = [...new Set(debt.map(r => r.bill_no).filter(Boolean))]
      const billsMap = new Map() // bill_no -> { patient_name, insurance, debt }
      const BATCH = 500
      for (let i = 0; i < billNos.length; i += BATCH) {
        const batch = billNos.slice(i, i + BATCH)
        const { data, error } = await supabase
          .from('ar_bills')
          .select('bill_no, patient_name, insurance, customer_type, debt')
          .in('bill_no', batch)
        if (error) throw error
        data?.forEach(r => {
          // ມີຫຼາຍ row ໃນ ar_bills ດ້ວຍ bill_no ດຽວກັນ → ໃຊ້ record ທີ່ມີ debt ສູງສຸດ
          const prev = billsMap.get(r.bill_no)
          if (!prev || (r.debt || 0) > (prev.debt || 0)) billsMap.set(r.bill_no, r)
        })
      }

      for (const r of debt) {
        if (!r.bill_no) continue
        const bill = billsMap.get(r.bill_no)
        const rowIssues = []
        if (!bill) {
          rowIssues.push({ type: 'not_found', text: 'ບໍ່ມີໃບບິນ' })
        } else {
          if (bill.customer_type !== 'INS') {
            rowIssues.push({ type: 'not_insurance', text: 'Only INS bills can be uploaded to Debt Management' })
          }
          if (norm(r.patient_name) !== norm(bill.patient_name)) {
            rowIssues.push({ type: 'name', text: `ຊື່ບໍ່ກົງ → "${bill.patient_name || '—'}"` })
          }
          if (norm(r.insurance) !== norm(bill.insurance)) {
            rowIssues.push({ type: 'insurance', text: `ປະກັນບໍ່ກົງ → "${bill.insurance || '—'}"` })
          }
          const billDebt = bill.debt || 0
          const debtAmount = r.debt_amount || 0
          if (debtAmount > billDebt) {
            const over = debtAmount - billDebt
            rowIssues.push({ type: 'overdebt', text: `ຍອດເກີນ +${fmt(over)} LAK (ໃບບິນ: ${fmt(billDebt)})` })
          }
        }
        if (rowIssues.length > 0) {
          issues.push({ row: r, bill: bill || null, issues: rowIssues })
        }
      }
    } catch (err) {
      alert('ກວດສອບໄຟລຜິດພາດ: ' + err.message)
      return
    }

    // 3) ຖ້າມີບັນຫາ → block upload ແລະສະແດງລາຍຊື່
    if (issues.length > 0) {
      await new Promise(resolve => {
        setMismatchDialog({
          issues,
          fileName: file.name,
          onClose: () => { setMismatchDialog(null); resolve() },
        })
      })
      try {
        await logAction({
          action: 'ຍົກເລີກອັບໂຫຼດໜີ້ຄ້າງ',
          action_type: 'data.upload.cancelled',
          entity_type: 'excel_file',
          entity_id: file.name,
          details: `ບໍ່ອັບໂຫຼດ — ພົບ ${issues.length} ແຖວທີ່ມີບັນຫາ`,
          metadata: {
            file_name: file.name,
            issue_count: issues.length,
            issue_types: issues.reduce((acc, it) => {
              it.issues.forEach(i => { acc[i.type] = (acc[i.type] || 0) + 1 })
              return acc
            }, {}),
          },
        })
      } catch (_) {}
      return
    }

    // 4) Upload with progress
    const log = []
    const addLog = (msg, ok = true) => log.push({ msg, ok, time: new Date().toLocaleTimeString('lo-LA') })
    setUploadState({ progress: 0, total: debt.length, done: 0, log: [...log], fileName: file.name })
    try {
      addLog(`ພົບ ${debt.length} ແຖວ ໃນ sheet Pay off — ກຳລັງອັບໂຫຼດ...`)
      setUploadState(s => ({ ...s, log: [...log] }))
      const uploaded = await upsertRows('ar_debt', debt, (pct, done, total) => {
        setUploadState(s => ({ ...s, progress: Math.round(pct * 0.85), done, total }))
      })
      addLog(`✓ ar_debt: ${uploaded} ແຖວສຳເລັດ`)
      setUploadState(s => ({ ...s, log: [...log] }))

      const billUpdates = parsed.billUpdates || []
      if (billUpdates.length > 0) {
        addLog(`ກຳລັງປັບສະຖານະໜີ້ໃນ ar_bills (${billUpdates.length} ແຖວ)...`)
        setUploadState(s => ({ ...s, log: [...log] }))
        await syncDebtStatus(billUpdates, (pct) => {
          setUploadState(s => ({ ...s, progress: 85 + Math.round(pct * 0.15) }))
        })
        addLog(`✓ ປັບສະຖານະໜີ້: ${billUpdates.length} ໃບບິນ`)
      }

      try {
        await logAction({
          action: 'ອັບໂຫຼດໜີ້ຄ້າງ (Excel)',
          action_type: 'data.upload',
          entity_type: 'excel_file',
          entity_id: file.name,
          details: `ອັບໂຫຼດ ${uploaded} ລາຍການໜີ້ ຈາກ ${file.name}`,
          metadata: { file_name: file.name, debt: uploaded, bill_updates: billUpdates.length },
        })
      } catch (_) {}
      setUploadState(s => ({ ...s, log: [...log], progress: 100 }))
      fetchRows()
      fetchKpis()
    } catch (err) {
      addLog(`✗ ${err.message}`, false)
      setUploadState(s => ({ ...(s || { progress: 0, done: 0, total: 0, fileName: file.name }), error: err.message, log: [...log] }))
    }
  }

  async function fetchRowsForExport() {
    const PAGE = 1000
    let all = []
    let from = 0
    let expectedTotal = null

    while (true) {
      const q = applyDebtQueryFilters(
        supabase.from('ar_debt').select('*', { count: 'exact' }),
        { search, aging, statusFilter, paymentTypeFilter, insuranceFilter, dateFrom, dateTo, paidDateFrom, paidDateTo },
      )
      const { data, count, error } = await q
        .order('date', { ascending: false })
        .order('bill_no', { ascending: false })
        .range(from, from + PAGE - 1)

      if (error) {
        if (statusFilter === 'denied' && String(error.message || '').includes('note')) return []
        throw error
      }

      if (expectedTotal === null) expectedTotal = count ?? 0
      if (data?.length) all = all.concat(data)
      if (!data?.length || all.length >= expectedTotal || data.length < PAGE) break
      from += PAGE
    }

    return aging ? all.filter(row => matchesAgingFilter(row, aging, insuranceDueDays)) : all
  }

  async function handleExportExcel() {
    setExporting(true)
    try {
      const exportRows = (await fetchRowsForExport()).map((row, index) =>
        buildDebtExportRow(row, insuranceDueDays, index)
      )

      if (!exportRows.length) {
        alert('ບໍ່ມີຂໍ້ມູນສຳລັບ Export')
        return
      }

      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(exportRows)
      ws['!cols'] = [
        { wch: 6 },
        { wch: 14 },
        { wch: 12 },
        { wch: 12 },
        { wch: 28 },
        { wch: 14 },
        { wch: 16 },
        { wch: 16 },
        { wch: 18 },
        { wch: 34 },
        { wch: 15 },
        { wch: 12 },
        { wch: 12 },
        { wch: 18 },
        { wch: 18 },
      ]
      if (ws['!ref']) {
        ws['!autofilter'] = { ref: ws['!ref'] }
        const range = XLSX.utils.decode_range(ws['!ref'])
        for (let row = 1; row <= range.e.r; row += 1) {
          ;[7, 8, 12].forEach(col => {
            const cell = ws[XLSX.utils.encode_cell({ r: row, c: col })]
            if (cell) cell.z = '#,##0'
          })
        }
      }
      XLSX.utils.book_append_sheet(wb, ws, 'Debt Management')
      XLSX.writeFile(wb, `AR_Debt_Management_${todayIso()}.xlsx`)

      try {
        await logAction({
          action: 'Export Debt Management Excel',
          action_type: 'report.export',
          entity_type: 'ar_debt',
          details: `Exported ${exportRows.length} Debt Management rows to Excel`,
          metadata: { rows: exportRows.length },
        })
      } catch (_) {}
    } catch (err) {
      alert('Export Excel ບໍ່ສຳເລັດ: ' + err.message)
    } finally {
      setExporting(false)
    }
  }

  const totalPages = Math.ceil(total / pageSize)
  const AGING_OPTS = ['', ...AGING_GROUPS]

  return (
    <div id="ar-debt-content" className="p-5 space-y-4 text-sm">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="grid w-full grid-cols-6 gap-2">
          <div className={`min-w-0 rounded-xl border px-2 py-2 ${TERM_CARD_STYLE.outstanding.box}`}>
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-1.5">
              <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${TERM_CARD_STYLE.outstanding.icon}`}>
                <TermIcon keyName="outstanding" />
              </span>
              <span className="block min-w-0 truncate text-[9px] font-semibold leading-tight text-slate-500">Outstanding Debt</span>
              </div>
              <span className={`mt-1 block truncate font-mono text-[13px] font-extrabold leading-tight ${TERM_CARD_STYLE.outstanding.count}`}>{fmt(outstandingSummary.amount)}</span>
              <span className="mt-0.5 block text-[10px] text-slate-400">{fmt(outstandingSummary.bills)} Bills</span>
            </div>
          </div>
          <div className={`min-w-0 rounded-xl border px-2 py-2 ${TERM_CARD_STYLE.paid_today.box}`}>
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-1.5">
              <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${TERM_CARD_STYLE.paid_today.icon}`}>
                <TermIcon keyName="paid_today" />
              </span>
              <span className="block min-w-0 truncate text-[9px] font-semibold leading-tight text-slate-500">Paid Amount</span>
              </div>
              <span className={`mt-1 block truncate font-mono text-[13px] font-extrabold leading-tight ${TERM_CARD_STYLE.paid_today.count}`}>{fmt(paidSummary.amount)}</span>
              <span className="mt-0.5 block text-[10px] text-slate-400">{fmt(paidSummary.bills)} Bills</span>
            </div>
          </div>
          {[
            { label: 'Cash', metric: paidSummary.channels.cash, dot: 'bg-emerald-500', box: 'border-emerald-100 bg-emerald-50/60', value: 'text-emerald-700' },
            { label: 'BCEL1', metric: paidSummary.channels.bcel, dot: 'bg-red-500', box: 'border-red-100 bg-red-50/60', value: 'text-red-700' },
            { label: 'BCEL2', metric: paidSummary.channels.bcel2, dot: 'bg-rose-500', box: 'border-rose-100 bg-rose-50/60', value: 'text-rose-700' },
            { label: 'LDB', metric: paidSummary.channels.ldb, dot: 'bg-sky-500', box: 'border-sky-100 bg-sky-50/60', value: 'text-sky-700' },
          ].map(channel => (
            <div key={channel.label} className={`min-w-0 rounded-xl border px-2 py-2 ${channel.box}`}>
              <div className="flex min-w-0 items-center gap-1.5">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${channel.dot}`} />
                <span className="truncate text-[10px] font-bold text-slate-500">{channel.label}</span>
              </div>
              <div className={`mt-1 truncate font-mono text-[13px] font-extrabold leading-tight ${channel.value}`}>{fmt(channel.metric.amount)}</div>
              <div className="mt-0.5 text-[10px] text-slate-400">{fmt(channel.metric.bills)} Bills</div>
            </div>
          ))}
        </div>
        <div className="hidden items-center gap-2" data-pdf-hidden="true">
          <Can permission={PERMISSIONS.RECORDS_DELETE}>
          <button onClick={() => setDelAll(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-semibold rounded-xl border border-red-200 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            ລົບທັງໝົດ
          </button>
          </Can>
          <button onClick={downloadDebtTemplate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl border border-slate-200 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Template
          </button>
          <Can permission={PERMISSIONS.DATA_UPLOAD}>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) handleExcelUpload(f) }}
          />
          <button onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl border border-slate-200 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            ອັບໂຫຼດ Excel
          </button>
          </Can>
        </div>
      </div>

      {/* Collection term summary */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-slate-700 text-sm">Collection Term Summary</h3>
            <p className="text-xs text-slate-400">Bill totals by collection term</p>
          </div>
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(0) }}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary-400 bg-white min-w-[220px]"
            data-pdf-hidden="true"
          >
            <option value="">All Terms</option>
            {COLLECTION_TERMS.map(term => (
              <option key={term.key} value={term.key}>{term.label}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
          {COLLECTION_TERMS.map(term => {
            const item = collectionSummary[term.key] || { bills: 0, amount: 0 }
            const active = statusFilter === term.key
            const style = TERM_CARD_STYLE[term.key] || TERM_CARD_STYLE.pending_submission
            return (
              <button
                key={term.key}
                type="button"
                onClick={() => { setStatusFilter(active ? '' : term.key); setPage(0) }}
                className={`min-h-[70px] text-left rounded-xl border px-2 py-2 transition-colors ${active ? style.active : style.box}`}
              >
                <div className="flex h-full items-center gap-2">
                  <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${style.icon}`}>
                    <TermIcon keyName={term.key} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[10px] font-semibold leading-tight text-slate-500">{term.label}</span>
                    <span className="mt-1 flex min-w-0 items-baseline gap-1.5">
                      <span className={`font-mono text-[13px] font-extrabold leading-none ${style.count}`}>{fmt(item.bills)}</span>
                      <span className="text-[10px] leading-none text-slate-400">Bills</span>
                    </span>
                    <span className="mt-1 block truncate font-mono text-[10px] font-semibold leading-none text-slate-600">{fmt(item.amount)} LAK</span>
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="relative bg-white rounded-xl border border-slate-100 p-2 grid grid-cols-[minmax(120px,1.6fr)_minmax(82px,1fr)_minmax(82px,1fr)_minmax(70px,.9fr)_minmax(70px,.85fr)_minmax(95px,1.05fr)_minmax(105px,1.15fr)_minmax(64px,.75fr)_minmax(86px,.85fr)] gap-1.5 items-end" data-pdf-hidden="true">
        <div className="min-w-0">
          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">ຄົ້ນຫາ</label>
          <input
            type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(0) }}
            placeholder="ເລກໃບບິນ, ຊື່ຄົນເຈັບ..."
            className="h-9 w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          />
        </div>
        <div className="min-w-0">
          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">ສະຖານະ</label>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0) }}
            className="h-9 w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-primary-400">
            <option value="">ທັງໝົດ</option>
            {COLLECTION_STATUS_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div className="min-w-0">
          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">ປະເພດຊຳລະ</label>
          <select value={paymentTypeFilter} onChange={e => { setPaymentTypeFilter(e.target.value); setPage(0) }}
            className="h-9 w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-primary-400">
            <option value="">ທັງໝົດ</option>
            <option value="Deposit">Deposit</option>
            <option value="Advance">Advance</option>
          </select>
        </div>
        <div className="min-w-0">
          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Aging</label>
          <select value={aging} onChange={e => { setAging(e.target.value); setPage(0) }}
            className="h-9 w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-primary-400">
            {AGING_OPTS.map(a => <option key={a} value={a}>{a ? getAgingLabel(a) : 'ທັງໝົດ'}</option>)}
          </select>
        </div>
        <div className="min-w-0">
          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">ປະກັນ</label>
          <select value={insuranceFilter} onChange={e => { setInsuranceFilter(e.target.value); setPage(0) }}
            className="h-9 w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-primary-400">
            <option value="">ທັງໝົດ</option>
            {insuranceOptions.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>
        <div className="min-w-0">
          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">ເລືອກບີນວັນທີ</label>
          <input
            type="date"
            value={dateFrom && dateFrom === dateTo ? dateFrom : dateFrom}
            onClick={e => e.currentTarget.showPicker?.()}
            onChange={e => {
              const value = e.target.value
              setDateFrom(value)
              setDateTo(value)
              setPage(0)
            }}
            className={`h-9 w-full min-w-0 rounded-lg border px-2 py-1.5 text-[11px] outline-none transition-colors ${dateFrom ? 'border-primary-200 bg-primary-50 text-primary-700' : 'border-slate-200 bg-white text-slate-600 hover:border-primary-300'} focus:border-primary-400`}
            title="ເລືອກບີນວັນທີ"
          />
        </div>
        <div className="min-w-0">
          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">ວັນທີຊຳລະບີນ</label>
          <input
            type="date"
            value={paidDateFrom && paidDateFrom === paidDateTo ? paidDateFrom : paidDateFrom}
            onClick={e => e.currentTarget.showPicker?.()}
            onChange={e => {
              const value = e.target.value
              setPaidDateFrom(value)
              setPaidDateTo(value)
              setPage(0)
            }}
            className={`h-9 w-full min-w-0 rounded-lg border px-2 py-1.5 text-[11px] outline-none transition-colors ${paidDateFrom ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300'} focus:border-emerald-400`}
            title="ວັນທີຊຳລະບີນ"
          />
        </div>
        <div className="min-w-0">
          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">ຈຳນວນແຖວ</label>
          <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(0) }}
            className="h-9 w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-primary-400">
            <option value={20}>20 ແຖວ</option>
            <option value={50}>50 ແຖວ</option>
            <option value={100}>100 ແຖວ</option>
            <option value={200}>200 ແຖວ</option>
            <option value={500}>500 ແຖວ</option>
          </select>
        </div>
        <Can permission={PERMISSIONS.REPORTS_EXPORT}>
        <div className="min-w-0">
          <label className="block text-[10px] font-semibold text-transparent mb-0.5">Export</label>
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={exporting || loading || total === 0}
            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[11px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
            title="Export Excel"
          >
            <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
            </svg>
            <span className="truncate">{exporting ? 'Exporting...' : 'Export Excel'}</span>
          </button>
        </div>
        </Can>
        {(search || aging || statusFilter || paymentTypeFilter || insuranceFilter || dateFrom || dateTo || paidDateFrom || paidDateTo) && (
          <button onClick={() => { setSearch(''); setAging(''); setStatusFilter(''); setPaymentTypeFilter(''); setInsuranceFilter(''); setDateFrom(''); setDateTo(''); setPaidDateFrom(''); setPaidDateTo(''); setPage(0) }}
            className="absolute -bottom-5 right-2 text-[10px] font-semibold text-slate-500 hover:text-slate-800 underline">
            ລ້າງ
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <div className="w-full">
          <table className="w-full table-fixed text-[11px]">
            <thead>
              <tr className="border-b border-slate-100 [&_th]:px-1.5 [&_th]:py-2 [&_th]:text-[10px] [&_th]:font-semibold [&_th]:text-slate-500 [&_th]:uppercase [&_th]:bg-slate-50 [&_th]:whitespace-nowrap">
                <th className="text-left w-[7%]">ບິນ</th>
                <th className="text-left w-[6%]">ວັນທີ</th>
                <th className="text-left w-[6%]">ຊຳລະ</th>
                <th className="text-left w-[13%]">ຊື່ຄົນເຈັບ</th>
                <th className="text-left w-[4%]">ປະເພດ</th>
                <th className="text-left w-[5%]">ປະກັນ</th>
                <th className="text-right w-[7%]">ຍອດລວມ</th>
                <th className="text-right w-[7%]">ໜີ້ຄ້າງ</th>
                <th className="text-left w-[9%]">ປະເພດຊຳລະ</th>
                <th className="text-left w-[7%]">ສົ່ງເອກະສານ</th>
                <th className="text-left w-[7%]">Due</th>
                <th className="text-center w-[4%]">ຄ້າງ</th>
                <th className="text-left w-[6%]">Aging</th>
                <th className="text-center w-[5%]">ສະຖານະ</th>
                <th className="text-center w-[10%]">ຈັດການ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 [&_td]:px-1.5 [&_td]:py-1.5 [&_td]:text-[11px] [&_td]:text-slate-700 [&_td]:align-middle [&_td]:truncate">
              {loading ? (
                <tr><td colSpan={15} className="table-td text-center py-12 text-slate-400">ກຳລັງໂຫຼດ...</td></tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={15} className="table-td text-center py-16">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <svg className="w-10 h-10 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-sm">ບໍ່ມີຂໍ້ມູນ</p>
                    </div>
                  </td>
                </tr>
              ) : rows.map(row => {
                // ໃຊ້ຂໍ້ມູນຈາກ ar_debt: debt_amount, amount_paid, balance
                const collected = getPaidAmount(row)
                const debt = row.balance || 0
                const dueDate = row.due_date || calcDueDate(row.submit_date || row.date, insuranceDueDays, row.insurance)
                const agingRow = { ...row, due_date: dueDate, insuranceDueDays }
                const days = calcOverdueDays(agingRow)
                const currentAging = calcAging(agingRow)
                const daysCls = days <= 15
                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                  : days <= 30
                  ? 'bg-amber-100 text-amber-700 border border-amber-200'
                  : days <= 45
                  ? 'bg-orange-100 text-orange-700 border border-orange-200'
                  : 'bg-red-100 text-red-700 border border-red-200'
                const isPaid = debt <= 0
                const paymentStatus = resolvePaymentStatus(agingRow)
                const collectionStatus = getCollectionStatus(agingRow, insuranceDueDays)
                const paymentChannels = getDebtPaymentChannels(row)
                return (
                  <tr key={row.id} className="group hover:bg-slate-50 transition-colors">
                    <td className="font-mono font-semibold text-primary-600" title={row.bill_no}>{row.bill_no}</td>
                    <td>{row.date}</td>
                    <td>{row.date_paid || <span className="text-slate-300">—</span>}</td>
                    <td title={row.patient_name}>{row.patient_name}</td>
                    <td>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${row.customer_type === 'INS' ? 'bg-sky-100 text-sky-700' : row.customer_type === 'B2B' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
                        {row.customer_type}
                      </span>
                    </td>
                    <td className="!text-slate-500" title={row.insurance || ''}>{row.insurance || '—'}</td>
                    <td className="text-right font-mono">{fmt(row.grand_total)}</td>
                    <td className="text-right font-mono font-semibold text-red-600">{fmt(debt)}</td>
                    <td title={paymentChannels.map(c => `${c.label}: ${fmt(c.amount)}`).join(' / ')}>
                      {paymentChannels.length ? (
                        <div className="flex flex-wrap gap-0.5">
                          {paymentChannels.map(channel => (
                            <span
                              key={channel.label}
                              className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0 text-[9px] font-bold ${channel.className}`}
                            >
                              <span>{channel.label}:</span>
                              <span className="font-mono">{fmt(channel.amount)}</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td>
                      <span className="font-medium text-slate-700">{row.submit_date || <span className="text-slate-300">—</span>}</span>
                    </td>
                    <td>
                      <span className={resolvePaymentStatus(agingRow) === 'overdue' ? 'font-semibold text-red-600' : 'text-slate-600'}>
                        {dueDate || <span className="text-slate-300">—</span>}
                      </span>
                    </td>
                    <td className="text-center">
                      <span className={`inline-flex items-center justify-center px-1.5 py-0 rounded-md text-[10px] font-bold ${daysCls}`}>
                        {days}ມື້
                      </span>
                    </td>
                    <td>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${AGING_COLOR[currentAging] || 'bg-slate-100 text-slate-600'}`} title={getAgingLabel(currentAging)}>{AGING_SHORT[currentAging] || getAgingLabel(currentAging)}</span>
                    </td>
                    <td className="text-center">
                      {collectionStatus ? (
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${collectionStatusBadgeClass(collectionStatus.key)}`} title={collectionStatus.label || collectionStatus.shortLabel}>{STATUS_SHORT[collectionStatus.key] || collectionStatus.shortLabel}</span>
                      ) : paymentStatus ? (
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${statusBadgeClass(paymentStatus)}`} title={paymentStatus}>{paymentStatus}</span>
                      ) : isPaid ? (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-700 rounded-md border border-emerald-200" title="ຊຳລະແລ້ວ">
                          ✓ Paid
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold bg-red-50 text-red-600 rounded-md border border-red-200" title="ຍັງຄ້າງ">
                          Due
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => setViewModal(row)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:text-primary-600 hover:bg-slate-50 transition-colors shadow-sm"
                          title="ເບິ່ງລາຍລະອຽດ"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.25 12s3.75-6.75 9.75-6.75S21.75 12 21.75 12s-3.75 6.75-9.75 6.75S2.25 12 2.25 12z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </button>
                        <Can permission={PERMISSIONS.RECORDS_WRITE}>
                        <button
                          onClick={() => setModal({ row })}
                          className={`inline-flex h-7 w-7 items-center justify-center rounded-md border bg-white shadow-sm transition-colors ${isPaid ? 'border-slate-200 text-slate-400 hover:bg-slate-50' : 'border-slate-200 text-primary-600 hover:bg-slate-50'}`}
                          title="ຊຳລະໜີ້"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => openEditModal(row)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:text-primary-600 hover:bg-slate-50 transition-colors shadow-sm"
                          title="ແກ້ໄຂ"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        </Can>
                        <Can permission={PERMISSIONS.RECORDS_DELETE}>
                        <button
                          onClick={() => setDelTarget(row)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-400 hover:text-red-600 hover:bg-slate-50 transition-colors shadow-sm"
                          title="ລົບ"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                        </Can>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between" data-pdf-hidden="true">
            <p className="text-xs text-slate-500">
              ສະແດງ {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} ຈາກ {fmt(total)}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="px-3 py-1 text-xs rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40">
                ກ່ອນ
              </button>
              <span className="px-3 py-1 text-xs text-slate-600">{page + 1} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                className="px-3 py-1 text-xs rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40">
                ຖັດໄປ
              </button>
            </div>
          </div>
        )}
      </div>

      {/* View Modal */}
      <Modal
        open={!!viewModal}
        onClose={() => setViewModal(null)}
        title={`View Bill: ${viewModal?.bill_no || ''}`}
        subtitle={viewModal?.patient_name}
        size="xl"
      >
        {viewModal && (() => {
          const debt = toNumber(viewModal.balance)
          const collected = getPaidAmount(viewModal)
          const channels = getDebtPaymentChannels(viewModal)
          const dueDate = viewModal.due_date || calcDueDate(viewModal.submit_date || viewModal.date, insuranceDueDays, viewModal.insurance)
          const details = [
            ['Bill No', viewModal.bill_no],
            ['Bill Date', viewModal.date],
            ['Paid Date', viewModal.date_paid || '—'],
            ['Patient', viewModal.patient_name],
            ['Customer Type', viewModal.customer_type],
            ['Insurance', viewModal.insurance || '—'],
            ['Total', `${fmt(viewModal.grand_total)} LAK`],
            ['Paid Amount', `${fmt(collected)} LAK`],
            ['Outstanding Debt', `${fmt(debt)} LAK`],
            ['Payment Channels', channels.length ? channels.map(channel => `${channel.label}: ${fmt(channel.amount)}`).join(' / ') : '—'],
            ['Submit Date', viewModal.submit_date || '—'],
            ['Due Date', dueDate || '—'],
            ['Recorded By', viewModal.recorded_by_debt || '—'],
          ]
          return (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {details.map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
                    <div className="mt-1 break-words text-sm font-semibold text-slate-700">{value || '—'}</div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end">
                <button type="button" onClick={() => setViewModal(null)} className="btn-secondary">
                  Close
                </button>
              </div>
            </div>
          )
        })()}
      </Modal>

      {/* Payment Modal */}
      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={`${modal?.mode === 'edit-payment' ? 'ແກ້ໄຂການຊຳລະ' : 'ຊຳລະໜີ້'}: ${modal?.row?.bill_no}`}
        subtitle={(modal?.row?.balance || 0) <= 0 ? `${modal?.row?.patient_name} · ຊຳລະຄົບແລ້ວ` : `${modal?.row?.patient_name} · ໜີ້ຄ້າງ: ${fmt(modal?.row?.balance)} LAK`}
        size="xl"
      >
        <DebtPaymentForm
          initial={modal?.row || {}}
          insuranceDueDays={insuranceDueDays}
          onSubmit={handleSubmit}
          onCancel={() => setModal(null)}
          loading={saving}
        />
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={!!editModal}
        onClose={() => setEditModal(null)}
        title={`ແກ້ໄຂໃບບິນ: ${editModal?.bill_no}`}
        subtitle={editModal?.patient_name}
        size="xl"
      >
        <BillForm
          initial={editModal || {}}
          onSubmit={handleEditSubmit}
          onCancel={() => setEditModal(null)}
          loading={saving}
          insuranceDueDays={insuranceDueDays}
        />
      </Modal>

      {/* Delete single */}
      <ConfirmDialog
        open={!!delTarget}
        onClose={() => setDelTarget(null)}
        onConfirm={handleDelete}
        loading={saving}
        title="ລົບໃບບິນ?"
        message={`ລົບໃບບິນ ${delTarget?.bill_no} ຂອງ ${delTarget?.patient_name} (ໜີ້: ${fmt(delTarget?.debt)} LAK) ແທ້ບໍ?`}
        confirmLabel="ລົບ"
      />

      {/* Delete all — require confirmation code */}
      <ConfirmCodeDialog
        open={delAll}
        onClose={() => setDelAll(false)}
        onConfirm={handleDeleteAll}
        loading={saving}
        title="ລົບໜີ້ທັງໝົດ?"
        message={`ທ່ານກຳລັງຈະລົບລາຍການໜີ້ຄ້າງທັງໝົດ ${fmt(total)} ລາຍການ ອອກຈາກລະບົບ. ການດຳເນີນການນີ້ບໍ່ສາມາດຍ້ອນຄືນໄດ້.`}
        confirmLabel="ລົບທັງໝົດ"
      />

      {/* Excel upload pre-check — blocks upload when issues found */}
      {mismatchDialog && (() => {
        const counts = mismatchDialog.issues.reduce((acc, it) => {
          it.issues.forEach(i => { acc[i.type] = (acc[i.type] || 0) + 1 })
          return acc
        }, {})
        const badgeCls = {
          not_found:  'bg-red-100 text-red-700 border-red-200',
          name:       'bg-orange-100 text-orange-700 border-orange-200',
          insurance:  'bg-violet-100 text-violet-700 border-violet-200',
          overdebt:   'bg-amber-100 text-amber-800 border-amber-200',
        }
        const chipCls = {
          not_found:  'bg-red-50 text-red-700',
          name:       'bg-orange-50 text-orange-700',
          insurance:  'bg-violet-50 text-violet-700',
          overdebt:   'bg-amber-50 text-amber-800',
        }
        return (
        <Modal
          open={true}
          onClose={mismatchDialog.onClose}
          title="ພົບຂໍ້ມູນບໍ່ກົງກັນ — ບໍ່ສາມາດອັບໂຫຼດໄດ້"
          subtitle={`${fmt(mismatchDialog.issues.length)} ແຖວມີບັນຫາ · ໄຟລ: ${mismatchDialog.fileName}`}
          size="xl"
        >
          <div className="space-y-5">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 flex items-start gap-3">
              <svg className="w-6 h-6 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
              <div className="flex-1">
                <p className="font-semibold mb-1">ການອັບໂຫຼດຖືກຍົກເລີກ</p>
                <p>ກວດສອບເລກໃບບິນ, ຊື່ຄົນເຈັບ, ປະກັນ ແລະ ຍອດໜີ້ໃນ Excel ໃຫ້ກົງກັບ <code className="bg-red-100 px-1 rounded">ar_bills</code> ກ່ອນ ແລ້ວຈິ່ງລອງອັບໂຫຼດໃໝ່. ຂໍ້ມູນເກົ່າຍັງຄົງເດີມ — ບໍ່ມີຫຍັງຖືກປ່ຽນແປງ.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {counts.not_found  && <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${badgeCls.not_found}`}>ບໍ່ມີໃບບິນ: {fmt(counts.not_found)}</span>}
                  {counts.name       && <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${badgeCls.name}`}>ຊື່ບໍ່ກົງ: {fmt(counts.name)}</span>}
                  {counts.insurance  && <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${badgeCls.insurance}`}>ປະກັນບໍ່ກົງ: {fmt(counts.insurance)}</span>}
                  {counts.overdebt   && <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${badgeCls.overdebt}`}>ຍອດເກີນ: {fmt(counts.overdebt)}</span>}
                </div>
              </div>
            </div>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="max-h-[480px] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wide w-10">#</th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wide">ເລກໃບບິນ</th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wide">ວັນທີ</th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wide">ຊື່ (Excel)</th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wide">ປະກັນ (Excel)</th>
                      <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-slate-600 uppercase tracking-wide">ຍອດໜີ້ (Excel)</th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wide">ບັນຫາ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {mismatchDialog.issues.slice(0, 500).map(({ row, issues }, i) => (
                      <tr key={i} className="hover:bg-red-50/40 align-top">
                        <td className="px-3 py-2 text-slate-400 text-xs">{i + 1}</td>
                        <td className="px-3 py-2 font-mono text-red-600 font-semibold text-xs">{row.bill_no}</td>
                        <td className="px-3 py-2 text-slate-600 text-xs whitespace-nowrap">{row.date || '—'}</td>
                        <td className="px-3 py-2 text-slate-700 truncate max-w-[220px]" title={row.patient_name || ''}>{row.patient_name || '—'}</td>
                        <td className="px-3 py-2 text-slate-500 text-xs">{row.insurance || '—'}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs">{fmt(row.debt_amount || 0)}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {issues.map((iss, j) => (
                              <span key={j} className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded ${chipCls[iss.type] || 'bg-slate-100 text-slate-700'}`}>
                                {iss.text}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {mismatchDialog.issues.length > 500 && (
                <div className="px-3 py-2 bg-slate-50 text-xs text-slate-500 border-t border-slate-200">
                  ສະແດງ 500 ແຖວທຳອິດ ຈາກທັງໝົດ {fmt(mismatchDialog.issues.length)} ແຖວ
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <button onClick={mismatchDialog.onClose}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-slate-700 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
                </svg>
                ກັບຄືນ
              </button>
            </div>
          </div>
        </Modal>
        )
      })()}

      {/* Excel upload progress */}
      {uploadState && (
        <Modal
          open={true}
          onClose={() => { if (uploadState.progress >= 100 || uploadState.error) setUploadState(null) }}
          title={uploadState.error ? 'ອັບໂຫຼດບໍ່ສຳເລັດ' : (uploadState.progress >= 100 ? 'ອັບໂຫຼດສຳເລັດ' : 'ກຳລັງອັບໂຫຼດ Excel...')}
          subtitle={uploadState.fileName}
          size="md"
        >
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                <span>ຄວາມຄືບໜ້າ</span>
                <span className="font-semibold">{uploadState.progress}% ({fmt(uploadState.done)}/{fmt(uploadState.total)})</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5">
                <div className={`h-2.5 rounded-full transition-all duration-500 ${uploadState.error ? 'bg-red-500' : 'bg-gradient-to-r from-primary-500 to-indigo-500'}`}
                  style={{ width: `${uploadState.progress}%` }} />
              </div>
            </div>
            <div className="bg-slate-900 rounded-xl p-3 font-mono text-xs space-y-1 max-h-44 overflow-y-auto">
              {uploadState.log.map((e, i) => (
                <p key={i} className={e.ok ? 'text-emerald-400' : 'text-red-400'}>
                  <span className="text-slate-500 mr-1">{e.time}</span>{e.msg}
                </p>
              ))}
            </div>
            {(uploadState.progress >= 100 || uploadState.error) && (
              <div className="flex justify-end">
                <button onClick={() => setUploadState(null)} className="btn-primary px-6">
                  ປິດ
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
