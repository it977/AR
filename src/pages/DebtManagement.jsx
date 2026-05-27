import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { logAction } from '../lib/log'
import Modal, { ConfirmDialog } from '../components/Modal'
import DebtPaymentForm from '../components/forms/DebtPaymentForm'
import BillForm from '../components/forms/BillForm'
import Can from '../components/Can'
import { PERMISSIONS } from '../lib/rbac'
import {
  AGING_GROUPS,
  DEFAULT_DUE_DAYS,
  calcAging,
  calcOverdueDays,
  calcDueDate,
  getAgingLabel,
} from '../lib/debtUtils'

function fmt(v) { return new Intl.NumberFormat().format(v || 0) }

const AGING_COLOR = {
  'N':          'bg-slate-100 text-slate-600',
  'Due on schedule': 'bg-sky-100 text-sky-700',
  'Pay in installments': 'bg-violet-100 text-violet-700',
  '1-15 Days':  'bg-emerald-100 text-emerald-700',
  '16-30 Days': 'bg-yellow-100 text-yellow-700',
  '31-45 Days': 'bg-orange-100 text-orange-700',
  '46-60+ Days':'bg-red-100 text-red-700',
}
const WORKLOADS = ['8AM-4PM', '4PM-12AM', '12AM-8AM']
const actionThCls = 'table-th sticky right-0 z-20 bg-slate-50 text-center shadow-[-10px_0_18px_-16px_rgba(15,23,42,0.45)]'
const actionTdCls = 'table-td sticky right-0 z-10 bg-white group-hover:bg-slate-50 shadow-[-10px_0_18px_-16px_rgba(15,23,42,0.45)]'

export default function DebtManagement() {
  const [rows, setRows]       = useState([])
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(0)
  const [pageSize, setPageSize] = useState(50)  // ເພີ່ມ: ເລືອກຈຳນວນແຖວ
  const [loading, setLoading] = useState(false)
  const [saving, setSaving]   = useState(false)

  const [search, setSearch]     = useState('')
  const [aging, setAging]       = useState('')
  const [statusFilter, setStatusFilter] = useState('')  // ເລີ່ມດ້ວຍທັງໝົດ
  const [workload, setWorkload] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')

  const [modal, setModal]         = useState(null)
  const [editModal, setEditModal] = useState(null)
  const [delTarget, setDelTarget] = useState(null)
  const [delAll, setDelAll]       = useState(false)

  const [kpis, setKpis] = useState({ total_debt: 0, total_paid: 0, total_balance: 0, records: 0 })
  const [insuranceDueDays, setInsuranceDueDays] = useState({})

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
    // ກັ່ນຕອງຕາມສະຖານະ: pending = balance > 0, paid = balance <= 0
    if (statusFilter === 'pending') q = q.gt('balance', 0)
    if (statusFilter === 'paid')    q = q.lte('balance', 0)
    if (workload) q = q.eq('workload', workload)
    if (aging) q = q.eq('aging_group', aging)
    if (dateFrom) q = q.gte('date', dateFrom)
    if (dateTo)   q = q.lte('date', dateTo)

    const { data, count, error } = await q
      .order('date', { ascending: false })
      .order('bill_no', { ascending: false })
      .range(page * pageSize, page * pageSize + pageSize - 1)
    if (!error) { setRows(data || []); setTotal(count || 0) }
    setLoading(false)
  }, [search, aging, statusFilter, workload, dateFrom, dateTo, page, pageSize])

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
    const debt_status = newDebt > 0 ? 'pending' : (form.debt_status || 'paid')
    // ກັ່ນຕອງເອົາແຕ່ ar_bills columns
    const billCols = ['date','week','workload','bill_no','customer_type','insite_onsite','opd_ipd',
      'insurance','hn','patient_name','gender',
      'svc_opd','svc_diag_image','svc_ipd','svc_surg_ot','svc_emergency','svc_chronic','svc_pharma','svc_support','svc_admin','svc_homecare',
      'total','discounts','grand_total','cash','bcel','bcel2','ldb','debt','prepayment','note','aging_group']
    const payload = { debt_status }
    for (const k of billCols) if (form[k] !== undefined) payload[k] = form[k]
    const { error } = await supabase.from('ar_bills').update(payload).eq('bill_no', form.bill_no)

    // Sync ar_debt ໃຫ້ຕົງກັນ
    if (!error) {
      const collected = (form.cash||0)+(form.bcel||0)+(form.bcel2||0)+(form.ldb||0)
      try {
        await supabase.from('ar_debt').update({
          date: form.date, customer_type: form.customer_type, insurance: form.insurance,
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

  const totalPages = Math.ceil(total / pageSize)
  const AGING_OPTS = ['', ...AGING_GROUPS]

  return (
    <div id="ar-debt-content" className="p-5 space-y-4 text-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="section-title">ຈັດການໜີ້ຄ້າງຊຳລະ</h2>
          <p className="text-xs text-slate-500 mt-0.5">ທັງໝົດ {fmt(total)} ລາຍການ</p>
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
            <option value="pending">ຍັງຄ້າງ</option>
            <option value="paid">ຊຳລະແລ້ວ</option>
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
          <label className="block text-xs font-semibold text-slate-500 mb-1">ກະ</label>
          <select value={workload} onChange={e => { setWorkload(e.target.value); setPage(0) }}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary-400">
            <option value="">ທັງໝົດ</option>
            {WORKLOADS.map(w => <option key={w} value={w}>{w}</option>)}
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
        {(search || aging || statusFilter || workload || dateFrom || dateTo) && (
          <button onClick={() => { setSearch(''); setAging(''); setStatusFilter(''); setWorkload(''); setDateFrom(''); setDateTo(''); setPage(0) }}
            className="text-xs text-slate-500 hover:text-slate-800 underline">
            ລ້າງ
          </button>
        )}
        <div className="ml-auto">
          <Can permission={PERMISSIONS.RECORDS_DELETE}>
          <button onClick={() => setDelAll(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-500 text-xs font-semibold rounded-lg border border-red-200 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            ລົບທັງໝົດ
          </button>
          </Can>
        </div>
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
                <th className="table-th text-center">ວັນຄ້າງ</th>
                <th className="table-th">Aging</th>
                <th className="table-th text-center">ສະຖານະ</th>
                <th className="table-th">ຜູ້ບັນທຶກໜີ້</th>
                <th className={actionThCls}>ຈັດການ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={14} className="table-td text-center py-12 text-slate-400">ກຳລັງໂຫຼດ...</td></tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={14} className="table-td text-center py-16">
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
                    <td className="table-td text-center">
                      <span className={`inline-flex items-center justify-center min-w-[48px] px-2 py-0.5 rounded-lg text-xs font-bold ${daysCls}`}>
                        {days} ມື້
                      </span>
                    </td>
                    <td className="table-td">
                      <span className={`badge text-[10px] ${AGING_COLOR[currentAging] || AGING_COLOR.N}`}>{getAgingLabel(currentAging)}</span>
                    </td>
                    <td className="table-td text-center">
                      {isPaid ? (
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

      {/* Delete all */}
      <ConfirmDialog
        open={delAll}
        onClose={() => setDelAll(false)}
        onConfirm={handleDeleteAll}
        loading={saving}
        title="ລົບໜີ້ທັງໝົດ?"
        message={`ລົບໃບບິນທີ່ມີໜີ້ຄ້າງທັງໝົດ ${fmt(total)} ລາຍການ ອອກຈາກລະບົບແທ້ບໍ?`}
        confirmLabel="ລົບທັງໝົດ"
      />
    </div>
  )
}
