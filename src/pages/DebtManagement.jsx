import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { logAction } from '../lib/log'
import Modal, { ConfirmDialog } from '../components/Modal'
import DebtPaymentForm from '../components/forms/DebtPaymentForm'
import BillForm from '../components/forms/BillForm'

const PAYOFF_HEADERS = [
  'Date','Week','Workload','Bill No','Insite-Onsite','OPD-IPD',
  'Customer Type Code','Insurance','HN','Customer Name','Gender',
  'Grand Total','Outstanding Debt','Date Paid','Workload Debt','Submission Date',
  'Amount Paid','Cash Received Debt','Transfer Payment by BCEL Debt',
  'Transfer Payment by BCEL 2 Debt','Transfer Payment by LDB Debt',
  'Balance','Due date','Aging Group',
]
const SAMPLE_PAYOFF = [
  ['2026-01-01','Week 1','8AM-4PM','BILL-INS001','Insite','OPD','INS','APA','HN002','ນາງສີ','Female',
   500000,500000,'','','',0,0,0,0,0,500000,'2026-01-16','16-30 Days'],
]
function downloadTemplate() {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([PAYOFF_HEADERS, ...SAMPLE_PAYOFF])
  ws['!cols'] = PAYOFF_HEADERS.map(() => ({ wch: 18 }))
  XLSX.utils.book_append_sheet(wb, ws, 'Pay off')
  XLSX.writeFile(wb, 'AR_Debt_Template_LXH.xlsx')
}

function fmt(v) { return new Intl.NumberFormat().format(v || 0) }

function calcAging(dateStr) {
  if (!dateStr) return 'N'
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
  if (days <= 0)  return 'N'
  if (days <= 15) return '0-15 Days'
  if (days <= 30) return '16-30 Days'
  if (days <= 45) return '31-45 Days'
  return '46-60+ Days'
}

