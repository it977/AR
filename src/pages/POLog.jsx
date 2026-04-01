import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'
import LoadingSpinner from '../components/LoadingSpinner'

const DEPARTMENTS = ['Pharmacy', 'Lab', 'Administration', 'Emergency Room', 'IT Support']
const VENDORS = ['EDL', 'Zuellig', 'Berlin', 'VT Office', 'DKSH', 'Water Laos', 'IT Laos', 'Viengthong']
const COST_MAIN = ['COGS', 'Operating Cost']
const COST_SUB = ['Medicines', 'Out source Service', 'Employee Benefit', 'Training', 'Device', 'Utility (ໄຟ້າ/ນ້ຳປະປາ)', 'SSO (ປະກັນສັງຄົມ)']
const APPROVE_STATUS = ['Pending', 'Approved', 'Revised', 'Rejected']

export default function POLog() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [modal, setModal] = useState(null)
  const [filters, setFilters] = useState({})

  const fetchRows = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('ap_po').select('*', { count: 'exact' })
    const { data } = await q.order('po_date', { ascending: false })
    setRows(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchRows() }, [fetchRows])

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="section-title">02_PO_Log - ໃບສັ່ງຊື້ (Purchase Order)</h2>
          <p className="text-xs text-slate-500 mt-0.5">ທັງໝົດ {rows.length} ລາຍການ</p>
        </div>
        <button onClick={() => setModal({ mode: 'add' })} className="btn-primary">+ ເພີ່ມ PO</button>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="table-th">PO Date</th>
                <th className="table-th">PO No.</th>
                <th className="table-th">Ref PR</th>
                <th className="table-th">Department</th>
                <th className="table-th">Vendor</th>
                <th className="table-th">Type</th>
                <th className="table-th">Cost Type (Main)</th>
                <th className="table-th">Cost Type (Sub)</th>
                <th className="table-th text-right">Actual Amount</th>
                <th className="table-th text-center">Disc %</th>
                <th className="table-th text-right">Deposited</th>
                <th className="table-th">Approve</th>
                <th className="table-th">GRN No.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? <tr><td colSpan={13} className="table-td text-center py-12">ກຳລັງໂຫຼດ...</td></tr> : rows.length === 0 ? <tr><td colSpan={13} className="table-td text-center py-12">ບໍ່ມີຂໍ້ມູນ</td></tr> : rows.map(row => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="table-td">{row.po_date}</td>
                  <td className="table-td font-mono font-semibold text-primary-600">{row.po_no}</td>
                  <td className="table-td font-mono text-xs">{row.ref_pr}</td>
                  <td className="table-td">{row.department}</td>
                  <td className="table-td font-semibold">{row.vendor}</td>
                  <td className="table-td">{row.cost_type_main === 'COGS' ? 'ຜູ້ສະໜອງທີ່ມີສັນຍາ' : 'ຜູ້ສະໜອງອື່ນໆ'}</td>
                  <td className="table-td"><span className="badge bg-slate-100">{row.cost_type_main}</span></td>
                  <td className="table-td">{row.cost_type_sub}</td>
                  <td className="table-td text-right font-mono">{new Intl.NumberFormat().format(row.actual_amount)}</td>
                  <td className="table-td text-center">{row.discount_percent || 0}</td>
                  <td className="table-td text-right font-mono text-emerald-600">{new Intl.NumberFormat().format(row.deposited_amount || 0)}</td>
                  <td className="table-td"><span className={`badge ${row.approve_status === 'Approved' ? 'bg-emerald-100 text-emerald-700' : row.approve_status === 'Rejected' ? 'bg-red-100 text-red-700' : row.approve_status === 'Revised' ? 'bg-violet-100 text-violet-700' : 'bg-amber-100 text-amber-700'}`}>{row.approve_status}</span></td>
                  <td className="table-td font-mono text-xs">{row.grn_no || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!modal} onClose={() => setModal(null)} title="ເພີ່ມ PO ໃໝ່" size="lg">
        <p className="text-sm text-slate-500 p-4">ກຳລັງພັດທະນາ...</p>
      </Modal>
    </div>
  )
}
