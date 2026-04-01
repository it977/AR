import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'
import LoadingSpinner from '../components/LoadingSpinner'

const DEPARTMENTS = ['Pharmacy', 'Lab', 'Administration', 'Emergency Room', 'IT Support', 'HR', 'Finance']
const COST_MAIN = ['COGS', 'Operating Cost']
const COST_SUB = ['Medicines', 'Out source Service', 'Employee Benefit', 'Training', 'Device', 'Utility (ໄຟ້າ/ນ້ຳປະປາ)', 'SSO (ປະກັນສັງຄົມ)', 'Recruitment', 'Maintenance', 'Stationaries', 'Rent', 'Legal+License', 'Emergency matter', 'Medes Office Supply', 'Others']
const STATUS = ['Ordered', 'Approved', 'Rejected', 'Pending']

export default function PRLog() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [modal, setModal] = useState(null)
  const [filters, setFilters] = useState({ department: '', status: '', dateFrom: '', dateTo: '' })

  const fetchRows = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('ap_pr').select('*', { count: 'exact' })
    if (filters.department) q = q.eq('request_by', filters.department)
    if (filters.status) q = q.eq('status', filters.status)
    if (filters.dateFrom) q = q.gte('date', filters.dateFrom)
    if (filters.dateTo) q = q.lte('date', filters.dateTo)
    const { data } = await q.order('date', { ascending: false })
    setRows(data || [])
    setLoading(false)
  }, [filters])

  useEffect(() => { fetchRows() }, [fetchRows])

  async function handleSubmit(form) {
    setSaving(true)
    const prNo = form.pr_no || `PR-${new Date().getFullYear()}-${String(rows.length + 1).padStart(3, '0')}`
    const { error } = await supabase.from('ap_pr').insert({ ...form, pr_no: prNo })
    setSaving(false)
    if (!error) { setModal(null); fetchRows() }
    else alert('Error: ' + error.message)
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="section-title">01_PR_Log - ໃບສະເໜີຊື້ (Purchase Request)</h2>
          <p className="text-xs text-slate-500 mt-0.5">ທັງໝົດ {rows.length} ລາຍການ</p>
        </div>
        <button onClick={() => setModal({ mode: 'add' })} className="btn-primary">+ ເພີ່ມ PR</button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-100 p-4 flex flex-wrap gap-3">
        <select value={filters.department} onChange={e => setFilters({...filters, department: e.target.value})} className="text-sm border border-slate-200 rounded-lg px-3 py-2"><option value="">Department (All)</option>{DEPARTMENTS.map(d => <option key={d}>{d}</option>)}</select>
        <select value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})} className="text-sm border border-slate-200 rounded-lg px-3 py-2"><option value="">Status (All)</option>{STATUS.map(s => <option key={s}>{s}</option>)}</select>
        <input type="date" value={filters.dateFrom} onChange={e => setFilters({...filters, dateFrom: e.target.value})} className="text-sm border border-slate-200 rounded-lg px-3 py-2" />
        <input type="date" value={filters.dateTo} onChange={e => setFilters({...filters, dateTo: e.target.value})} className="text-sm border border-slate-200 rounded-lg px-3 py-2" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="table-th">Date</th>
                <th className="table-th">PR No.</th>
                <th className="table-th">Request By</th>
                <th className="table-th">Cost Type (Main)</th>
                <th className="table-th">Cost Type (Sub)</th>
                <th className="table-th text-right">Est. Amount</th>
                <th className="table-th">Status</th>
                <th className="table-th">PO Ref</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? <tr><td colSpan={8} className="table-td text-center py-12">ກຳລັງໂຫຼດ...</td></tr> : rows.length === 0 ? <tr><td colSpan={8} className="table-td text-center py-12">ບໍ່ມີຂໍ້ມູນ</td></tr> : rows.map(row => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="table-td">{row.date}</td>
                  <td className="table-td font-mono font-semibold text-primary-600">{row.pr_no}</td>
                  <td className="table-td">{row.request_by}</td>
                  <td className="table-td"><span className="badge bg-slate-100">{row.cost_type_main}</span></td>
                  <td className="table-td">{row.cost_type_sub}</td>
                  <td className="table-td text-right font-mono">{new Intl.NumberFormat().format(row.est_amount)}</td>
                  <td className="table-td"><span className={`badge ${row.status === 'Ordered' ? 'bg-emerald-100 text-emerald-700' : row.status === 'Pending' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100'}`}>{row.status}</span></td>
                  <td className="table-td font-mono text-xs">{row.po_ref || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <Modal open={!!modal} onClose={() => setModal(null)} title="ເພີ່ມ PR ໃ່" size="lg">
        <form onSubmit={e => { e.preventDefault(); handleSubmit({ date: new Date().toISOString().split('T')[0], status: 'Ordered', ...Object.fromEntries(new FormData(e.target)) }) }} className="space-y-4 p-2">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-semibold text-slate-600 mb-1">Request By</label><select name="request_by" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2">{DEPARTMENTS.map(d => <option key={d}>{d}</option>)}</select></div>
            <div><label className="block text-xs font-semibold text-slate-600 mb-1">Cost Type (Main)</label><select name="cost_type_main" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2">{COST_MAIN.map(c => <option key={c}>{c}</option>)}</select></div>
            <div><label className="block text-xs font-semibold text-slate-600 mb-1">Cost Type (Sub)</label><select name="cost_type_sub" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2">{COST_SUB.map(c => <option key={c}>{c}</option>)}</select></div>
            <div><label className="block text-xs font-semibold text-slate-600 mb-1">Est. Amount</label><input type="number" name="est_amount" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-right" /></div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t"><button type="button" onClick={() => setModal(null)} className="btn-secondary">ຍົກເລີກ</button><button type="submit" className="btn-primary">ບັນທຶກ</button></div>
        </form>
      </Modal>
    </div>
  )
}
