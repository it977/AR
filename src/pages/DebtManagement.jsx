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
  DEFAULT_DUE_DAYS,
  calcAging,
  calcOverdueDays,
  calcDueDate,
  getAgingLabel,
  resolvePaymentStatus,
  statusBadgeClass,
  todayIso,
} from '../lib/debtUtils'

function fmt(v) { return new Intl.NumberFormat().format(v || 0) }

const AGING_COLOR = {
  'Current Receivables': 'bg-sky-100 text-sky-700',
  '1-15 Days':  'bg-emerald-100 text-emerald-700',
  '16-30 Days': 'bg-yellow-100 text-yellow-700',
  '31-45 Days': 'bg-orange-100 text-orange-700',
  '46-90 Days':'bg-red-100 text-red-700',
}
const actionThCls = 'table-th sticky right-0 z-20 bg-slate-50 text-center shadow-[-10px_0_18px_-16px_rgba(15,23,42,0.45)]'
const actionTdCls = 'table-td sticky right-0 z-10 bg-white group-hover:bg-slate-50 shadow-[-10px_0_18px_-16px_rgba(15,23,42,0.45)]'

function dateDaysAgo(days) {
  const date = new Date(todayIso())
  date.setDate(date.getDate() - days)
  return date.toISOString().split('T')[0]
}

function applyAgingFilter(query, aging) {
  if (!aging) return query
  const today = todayIso()
  if (aging === 'Current Receivables') return query.or(`due_date.is.null,due_date.gte.${today}`)
  if (aging === '1-15 Days') return query.lt('due_date', today).gte('due_date', dateDaysAgo(15))
  if (aging === '16-30 Days') return query.lt('due_date', dateDaysAgo(15)).gte('due_date', dateDaysAgo(30))
  if (aging === '31-45 Days') return query.lt('due_date', dateDaysAgo(30)).gte('due_date', dateDaysAgo(45))
  if (aging === '46-90 Days') return query.lt('due_date', dateDaysAgo(45))
  return query
}

