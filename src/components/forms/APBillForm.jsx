import { useState, useEffect } from 'react'
import RecorderSelect from '../RecorderSelect'

const WORKLOADS   = ['8AM-4PM', '4PM-12AM', '12AM-8AM']
const WEEKS       = Array.from({ length: 53 }, (_, i) => `Week ${i + 1}`)
const DEPARTMENTS = ['Pharmacy', 'IT Support', 'Administration', 'Lab', 'Emergency Room', 'Finance', 'HR']
const STATUS_OPTS = ['pending', 'approved', 'rejected', 'revised']

const EMPTY = {
  date: '', week: '', workload: '8AM-4PM', invoice_no: '',
  po_no: '', po_date: '',
  vendor_name: '', vendor_code: '', department: '', contact_person: '', phone: '',
  bill_date: '', due_date: '', description: '',
  svc_materials: 0, svc_equipment: 0, svc_maintenance: 0, 
  svc_consulting: 0, svc_training: 0, svc_software: 0, svc_other: 0,
  total: 0, vat: 0, grand_total: 0,
  cash_paid: 0, bcel_paid: 0, bcel2_paid: 0, ldb_paid: 0,
  balance: 0, debt_status: 'pending',
  status: 'pending', approved_by: '', approved_date: '', rejected_reason: '',
  aging_group: 'N', note: '', recorded_by: '',
}

function Field({ label, required, children, hint }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="text-[10px] text-slate-400 mt-0.5">{hint}</p>}
    </div>
  )
}

const inputCls = 'w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all'
const numCls   = inputCls + ' text-right font-mono'

