import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const AGING_OPTS = ['N', '0-15 Days', '16-30 Days', '31-45 Days', '46-60+ Days']

const EMPTY = {
  bill_no: '', date: '', patient_name: '', customer_type: '', insurance: '',
  debt_amount: 0, amount_paid: 0, cash_paid: 0, bcel_paid: 0, bcel2_paid: 0,
  ldb_paid: 0, balance: 0, note: '', aging_group: 'N',
}

const inputCls = 'w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all'
const numCls   = inputCls + ' text-right font-mono'

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

export default function DebtForm({ initial, onSubmit, onCancel, loading }) {
  const [form, setForm]           = useState({ ...EMPTY, ...initial })
  const [billSearch, setBillSearch] = useState('')
  const [billResults, setBillResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [pulled, setPulled]       = useState(false)

  useEffect(() => { setForm({ ...EMPTY, ...initial }); setPulled(false) }, [initial])

  function set(k, v) {
    setForm(prev => {
      const next = { ...prev, [k]: v }
      const paid = (parseFloat(next.cash_paid)||0) + (parseFloat(next.bcel_paid)||0)
                 + (parseFloat(next.bcel2_paid)||0) + (parseFloat(next.ldb_paid)||0)
      next.amount_paid = paid
      next.balance = Math.max(0, (parseFloat(next.debt_amount)||0) - paid)
      return next
    })
  }

  function num(k) { return e => set(k, parseFloat(e.target.value) || 0) }
  function txt(k) { return e => set(k, e.target.value) }

  async function searchBills(q) {
    if (!q || q.length < 2) { setBillResults([]); return }
    setSearching(true)
    const { data } = await supabase
      .from('ar_bills')
      .select('bill_no, date, patient_name, customer_type, insurance, grand_total, debt')
      .or(`bill_no.ilike.%${q}%,patient_name.ilike.%${q}%`)
      .gt('debt', 0)
      .order('date', { ascending: false })
      .limit(10)
    setBillResults(data || [])
    setSearching(false)
  }

  function pullFromBill(bill) {
    setForm(prev => {
      const paid = (parseFloat(prev.cash_paid)||0) + (parseFloat(prev.bcel_paid)||0)
                 + (parseFloat(prev.bcel2_paid)||0) + (parseFloat(prev.ldb_paid)||0)
      return {
        ...prev,
        bill_no:       bill.bill_no,
        date:          bill.date,
        patient_name:  bill.patient_name,
        customer_type: bill.customer_type,
        insurance:     bill.insurance || '',
        debt_amount:   bill.debt,
        amount_paid:   paid,
        balance:       Math.max(0, bill.debt - paid),
      }
    })
    setBillSearch('')
    setBillResults([])
    setPulled(true)
  }

  function handleSubmit(e) {
    e.preventDefault()
    const out = { ...form }
    const numericKeys = ['debt_amount','amount_paid','cash_paid','bcel_paid','bcel2_paid','ldb_paid','balance']
    numericKeys.forEach(k => { out[k] = parseFloat(out[k]) || 0 })
    onSubmit(out)
  }

  const isEdit = !!initial?.id
  const fmt = v => new Intl.NumberFormat().format(v || 0)

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Pull from bill */}
      {!isEdit && (
        <div className="bg-primary-50 border border-primary-200 rounded-xl p-4">
          <p className="text-xs font-bold text-primary-700 uppercase tracking-wider mb-2">
            ດຶງຂໍ້ມູນຈາກໃບບິນ (ໜີ້ຄ້າງ)
          </p>
          <div className="relative">
            <input
              type="text"
              value={billSearch}
              onChange={e => { setBillSearch(e.target.value); searchBills(e.target.value) }}
              placeholder="ຄົ້ນຫາດ້ວຍ ເລກໃບບິນ ຫຼື ຊື່ຄົນເຈັບ..."
              className={inputCls + ' pr-8'}
            />
            {searching && (
              <div className="absolute right-3 top-2.5 w-4 h-4 border-2 border-primary-300 border-t-primary-600 rounded-full animate-spin" />
            )}
          </div>
          {billResults.length > 0 && (
            <div className="mt-2 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
              {billResults.map(bill => (
                <button
                  key={`${bill.bill_no}__${bill.date}`}
                  type="button"
                  onClick={() => pullFromBill(bill)}
                  className="w-full text-left px-4 py-3 hover:bg-primary-50 border-b border-slate-100 last:border-0 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-semibold text-slate-800">{bill.bill_no}</span>
                      <span className="text-xs text-slate-500 ml-2">{bill.date}</span>
                    </div>
                    <span className="text-xs font-bold text-red-600">{fmt(bill.debt)} LAK</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{bill.patient_name} · {bill.customer_type}</p>
                </button>
              ))}
            </div>
          )}
          {pulled && (
            <div className="mt-2 flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              ດຶງຂໍ້ມູນຈາກໃບບິນສຳເລັດ — ກວດສອບ ແລະ ແກ້ໄຂຕາມຕ້ອງການ
            </div>
          )}
        </div>
      )}

      {/* Basic info */}
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">ຂໍ້ມູນໃບບິນ</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Field label="ເລກໃບບິນ" required>
            <input type="text" value={form.bill_no} onChange={txt('bill_no')} required
              placeholder="BILL-001" className={inputCls} disabled={isEdit} />
          </Field>
          <Field label="ວັນທີ" required>
            <input type="date" value={form.date} onChange={txt('date')} required className={inputCls} />
          </Field>
          <Field label="ຊື່ຄົນເຈັບ">
            <input type="text" value={form.patient_name} onChange={txt('patient_name')}
              placeholder="ສົມສາຍ ສາຍສຸດ" className={inputCls} />
          </Field>
          <Field label="ປະເພດລູກຄ້າ">
            <input type="text" value={form.customer_type} onChange={txt('customer_type')}
              placeholder="GN / INS / B2B" className={inputCls} />
          </Field>
          <Field label="ບໍລິສັດປະກັນ">
            <input type="text" value={form.insurance} onChange={txt('insurance')}
              placeholder="APA, Forte, ..." className={inputCls} />
          </Field>
          <Field label="Aging Group">
            <select value={form.aging_group} onChange={txt('aging_group')} className={inputCls}>
              {AGING_OPTS.map(a => <option key={a}>{a}</option>)}
            </select>
          </Field>
        </div>
      </div>

      {/* Financials */}
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">ການຊຳລະໜີ້</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Field label="ຍອດໜີ້ທັງໝົດ (Debt Amount)" hint="ດຶງຈາກໃບບິນ ຫຼື ໃສ່ເອງ">
            <input type="number" min="0" step="any" value={form.debt_amount} onChange={num('debt_amount')}
              className={numCls + ' text-red-600 font-semibold'} />
          </Field>
          <Field label="ຍອດທີ່ຍັງຄ້າງ (Balance)" hint="ຄຳນວນອັດຕະໂນມັດ">
            <input type="number" value={form.balance} readOnly
              className={numCls + ' bg-slate-50 cursor-not-allowed text-red-600 font-semibold'} />
          </Field>
          <Field label="ຈ່າຍທັງໝົດ (Amount Paid)" hint="ຄຳນວນອັດຕະໂນມັດ">
            <input type="number" value={form.amount_paid} readOnly
              className={numCls + ' bg-slate-50 cursor-not-allowed text-emerald-600 font-semibold'} />
          </Field>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
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
        </div>
      </div>

      {/* Note */}
      <Field label="ໝາຍເຫດ (Note)">
        <input type="text" value={form.note} onChange={txt('note')} className={inputCls} />
      </Field>

      {/* Actions */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <div className="text-xs text-slate-400">
          ໜີ້: <span className="font-bold text-red-600">{fmt(form.debt_amount)}</span> |
          ຈ່າຍ: <span className="font-bold text-emerald-600">{fmt(form.amount_paid)}</span> |
          ຄ້າງ: <span className="font-bold text-slate-700">{fmt(form.balance)}</span> LAK
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onCancel} className="btn-secondary">ຍົກເລີກ</button>
          <button type="submit" disabled={loading} className="btn-primary px-6 disabled:opacity-50">
            {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {isEdit ? 'ບັນທຶກການແກ້ໄຂ' : 'ເພີ່ມລາຍການໜີ້'}
          </button>
        </div>
      </div>
    </form>
  )
}