export default function DebtManagement() {
  const [rows, setRows]       = useState([])
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(0)
  const [pageSize, setPageSize] = useState(50)  // ເພີ່ມ: ເລືອກຈຳນວນແຖວ
  const [loading, setLoading] = useState(false)
  const [saving, setSaving]   = useState(false)

  const [search, setSearch]     = useState('')
  const [aging, setAging]       = useState('')
  const [statusFilter, setStatusFilter] = useState('')  // Collection workflow status
  const [paymentTypeFilter, setPaymentTypeFilter] = useState('')
  const [insuranceFilter, setInsuranceFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')

  const [modal, setModal]         = useState(null)
  const [editModal, setEditModal] = useState(null)
  const [delTarget, setDelTarget] = useState(null)
  const [delAll, setDelAll]       = useState(false)

  const fileRef = useRef(null)
  const [uploadState, setUploadState] = useState(null)
  const [mismatchDialog, setMismatchDialog] = useState(null)

  const [kpis, setKpis] = useState({ total_debt: 0, total_paid: 0, total_balance: 0, records: 0 })
  const [insuranceDueDays, setInsuranceDueDays] = useState({})

  const insuranceOptions = useMemo(
    () => Object.keys(insuranceDueDays).filter(Boolean).sort((a, b) => a.localeCompare(b)),
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
        if (error) break
        if (total === null && count != null) total = count
        if (data?.length) all = all.concat(data)
        if (!data?.length || all.length >= (total ?? Infinity) || data.length < PAGE) break
        from += PAGE
      }
      return all
    }

    const debtData = await fetchAll((f, t) =>
      supabase.from('ar_debt').select('debt_amount, cash_paid, bcel_paid, bcel2_paid, ldb_paid, balance', { count: 'exact' }).range(f, t)
    )

    const originalDebt = debtData.reduce((s, r) => s + (r.debt_amount || 0), 0)
    const collected    = debtData.reduce((s, r) => s + (r.cash_paid || 0) + (r.bcel_paid || 0) + (r.bcel2_paid || 0) + (r.ldb_paid || 0), 0)
    const remaining    = debtData.reduce((s, r) => s + (r.balance    || 0), 0)

    setKpis({
      total_debt:    originalDebt > 0 ? originalDebt : collected + remaining,
      total_paid:    collected,
      total_balance: remaining,
      records:       debtData.length,
    })
  }, [])

  const fetchRows = useCallback(async () => {
    setLoading(true)
    // ດຶງຂໍ້ມູນຈາກ ar_debt (Pay off)
    let q = supabase.from('ar_debt').select('*', { count: 'exact' })

    if (search)       q = q.or(`bill_no.ilike.%${search}%,patient_name.ilike.%${search}%`)
    const today = todayIso()
    if (statusFilter === 'pending_submission') q = q.gt('balance', 0).is('submit_date', null)
    if (statusFilter === 'pending_payment') q = q.gt('balance', 0).not('submit_date', 'is', null)
    if (statusFilter === 'outstanding') q = q.gt('balance', 0)
    if (statusFilter === 'current') q = q.gt('balance', 0).or(`due_date.is.null,due_date.gte.${today}`)
    if (statusFilter === 'past_due') q = q.gt('balance', 0).lt('due_date', today)
    if (statusFilter === 'paid') q = q.lte('balance', 0)
    if (paymentTypeFilter) q = q.eq('payment_type', paymentTypeFilter)
    if (insuranceFilter) q = q.eq('insurance', insuranceFilter)
    q = applyAgingFilter(q, aging)
    if (dateFrom) q = q.gte('date', dateFrom)
    if (dateTo)   q = q.lte('date', dateTo)

    const { data, count, error } = await q
      .order('date', { ascending: false })
      .order('bill_no', { ascending: false })
      .range(page * pageSize, page * pageSize + pageSize - 1)
    if (!error) { setRows(data || []); setTotal(count || 0) }
    setLoading(false)
  }, [search, aging, statusFilter, paymentTypeFilter, insuranceFilter, dateFrom, dateTo, page, pageSize])

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
        aging_group: form.aging_group,
        note: form.note,
      }
      // ຢ່າເພີ່ມ recorded_by_debt ຖ້າ schema ບໍ່ມີ — ໃສ່ໃນ try
      try {
        await supabase.from('ar_bills').update({ ...billUpdate, recorded_by_debt: form.recorded_by_debt }).eq('bill_no', form.bill_no)
      } catch (e) {
        await supabase.from('ar_bills').update(billUpdate).eq('bill_no', form.bill_no)
      }
    }

    setSaving(false)
    if (!debtErr) {
      logAction({ action: 'ຊຳລະໜີ້', bill_no: form.bill_no, patient_name: form.patient_name, amount: collected, details: (form.debt||0)===0 ? 'ຊຳລະຄົບ' : 'ຊຳລະບາງສ່ວນ', recorder: form.recorded_by_debt })
      setModal(null); fetchRows(); fetchKpis()
    } else alert('Error: ' + debtErr.message)
  }

  async function handleEditSubmit(form) {
    setSaving(true)
    const newDebt = form.debt || 0
    const debt_status = resolvePaymentStatus({ ...form, debt: newDebt })
    // ກັ່ນຕອງເອົາແຕ່ ar_bills columns
    const billCols = ['date','week','workload','bill_no','customer_type','insite_onsite','opd_ipd',
      'insurance','hn','patient_name','gender',
      'svc_opd','svc_diag_image','svc_ipd','svc_surg_ot','svc_emergency','svc_chronic','svc_pharma','svc_support','svc_admin','svc_homecare',
      'total','discounts','grand_total','cash','bcel','bcel2','ldb','debt','prepayment','payment_type','due_date','note','aging_group']
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
          .select('bill_no, patient_name, insurance, debt')
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

  const totalPages = Math.ceil(total / pageSize)
  const AGING_OPTS = ['', ...AGING_GROUPS]

  return (
    <div id="ar-debt-content" className="p-5 space-y-4 text-sm">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="section-title">ຈັດການໜີ້ຄ້າງຊຳລະ</h2>
          <p className="text-xs text-slate-500 mt-0.5">ທັງໝົດ {fmt(total)} ລາຍການ</p>
        </div>
        <div className="flex items-center gap-2" data-pdf-hidden="true">
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

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'ຍອດລວມທັງໝົດ', value: kpis.total_debt, color: 'text-slate-700', bg: 'bg-white border-slate-100' },
          { label: 'ເກັບໄດ້ແລ້ວ', value: kpis.total_paid, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
          { label: 'ໜີ້ຄ້າງ', value: kpis.total_balance, color: 'text-red-600', bg: 'bg-red-50 border-red-100' },
          { label: 'ຈຳນວນໃບບິນ', value: kpis.records, color: 'text-slate-700', bg: 'bg-white border-slate-100' },
        ].map(k => (
          <div key={k.label} className={`rounded-xl p-3 border ${k.bg}`}>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{k.label}</p>
            <p className={`text-lg font-bold mt-1 font-mono ${k.color}`}>{fmt(k.value)}</p>
            {k.label !== 'ຈຳນວນໃບບິນ' && <p className="text-[10px] text-slate-400 mt-0.5">LAK</p>}
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-100 p-3 flex flex-wrap gap-2 items-end" data-pdf-hidden="true">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-semibold text-slate-500 mb-1">ຄົ້ນຫາ</label>
          <input
            type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(0) }}
            placeholder="ເລກໃບບິນ, ຊື່ຄົນເຈັບ..."
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">ສະຖານະ</label>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0) }}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary-400">
            <option value="">ທັງໝົດ</option>
            <option value="pending_submission">Pending Insurance Submission</option>
            <option value="pending_payment">Pending Insurance Payment</option>
            <option value="outstanding">Outstanding Receivables</option>
            <option value="current">Current Receivables</option>
            <option value="past_due">Past Due Receivables</option>
            <option value="paid">ຊຳລະແລ້ວ</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">ປະເພດຊຳລະ</label>
          <select value={paymentTypeFilter} onChange={e => { setPaymentTypeFilter(e.target.value); setPage(0) }}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary-400">
            <option value="">ທັງໝົດ</option>
            <option value="Deposit">Deposit</option>
            <option value="Advance">Advance</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Aging</label>
          <select value={aging} onChange={e => { setAging(e.target.value); setPage(0) }}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary-400">
            {AGING_OPTS.map(a => <option key={a} value={a}>{a ? getAgingLabel(a) : 'ທັງໝົດ'}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">ປະກັນ</label>
          <select value={insuranceFilter} onChange={e => { setInsuranceFilter(e.target.value); setPage(0) }}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary-400">
            <option value="">ທັງໝົດ</option>
            {insuranceOptions.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">ຈາກວັນທີ</label>
          <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0) }}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary-400" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">ຫາວັນທີ</label>
          <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(0) }}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary-400" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">ຈຳນວນແຖວ</label>
          <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(0) }}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary-400">
            <option value={20}>20 ແຖວ</option>
            <option value={50}>50 ແຖວ</option>
            <option value={100}>100 ແຖວ</option>
            <option value={200}>200 ແຖວ</option>
            <option value={500}>500 ແຖວ</option>
          </select>
        </div>
        {(search || aging || statusFilter || paymentTypeFilter || insuranceFilter || dateFrom || dateTo) && (
          <button onClick={() => { setSearch(''); setAging(''); setStatusFilter(''); setPaymentTypeFilter(''); setInsuranceFilter(''); setDateFrom(''); setDateTo(''); setPage(0) }}
            className="text-xs text-slate-500 hover:text-slate-800 underline">
            ລ້າງ
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1240px]">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="table-th">ເລກໃບບິນ</th>
                <th className="table-th">ວັນທີ</th>
                <th className="table-th">ຊື່ຄົນເຈັບ</th>
                <th className="table-th">ປະເພດ</th>
                <th className="table-th">ປະກັນ</th>
                <th className="table-th text-right">ຍອດລວມ</th>
                <th className="table-th text-right">ເກັບໄດ້</th>
                <th className="table-th text-right">ໜີ້ຄ້າງ</th>
                <th className="table-th">ວັນສົ່ງເອກະສານ</th>
                <th className="table-th">Due Date</th>
                <th className="table-th text-center">ວັນຄ້າງ</th>
                <th className="table-th">Aging</th>
                <th className="table-th text-center">ສະຖານະ</th>
                <th className="table-th">ຜູ້ບັນທຶກໜີ້</th>
                <th className={actionThCls}>ຈັດການ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
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
                const collected = (row.cash_paid || 0) + (row.bcel_paid || 0) + (row.bcel2_paid || 0) + (row.ldb_paid || 0)
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
                return (
                  <tr key={row.id} className="group hover:bg-slate-50 transition-colors">
                    <td className="table-td font-mono text-xs font-semibold text-primary-600">{row.bill_no}</td>
                    <td className="table-td text-xs">{row.date}</td>
                    <td className="table-td max-w-[230px] truncate" title={row.patient_name}>{row.patient_name}</td>
                    <td className="table-td">
                      <span className={`badge ${row.customer_type === 'INS' ? 'bg-sky-100 text-sky-700' : row.customer_type === 'B2B' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
                        {row.customer_type}
                      </span>
                    </td>
                    <td className="table-td text-xs text-slate-500">{row.insurance || '—'}</td>
                    <td className="table-td text-right font-mono text-xs">{fmt(row.grand_total)}</td>
                    <td className="table-td text-right font-mono text-xs text-emerald-600">{fmt(row.amount_paid || collected)}</td>
                    <td className="table-td text-right font-mono text-xs font-semibold text-red-600">{fmt(debt)}</td>
                    <td className="table-td text-xs">
                      <span className="font-medium text-slate-700">{row.submit_date || <span className="text-slate-300">—</span>}</span>
                    </td>
                    <td className="table-td text-xs">
                      <span className={resolvePaymentStatus(agingRow) === 'overdue' ? 'font-semibold text-red-600' : 'text-slate-600'}>
                        {dueDate || <span className="text-slate-300">—</span>}
                      </span>
                    </td>
                    <td className="table-td text-center">
                      <span className={`inline-flex items-center justify-center min-w-[48px] px-2 py-0.5 rounded-lg text-xs font-bold ${daysCls}`}>
                        {days} ມື້
                      </span>
                    </td>
                    <td className="table-td">
                      <span className={`badge text-[10px] ${AGING_COLOR[currentAging] || 'bg-slate-100 text-slate-600'}`}>{getAgingLabel(currentAging)}</span>
                    </td>
                    <td className="table-td text-center">
                      {paymentStatus ? (
                        <span className={`badge ${statusBadgeClass(paymentStatus)}`}>{paymentStatus}</span>
                      ) : isPaid ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-200">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                          ຊຳລະແລ້ວ
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-red-50 text-red-600 rounded-lg border border-red-200">
                          ຍັງຄ້າງ
                        </span>
                      )}
                    </td>
                    <td className="table-td text-xs text-slate-600 max-w-[120px] truncate" title={row.recorded_by_debt || ''}>{row.recorded_by_debt || <span className="text-slate-300">—</span>}</td>
                    <td className={actionTdCls}>
                      <div className="flex items-center justify-center gap-1.5">
                        <Can permission={PERMISSIONS.RECORDS_WRITE}>
                        <button
                          onClick={() => setModal({ row })}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${isPaid ? 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100' : 'bg-primary-50 text-primary-600 border-primary-100 hover:bg-primary-100'}`}
                          title="ຊຳລະໜີ້"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          ຊຳລະ
                        </button>
                        <button
                          onClick={() => setEditModal(row)}
                          className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg border border-slate-100 transition-colors"
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
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-slate-100 transition-colors"
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

      {/* Payment Modal */}
      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={`ຊຳລະໜີ້: ${modal?.row?.bill_no}`}
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
