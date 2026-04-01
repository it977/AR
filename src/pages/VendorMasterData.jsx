import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import Modal, { ConfirmDialog } from '../components/Modal'
import LoadingSpinner from '../components/LoadingSpinner'

const CATEGORIES = ['ຢາ/Medicine', 'ອຸປະກອນ/Equip', 'ຕ້ອງໃຊ້ອງການ', 'ບໍລິການ/Service', 'ວັດທະນະປະໄພກ', 'ຄອມພິວເຕີ']
const TYPES = ['ຜູ້ສະໜອງທີ່ມີສັນຍາ (Contracted)', 'ຜູ້ສະໜອງທີ່ບໍ່ມີສັນຍາ (Non-Contracted)', 'ຜູ້ສະໜອງອ່ນໆ']
const COST_MAIN = ['COGS', 'Operating Cost']
const COST_SUB = ['Cheme', 'Medicines', 'Medical Equip', 'Device', 'Out source Service', 'Utility (ໄຟ້າ/ນ້ຳປະປາ)', 'Staffing salary', 'Employee Benefit', 'SSO (ປະກັນສັງຄົມ)', 'Training', 'Recruitment', 'Maintenance', 'Stationaries', 'Rent', 'Legal+License', 'Emergency matter', 'Medes Office Supply', 'Others']
const DEPARTMENTS = ['Pharmacy', 'Lab', 'Administration', 'Emergency Room', 'IT Support', 'HR', 'Finance']

const EMPTY = {
  vendor_code: '', vendor_name: '', category: '', credit_term: 30,
  type: '', cost_type_main: 'COGS', cost_type_sub: '', department: '',
  contact_person: '', phone: '', email: '', address: '',
  tax_id: '', bank_name: '', bank_account: '', status: 'active'
}

function fmt(v) { return new Intl.NumberFormat().format(v || 0) }

export default function VendorMasterData() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)
  const [delTarget, setDelTarget] = useState(null)

  const fetchRows = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('ap_vendors').select('*', { count: 'exact' })
    if (search) q = q.or(`vendor_code.ilike.%${search}%,vendor_name.ilike.%${search}%`)
    const { data, error } = await q.order('vendor_code')
    if (!error) setRows(data || [])
    setLoading(false)
  }, [search])

  useEffect(() => { fetchRows() }, [fetchRows])

  async function handleSubmit(form) {
    setSaving(true)
    let error
    if (modal.mode === 'add') {
      ;({ error } = await supabase.from('ap_vendors').insert(form))
    } else {
      ;({ error } = await supabase.from('ap_vendors').update(form).eq('id', form.id))
    }
    setSaving(false)
    if (!error) { setModal(null); fetchRows() }
    else alert('Error: ' + error.message)
  }

  async function handleDelete() {
    setSaving(true)
    const { error } = await supabase.from('ap_vendors').delete().eq('id', delTarget.id)
    setSaving(false)
    if (!error) { setDelTarget(null); fetchRows() }
    else alert('Error: ' + error.message)
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="section-title">00_Master_Data - ຂໍ້ມູນ Vendor</h2>
          <p className="text-xs text-slate-500 mt-0.5">ທັງໝົດ {rows.length} ລາຍການ</p>
        </div>
        <button onClick={() => setModal({ mode: 'add' })} className="btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          ເພີ່ມ Vendor
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-slate-100 p-4">
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="ຄົ້ນຫາ Vendor Code ຫຼື ຊື່ Vendor..."
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary-400"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="table-th">Vendor Code</th>
                <th className="table-th">Vendor Name</th>
                <th className="table-th">Category</th>
                <th className="table-th text-center">Credit Term</th>
                <th className="table-th">Type</th>
                <th className="table-th">Cost Type (Main)</th>
                <th className="table-th">Cost Type (Sub)</th>
                <th className="table-th">Department</th>
                <th className="table-th">Contact</th>
                <th className="table-th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={10} className="table-td text-center py-12">ກຳລັງໂຫຼດ...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={10} className="table-td text-center py-12">ບໍ່ມີຂໍ້ມູນ</td></tr>
              ) : rows.map(row => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="table-td font-mono font-semibold text-primary-600">{row.vendor_code}</td>
                  <td className="table-td font-semibold">{row.vendor_name}</td>
                  <td className="table-td">{row.category}</td>
                  <td className="table-td text-center">{row.credit_term} ວັນ</td>
                  <td className="table-td">{row.type}</td>
                  <td className="table-td"><span className="badge bg-slate-100 text-slate-600">{row.cost_type_main}</span></td>
                  <td className="table-td">{row.cost_type_sub}</td>
                  <td className="table-td">{row.department}</td>
                  <td className="table-td text-xs">{row.contact_person}<br/><span className="text-slate-400">{row.phone}</span></td>
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
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.mode === 'edit' ? 'ແກ້ໄຂ Vendor' : 'ເພີ່ມ Vendor ໃໝ່'} size="xl">
        <VendorForm initial={modal?.row || EMPTY} onSubmit={handleSubmit} onCancel={() => setModal(null)} loading={saving} />
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog open={!!delTarget} onClose={() => setDelTarget(null)} onConfirm={handleDelete} loading={saving} title="ລົບ Vendor?" message={`ທ່ານຕ້ອງການລົບ ${delTarget?.vendor_name} ແທ້ບໍ?`} confirmLabel="ລົບ" />
    </div>
  )
}

