import { useState, useMemo } from 'react'
import RecorderSelect from '../RecorderSelect'

const inputCls = 'w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all'
const numCls   = inputCls + ' text-right font-mono'

function fmt(v) { return new Intl.NumberFormat().format(v || 0) }

function calcAging(date) {
  if (!date) return 'N'
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000)
  if (days <= 0)  return 'N'
  if (days <= 15) return '0-15 Days'
  if (days <= 30) return '16-30 Days'
  if (days <= 45) return '31-45 Days'
  return '46-60+ Days'
}

const AGING_COLOR = {
  'N':           'bg-slate-100 text-slate-600',
  '0-15 Days':   'bg-emerald-100 text-emerald-700',
  '16-30 Days':  'bg-amber-100 text-amber-700',
  '31-45 Days':  'bg-orange-100 text-orange-700',
  '46-60+ Days': 'bg-red-100 text-red-700',
}

export default function DebtPaymentForm({ initial, onSubmit, onCancel, loading }) {
  const [cash,            setCash]           = useState(initial.cash             || 0)
  const [bcel,            setBcel]           = useState(initial.bcel             || 0)
  const [bcel2,           setBcel2]          = useState(initial.bcel2            || 0)
  const [ldb,             setLdb]            = useState(initial.ldb              || 0)
  const [note,            setNote]           = useState(initial.note             || '')
  const [recordedByDebt,  setRecordedByDebt] = useState(initial.recorded_by_debt || '')

  const aging = useMemo(() => calcAging(initial.date), [initial.date])

  const collected  = (parseFloat(cash)||0) + (parseFloat(bcel)||0) + (parseFloat(bcel2)||0) + (parseFloat(ldb)||0)
  const newDebt    = Math.max(0, (initial.grand_total || 0) - (initial.discounts || 0) - collected)
  const isPaid     = newDebt === 0

  function handleSubmit(e) {
    e.preventDefault()
    onSubmit({
      ...initial,
      cash:  parseFloat(cash)  || 0,
      bcel:  parseFloat(bcel)  || 0,
      bcel2: parseFloat(bcel2) || 0,
      ldb:   parseFloat(ldb)   || 0,
      debt:  newDebt,
      aging_group: aging,
      note,
      debt_status: newDebt === 0 ? 'paid' : 'pending',
      recorded_by_debt: recordedByDebt,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Bill summary */}
      <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div>
          <p className="text-xs text-slate-400 mb-0.5">ເລກໃບບິນ</p>
          <p className="font-mono font-bold text-primary-600">{initial.bill_no}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-0.5">ວັນທີ</p>
          <p className="font-medium">{initial.date}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-0.5">ຊື່ຄົນເຈັບ</p>
          <p className="font-medium">{initial.patient_name}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-0.5">ປະເພດ</p>
          <p className="font-medium">{initial.customer_type}{initial.insurance ? ` · ${initial.insurance}` : ''}</p>
        </div>
      </div>

      {/* Totals row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-100 p-3 text-center">
          <p className="text-xs text-slate-400">ຍອດລວມ (Grand Total)</p>
          <p className="text-lg font-bold font-mono text-slate-700 mt-1">{fmt(initial.grand_total)}</p>
          <p className="text-[10px] text-slate-400">LAK</p>
        </div>
        <div className="rounded-xl border border-slate-100 p-3 text-center">
          <p className="text-xs text-slate-400">ສ່ວນຫຼຸດ</p>
          <p className="text-lg font-bold font-mono text-slate-500 mt-1">{fmt(initial.discounts)}</p>
          <p className="text-[10px] text-slate-400">LAK</p>
        </div>
        <div className={`rounded-xl border p-3 text-center ${isPaid ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
          <p className="text-xs text-slate-400">ໜີ້ຄ້າງຫຼັງຊຳລະ</p>
          <p className={`text-lg font-bold font-mono mt-1 ${isPaid ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(newDebt)}</p>
          <p className="text-[10px] text-slate-400">LAK</p>
        </div>
      </div>

      {/* Payment inputs */}
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">ບັນທຶກການຊຳລະ</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            ['ເງິນສົດ (Cash)',  cash,  setCash],
            ['BCEL',           bcel,  setBcel],
            ['BCEL 2',         bcel2, setBcel2],
            ['LDB Bank',       ldb,   setLdb],
          ].map(([label, val, setter]) => (
            <div key={label}>
              <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
              <input type="number" min="0" step="any" value={val}
                onChange={e => setter(parseFloat(e.target.value) || 0)}
                className={numCls} />
            </div>
          ))}
        </div>

        {/* Collected total */}
        <div className="mt-3 flex items-center justify-end gap-2">
          <span className="text-sm text-slate-500">ລວມຊຳລະ:</span>
          <span className="text-base font-bold font-mono text-emerald-600">{fmt(collected)} LAK</span>
        </div>
      </div>

      {/* Aging + Note + Recorder */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Aging Group <span className="text-slate-400 font-normal">(ອັດຕະໂນມັດ)</span></label>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-slate-50 border-slate-200">
            <span className={`badge ${AGING_COLOR[aging]}`}>{aging}</span>
            <span className="text-xs text-slate-400">
              {initial.date ? `${Math.floor((Date.now() - new Date(initial.date).getTime()) / 86400000)} ມື້` : ''}
            </span>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">ໝາຍເຫດ</label>
          <input type="text" value={note} onChange={e => setNote(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">ຜູ້ບັນທຶກໜີ້</label>
          <RecorderSelect value={recordedByDebt} onChange={setRecordedByDebt} />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <div className="text-xs text-slate-400">
          ໜີ້ຄ້າງ: <span className={`font-bold ${isPaid ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(newDebt)} LAK</span>
          {isPaid && <span className="ml-2 badge bg-emerald-100 text-emerald-700">ຊຳລະຄົບແລ້ວ</span>}
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onCancel} className="btn-secondary">ຍົກເລີກ</button>
          <button type="submit" disabled={loading} className="btn-primary px-6 disabled:opacity-50">
            {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            ບັນທຶກການຊຳລະ
          </button>
        </div>
      </div>
    </form>
  )
}
