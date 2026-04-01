import { useState, useEffect } from 'react'
import RecorderSelect from '../RecorderSelect'

const EMPTY = {
  id: '',
  invoice_no: '',
  vendor_name: '',
  date_paid: new Date().toISOString().split('T')[0],
  cash_paid: 0,
  bcel_paid: 0,
  bcel2_paid: 0,
  ldb_paid: 0,
  amount_paid: 0,
  balance: 0,
  status: 'pending',
  note: '',
  recorded_by: '',
}

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}

const inputCls = 'w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all'
const numCls   = inputCls + ' text-right font-mono'

export default function APDebtPaymentForm({ initial, onSubmit, onCancel, loading }) {
  const [form, setForm] = useState({ ...EMPTY, ...initial })

  useEffect(() => { 
    setForm({ 
      ...EMPTY, 
      ...initial,
      date_paid: new Date().toISOString().split('T')[0],
    }) 
  }, [initial])

  function set(k, v) {
    setForm(prev => {
      const next = { ...prev, [k]: v }
      // Auto-calculate amount_paid & balance
      const totalPaid = (parseFloat(next.cash_paid)||0) + (parseFloat(next.bcel_paid)||0) + (parseFloat(next.bcel2_paid)||0) + (parseFloat(next.ldb_paid)||0)
      next.amount_paid = totalPaid
      
      const originalDebt = parseFloat(initial.debt_amount || initial.balance || 0)
      const prevPaid = parseFloat(initial.amount_paid || 0)
      
      // ຖ້າມີການຈ່າຍເກົ່າແລ້ວ
      const remainingDebt = originalDebt - prevPaid + totalPaid
      next.balance = Math.max(0, remainingDebt)
      
      // Update status
      if (next.balance <= 0) next.status = 'paid'
      else if (totalPaid > 0) next.status = 'partial'
      else next.status = 'pending'
      
      return next
    })
  }

  function num(k) { return e => set(k, parseFloat(e.target.value) || 0) }
  function txt(k) { return e => set(k, e.target.value) }

  function handleSubmit(e) {
    e.preventDefault()
    const out = { 
      ...form,
      id: initial.id,
      debt_amount: initial.debt_amount,
    }
    const numericKeys = ['cash_paid','bcel_paid','bcel2_paid','ldb_paid','amount_paid','balance']
    numericKeys.forEach(k => { out[k] = parseFloat(out[k]) || 0 })
    onSubmit(out)
  }

  const remainingDebt = (parseFloat(initial.debt_amount || initial.balance || 0)) - (parseFloat(initial.amount_paid || 0))

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Info */}
      <div className="bg-slate-50 rounded-xl p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Invoice No:</span>
          <span className="font-semibold">{form.invoice_no}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Vendor:</span>
          <span className="font-semibold">{form.vendor_name}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">ໜີ້ເດີມ:</span>
          <span className="font-mono font-semibold">{new Intl.NumberFormat().format(initial.debt_amount || 0)} LAK</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">ຈ່າຍໄປແລ້ວ:</span>
          <span className="font-mono text-emerald-600 font-semibold">{new Intl.NumberFormat().format(initial.amount_paid || 0)} LAK</span>
        </div>
        <div className="flex justify-between text-sm pt-2 border-t border-slate-200">
          <span className="text-slate-700 font-bold">ຄ້າງຈ່າຍ:</span>
          <span className="font-mono text-red-600 font-bold">{new Intl.NumberFormat().format(remainingDebt)} LAK</span>
        </div>
      </div>

      {/* Payment Details */}
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">ລາຍລະອຽດການຈ່າຍ</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="ວັນທີຈ່າຍ">
            <input type="date" value={form.date_paid} onChange={txt('date_paid')} className={inputCls} />
          </Field>
          <Field label="ຜູ້ບັນທຶກ">
            <RecorderSelect value={form.recorded_by} onChange={v => set('recorded_by', v)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
          <Field label="ເງິນສົດ (Cash)">
            <input type="number" min="0" step="any" value={form.cash_paid} onChange={num('cash_paid')} className={numCls} placeholder="0" />
          </Field>
          <Field label="BCEL">
            <input type="number" min="0" step="any" value={form.bcel_paid} onChange={num('bcel_paid')} className={numCls} placeholder="0" />
          </Field>
          <Field label="BCEL 2">
            <input type="number" min="0" step="any" value={form.bcel2_paid} onChange={num('bcel2_paid')} className={numCls} placeholder="0" />
          </Field>
          <Field label="LDB Bank">
            <input type="number" min="0" step="any" value={form.ldb_paid} onChange={num('ldb_paid')} className={numCls} placeholder="0" />
          </Field>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-primary-50 rounded-xl p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-slate-600">ຍອດຈ່າຍລວມ:</span>
          <span className="font-mono font-bold text-primary-700">{new Intl.NumberFormat().format(form.amount_paid)} LAK</span>
        </div>
        <div className="flex justify-between text-sm pt-2 border-t border-primary-200">
          <span className="text-slate-700 font-bold">ຍອດຄ້າງຫຼັງຈ່າຍ:</span>
          <span className={`font-mono font-bold ${form.balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            {new Intl.NumberFormat().format(form.balance)} LAK
          </span>
        </div>
        {form.balance <= 0 && form.amount_paid > 0 && (
          <div className="text-center text-xs text-emerald-600 font-semibold mt-2">
            ✓ ຈ່າຍຄົບແລ້ວ!
          </div>
        )}
      </div>

      {/* Note */}
      <Field label="ໝາຍເຫດ">
        <input type="text" value={form.note} onChange={txt('note')} placeholder="ໝາຍເຫດ..." className={inputCls} />
      </Field>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
        <button type="button" onClick={onCancel} className="btn-secondary">ຍົກເລີກ</button>
        <button type="submit" disabled={loading} className="btn-primary px-6 disabled:opacity-50">
          {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
          ບັນທຶກການຈ່າຍ
        </button>
      </div>
    </form>
  )
}
