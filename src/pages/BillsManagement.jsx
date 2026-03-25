import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { logAction } from '../lib/log'
import Modal, { ConfirmDialog } from '../components/Modal'
import BillForm from '../components/forms/BillForm'
import LoadingSpinner from '../components/LoadingSpinner'

const DAILY_HEADERS = [
  'Date','Week','Workload','Bill No','Insite-Onsite','OPD-IPD',
  'Customer Type Code','Insurance','HN','Customer Name','Gender',
  'OPD','Diag & Image Services','IPD','Surg / OT Services',
  'Emergency Services','Chronic & Prev Services','Pharma & Consumables',
  'Supporting & Ancillary Services','Admin & Non-Clinical Services','Home care Services',
  'Total','Discounts','Grand Total','Cash Received',
  'Transfer Payment by BCEL','Transfer Payment by BCEL2','Transfer Payment by LDB',
  'Outstanding Debt','Prepayment','Note','Aging Group',
]
const SAMPLE_DAILY = [
  ['2026-01-01','Week 1','8AM-4PM','BILL-001','Insite','OPD','GN','','HN001','ສົມສາຍ','Male',
   50000,0,0,0,0,0,20000,0,0,0,70000,0,70000,70000,0,0,0,0,0,'',''],
]
function downloadTemplate() {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([DAILY_HEADERS, ...SAMPLE_DAILY])
  ws['!cols'] = DAILY_HEADERS.map(() => ({ wch: 18 }))
  XLSX.utils.book_append_sheet(wb, ws, 'Daily')
  XLSX.writeFile(wb, 'AR_Bills_Template_LXH.xlsx')
}

const PAGE_SIZE = 20

function fmt(v) { return new Intl.NumberFormat().format(v || 0) }

const BADGE = {
  GN:  'bg-slate-100 text-slate-600',
  INS: 'bg-blue-100 text-blue-700',
  B2B: 'bg-violet-100 text-violet-700',
}