const AGING_COLOR = {
  'N':          'bg-slate-100 text-slate-600',
  '0-15 Days':  'bg-emerald-100 text-emerald-700',
  '16-30 Days': 'bg-yellow-100 text-yellow-700',
  '31-45 Days': 'bg-orange-100 text-orange-700',
  '46-60+ Days':'bg-red-100 text-red-700',
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
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')

  const [modal, setModal]         = useState(null)
  const [editModal, setEditModal] = useState(null)
  const [delTarget, setDelTarget] = useState(null)
  const [delAll, setDelAll]       = useState(false)
  const navigate = useNavigate()

  const [kpis, setKpis] = useState({ total_debt: 0, total_paid: 0, total_balance: 0, records: 0 })

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
    // ດຶງຂໍ້ມູນຈາກ ar_debt (Pay off) ແທນ ar_bills
    let q = supabase.from('ar_debt').select('*', { count: 'exact' })

    if (search)       q = q.or(`bill_no.ilike.%${search}%,patient_name.ilike.%${search}%`)
    if (aging) {
      const today = new Date()
      const dayAgo = (n) => new Date(today.getTime() - n * 86400000).toISOString().split('T')[0]
      if (aging === 'N')            q = q.gte('date', dayAgo(0))
      else if (aging === '0-15 Days')   q = q.gte('date', dayAgo(15))
      else if (aging === '16-30 Days')  q = q.gte('date', dayAgo(30)).lt('date', dayAgo(15))
      else if (aging === '31-45 Days')  q = q.gte('date', dayAgo(45)).lt('date', dayAgo(30))
      else if (aging === '46-60+ Days') q = q.lt('date', dayAgo(45))
    }
    if (dateFrom) q = q.gte('date', dateFrom)
    if (dateTo)   q = q.lte('date', dateTo)

    const { data, count, error } = await q
      .order('date', { ascending: false })
      .order('bill_no', { ascending: false })
      .range(page * pageSize, page * pageSize + pageSize - 1)

    if (!error) { setRows(data || []); setTotal(count || 0) }
    setLoading(false)
  }, [search, aging, dateFrom, dateTo, page, pageSize])

  useEffect(() => { fetchRows(); fetchKpis() }, [fetchRows, fetchKpis])

  async function handleSubmit(form) {
    setSaving(true)
    const { error } = await supabase.from('ar_bills').update(form).eq('id', form.id)
    setSaving(false)
    if (!error) {
      logAction({ action: 'ຊຳລະໜີ້', bill_no: form.bill_no, patient_name: form.patient_name, amount: (form.cash||0)+(form.bcel||0)+(form.bcel2||0)+(form.ldb||0), details: (form.debt||0)===0 ? 'ຊຳລະຄົບ' : 'ຊຳລະບາງສ່ວນ', recorder: form.recorded_by_debt })
      setModal(null); fetchRows(); fetchKpis()
    } else alert('Error: ' + error.message)
  }

  async function handleEditSubmit(form) {
    setSaving(true)
    const newDebt = form.debt || 0
    const debt_status = newDebt > 0 ? 'pending' : (form.debt_status || 'paid')
    const payload = { ...form, debt_status }
    const { error } = await supabase.from('ar_bills').update(payload).eq('id', form.id)
    setSaving(false)
    if (!error) { setEditModal(null); fetchRows(); fetchKpis() }
    else alert('Error: ' + error.message)
  }

  async function handleDelete() {
    setSaving(true)
    const { error } = await supabase.from('ar_bills').delete().eq('id', delTarget.id)
    setSaving(false)
    if (!error) {
      logAction({ action: 'ລົບໜີ້', bill_no: delTarget.bill_no, patient_name: delTarget.patient_name, amount: delTarget.debt })
      setDelTarget(null); fetchRows(); fetchKpis()
    } else alert('Error: ' + error.message)
  }

  async function handleDeleteAll() {
    setSaving(true)
    const { error } = await supabase.from('ar_bills').delete().not('debt_status', 'is', null)
    setSaving(false)
    if (!error) { setDelAll(false); fetchRows(); fetchKpis() }
    else alert('Error: ' + error.message)
  }

  const totalPages = Math.ceil(total / pageSize)
  const AGING_OPTS = ['', 'N', '0-15 Days', '16-30 Days', '31-45 Days', '46-60+ Days']

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="section-title">ຈັດການໜີ້ຄ້າງຊຳລະ</h2>
          <p className="text-xs text-slate-500 mt-0.5">ທັງໝົດ {fmt(total)} ລາຍການ</p>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'ຍອດລວມທັງໝົດ', value: kpis.total_debt, color: 'text-slate-700', bg: 'bg-white border-slate-100' },
          { label: 'ເກັບໄດ້ແລ້ວ', value: kpis.total_paid, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
          { label: 'ໜີ້ຄ້າງ', value: kpis.total_balance, color: 'text-red-600', bg: 'bg-red-50 border-red-100' },
          { label: 'ຈຳນວນໃບບິນ', value: kpis.records, color: 'text-slate-700', bg: 'bg-white border-slate-100' },
        ].map(k => (
          <div key={k.label} className={`rounded-xl p-4 border ${k.bg}`}>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{k.label}</p>
            <p className={`text-xl font-bold mt-1 font-mono ${k.color}`}>{fmt(k.value)}</p>
            {k.label !== 'ຈຳນວນໃບບິນ' && <p className="text-[10px] text-slate-400 mt-0.5">LAK</p>}
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-100 p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-semibold text-slate-500 mb-1">ຄົ້ນຫາ</label>
          <input
            type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(0) }}
            placeholder="ເລກໃບບິນ, ຊື່ຄົນເຈັບ..."
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Aging</label>
          <select value={aging} onChange={e => { setAging(e.target.value); setPage(0) }}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary-400">
            {AGING_OPTS.map(a => <option key={a} value={a}>{a || 'ທັງໝົດ'}</option>)}
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
        {(search || aging || dateFrom || dateTo) && (
          <button onClick={() => { setSearch(''); setAging(''); setDateFrom(''); setDateTo(''); setPage(0) }}
            className="text-xs text-slate-500 hover:text-slate-800 underline">
            ລ້າງ
          </button>
        )}
        <div className="ml-auto">
          <button onClick={() => setDelAll(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-500 text-xs font-semibold rounded-lg border border-red-200 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            ລົບທັງໝົດ
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
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
                <th className="table-th text-center">ວັນຄ້າງ</th>
                <th className="table-th">Aging</th>
                <th className="table-th text-center">ສະຖານະ</th>
                <th className="table-th">ຜູ້ບັນທຶກໜີ້</th>
                <th className="table-th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={13} className="table-td text-center py-12 text-slate-400">ກຳລັງໂຫຼດ...</td></tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={13} className="table-td text-center py-16">
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
                const days = row.date ? Math.max(0, Math.floor((Date.now() - new Date(row.date).getTime()) / 86400000)) : 0
                const daysCls = days <= 15
                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                  : days <= 30
                  ? 'bg-amber-100 text-amber-700 border border-amber-200'
                  : days <= 45
                  ? 'bg-orange-100 text-orange-700 border border-orange-200'
                  : 'bg-red-100 text-red-700 border border-red-200'
                const isPaid = debt <= 0
                return (
                  <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                    <td className="table-td font-mono text-xs font-semibold text-primary-600">{row.bill_no}</td>
                    <td className="table-td text-xs">{row.date}</td>
                    <td className="table-td">{row.patient_name}</td>
                    <td className="table-td">
                      <span className={`badge ${row.customer_type === 'INS' ? 'bg-sky-100 text-sky-700' : row.customer_type === 'B2B' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
                        {row.customer_type}
                      </span>
                    </td>
                    <td className="table-td text-xs text-slate-500">{row.insurance || '—'}</td>
                    <td className="table-td text-right font-mono text-xs">{fmt(row.grand_total)}</td>
                    <td className="table-td text-right font-mono text-xs text-emerald-600">{fmt(row.amount_paid || collected)}</td>
                    <td className="table-td text-right font-mono text-xs font-semibold text-red-600">{fmt(debt)}</td>
                    <td className="table-td text-center">
                      <span className={`inline-flex items-center justify-center min-w-[48px] px-2 py-0.5 rounded-lg text-xs font-bold ${daysCls}`}>
                        {days} ມື້
                      </span>
                    </td>
                    <td className="table-td">
                      {(() => { const ag = calcAging(row.date); return (
                        <span className={`badge text-[10px] ${AGING_COLOR[ag]}`}>{ag}</span>
                      )})()}
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
                    <td className="table-td text-xs text-slate-600">{row.recorded_by_debt || <span className="text-slate-300">—</span>}</td>
                    <td className="table-td">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setModal({ row })}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${row.debt_status === 'paid' ? 'bg-slate-50 text-slate-400 hover:bg-slate-100' : 'bg-primary-50 text-primary-600 hover:bg-primary-100'}`}
                          title="ຊຳລະໜີ້"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          ຊຳລະ
                        </button>
                        <button
                          onClick={() => setEditModal(row)}
                          className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                          title="ແກ້ໄຂ"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setDelTarget(row)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="ລົບ"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
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
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
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
        subtitle={modal?.row?.debt_status === 'paid' ? `${modal?.row?.patient_name} · ຊຳລະຄົບແລ້ວ` : `${modal?.row?.patient_name} · ໜີ້ຄ້າງ: ${fmt(modal?.row?.debt)} LAK`}
        size="lg"
      >
        <DebtPaymentForm
          initial={modal?.row || {}}
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
