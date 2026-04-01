import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { logAction } from '../lib/log'
import Modal, { ConfirmDialog } from '../components/Modal'
import APDebtPaymentForm from '../components/forms/APDebtPaymentForm'
import LoadingSpinner from '../components/LoadingSpinner'

function fmt(v) { return new Intl.NumberFormat().format(v || 0) }

const AGING_COLOR = {
  'N':          'bg-slate-100 text-slate-600',
  '0-15 Days':  'bg-emerald-100 text-emerald-700',
  '16-30 Days': 'bg-yellow-100 text-yellow-700',
  '31-45 Days': 'bg-orange-100 text-orange-700',
  '46-60+ Days':'bg-red-100 text-red-700',
}

const STATUS_COLOR = {
  pending: 'bg-amber-100 text-amber-700',
  paid: 'bg-emerald-100 text-emerald-700',
  partial: 'bg-blue-100 text-blue-700',
}

export default function APDebtManagement() {
  const [rows, setRows]       = useState([])
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(0)
  const [pageSize, setPageSize] = useState(50)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving]   = useState(false)

  const [search, setSearch]     = useState('')
  const [vendor, setVendor]     = useState('')
  const [aging, setAging]       = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')

  const [modal, setModal]         = useState(null)
  const [delTarget, setDelTarget] = useState(null)
  const [delAll, setDelAll]       = useState(false)
  const navigate = useNavigate()

  const [kpis, setKpis] = useState({ total_debt: 0, total_paid: 0, total_balance: 0, records: 0 })

  function calcAging(dateStr) {
    if (!dateStr) return 'N'
    const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
    if (days <= 0)  return 'N'
    if (days <= 15) return '0-15 Days'
    if (days <= 30) return '16-30 Days'
    if (days <= 45) return '31-45 Days'
    return '46-60+ Days'
  }

  const fetchKpis = useCallback(async () => {
    const PAGE = 1000
    let allData = [], from = 0, total = null
    while (true) {
      let q = supabase.from('ap_debt')
        .select('debt_amount, cash_paid, bcel_paid, bcel2_paid, ldb_paid, balance', { count: 'exact' })
      const { data, count, error } = await q.range(from, from + PAGE - 1)
      if (error) break
      if (total === null && count != null) total = count
      if (data?.length) allData = allData.concat(data)
      if (!data?.length || allData.length >= (total ?? Infinity) || data.length < PAGE) break
      from += PAGE
    }

    const originalDebt = allData.reduce((s, r) => s + (r.debt_amount || 0), 0)
    const collected    = allData.reduce((s, r) => s + (r.cash_paid || 0) + (r.bcel_paid || 0) + (r.bcel2_paid || 0) + (r.ldb_paid || 0), 0)
    const remaining    = allData.reduce((s, r) => s + (r.balance || 0), 0)

    setKpis({
      total_debt:    originalDebt > 0 ? originalDebt : collected + remaining,
      total_paid:    collected,
      total_balance: remaining,
      records:       allData.length,
    })
  }, [])

  const fetchRows = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('ap_debt').select('*', { count: 'exact' })

    if (search)       q = q.or(`invoice_no.ilike.%${search}%,vendor_name.ilike.%${search}%`)
    if (vendor)       q = q.eq('vendor_name', vendor)
    if (statusFilter === 'pending') q = q.gt('balance', 0)
    if (statusFilter === 'paid')    q = q.lte('balance', 0)
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
      .order('invoice_no', { ascending: false })
      .range(page * pageSize, page * pageSize + pageSize - 1)

    if (!error) { setRows(data || []); setTotal(count || 0) }
    setLoading(false)
  }, [search, vendor, aging, statusFilter, dateFrom, dateTo, page, pageSize])

  useEffect(() => { fetchRows(); fetchKpis() }, [fetchRows, fetchKpis])

  async function handleSubmit(form) {
    setSaving(true)
    const { error } = await supabase.from('ap_debt').update(form).eq('id', form.id)
    setSaving(false)
    if (!error) {
      // Update ap_bills ດ້ວຍ
      const { data: apBill } = await supabase
        .from('ap_bills')
        .select('id')
        .eq('invoice_no', form.invoice_no)
        .single()
      
      if (apBill) {
        await supabase.from('ap_bills').update({
          cash_paid: form.cash_paid,
          bcel_paid: form.bcel_paid,
          bcel2_paid: form.bcel2_paid,
          ldb_paid: form.ldb_paid,
          total_paid: form.amount_paid,
          balance: form.balance,
          debt_status: form.balance > 0 ? 'partial' : 'paid',
        }).eq('id', apBill.id)
      }

      logAction({ 
        action: 'ຈ່າຍໜີ້ AP', 
        invoice_no: form.invoice_no, 
        vendor_name: form.vendor_name, 
        amount: form.amount_paid, 
        details: form.balance === 0 ? 'ຈ່າຍຄົບ' : 'ຈ່າຍບາງສ່ວນ', 
        recorder: form.recorded_by 
      })
      setModal(null); fetchRows(); fetchKpis()
    } else alert('Error: ' + error.message)
  }

  async function handleDelete() {
    setSaving(true)
    const { error } = await supabase.from('ap_debt').delete().eq('id', delTarget.id)
    setSaving(false)
    if (!error) {
      setDelTarget(null); fetchRows(); fetchKpis()
    } else alert('Error: ' + error.message)
  }

  async function handleDeleteAll() {
    setSaving(true)
    const { error } = await supabase.from('ap_debt').delete().not('id', 'is', null)
    setSaving(false)
    if (!error) {
      setDelAll(false); fetchRows(); fetchKpis()
    } else alert('Error: ' + error.message)
  }

  const totalPages = Math.ceil(total / pageSize)

  if (loading) return <div className="p-6"><LoadingSpinner /></div>

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="section-title">ຈ່າຍໜີ້ຄ້າງ (AP Debt)</h2>
          <p className="text-xs text-slate-500 mt-0.5">ທັງໝົດ {fmt(total)} ລາຍການ</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setDelAll(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-semibold rounded-xl border border-red-200 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            ລົບທັງໝົດ
          </button>
        </div>
      </div>

      {/* KPI Summary Boxes */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'ໜີ້ສິນລວມ', value: kpis.total_debt, color: 'text-slate-700', bg: 'bg-white border-slate-200' },
          { label: 'ຈ່າຍແລ້ວ', value: kpis.total_paid, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
          { label: 'ຍອດຄ້າງ', value: kpis.total_balance, color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
          { label: 'ຈຳນວນໃບ', value: kpis.records, color: 'text-slate-700', bg: 'bg-white border-slate-200', isCount: true },
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
            placeholder="ເລກໃບເກັບເງິນ, ຊື່ Vendor..."
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Vendor</label>
          <input type="text" value={vendor} onChange={e => { setVendor(e.target.value); setPage(0) }}
            placeholder="ຊື່ Vendor"
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary-400" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">ສະຖານະ</label>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0) }}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary-400">
            <option value="">ທັງໝົດ</option>
            <option value="pending">ຄ້າງຈ່າຍ</option>
            <option value="paid">ຈ່າຍແລ້ວ</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Aging</label>
          <select value={aging} onChange={e => { setAging(e.target.value); setPage(0) }}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary-400">
            <option value="">ທັງໝົດ</option>
            <option value="N">Current (N)</option>
            <option value="0-15 Days">0-15 Days</option>
            <option value="16-30 Days">16-30 Days</option>
            <option value="31-45 Days">31-45 Days</option>
            <option value="46-60+ Days">46-60+ Days</option>
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
        {(search || vendor || statusFilter || aging || dateFrom || dateTo) && (
          <button onClick={() => { setSearch(''); setVendor(''); setStatusFilter(''); setAging(''); setDateFrom(''); setDateTo(''); setPage(0) }}
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
                <th className="table-th">Invoice No</th>
                <th className="table-th">ວັນທີ</th>
                <th className="table-th">Vendor</th>
                <th className="table-th">ພະແນກ</th>
                <th className="table-th">Due Date</th>
                <th className="table-th text-right">ໜີ້ສິນ</th>
                <th className="table-th text-right">ຈ່າຍແລ້ວ</th>
                <th className="table-th text-right">ຄ້າງ</th>
                <th className="table-th">ສະຖານະ</th>
                <th className="table-th">Aging</th>
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
                  <td className="table-td font-mono text-xs font-semibold text-primary-600">{row.invoice_no}</td>
                  <td className="table-td text-xs">{row.date}</td>
                  <td className="table-td font-semibold">{row.vendor_name}</td>
                  <td className="table-td text-xs">{row.department}</td>
                  <td className="table-td text-xs">
                    {row.due_date ? (
                      <span className={row.due_date < new Date().toISOString().split('T')[0] ? 'text-red-600 font-semibold' : 'text-slate-600'}>
                        {row.due_date}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="table-td text-right font-mono text-xs">{fmt(row.debt_amount)}</td>
                  <td className="table-td text-right font-mono text-xs text-emerald-600">{fmt(row.amount_paid || 0)}</td>
                  <td className="table-td text-right font-mono text-xs">
                    {row.balance > 0 ? (
                      <span className="text-red-600 font-semibold">{fmt(row.balance)}</span>
                    ) : (
                      <span className="text-emerald-600">0</span>
                    )}
                  </td>
                  <td className="table-td">
                    <span className={`badge ${STATUS_COLOR[row.status] || 'bg-slate-100 text-slate-600'}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="table-td">
                    <span className={`badge ${AGING_COLOR[row.aging_group] || 'bg-slate-100 text-slate-600'}`}>
                      {row.aging_group}
                    </span>
                  </td>
                  <td className="table-td">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setModal({ mode: 'pay', row })}
                        className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="ຈ່າຍໜີ້"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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
                ຖັດປ
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={`ຈ່າຍໜີ້: ${modal?.row?.invoice_no}`}
        subtitle={`${modal?.row?.vendor_name} · ຄ້າງ: ${fmt(modal?.row?.balance)} LAK`}
        size="lg"
      >
        <APDebtPaymentForm
          initial={modal?.row || {}}
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
        title="ລົບໃບຈ່າຍໜີ້?"
        message={`ທ່ານຕ້ອງການລົບ ${delTarget?.invoice_no} ຂອງ ${delTarget?.vendor_name} ແທ້ບໍ?`}
        confirmLabel="ລົບ"
      />

      {/* Delete all */}
      <ConfirmDialog
        open={delAll}
        onClose={() => setDelAll(false)}
        onConfirm={handleDeleteAll}
        loading={saving}
        title="ລົບຂໍ້ມູນ AP Debt ທັງໝົດ?"
        message={`ທ່ານຕ້ອງການລົບໃບຈ່າຍໜີ້ທັງໝົດ ${fmt(total)} ລາຍການ ອອກຈາກລະບົບແທ້ບໍ?`}
        confirmLabel="ລົບທັງໝົດ"
      />
    </div>
  )
}
