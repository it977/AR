import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { logAction } from '../lib/log'
import Modal, { ConfirmDialog } from '../components/Modal'
import APBillForm from '../components/forms/APBillForm'
import LoadingSpinner from '../components/LoadingSpinner'

const AP_HEADERS = [
  'Date', 'Week', 'Workload', 'Invoice No', 'PO No', 'PO Date',
  'Vendor Name', 'Vendor Code', 'Department', 'Contact Person', 'Phone',
  'Bill Date', 'Due Date', 'Description',
  'Materials', 'Equipment', 'Maintenance', 'Consulting', 'Training', 'Software', 'Other',
  'Total', 'VAT', 'Grand Total',
  'Cash Paid', 'BCEL Paid', 'BCEL2 Paid', 'LDB Paid',
  'Balance', 'Debt Status', 'Status', 'Approved By', 'Aging Group', 'Note', 'Recorded By'
]

const SAMPLE_AP = [
  ['2026-01-15', 'Week 3', '8AM-4PM', 'INV-EDL001', 'PO-2026-001', '2026-01-10',
   'EDL', 'VEN001', 'Pharmacy', 'ສົມຈິດ', '020 1234 5678',
   '2026-01-15', '2026-02-14', 'ຢາ ແລະ ອຸປະກອນການແພດ',
   10000000, 0, 0, 0, 0, 0, 0,
   10000000, 700000, 10700000,
   0, 0, 0, 0,
   10700000, 'pending', 'approved', 'Admin', '30+ Days', 'ຄ້າງຈ່າຍ', 'Admin'],
]

function downloadTemplate() {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([AP_HEADERS, ...SAMPLE_AP])
  ws['!cols'] = AP_HEADERS.map(() => ({ wch: 18 }))
  XLSX.utils.book_append_sheet(wb, ws, 'AP Bills')
  XLSX.writeFile(wb, 'AP_Bills_Template_LXH.xlsx')
}

const PAGE_SIZE = 20
function fmt(v) { return new Intl.NumberFormat().format(v || 0) }

const STATUS_COLOR = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
  revised: 'bg-violet-100 text-violet-700',
}

const DEBT_STATUS_COLOR = {
  pending: 'bg-amber-100 text-amber-700',
  paid: 'bg-emerald-100 text-emerald-700',
  partial: 'bg-blue-100 text-blue-700',
}

