import { useState, useEffect, useCallback, useRef } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { logAction } from '../lib/log'
import Modal, { ConfirmDialog, ConfirmCodeDialog } from '../components/Modal'
import BillForm from '../components/forms/BillForm'
import LoadingSpinner from '../components/LoadingSpinner'
import Can from '../components/Can'
import { PERMISSIONS } from '../lib/rbac'
import {
  DEFAULT_DUE_DAYS,
  PAYMENT_TYPES,
  calcAging,
  calcDueDate,
  resolvePaymentStatus,
  todayIso,
} from '../lib/debtUtils'
import { parseExcelFile } from '../lib/excelParser'
import { upsertRows } from '../lib/excelUpload'

const DAILY_HEADERS = [
  'Date','Week','Workload','Bill No','Insite-Onsite','OPD-IPD',
  'Customer Type Code','Insurance','HN','Customer Name','Gender',
  'OPD','Diag & Image Services','IPD','Surg / OT Services',
  'Emergency Services','Chronic & Prev Services','Pharma & Consumables',
  'Supporting & Ancillary Services','Admin & Non-Clinical Services','Home care Services',
  'Total','Discounts','Grand Total','Cash Received',
  'Transfer Payment by BCEL','Transfer Payment by BCEL2','Transfer Payment by LDB',
  'Outstanding Debt','Prepayment','Payment Type','Due date','Bill Issued At','Note','Recorder',
]
const SAMPLE_DAILY = [
  [new Date(2026, 0, 1),'Week 1','8AM-4PM','BILL-001','Insite','OPD','GN','','HN001','ສົມສາຍ','Male',
   50000,0,0,0,0,0,20000,0,0,0,70000,0,70000,70000,0,0,0,0,0,'Cash','','2026-01-01T08:30','','ມະນີວັນ'],
]
function downloadTemplate() {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([DAILY_HEADERS, ...SAMPLE_DAILY], { cellDates: true })
  ws['!cols'] = DAILY_HEADERS.map((h) => ({ wch: h === 'Date' ? 12 : 18 }))
  // Format the Date column (A) as DD/MM/YYYY on the sample row
  if (ws['A2']) ws['A2'].z = 'dd/mm/yyyy'
  XLSX.utils.book_append_sheet(wb, ws, 'Daily')
  XLSX.writeFile(wb, 'AR_Bills_Template_LXH.xlsx')
}

const DEFAULT_PAGE_SIZE = 50
const WORKLOADS = ['8AM-4PM', '4PM-12AM', '12AM-8AM']

function fmt(v) { return new Intl.NumberFormat().format(v || 0) }

const BADGE = {
  GN:  'bg-slate-100 text-slate-600',
  INS: 'bg-blue-100 text-blue-700',
  B2B: 'bg-violet-100 text-violet-700',
}

const CHANNEL_BADGE = {
  cash:  'bg-emerald-50 text-emerald-700 border-emerald-200',
  bcel:  'bg-red-50 text-red-700 border-red-200',
  bcel2: 'bg-red-50 text-red-700 border-red-200',
  ldb:   'bg-sky-50 text-sky-700 border-sky-200',
}
const CHANNEL_LABEL = { cash: 'Cash', bcel: 'BCEL', bcel2: 'BCEL2', ldb: 'LDB' }

function displayPaymentType(row) {
  if (row.payment_type) return row.payment_type
  const cash = Number(row.cash) || 0
  const transfer = (Number(row.bcel) || 0) + (Number(row.bcel2) || 0) + (Number(row.ldb) || 0)
  if (cash > 0 && transfer > 0) return 'Cash/Transfer'
  if (cash > 0) return 'Cash'
  if (transfer > 0) return 'Transfer'
  return ''
}