export default function BillsManagement() {
  const [rows, setRows]       = useState([])
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(0)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving]   = useState(false)

  const [search, setSearch]   = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]   = useState('')

  const [kpis, setKpis] = useState({ total_grand: 0, total_collected: 0, total_debt: 0 })

  const [modal, setModal]         = useState(null)  // null | { mode: 'add'|'edit', row?: {} }
  const [delTarget, setDelTarget] = useState(null)
  const [delAll, setDelAll]       = useState(false)
  const navigate = useNavigate()

  const fetchRows = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('ar_bills').select('*', { count: 'exact' })

    if (search)   q = q.or(`bill_no.ilike.%${search}%,patient_name.ilike.%${search}%`)
    if (dateFrom) q = q.gte('date', dateFrom)
    if (dateTo)   q = q.lte('date', dateTo)

    const { data, count, error } = await q
      .order('date', { ascending: false })
      .order('bill_no', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

    if (!error) { setRows(data || []); setTotal(count || 0) }
    setLoading(false)
  }, [search, dateFrom, dateTo, page])

  // Separate KPI fetch — sums ALL matching bills, not just current page
  const fetchKpis = useCallback(async () => {
    let q = supabase.from('ar_bills').select('grand_total, cash, bcel, bcel2, ldb, debt')
    if (search)   q = q.or(`bill_no.ilike.%${search}%,patient_name.ilike.%${search}%`)
    if (dateFrom) q = q.gte('date', dateFrom)
    if (dateTo)   q = q.lte('date', dateTo)
    const { data } = await q
    if (data) {
      setKpis({
        total_grand:     data.reduce((s, r) => s + (r.grand_total || 0), 0),
        total_collected: data.reduce((s, r) => s + (r.cash || 0) + (r.bcel || 0) + (r.bcel2 || 0) + (r.ldb || 0), 0),
        total_debt:      data.reduce((s, r) => s + (r.debt || 0), 0),
      })
    }
  }, [search, dateFrom, dateTo])

  useEffect(() => { fetchRows() }, [fetchRows])
  useEffect(() => { fetchKpis() }, [fetchKpis])

  async function handleSubmit(form) {
    setSaving(true)
    const payload = { ...form, debt_status: (form.debt || 0) > 0 ? 'pending' : null }
    let error
    if (modal.mode === 'add') {
      ;({ error } = await supabase.from('ar_bills').insert(payload))
    } else {
      ;({ error } = await supabase.from('ar_bills').update(payload).eq('id', form.id))
    }
    setSaving(false)
    if (!error) {
      logAction({ action: modal.mode === 'add' ? 'ເພີ່ມໃບບິນ' : 'ແກ້ໄຂໃບບິນ', bill_no: form.bill_no, patient_name: form.patient_name, amount: form.grand_total, recorder: form.recorded_by })
      setModal(null); fetchRows(); fetchKpis()
    } else alert('Error: ' + error.message)
  }

  async function handleDelete() {
    setSaving(true)
    const { error } = await supabase.from('ar_bills').delete().eq('id', delTarget.id)
    setSaving(false)
    if (!error) {
      logAction({ action: 'ລົບໃບບິນ', bill_no: delTarget.bill_no, patient_name: delTarget.patient_name, amount: delTarget.grand_total })
      setDelTarget(null); fetchRows(); fetchKpis()
    } else alert('Error: ' + error.message)
  }

  async function handleDeleteAll() {
    setSaving(true)
    const { error } = await supabase.from('ar_bills').delete().not('id', 'is', null)
    setSaving(false)
    if (!error) { setDelAll(false); fetchRows(); fetchKpis() }
    else alert('Error: ' + error.message)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  if (loading) return <div className="p-6"><LoadingSpinner /></div>

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="section-title">ຈັດການໃບບິນ</h2>
          <p className="text-xs text-slate-500 mt-0.5">ທັງໝົດ {fmt(total)} ໃບ</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setDelAll(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-semibold rounded-xl border border-red-200 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            ລົບທັງໝົດ
          </button>
          <button onClick={downloadTemplate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl border border-slate-200 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Template
          </button>
          <button onClick={() => navigate('/upload')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl border border-slate-200 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            ອັບໂຫຼດ Excel
          </button>
          <button onClick={() => setModal({ mode: 'add' })} className="btn-primary">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            ເພີ່ມໃບບິນ
          </button>
        </div>
      </div>

      {/* KPI Summary Boxes */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'ຍອດຂາຍລວມ', value: kpis.total_grand, color: 'text-slate-700', bg: 'bg-white border-slate-200' },
          { label: 'ເງິນທີ່ຮັບແລ້ວ', value: kpis.total_collected, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
          { label: 'ໜີ້ຄ້າງຊຳລະ', value: kpis.total_debt, color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
          { label: 'ຈຳນວນໃບບິນ', value: total, color: 'text-slate-700', bg: 'bg-white border-slate-200', isCount: true },
        ].map(k => (
          <div key={k.label} className={`rounded-xl p-4 border ${k.bg}`}>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{k.label}</p>
            <p className={`text-xl font-bold mt-1 font-mono ${k.color}`}>{fmt(k.value)}</p>
            {!k.isCount && <p className="text-[10px] text-slate-400 mt-0.5">LAK</p>}
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-100 p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-semibold text-slate-500 mb-1">ຄົ້ນຫາ</label>
          <input
            type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(0) }}
            placeholder="ເລກໃບບິນ, ຊື່ຄົນເຈັບ..."
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          />
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
        {(search || dateFrom || dateTo) && (
          <button onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); setPage(0) }}
            className="text-xs text-slate-500 hover:text-slate-800 underline">
            ລ້າງ
          </button>
        )}
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
                <th className="table-th">OPD/IPD</th>
                <th className="table-th">ລາຍຮັບຕາມບໍລິການ</th>
                <th className="table-th text-right">Grand Total</th>
                <th className="table-th text-right">ໜີ້</th>
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
                    <div className="flex flex-wrap gap-1">
                      {[
                        ['OPD', row.svc_opd], ['Diag', row.svc_diag_image], ['IPD', row.svc_ipd],
                        ['Surg', row.svc_surg_ot], ['ER', row.svc_emergency], ['Chronic', row.svc_chronic],
                        ['Pharma', row.svc_pharma], ['Support', row.svc_support], ['Admin', row.svc_admin], ['Home', row.svc_homecare],
                      ].filter(([, v]) => v > 0).map(([lbl, v]) => (
                        <span key={lbl} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-primary-50 text-primary-700 text-[10px] font-semibold rounded">
                          {lbl}: {fmt(v)}
                        </span>
                      ))}
                      {!['svc_opd','svc_diag_image','svc_ipd','svc_surg_ot','svc_emergency','svc_chronic','svc_pharma','svc_support','svc_admin','svc_homecare'].some(k => row[k] > 0) && (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </div>
                  </td>
                  <td className="table-td text-right font-mono text-xs">{fmt(row.grand_total)}</td>
                  <td className="table-td text-right font-mono text-xs">
                    {row.debt > 0 ? (
                      <span className="text-red-600 font-semibold">{fmt(row.debt)}</span>
                    ) : (
                      <span className="text-emerald-600">0</span>
                    )}
                  </td>
                  <td className="table-td text-xs text-slate-500">{row.workload}</td>
                  <td className="table-td text-xs text-slate-600">{row.recorded_by || <span className="text-slate-300">—</span>}</td>
                  <td className="table-td">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setModal({ mode: 'edit', row })}
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
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              ສະແດງ {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} ຈາກ {fmt(total)}
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
        onClose={() => setModal(null)}
        title={modal?.mode === 'edit' ? `ແກ້ໄຂ: ${modal.row?.bill_no}` : 'ເພີ່ມໃບບິນໃໝ່'}
        subtitle={modal?.mode === 'edit' ? `${modal.row?.patient_name} · ${modal.row?.date}` : 'ກະລຸນາໃສ່ຂໍ້ມູນໃຫ້ຄົບຖ້ວນ'}
        size="xl"
      >
        <BillForm
          initial={modal?.mode === 'edit' ? modal.row : {}}
          onSubmit={handleSubmit}
          onCancel={() => setModal(null)}
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
        message={`ທ່ານຕ້ອງການລົບ ${delTarget?.bill_no} ຂອງ ${delTarget?.patient_name} ແທ້ບໍ? ການດຳເນີນການນີ້ບໍ່ສາມາດຍ້ອນຄືນໄດ້.`}
        confirmLabel="ລົບ"
      />

      {/* Delete all */}
      <ConfirmDialog
        open={delAll}
        onClose={() => setDelAll(false)}
        onConfirm={handleDeleteAll}
        loading={saving}
        title="ລົບຂໍ້ມູນທັງໝົດ?"
        message={`ທ່ານຕ້ອງການລົບໃບບິນທັງໝົດ ${fmt(total)} ໃບ ອອກຈາກລະບົບແທ້ບໍ? ການດຳເນີນການນີ້ບໍ່ສາມາດຍ້ອນຄືນໄດ້.`}
        confirmLabel="ລົບທັງໝົດ"
      />
    </div>
  )
}