export default function APManagement() {
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [search, setSearch] = useState('')
  const [vendor, setVendor] = useState('')
  const [department, setDepartment] = useState('')
  const [status, setStatus] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [kpis, setKpis] = useState({ 
    total_ap: 0, 
    total_outstanding: 0, 
    total_paid: 0,
    overdue_bills: 0,
    overdue_amount: 0,
  })

  const [modal, setModal] = useState(null)
  const [delTarget, setDelTarget] = useState(null)
  const [delAll, setDelAll] = useState(false)
  const navigate = useNavigate()

  function calcAgingGroup(dateStr) {
    if (!dateStr) return 'N'
    const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
    if (days <= 0) return 'N'
    if (days <= 15) return '0-15 Days'
    if (days <= 30) return '16-30 Days'
    if (days <= 45) return '31-45 Days'
    return '46-60+ Days'
  }

  const fetchRows = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('ap_bills').select('*', { count: 'exact' })

    if (search) q = q.or(`invoice_no.ilike.%${search}%,vendor_name.ilike.%${search}%`)
    if (vendor) q = q.eq('vendor_name', vendor)
    if (department) q = q.eq('department', department)
    if (status) q = q.eq('status', status)
    if (dateFrom) q = q.gte('date', dateFrom)
    if (dateTo) q = q.lte('date', dateTo)

    const { data, count, error } = await q
      .order('date', { ascending: false })
      .order('invoice_no', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

    if (!error) { setRows(data || []); setTotal(count || 0) }
    setLoading(false)
  }, [search, vendor, department, status, dateFrom, dateTo, page])

  const fetchKpis = useCallback(async () => {
    const PAGE = 1000
    let allData = [], from = 0, total = null
    while (true) {
      let q = supabase.from('ap_bills')
        .select('grand_total, cash_paid, bcel_paid, bcel2_paid, ldb_paid, balance, status, due_date', { count: 'exact' })
      if (search) q = q.or(`invoice_no.ilike.%${search}%,vendor_name.ilike.%${search}%`)
      if (vendor) q = q.eq('vendor_name', vendor)
      if (department) q = q.eq('department', department)
      if (status) q = q.eq('status', status)
      if (dateFrom) q = q.gte('date', dateFrom)
      if (dateTo) q = q.lte('date', dateTo)
      
      const { data, count, error } = await q.range(from, from + PAGE - 1)
      if (error) break
      if (total === null && count != null) total = count
      if (data?.length) allData = allData.concat(data)
      if (!data?.length || allData.length >= (total ?? Infinity) || data.length < PAGE) break
      from += PAGE
    }

    const today = new Date().toISOString().split('T')[0]
    setKpis({
      total_ap: allData.reduce((s, r) => s + (r.grand_total || 0), 0),
      total_outstanding: allData.reduce((s, r) => s + (r.balance || 0), 0),
      total_paid: allData.reduce((s, r) => s + ((r.cash_paid||0) + (r.bcel_paid||0) + (r.bcel2_paid||0) + (r.ldb_paid||0)), 0),
      overdue_bills: allData.filter(r => r.due_date && r.due_date < today && (r.balance || 0) > 0).length,
      overdue_amount: allData.filter(r => r.due_date && r.due_date < today && (r.balance || 0) > 0)
        .reduce((s, r) => s + (r.balance || 0), 0),
    })
  }, [search, vendor, department, status, dateFrom, dateTo])

  useEffect(() => { fetchRows() }, [fetchRows])
  useEffect(() => { fetchKpis() }, [fetchKpis])

  async function handleSubmit(form) {
    setSaving(true)
    const payload = { 
      ...form, 
      debt_status: (form.balance || 0) > 0 ? 'pending' : 'paid',
      total_paid: (form.cash_paid||0) + (form.bcel_paid||0) + (form.bcel2_paid||0) + (form.ldb_paid||0)
    }
    let error
    if (modal.mode === 'add') {
      ;({ error } = await supabase.from('ap_bills').insert(payload))
    } else {
      ;({ error } = await supabase.from('ap_bills').update(payload).eq('id', form.id))
    }
    setSaving(false)
    if (!error) {
      try {
        await logAction({ 
          action: modal.mode === 'add' ? 'ເພີ່ມ AP Bill' : 'ແກ້ໄຂ AP Bill', 
          invoice_no: form.invoice_no, 
          vendor_name: form.vendor_name, 
          amount: form.grand_total, 
          recorder: form.recorded_by 
        })
      } catch (logErr) {
        console.warn('⚠️ Log action failed:', logErr)
      }
      setModal(null); fetchRows(); fetchKpis()
    } else alert('Error: ' + error.message)
  }

  async function handleDelete() {
    setSaving(true)
    const { error } = await supabase.from('ap_bills').delete().eq('id', delTarget.id)
    setSaving(false)
    if (!error) {
      try {
        await logAction({ 
          action: 'ລົບ AP Bill', 
          invoice_no: delTarget.invoice_no, 
          vendor_name: delTarget.vendor_name, 
          amount: delTarget.grand_total 
        })
      } catch (logErr) {
        console.warn('⚠️ Log action failed:', logErr)
      }
      setDelTarget(null); fetchRows(); fetchKpis()
    } else alert('Error: ' + error.message)
  }

  async function handleDeleteAll() {
    setSaving(true)
    const { error: errorDebt } = await supabase.from('ap_debt').delete().not('id', 'is', null)
    const { error: errorBills } = await supabase.from('ap_bills').delete().not('id', 'is', null)
    setSaving(false)
    if (!errorBills && !errorDebt) {
      try {
        await logAction({ action: 'ລຶບຂໍ້ມູນ AP ທັງໝົດ', details: 'ລຶບທັງ ap_bills ແລະ ap_debt' })
      } catch (logErr) {
        console.warn('⚠️ Log action failed:', logErr)
      }
      setDelAll(false); fetchRows(); fetchKpis()
    } else {
      alert('Error: ' + (errorBills?.message || errorDebt?.message || 'Unknown error'))
    }
  }

  async function syncDebtToApDebt() {
    setSaving(true)
    try {
      const { data: billsWithDebt, error: fetchError } = await supabase
        .from('ap_bills')
        .select('*')
        .gt('balance', 0)
        .eq('debt_status', 'pending')

      console.log('📊 AP Sync - Bills with debt:', { count: billsWithDebt?.length, error: fetchError })

      if (fetchError) throw fetchError

      if (!billsWithDebt || billsWithDebt.length === 0) {
        alert('ບໍ່ມີໃບເກັບເງິນທີ່ມີໜີ້ຄ້າງທີ່ຍັງບໍ່ທັນສົ່ງ')
        setSaving(false)
        return
      }

      const debtRecords = billsWithDebt.map(bill => ({
        date: bill.date,
        invoice_no: bill.invoice_no,
        vendor_name: bill.vendor_name,
        vendor_code: bill.vendor_code,
        department: bill.department,
        po_no: bill.po_no,
        grand_total: bill.grand_total,
        debt_amount: bill.balance,
        date_paid: bill.bill_date,
        submit_date: new Date().toISOString().split('T')[0],
        amount_paid: bill.total_paid || 0,
        cash_paid: bill.cash_paid,
        bcel_paid: bill.bcel_paid,
        bcel2_paid: bill.bcel2_paid,
        ldb_paid: bill.ldb_paid,
        balance: bill.balance,
        due_date: bill.due_date,
        aging_group: bill.aging_group || calcAgingGroup(bill.date),
        status: 'pending',
        note: bill.note,
        recorded_by: bill.recorded_by,
      }))

      const { data: existingDebt } = await supabase
        .from('ap_debt')
        .select('invoice_no')
        .in('invoice_no', billsWithDebt.map(b => b.invoice_no))

      const existingInvoiceNos = new Set(existingDebt?.map(d => d.invoice_no) || [])
      const newRecords = debtRecords.filter(r => !existingInvoiceNos.has(r.invoice_no))

      console.log('📊 AP Sync - Records to insert:', { 
        totalBillsWithDebt: billsWithDebt.length, 
        existingCount: existingInvoiceNos.size,
        newRecordsCount: newRecords.length 
      })

      if (newRecords.length === 0) {
        alert('ໃບເກັບເງິນທັງໝົດືກສົ່ງໄປ AP Debt ແລ້ວ')
        setSaving(false)
        return
      }

      const { error: insertError } = await supabase.from('ap_debt').insert(newRecords)

      if (insertError) throw insertError

      try {
        await logAction({
          action: 'ສົ່ງໜີ້ຄ້າງໄປ AP Debt',
          details: `ສົ່ງ ${newRecords.length} ໃບເກັບເງິນ`,
          amount: newRecords.reduce((s, r) => s + (r.debt_amount || 0), 0)
        })
      } catch (logErr) {
        console.warn('⚠️ Log action failed:', logErr)
      }

      alert(`ສົ່ງ ${newRecords.length} ໃບເກັບເງິນ ໄປ AP Debt ສຳເລັດ!`)
      fetchRows()
      fetchKpis()
    } catch (err) {
      console.error('AP Sync error:', err)
      alert('ຜິດພາດ: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  if (loading) return <div className="p-6"><LoadingSpinner /></div>

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="section-title">ຈັດການໃບເກັບເງິນຂາເຂົ້າ (AP)</h2>
          <p className="text-xs text-slate-500 mt-0.5">ທັງໝົດ {fmt(total)} ໃບ</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={syncDebtToApDebt}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 text-sm font-semibold rounded-xl border border-amber-200 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            ສົ່ງໜີ້ຄ້າງ
          </button>
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
          <button onClick={() => setModal({ mode: 'add' })} className="btn-primary">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            ເພີ່ມໃບເກັບເງິນ
          </button>
        </div>
      </div>

      {/* KPI Summary Boxes */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'ຍອດ AP ລວມ', value: kpis.total_ap, color: 'text-slate-700', bg: 'bg-white border-slate-200' },
          { label: 'ຍອດຄ້າງຈ່າຍ', value: kpis.total_outstanding, color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
          { label: 'ຍອດຈ່າຍແລ້ວ', value: kpis.total_paid, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
          { label: 'ໃບຄ້າງເກີນກຳນົດ', value: kpis.overdue_bills, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', isCount: true },
          { label: 'ຍອດເກີນກຳນົດ', value: kpis.overdue_amount, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
        ].map(k => (
          <div key={k.label} className={`rounded-xl p-4 border ${k.bg}`}>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{k.label}</p>
            <p className={`text-lg font-bold mt-1 font-mono ${k.color}`}>{fmt(k.value)}</p>
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
          <label className="block text-xs font-semibold text-slate-500 mb-1">ພະແນກ</label>
          <select value={department} onChange={e => { setDepartment(e.target.value); setPage(0) }}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary-400">
            <option value="">ທັງໝົດ</option>
            <option value="Pharmacy">Pharmacy</option>
            <option value="IT Support">IT Support</option>
            <option value="Administration">Administration</option>
            <option value="Lab">Lab</option>
            <option value="Emergency Room">Emergency Room</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">ສະຖານະ</label>
          <select value={status} onChange={e => { setStatus(e.target.value); setPage(0) }}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary-400">
            <option value="">ທັງໝົດ</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="revised">Revised</option>
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
        {(search || vendor || department || status || dateFrom || dateTo) && (
          <button onClick={() => { setSearch(''); setVendor(''); setDepartment(''); setStatus(''); setDateFrom(''); setDateTo(''); setPage(0) }}
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
                <th className="table-th">PO No</th>
                <th className="table-th text-right">Grand Total</th>
                <th className="table-th text-right">ຈ່າຍແລ້ວ</th>
                <th className="table-th text-right">ຄ້າງຈ່າຍ</th>
                <th className="table-th">ສະຖານະ</th>
                <th className="table-th">Due Date</th>
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
                  <td className="table-td text-xs font-mono">{row.po_no || '—'}</td>
                  <td className="table-td text-right font-mono text-xs">{fmt(row.grand_total)}</td>
                  <td className="table-td text-right font-mono text-xs text-emerald-600">{fmt(row.total_paid || 0)}</td>
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
                  <td className="table-td text-xs">
                    {row.due_date ? (
                      <span className={row.due_date < new Date().toISOString().split('T')[0] ? 'text-red-600 font-semibold' : 'text-slate-600'}>
                        {row.due_date}
                      </span>
                    ) : '—'}
                  </td>
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
        title={modal?.mode === 'edit' ? `ແກ້ໄຂ: ${modal.row?.invoice_no}` : 'ເພີ່ມໃບເກັບເງິນໃໝ່ (AP)'}
        subtitle={modal?.mode === 'edit' ? `${modal.row?.vendor_name} · ${modal.row?.date}` : 'ກະລຸນາໃສ່ຂໍ້ມູນໃຫ້ຄົບຖ້ວນ'}
        size="xl"
      >
        <APBillForm
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
        title="ລົບໃບເກັບເງິນ?"
        message={`ທ່ານຕ້ອງການລົບ ${delTarget?.invoice_no} ຂອງ ${delTarget?.vendor_name} ແທ້ບໍ? ການດຳເນີນການນີ້ບໍ່ສາມາດຍ້ອນຄືນໄດ້.`}
        confirmLabel="ລົບ"
      />

      {/* Delete all */}
      <ConfirmDialog
        open={delAll}
        onClose={() => setDelAll(false)}
        onConfirm={handleDeleteAll}
        loading={saving}
        title="ລົບຂໍ້ມູນ AP ທັງໝົດ?"
        message={`ທ່ານຕ້ອງການລົບໃບເກັບເງິນທັງໝົດ ${fmt(total)} ໃບ ອອກຈາກລະບົບແທ້ບໍ? ການດຳເນີນການນີ້ບໍ່ສາມາດຍ້ອນຄືນໄດ້.`}
        confirmLabel="ລົບທັງໝົດ"
      />
    </div>
  )
}