function PaymentChannels({ row }) {
  const channels = ['cash','bcel','bcel2','ldb'].filter(k => (row[k] || 0) > 0)
  return (
    <div className="flex flex-col items-start gap-1">
      {!!channels.length && (
        <div className="flex flex-wrap items-center gap-1.5">
          {channels.map(k => (
            <span key={k} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold ${CHANNEL_BADGE[k]}`}
                  title={`${CHANNEL_LABEL[k]}: ${fmt(row[k])}`}>
              {CHANNEL_LABEL[k]}
            </span>
          ))}
        </div>
      )}
      {row.debt > 0 && (
        <span className="font-mono text-xs font-semibold text-red-600">{fmt(row.debt)}</span>
      )}
      {!channels.length && !(row.debt > 0) && <span className="text-slate-300 text-xs">—</span>}
    </div>
  )
}

export default function BillsManagement() {
  const [rows, setRows]       = useState([])
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(0)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving]   = useState(false)

  const [search, setSearch]   = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]   = useState('')
  const [workload, setWorkload] = useState('')
  const [customerTypeFilter, setCustomerTypeFilter] = useState('')
  const [bankFilter, setBankFilter] = useState('')
  const [paymentTypeFilter, setPaymentTypeFilter] = useState('')

  const [insuranceDueDays, setInsuranceDueDays] = useState({})

  const [modal, setModal]         = useState(null)  // null | { mode: 'add'|'edit', row?: {} }
  const [submitError, setSubmitError] = useState('')
  const [delTarget, setDelTarget] = useState(null)
  const [delAll, setDelAll]       = useState(false)

  // Excel upload state
  const fileRef = useRef(null)
  const [uploadState, setUploadState] = useState(null) // null | { progress, total, done, log:[], error?, fileName }

  const fetchInsuranceDueDays = useCallback(async () => {
    const { data, error } = await supabase.from('ar_insurance_list').select('name,due_days')
    if (error) {
      const fallback = await supabase.from('ar_insurance_list').select('name')
      setInsuranceDueDays(Object.fromEntries((fallback.data || []).map(item => [item.name, DEFAULT_DUE_DAYS])))
      return
    }
    setInsuranceDueDays(Object.fromEntries((data || []).map(item => [item.name, item.due_days || DEFAULT_DUE_DAYS])))
  }, [])

  const fetchRows = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('ar_bills').select('*', { count: 'exact' })

    if (search)   q = q.or(`bill_no.ilike.%${search}%,patient_name.ilike.%${search}%`)
    if (dateFrom) q = q.gte('date', dateFrom)
    if (dateTo)   q = q.lte('date', dateTo)
    if (workload) q = q.eq('workload', workload)
    if (customerTypeFilter) q = q.eq('customer_type', customerTypeFilter)
    if (paymentTypeFilter) q = q.eq('payment_type', paymentTypeFilter)
    if (bankFilter === 'cash') q = q.gt('cash', 0)
    if (bankFilter === 'bcel') q = q.gt('bcel', 0)
    if (bankFilter === 'bcel2') q = q.gt('bcel2', 0)
    if (bankFilter === 'ldb') q = q.gt('ldb', 0)
    if (bankFilter === 'debt') q = q.gt('debt', 0)

    const { data, count, error } = await q
      .order('date', { ascending: false })
      .order('bill_no', { ascending: false })
      .range(page * pageSize, page * pageSize + pageSize - 1)

    if (!error) { setRows(data || []); setTotal(count || 0) }
    setLoading(false)
  }, [search, dateFrom, dateTo, workload, customerTypeFilter, paymentTypeFilter, bankFilter, page, pageSize])

  useEffect(() => { fetchRows() }, [fetchRows])
  useEffect(() => { fetchInsuranceDueDays() }, [fetchInsuranceDueDays])

  async function upsertArDebt(bill) {
    const submitDate = todayIso()
    const debtRecord = {
      date: bill.date,
      bill_no: bill.bill_no,
      insite_onsite: bill.insite_onsite,
      opd_ipd: bill.opd_ipd,
      payment_type: displayPaymentType(bill) || null,
      customer_type: bill.customer_type,
      insurance: bill.insurance,
      hn: bill.hn,
      patient_name: bill.patient_name,
      gender: bill.gender,
      workload: bill.workload,
      grand_total: bill.grand_total,
      debt_amount: bill.debt,
      date_paid: null,
      submit_date: submitDate,
      amount_paid: 0,
      cash_paid: 0,
      bcel_paid: 0,
      bcel2_paid: 0,
      ldb_paid: 0,
      balance: bill.debt,
      due_date: bill.due_date || calcDueDate(submitDate, insuranceDueDays, bill.insurance),
      aging_group: calcAging({
        submit_date: submitDate,
        due_date: bill.due_date || calcDueDate(submitDate, insuranceDueDays, bill.insurance),
        balance: bill.debt,
      }),
    }
    const { data: existing } = await supabase.from('ar_debt').select('id').eq('bill_no', bill.bill_no).limit(1)
    if (existing && existing.length > 0) {
      await supabase.from('ar_debt').update(debtRecord).eq('id', existing[0].id)
    } else {
      await supabase.from('ar_debt').insert(debtRecord)
    }
  }

  async function handleSubmit(form) {
    setSubmitError('')
    setSaving(true)
    const normalizedForm = {
      ...form,
      payment_type: form.payment_type,
      bill_issued_at: form.bill_issued_at || null,
      due_date: null,
    }
    const payload = { ...normalizedForm, debt_status: resolvePaymentStatus(normalizedForm) }
    let error
    if (modal.mode === 'add') {
      ;({ error } = await supabase.from('ar_bills').insert(payload))
    } else {
      ;({ error } = await supabase.from('ar_bills').update(payload).eq('id', form.id))
    }
    if (error && ['payment_type', 'due_date', 'bill_issued_at'].some(col => error.message?.includes(col))) {
      const fallbackPayload = { ...payload }
      ;['payment_type', 'due_date', 'bill_issued_at'].forEach(col => {
        delete fallbackPayload[col]
      })
      if (modal.mode === 'add') {
        ;({ error } = await supabase.from('ar_bills').insert(fallbackPayload))
      } else {
        ;({ error } = await supabase.from('ar_bills').update(fallbackPayload).eq('id', form.id))
      }
    }
    setSaving(false)
    if (!error) {
      // Auto-sync ໄປ ar_debt ທັນທີ ຖ້າມີໜີ້
      if ((normalizedForm.debt || 0) > 0) {
        try { await upsertArDebt(normalizedForm) } catch (e) {}
      } else if (modal.mode === 'edit') {
        // ຖ້າແກ້ໄຂໃຫ້ໜີ້ = 0 ໃຫ້ລຶບອອກຈາກ ar_debt
        try { await supabase.from('ar_debt').delete().eq('bill_no', form.bill_no) } catch (e) {}
      }
      try {
        await logAction({ action: modal.mode === 'add' ? 'ເພີ່ມໃບບິນ' : 'ແກ້ໄຂໃບບິນ', bill_no: form.bill_no, patient_name: form.patient_name, amount: form.grand_total, recorder: form.recorded_by })
      } catch (logErr) {
      }
      setModal(null); fetchRows()
    } else {
      if (error.message?.includes('duplicate key') || error.code === '23505') {
        setSubmitError('ໃບບິນເລກ "' + form.bill_no + '" ວັນທີ "' + form.date + '" ກະວຽກ "' + form.workload + '" ມີຢູ່ໃນລະບົບແລ້ວ — ກວດສອບຂໍ້ມູນຄືນ')
      } else {
        setSubmitError('ເກີດຂໍ້ຜິດພາດ: ' + error.message)
      }
    }
  }

  async function handleDelete() {
    setSaving(true)
    const { error } = await supabase.from('ar_bills').delete().eq('id', delTarget.id)
    if (!error) {
      // ລຶບອອກຈາກ ar_debt ນຳ
      try { await supabase.from('ar_debt').delete().eq('bill_no', delTarget.bill_no) } catch (e) {}
    }
    setSaving(false)
    if (!error) {
      try {
        await logAction({ action: 'ລົບໃບບິນ', bill_no: delTarget.bill_no, patient_name: delTarget.patient_name, amount: delTarget.grand_total })
      } catch (logErr) {
      }
      setDelTarget(null); fetchRows()
    } else {
      alert('Error: ' + error.message)
    }
  }

  async function handleDeleteAll() {
    setSaving(true)
    // ລຶບທັງ ar_bills ແລະ ar_debt ທີ່ກ່ຽວຂ້ອງ
    const { error: errorDebt } = await supabase.from('ar_debt').delete().not('id', 'is', null)
    const { error: errorBills } = await supabase.from('ar_bills').delete().not('id', 'is', null)
    setSaving(false)
    if (!errorBills && !errorDebt) {
      try {
        await logAction({ action: 'ລຶບຂໍ້ມູນທັງໝົດ', details: 'ລຶບທັງ ar_bills ແລະ ar_debt' })
      } catch (logErr) {
      }
      setDelAll(false); fetchRows()
    } else {
      alert('Error: ' + (errorBills?.message || errorDebt?.message || 'Unknown error'))
    }
  }

  async function syncDebtToArDebt() {
    setSaving(true)
    try {
      // ດຶງໃບບິນທີ່ມີໜີ້ຄ້າງຈາກ ar_bills (ກວດ debt > 0)
      const { data: billsWithDebt, error: fetchError } = await supabase
        .from('ar_bills')
        .select('*')
        .gt('debt', 0)
        .in('debt_status', ['pending', 'overdue', 'deposit']) // ເອົາສະເພາະຍັງບໍ່ທັນສົ່ງໄປ ar_debt
      if (fetchError) throw fetchError

      if (!billsWithDebt || billsWithDebt.length === 0) {
        alert('ບໍ່ມີໃບບິນທີ່ມີໜີ້ຄ້າງທີ່ຍັງບໍ່ທັນສົ່ງ')
        setSaving(false)
        return
      }

      // ສ້າງຂໍ້ມູນສຳລັບ ar_debt
      const submitDate = todayIso()
      const debtRecords = billsWithDebt.map(bill => ({
        date: bill.date,
        bill_no: bill.bill_no,
        insite_onsite: bill.insite_onsite,
        opd_ipd: bill.opd_ipd,
        payment_type: displayPaymentType(bill) || null,
        customer_type: bill.customer_type,
        insurance: bill.insurance,
        hn: bill.hn,
        patient_name: bill.patient_name,
        gender: bill.gender,
        workload: bill.workload,
        grand_total: bill.grand_total,
        debt_amount: bill.debt,
        date_paid: null,
        submit_date: submitDate,
        amount_paid: 0,
        cash_paid: 0,
        bcel_paid: 0,
        bcel2_paid: 0,
        ldb_paid: 0,
        balance: bill.debt,
        due_date: bill.due_date || calcDueDate(submitDate, insuranceDueDays, bill.insurance),
        aging_group: calcAging({
          submit_date: submitDate,
          due_date: bill.due_date || calcDueDate(submitDate, insuranceDueDays, bill.insurance),
          balance: bill.debt,
        }),
      }))

      // ກວດສອບວ່າມີໃນ ar_debt ແລ້ວຫຼືຍັງ (ຕາມ bill_no)
      const { data: existingDebt } = await supabase
        .from('ar_debt')
        .select('bill_no')
        .in('bill_no', billsWithDebt.map(b => b.bill_no))
      
      const existingBillNos = new Set(existingDebt?.map(d => d.bill_no) || [])
      const newRecords = debtRecords.filter(r => !existingBillNos.has(r.bill_no))
      if (newRecords.length === 0) {
        alert('ໃບບິນທັງໝົດຖືກສົ່ງໄປໜ້າຈັດການໜີ້ຄ້າງແລ້ວ')
        setSaving(false)
        return
      }

      // ບັນທກລົງ ar_debt
      const { error: insertError } = await supabase.from('ar_debt').insert(newRecords)
      if (insertError) throw insertError

      try {
        await logAction({
          action: 'ສົ່ງໜີ້ຄ້າງໄປໜ້າຈັດການໜີ້ຄ້າງ',
          details: `ສົ່ງ ${newRecords.length} ໃບບິນ`,
          amount: newRecords.reduce((s, r) => s + (r.debt_amount || 0), 0)
        })
      } catch (logErr) {
      }

      alert(`ສົ່ງ ${newRecords.length} ໃບບິນ ໄປໜ້າຈັດການໜີ້ຄ້າງສຳເລັດ!`)
      fetchRows()
    } catch (err) {
      alert('ຜິດພາດ: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleExcelUpload(file) {
    if (!file) return
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      alert('ກະລຸນາເລືອກໄຟລ .xlsx ຫຼື .xls ເທົ່ານັ້ນ')
      return
    }
    const log = []
    const addLog = (msg, ok = true) => log.push({ msg, ok, time: new Date().toLocaleTimeString('lo-LA') })
    setUploadState({ progress: 0, total: 0, done: 0, log: [...log], fileName: file.name })
    try {
      addLog(`ກຳລັງອ່ານໄຟລ "${file.name}"...`)
      setUploadState(s => ({ ...s, log: [...log] }))
      const result = await parseExcelFile(file)
      const bills = result.bills || []
      if (!bills.length) {
        throw new Error('ບໍ່ພົບຂໍ້ມູນໃນ sheet "Daily" — ກວດສອບໂຄງສ້າງໄຟລ')
      }
      addLog(`ພົບ ${bills.length} ແຖວ ໃນ sheet Daily — ກຳລັງອັບໂຫຼດ...`)
      setUploadState(s => ({ ...s, log: [...log], total: bills.length }))
      const uploaded = await upsertRows('ar_bills', bills, (pct, done, total) => {
        setUploadState(s => ({ ...s, progress: pct, done, total }))
      })
      addLog(`✓ ສຳເລັດ: ${uploaded} ແຖວ`)
      try {
        await logAction({
          action: 'ອັບໂຫຼດໃບບິນ (Excel)',
          action_type: 'data.upload',
          entity_type: 'excel_file',
          entity_id: file.name,
          details: `ອັບໂຫຼດ ${uploaded} ໃບບິນ ຈາກ ${file.name}`,
          metadata: { file_name: file.name, bills: uploaded },
        })
      } catch (_) {}
      setUploadState(s => ({ ...s, log: [...log], progress: 100 }))
      fetchRows()
    } catch (err) {
      addLog(`✗ ${err.message}`, false)
      setUploadState(s => ({ ...(s || { progress: 0, done: 0, total: 0, fileName: file.name }), error: err.message, log: [...log] }))
    }
  }

  const totalPages = Math.ceil(total / pageSize)

  if (loading) return <div className="p-6"><LoadingSpinner /></div>

  return (
    <div id="ar-bills-content" className="p-5 space-y-4 text-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="section-title">ຈັດການໃບບິນ</h2>
          <p className="text-xs text-slate-500 mt-0.5">ທັງໝົດ {fmt(total)} ໃບ</p>
        </div>
        <div className="flex items-center gap-2" data-pdf-hidden="true">
          <Can permission={PERMISSIONS.RECORDS_WRITE}>
          <button onClick={syncDebtToArDebt}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 text-sm font-semibold rounded-xl border border-amber-200 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            ສົ່ງໜີ້ຄ້າງ
          </button>
          </Can>
          <Can permission={PERMISSIONS.RECORDS_DELETE}>
          <button onClick={() => setDelAll(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-semibold rounded-xl border border-red-200 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            ລົບທັງໝົດ
          </button>
          </Can>
          <button onClick={downloadTemplate}
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
          <Can permission={PERMISSIONS.RECORDS_WRITE}>
          <button onClick={() => setModal({ mode: 'add' })} className="btn-primary">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            ເພີ່ມໃບບິນ
          </button>
          </Can>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-100 p-3 flex flex-wrap gap-2 items-end" data-pdf-hidden="true">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-semibold text-slate-500 mb-1">ຄົ້ນຫາ</label>
          <input
            type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(0) }}
            placeholder="ເລກໃບບິນ, ຊື່ຄົນເຈັບ..."
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">ກະ</label>
          <select value={workload} onChange={e => { setWorkload(e.target.value); setPage(0) }}
            className="text-xs border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary-400">
            <option value="">ທັງໝົດ</option>
            {WORKLOADS.map(w => <option key={w} value={w}>{w}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">ປະເພດລູກຄ້າ</label>
          <select value={customerTypeFilter} onChange={e => { setCustomerTypeFilter(e.target.value); setPage(0) }}
            className="text-xs border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary-400">
            <option value="">ທັງໝົດ</option>
            {['GN', 'INS', 'B2B'].map(type => <option key={type} value={type}>{type}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Payment Type</label>
          <select value={paymentTypeFilter} onChange={e => { setPaymentTypeFilter(e.target.value); setPage(0) }}
            className="text-xs border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary-400">
            <option value="">ທັງໝົດ</option>
            {PAYMENT_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">ທະນາຄານ</label>
          <select value={bankFilter} onChange={e => { setBankFilter(e.target.value); setPage(0) }}
            className="text-xs border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary-400">
            <option value="">ທັງໝົດ</option>
            <option value="cash">Cash</option>
            <option value="bcel">BCEL</option>
            <option value="bcel2">BCEL 2</option>
            <option value="ldb">LDB</option>
            <option value="debt">ມີໜີ້</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">ຈາກວັນທີ</label>
          <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0) }}
            className="text-xs border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary-400" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">ຫາວັນທີ</label>
          <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(0) }}
            className="text-xs border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary-400" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">ຈຳນວນແຖວ</label>
          <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(0) }}
            className="text-xs border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary-400">
            <option value={20}>20 ແຖວ</option>
            <option value={50}>50 ແຖວ</option>
            <option value={100}>100 ແຖວ</option>
            <option value={200}>200 ແຖວ</option>
          </select>
        </div>
        {(search || dateFrom || dateTo || workload || customerTypeFilter || paymentTypeFilter || bankFilter) && (
          <button onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); setWorkload(''); setCustomerTypeFilter(''); setPaymentTypeFilter(''); setBankFilter(''); setPage(0) }}
            className="text-xs text-slate-500 hover:text-slate-800 underline">
            ລ້າງ
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px]">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="table-th">ເລກໃບບິນ</th>
                <th className="table-th">ວັນທີ</th>
                <th className="table-th">ຊື່ຄົນເຈັບ</th>
                <th className="table-th">ປະເພດ</th>
                <th className="table-th">OPD/IPD</th>
                <th className="table-th">Payment Type</th>
                <th className="table-th text-right">ຍອດລວມສຸດທິ</th>
                <th className="table-th">ທະນາຄານ</th>
                <th className="table-th">ກະ</th>
                <th className="table-th">ຜູ້ບັນທຶກ</th>
                <th className="table-th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={11} className="table-td text-center py-12 text-slate-400">ກຳລັງໂຫຼດ...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={11} className="table-td text-center py-12 text-slate-400">ບໍ່ມີຂໍ້ມູນ</td></tr>
              ) : rows.map(row => (
                <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                  <td className="table-td font-mono text-xs font-semibold text-primary-600">{row.bill_no}</td>
                  <td className="table-td text-xs">{row.date}</td>
                  <td className="table-td">{row.patient_name}</td>
                  <td className="table-td">
                    <span className={`badge ${BADGE[row.customer_type] || 'bg-slate-100 text-slate-600'}`}>
                      {row.customer_type}
                    </span>
                  </td>
                  <td className="table-td text-xs">{row.opd_ipd}</td>
                  <td className="table-td">
                    {displayPaymentType(row) ? (
                      <span className="badge bg-slate-100 text-slate-700">{displayPaymentType(row)}</span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="table-td text-right font-mono text-xs">{fmt(row.grand_total)}</td>
                  <td className="table-td"><PaymentChannels row={row} /></td>
                  <td className="table-td text-xs text-slate-500">{row.workload}</td>
                  <td className="table-td text-xs text-slate-600">{row.recorded_by || <span className="text-slate-300">—</span>}</td>
                  <td className="table-td">
                    <div className="flex items-center gap-1">
                      <Can permission={PERMISSIONS.RECORDS_WRITE}>
                      <button
                        onClick={() => setModal({ mode: 'edit', row })}
                        className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
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
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
              ))}
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

      {/* Add / Edit Modal */}
      <Modal
        open={!!modal}
        onClose={() => { setModal(null); setSubmitError('') }}
        title={modal?.mode === 'edit' ? `ແກ້ໄຂ: ${modal.row?.bill_no}` : 'ເພີ່ມໃບບິນໃໝ່'}
        subtitle={modal?.mode === 'edit' ? `${modal.row?.patient_name} · ${modal.row?.date}` : 'ກະລຸນາໃສ່ຂໍ້ມູນໃຫ້ຄົບຖ້ວນ'}
        size="xl"
      >
        <BillForm
          initial={modal?.mode === 'edit' ? modal.row : {}}
          onSubmit={handleSubmit}
          onCancel={() => { setModal(null); setSubmitError('') }}
          loading={saving}
          submitError={submitError}
        />
      </Modal>

      {/* Delete single */}
      <ConfirmDialog
        open={!!delTarget}
        onClose={() => setDelTarget(null)}
        onConfirm={handleDelete}
        loading={saving}
        title="ລົບໃບບິນ?"
        message={`ທ່ານຕ້ອງການລົບ ${delTarget?.bill_no} ຂອງ ${delTarget?.patient_name} ແທ້ບໍ? ການດຳເນີນການນີ້ບໍ່ສາມາດຍ້ອນຄືນໄດ້.`}
        confirmLabel="ລົບ"
      />

      {/* Delete all — require confirmation code */}
      <ConfirmCodeDialog
        open={delAll}
        onClose={() => setDelAll(false)}
        onConfirm={handleDeleteAll}
        loading={saving}
        title="ລົບຂໍ້ມູນທັງໝົດ?"
        message={`ທ່ານກຳລັງຈະລົບໃບບິນທັງໝົດ ${fmt(total)} ໃບ ອອກຈາກລະບົບ. ການດຳເນີນການນີ້ບໍ່ສາມາດຍ້ອນຄືນໄດ້.`}
        confirmLabel="ລົບທັງໝົດ"
      />

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
