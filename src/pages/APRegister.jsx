import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import Modal, { ConfirmDialog } from '../components/Modal'
import LoadingSpinner from '../components/LoadingSpinner'
import PDFButton from '../components/PDFButton'

const COST_TYPES = ['COGS', 'Operating Cost']
const EXPENSE_ITEMS = ['Medicines', 'Device', 'Out source Service', 'Utility (ໄຟ້າ/ນ້ຳປະປາ)', 'SSO (ປະກັນສັງຄົມ)', 'Staffing salary', 'Employee Benefit', 'Training', 'Recruitment', 'Maintenance', 'Stationaries', 'Rent', 'Legal+License', 'Emergency matter', 'Medes Office Supply', 'Others']
const DEPARTMENTS = ['Pharmacy', 'Lab', 'Administration', 'Emergency Room', 'IT Support', 'HR', 'Finance']
const STATUS_OPTS = ['Paid', 'Overdue', 'Pending']
const AGING_OPTS = ['N', '0-15 Days', '16-30 Days', '31-45 Days', '46-60+ Days']

function fmt(v) { return new Intl.NumberFormat().format(v || 0) }

export default function APRegister() {
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({ vendor: '', department: '', status: '', aging: '', dateFrom: '', dateTo: '' })
  const [modal, setModal] = useState(null)
  const [delTarget, setDelTarget] = useState(null)

  const fetchRows = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('ap_register').select('*', { count: 'exact' })
    if (search) q = q.or(`invoice_no.ilike.%${search}%,vendor_name.ilike.%${search}%`)
    if (filters.vendor) q = q.eq('vendor_name', filters.vendor)
    if (filters.department) q = q.eq('department', filters.department)
    if (filters.status) q = q.eq('status', filters.status)
    if (filters.aging) q = q.eq('aging', filters.aging)
    if (filters.dateFrom) q = q.gte('rec_date', filters.dateFrom)
    if (filters.dateTo) q = q.lte('rec_date', filters.dateTo)
    const { data, count, error } = await q.order('rec_date', { ascending: false })
    if (!error) { setRows(data || []); setTotal(count || 0) }
    setLoading(false)
  }, [search, filters])

  useEffect(() => { fetchRows() }, [fetchRows])

  async function handleSubmit(form) {
    setSaving(true)
    let error
    if (modal.mode === 'add') {
      ;({ error } = await supabase.from('ap_register').insert(form))
    } else {
      ;({ error } = await supabase.from('ap_register').update(form).eq('id', form.id))
    }
    setSaving(false)
    if (!error) { setModal(null); fetchRows() }
    else alert('Error: ' + error.message)
  }

  async function handleDelete() {
    setSaving(true)
    const { error } = await supabase.from('ap_register').delete().eq('id', delTarget.id)
    setSaving(false)
    if (!error) { setDelTarget(null); fetchRows() }
    else alert('Error: ' + error.message)
  }

  const kpis = {
    total: rows.reduce((s, r) => s + (r.total_amount || 0), 0),
    deposited: rows.reduce((s, r) => s + (r.deposited_amount || 0), 0),
    paid: rows.reduce((s, r) => s + (r.paid_amount || 0), 0),
    balance: rows.reduce((s, r) => s + (r.balance || 0), 0),
    overdue: rows.filter(r => r.status === 'Overdue').length,
  }

  return (
    <div id="ap-register-content" className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="section-title">03_AP_Register - ເບີນຄ້າງຈ່າຍ</h2>
          <p className="text-xs text-slate-500 mt-0.5">ທັງໝົດ {fmt(total)} ໃບ</p>
        </div>
        <div className="flex items-center gap-2">
          <PDFButton elementId="ap-register-content" filename="AP_Register" label="PDF" />
          <button onClick={() => setModal({ mode: 'add' })} className="btn-primary">+ ເພີ່ມເບີນ</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-5 gap-4">
        <KpiCard label="ຍອດລວມ" value={kpis.total} color="text-slate-700" />
        <KpiCard label="ມັດຈຳ" value={kpis.deposited} color="text-amber-600" />
        <KpiCard label="ຈ່າຍແລ້ວ" value={kpis.paid} color="text-emerald-600" />
        <KpiCard label="ຄ້າງຈ່າຍ" value={kpis.balance} color="text-red-600" />
        <KpiCard label="ເກີນກຳນົດ" value={kpis.overdue} isCount color="text-amber-600" />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-100 p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-semibold text-slate-500 mb-1">ຄົ້ນຫາ</label>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="ເລກໃບເກັບເງິນ, Vendor..." className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary-400" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Vendor</label>
          <input type="text" value={filters.vendor} onChange={e => setFilters({...filters, vendor: e.target.value})} className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">ພະແນກ</label>
          <select value={filters.department} onChange={e => setFilters({...filters, department: e.target.value})} className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none"><option value="">ທັງໝົດ</option>{DEPARTMENTS.map(d => <option key={d}>{d}</option>)}</select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">ສະຖານະ</label>
          <select value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})} className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none"><option value="">ທັງໝົດ</option>{STATUS_OPTS.map(s => <option key={s}>{s}</option>)}</select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Aging</label>
          <select value={filters.aging} onChange={e => setFilters({...filters, aging: e.target.value})} className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none"><option value="">ທັງໝົດ</option>{AGING_OPTS.map(a => <option key={a}>{a}</option>)}</select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">ຈາກວັນທີ</label>
          <input type="date" value={filters.dateFrom} onChange={e => setFilters({...filters, dateFrom: e.target.value})} className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">ຫາວັນທີ</label>
          <input type="date" value={filters.dateTo} onChange={e => setFilters({...filters, dateTo: e.target.value})} className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="table-th">Rec Date</th>
                <th className="table-th">Invoice No</th>
                <th className="table-th">Ref PO/GRN</th>
                <th className="table-th">Vendor</th>
                <th className="table-th">Cost Type</th>
                <th className="table-th">Expense Item</th>
                <th className="table-th text-right">Total</th>
                <th className="table-th text-right">Deposited</th>
                <th className="table-th text-right">Paid</th>
                <th className="table-th text-right">Balance</th>
                <th className="table-th">Due Date</th>
                <th className="table-th">Aging</th>
                <th className="table-th">Status</th>
                <th className="table-th">Dept</th>
                <th className="table-th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={15} className="table-td text-center py-12">ກຳລັງໂຫຼດ...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={15} className="table-td text-center py-12">ບໍ່ມີຂໍ້ມູນ</td></tr>
              ) : rows.map(row => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="table-td">{row.rec_date}</td>
                  <td className="table-td font-mono font-semibold text-primary-600">{row.invoice_no}</td>
                  <td className="table-td font-mono text-xs">{row.ref_po_grn || '—'}</td>
                  <td className="table-td font-semibold">{row.vendor_name}</td>
                  <td className="table-td"><span className={`badge ${row.cost_type === 'COGS' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>{row.cost_type}</span></td>
                  <td className="table-td">{row.expense_item}</td>
                  <td className="table-td text-right font-mono">{fmt(row.total_amount)}</td>
                  <td className="table-td text-right font-mono text-amber-600">{fmt(row.deposited_amount || 0)}</td>
                  <td className="table-td text-right font-mono text-emerald-600">{fmt(row.paid_amount || 0)}</td>
                  <td className="table-td text-right font-mono font-semibold text-red-600">{fmt(row.balance)}</td>
                  <td className="table-td text-xs">{row.due_date}</td>
                  <td className="table-td"><span className={`badge ${getAgingColor(row.aging)}`}>{row.aging}</span></td>
                  <td className="table-td"><span className={`badge ${getStatusColor(row.status)}`}>{row.status}</span></td>
                  <td className="table-td text-xs">{row.department}</td>
                  <td className="table-td">
                    <div className="flex gap-1">
                      <button onClick={() => setModal({ mode: 'edit', row })} className="p-1.5 text-slate-400 hover:text-primary-600"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
                      <button onClick={() => setDelTarget(row)} className="p-1.5 text-slate-400 hover:text-red-600"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.mode === 'edit' ? 'ແກ້ໄຂເບີນ' : 'ເພີ່ມເບີນໃໝ່'} size="xl">
        <RegisterForm initial={modal?.row || {}} onSubmit={handleSubmit} onCancel={() => setModal(null)} loading={saving} />
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog open={!!delTarget} onClose={() => setDelTarget(null)} onConfirm={handleDelete} loading={saving} title="ລົບເບີນ?" message={`ທ່ານຕ້ອງການລົບ ${delTarget?.invoice_no} ແທ້ບໍ?`} confirmLabel="ລົບ" />
    </div>
  )
}

function KpiCard({ label, value, isCount, color = 'text-slate-700' }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-4 text-center">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold mt-2 font-mono ${color}`}>{isCount ? value : fmt(value)}</p>
      {!isCount && <p className="text-[9px] text-slate-400 mt-1">LAK</p>}
    </div>
  )
}