export default function APBillForm({ initial, onSubmit, onCancel, loading }) {
  const [form, setForm] = useState({ ...EMPTY, ...initial })
  const [showSvc, setShowSvc] = useState(false)

  useEffect(() => { setForm({ ...EMPTY, ...initial }) }, [initial])

  function set(k, v) {
    setForm(prev => {
      const next = { ...prev, [k]: v }
      // Auto-compute total & grand_total
      const svcTotal = ['svc_materials','svc_equipment','svc_maintenance',
        'svc_consulting','svc_training','svc_software','svc_other']
        .reduce((s, f) => s + (parseFloat(next[f]) || 0), 0)
      next.total = svcTotal
      next.grand_total = svcTotal + (parseFloat(next.vat) || 0)
      // Auto balance = grand_total - paid
      const paid = (parseFloat(next.cash_paid)||0)+(parseFloat(next.bcel_paid)||0)+(parseFloat(next.bcel2_paid)||0)+(parseFloat(next.ldb_paid)||0)
      next.balance = Math.max(0, next.grand_total - paid)
      next.debt_status = next.balance > 0 ? 'pending' : 'paid'
      return next
    })
  }

  function num(k) { return e => set(k, parseFloat(e.target.value) || 0) }
  function txt(k) { return e => set(k, e.target.value) }

  function handleSubmit(e) {
    e.preventDefault()
    const out = { ...form }
    const numericKeys = ['svc_materials','svc_equipment','svc_maintenance',
      'svc_consulting','svc_training','svc_software','svc_other',
      'total','vat','grand_total','cash_paid','bcel_paid','bcel2_paid','ldb_paid','balance']
    numericKeys.forEach(k => { out[k] = parseFloat(out[k]) || 0 })
    onSubmit(out)
  }

  const isEdit = !!initial?.id

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* ── Section 1: Basic Info ── */}
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">ຂໍ້ມູນພ້ນຖານ</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="ວັນທີ" required>
            <input type="date" value={form.date} onChange={txt('date')} required className={inputCls} />
          </Field>
          <Field label="ອາທິດ (Week)">
            <select value={form.week} onChange={txt('week')} className={inputCls}>
              <option value="">-- ເລືອກອາທິດ --</option>
              {WEEKS.map(w => <option key={w}>{w}</option>)}
            </select>
          </Field>
          <Field label="ກະວຽກ">
            <select value={form.workload} onChange={txt('workload')} className={inputCls}>
              {WORKLOADS.map(w => <option key={w}>{w}</option>)}
            </select>
          </Field>
          <Field label="ເລກໃບເກັບເງິນ" required>
            <input type="text" value={form.invoice_no} onChange={txt('invoice_no')} required
              placeholder="INV-001" className={inputCls} disabled={isEdit} />
          </Field>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
          <Field label="ເລກ PO">
            <input type="text" value={form.po_no} onChange={txt('po_no')} placeholder="PO-2026-001" className={inputCls} />
          </Field>
          <Field label="ວັນທີ PO">
            <input type="date" value={form.po_date} onChange={txt('po_date')} className={inputCls} />
          </Field>
          <Field label="ວັນທີໃບເກັບເງິນ">
            <input type="date" value={form.bill_date} onChange={txt('bill_date')} className={inputCls} />
          </Field>
          <Field label="ວັນຄົບກຳນົດຈ່າຍ" required>
            <input type="date" value={form.due_date} onChange={txt('due_date')} required className={inputCls} />
          </Field>
        </div>
      </div>

      {/* ── Section 2: Vendor Info ── */}
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">ຂໍ້ມູນ Vendor</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="ຊື່ Vendor" required>
            <input type="text" value={form.vendor_name} onChange={txt('vendor_name')} required
              placeholder="ຊື່ Vendor" className={inputCls} />
          </Field>
          <Field label="ລະຫັດ Vendor">
            <input type="text" value={form.vendor_code} onChange={txt('vendor_code')} placeholder="VEN001" className={inputCls} />
          </Field>
          <Field label="ພະແນກ" required>
            <select value={form.department} onChange={txt('department')} required className={inputCls}>
              <option value="">-- ເລືອກພະແນກ --</option>
              {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
            </select>
          </Field>
          <Field label="ຜູ້ຕິດຕໍ່">
            <input type="text" value={form.contact_person} onChange={txt('contact_person')} placeholder="ຊື່ຜູ້ຕິດຕໍ່" className={inputCls} />
          </Field>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
          <Field label="ເບີໂທ">
            <input type="text" value={form.phone} onChange={txt('phone')} placeholder="020 XX XX XX XX" className={inputCls} />
          </Field>
          <Field label="ສະຖານະ" required>
            <select value={form.status} onChange={txt('status')} required className={inputCls}>
              {STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="ຜູ້ອະນຸມັດ">
            <input type="text" value={form.approved_by} onChange={txt('approved_by')} placeholder="ຊື່ຜູ້ອະນຸມັດ" className={inputCls} />
          </Field>
          <Field label="ວັນທີອະນຸມັດ">
            <input type="date" value={form.approved_date} onChange={txt('approved_date')} className={inputCls} />
          </Field>
        </div>
      </div>

      {/* ── Section 3: Services (collapsible) ── */}
      <div className="border border-slate-100 rounded-xl overflow-hidden">
        <button type="button" onClick={() => setShowSvc(!showSvc)}
          className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
          <div className="flex items-center gap-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">ລາຍຮັບຕາມປະເພດບໍລິການ</p>
            <span className="badge bg-primary-100 text-primary-700 text-[10px]">
              {new Intl.NumberFormat().format(form.total)} LAK
            </span>
          </div>
          <svg className={`w-4 h-4 text-slate-400 transition-transform ${showSvc ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {showSvc && (
          <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              ['svc_materials','Materials/Vendors'],['svc_equipment','Equipment'],['svc_maintenance','Maintenance'],
              ['svc_consulting','Consulting'],['svc_training','Training'],['svc_software','Software'],
              ['svc_other','Other'],
            ].map(([k, lbl]) => (
              <Field key={k} label={lbl}>
                <input type="number" min="0" step="any" value={form[k]} onChange={num(k)} className={numCls} />
              </Field>
            ))}
          </div>
        )}
      </div>

      {/* ── Section 4: Financials ── */}
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">ຍອດເງິນ & ການຈ່າຍ</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="VAT (7%)">
            <input type="number" min="0" step="any" value={form.vat} onChange={num('vat')} className={numCls} />
          </Field>
          <Field label="ຍອດລວມ (Grand Total)" hint="ຄຳນວນອັດຕະໂນມັດ">
            <input type="number" value={form.grand_total} readOnly className={numCls + ' bg-slate-50 cursor-not-allowed'} />
          </Field>
          <Field label="ເງິນສົດ (Cash)">
            <input type="number" min="0" step="any" value={form.cash_paid} onChange={num('cash_paid')} className={numCls} />
          </Field>
          <Field label="BCEL">
            <input type="number" min="0" step="any" value={form.bcel_paid} onChange={num('bcel_paid')} className={numCls} />
          </Field>
          <Field label="BCEL 2">
            <input type="number" min="0" step="any" value={form.bcel2_paid} onChange={num('bcel2_paid')} className={numCls} />
          </Field>
          <Field label="LDB Bank">
            <input type="number" min="0" step="any" value={form.ldb_paid} onChange={num('ldb_paid')} className={numCls} />
          </Field>
          <Field label="ຍອດຄ້າງຈ່າຍ (Balance)" hint="ຄຳນວນອັດຕະໂນມັດ">
            <input type="number" min="0" step="any" value={form.balance} readOnly
              className={numCls + ' text-red-600 font-semibold bg-slate-50 cursor-not-allowed'} />
          </Field>
          <Field label="ສະຖານະໜີ້">
            <input type="text" value={form.debt_status} readOnly
              className={numCls + ' bg-slate-50 cursor-not-allowed'} />
          </Field>
        </div>
      </div>

      {/* ── Section 5: Notes ── */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="ໝາຍເຫດ (Note)">
          <input type="text" value={form.note} onChange={txt('note')} className={inputCls} />
        </Field>
        <Field label="ຜູ້ບັນທຶກ">
          <RecorderSelect value={form.recorded_by} onChange={v => set('recorded_by', v)} />
        </Field>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <div className="text-xs text-slate-400">
          Grand Total: <span className="font-bold text-slate-700">{new Intl.NumberFormat().format(form.grand_total)}</span> LAK  |
          Balance: <span className="font-bold text-red-600">{new Intl.NumberFormat().format(form.balance)}</span> LAK
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onCancel} className="btn-secondary">ຍົກເລີກ</button>
          <button type="submit" disabled={loading} className="btn-primary px-6 disabled:opacity-50">
            {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {isEdit ? 'ບັນທຶກການແກ້ໄຂ' : 'ເພີ່ມໃບເກັບເງິນ'}
          </button>
        </div>
      </div>
    </form>
  )
}