function VendorForm({ initial, onSubmit, onCancel, loading }) {
  const [form, setForm] = useState({ ...EMPTY, ...initial })
  function set(k, v) { setForm(prev => ({ ...prev, [k]: v })) }

  function handleSubmit(e) {
    e.preventDefault()
    onSubmit({ ...form, credit_term: parseInt(form.credit_term) || 0 })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto p-2">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div><label className="block text-xs font-semibold text-slate-600 mb-1">Vendor Code *</label><input type="text" value={form.vendor_code} onChange={e => set('vendor_code', e.target.value)} required className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary-400" /></div>
        <div><label className="block text-xs font-semibold text-slate-600 mb-1">Vendor Name *</label><input type="text" value={form.vendor_name} onChange={e => set('vendor_name', e.target.value)} required className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary-400" /></div>
        <div><label className="block text-xs font-semibold text-slate-600 mb-1">Category</label><select value={form.category} onChange={e => set('category', e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary-400">{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
        <div><label className="block text-xs font-semibold text-slate-600 mb-1">Credit Term (Days)</label><input type="number" value={form.credit_term} onChange={e => set('credit_term', e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary-400 text-right" /></div>
        <div><label className="block text-xs font-semibold text-slate-600 mb-1">Type</label><select value={form.type} onChange={e => set('type', e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary-400">{TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
        <div><label className="block text-xs font-semibold text-slate-600 mb-1">Department</label><select value={form.department} onChange={e => set('department', e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary-400">{DEPARTMENTS.map(d => <option key={d}>{d}</option>)}</select></div>
        <div><label className="block text-xs font-semibold text-slate-600 mb-1">Cost Type (Main)</label><select value={form.cost_type_main} onChange={e => set('cost_type_main', e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary-400">{COST_MAIN.map(c => <option key={c}>{c}</option>)}</select></div>
        <div><label className="block text-xs font-semibold text-slate-600 mb-1">Cost Type (Sub)</label><select value={form.cost_type_sub} onChange={e => set('cost_type_sub', e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary-400">{COST_SUB.map(c => <option key={c}>{c}</option>)}</select></div>
        <div><label className="block text-xs font-semibold text-slate-600 mb-1">Contact Person</label><input type="text" value={form.contact_person} onChange={e => set('contact_person', e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary-400" /></div>
        <div><label className="block text-xs font-semibold text-slate-600 mb-1">Phone</label><input type="text" value={form.phone} onChange={e => set('phone', e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary-400" /></div>
        <div><label className="block text-xs font-semibold text-slate-600 mb-1">Email</label><input type="email" value={form.email} onChange={e => set('email', e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary-400" /></div>
        <div><label className="block text-xs font-semibold text-slate-600 mb-1">Tax ID</label><input type="text" value={form.tax_id} onChange={e => set('tax_id', e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary-400" /></div>
        <div><label className="block text-xs font-semibold text-slate-600 mb-1">Bank Name</label><input type="text" value={form.bank_name} onChange={e => set('bank_name', e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary-400" /></div>
        <div><label className="block text-xs font-semibold text-slate-600 mb-1">Bank Account</label><input type="text" value={form.bank_account} onChange={e => set('bank_account', e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary-400" /></div>
        <div><label className="block text-xs font-semibold text-slate-600 mb-1">Status</label><select value={form.status} onChange={e => set('status', e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary-400"><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
      </div>
      <div className="flex justify-end gap-3 pt-4 border-t"><button type="button" onClick={onCancel} className="btn-secondary">ຍົກເລີກ</button><button type="submit" disabled={loading} className="btn-primary px-6">{loading ? 'ກຳລັງບັນທຶກ...' : 'ບັນທຶກ'}</button></div>
    </form>
  )
}