function getStatusColor(status) {
  const colors = { Paid: 'bg-emerald-100 text-emerald-700', Overdue: 'bg-red-100 text-red-700', Pending: 'bg-amber-100 text-amber-700' }
  return colors[status] || 'bg-slate-100 text-slate-600'
}

function getAgingColor(aging) {
  const colors = { 'N': 'bg-slate-100 text-slate-600', '0-15 Days': 'bg-emerald-100 text-emerald-700', '16-30 Days': 'bg-yellow-100 text-yellow-700', '31-45 Days': 'bg-orange-100 text-orange-700', '46-60+ Days': 'bg-red-100 text-red-700' }
  return colors[aging] || 'bg-slate-100 text-slate-600'
}

function RegisterForm({ initial, onSubmit, onCancel, loading }) {
  const [form, setForm] = useState({ ...initial })
  function set(k, v) { setForm(prev => ({ ...prev, [k]: v })) }

  function handleSubmit(e) {
    e.preventDefault()
    onSubmit({ ...form, total_amount: parseFloat(form.total_amount) || 0, deposited_amount: parseFloat(form.deposited_amount) || 0, paid_amount: parseFloat(form.paid_amount) || 0, balance: (parseFloat(form.total_amount) || 0) - (parseFloat(form.deposited_amount) || 0) - (parseFloat(form.paid_amount) || 0) })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto p-2">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div><label className="block text-xs font-semibold text-slate-600 mb-1">Rec Date *</label><input type="date" value={form.rec_date} onChange={e => set('rec_date', e.target.value)} required className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none" /></div>
        <div><label className="block text-xs font-semibold text-slate-600 mb-1">Invoice No *</label><input type="text" value={form.invoice_no} onChange={e => set('invoice_no', e.target.value)} required className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none" /></div>
        <div><label className="block text-xs font-semibold text-slate-600 mb-1">Ref PO/GRN</label><input type="text" value={form.ref_po_grn} onChange={e => set('ref_po_grn', e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none" /></div>
        <div><label className="block text-xs font-semibold text-slate-600 mb-1">Vendor *</label><input type="text" value={form.vendor_name} onChange={e => set('vendor_name', e.target.value)} required className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none" /></div>
        <div><label className="block text-xs font-semibold text-slate-600 mb-1">Cost Type</label><select value={form.cost_type} onChange={e => set('cost_type', e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none"><option value="COGS">COGS</option><option value="Operating Cost">Operating Cost</option></select></div>
        <div><label className="block text-xs font-semibold text-slate-600 mb-1">Expense Item</label><select value={form.expense_item} onChange={e => set('expense_item', e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none"><option value="">ເລືອກ...</option>{EXPENSE_ITEMS.map(i => <option key={i}>{i}</option>)}</select></div>
        <div><label className="block text-xs font-semibold text-slate-600 mb-1">Credit Term</label><input type="number" value={form.credit_term} onChange={e => set('credit_term', e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none text-right" /></div>
        <div><label className="block text-xs font-semibold text-slate-600 mb-1">Due Date</label><input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none" /></div>
        <div><label className="block text-xs font-semibold text-slate-600 mb-1">Department</label><select value={form.department} onChange={e => set('department', e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none"><option value="">ເລືອກ...</option>{DEPARTMENTS.map(d => <option key={d}>{d}</option>)}</select></div>
        <div><label className="block text-xs font-semibold text-slate-600 mb-1">Total Amount</label><input type="number" value={form.total_amount} onChange={e => set('total_amount', e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none text-right" /></div>
        <div><label className="block text-xs font-semibold text-slate-600 mb-1">Deposited</label><input type="number" value={form.deposited_amount} onChange={e => set('deposited_amount', e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none text-right" /></div>
        <div><label className="block text-xs font-semibold text-slate-600 mb-1">Paid Amount</label><input type="number" value={form.paid_amount} onChange={e => set('paid_amount', e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none text-right" /></div>
        <div><label className="block text-xs font-semibold text-slate-600 mb-1">Paid Date</label><input type="date" value={form.paid_date} onChange={e => set('paid_date', e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none" /></div>
        <div><label className="block text-xs font-semibold text-slate-600 mb-1">Aging</label><select value={form.aging} onChange={e => set('aging', e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none"><option value="N">N</option><option value="0-15 Days">0-15 Days</option><option value="16-30 Days">16-30 Days</option><option value="31-45 Days">31-45 Days</option><option value="46-60+ Days">46-60+ Days</option></select></div>
        <div><label className="block text-xs font-semibold text-slate-600 mb-1">Status</label><select value={form.status} onChange={e => set('status', e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none"><option value="Pending">Pending</option><option value="Overdue">Overdue</option><option value="Paid">Paid</option></select></div>
      </div>
      <div className="flex justify-end gap-3 pt-4 border-t"><button type="button" onClick={onCancel} className="btn-secondary">ຍົກເລີກ</button><button type="submit" disabled={loading} className="btn-primary px-6">{loading ? 'ກຳລັງບັນທຶກ...' : 'ບັນທຶກ'}</button></div>
    </form>
  )
}
