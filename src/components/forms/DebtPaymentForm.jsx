import { useState, useMemo } from 'react'
import RecorderSelect from '../RecorderSelect'
import {
  PAYMENT_METHODS,
  calcAging,
  calcOverdueDays,
  calcDueDate,
  getAgingLabel,
  getDueDaysForInsurance,
  normalizeInstallments,
  resolvePaymentStatus,
  summarizeInstallments,
} from '../../lib/debtUtils'

const inputCls = 'w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all'
const numCls   = inputCls + ' text-right font-mono'

function fmt(v) { return new Intl.NumberFormat().format(v || 0) }

const AGING_COLOR = {
  'Current Receivables': 'bg-sky-100 text-sky-700',
  '1-15 Days':   'bg-emerald-100 text-emerald-700',
  '16-30 Days':  'bg-amber-100 text-amber-700',
  '31-45 Days':  'bg-orange-100 text-orange-700',
  '46-90 Days': 'bg-red-100 text-red-700',
}

export default function DebtPaymentForm({ initial, onSubmit, onCancel, loading, insuranceDueDays = {} }) {
  const [installments, setInstallments] = useState(() => normalizeInstallments(initial))
  const [submitDate,       setSubmitDate]      = useState(initial.submit_date || '')
  const [note,             setNote]            = useState(initial.note || '')
  const [recordedByDebt,   setRecordedByDebt]  = useState(initial.recorded_by_debt || '')

  const originalDebt = initial.debt_amount ?? initial.debt ?? Math.max(0, (initial.grand_total || 0) - (initial.discounts || 0))
  const installmentSummary = useMemo(() => summarizeInstallments(installments), [installments])
  const dueDays = getDueDaysForInsurance(insuranceDueDays, initial.insurance)
  const dueDate = useMemo(
    () => calcDueDate(submitDate || initial.submit_date || initial.date, insuranceDueDays, initial.insurance),
    [submitDate, initial.submit_date, initial.date, initial.insurance, insuranceDueDays]
  )
  const collected  = installmentSummary.total
  const newDebt    = Math.max(0, originalDebt - collected)
  const isPaid     = newDebt === 0
  const agingRow = useMemo(() => ({
    ...initial,
    submit_date: submitDate || null,
    due_date: dueDate,
    date_paid: installmentSummary.latestDate,
    amount_paid: collected,
    balance: newDebt,
    payment_1_date: installmentSummary.active[0]?.date,
    payment_1_method: installmentSummary.active[0]?.method,
    payment_1_amount: installmentSummary.active[0]?.amount,
    payment_2_date: installmentSummary.active[1]?.date,
    payment_2_method: installmentSummary.active[1]?.method,
    payment_2_amount: installmentSummary.active[1]?.amount,
    payment_3_date: installmentSummary.active[2]?.date,
    payment_3_method: installmentSummary.active[2]?.method,
    payment_3_amount: installmentSummary.active[2]?.amount,
  }), [initial, submitDate, dueDate, installmentSummary, collected, newDebt])
  const aging = useMemo(() => calcAging(agingRow), [agingRow])
  const overdueDays = useMemo(() => calcOverdueDays(agingRow), [agingRow])

  function setInstallment(index, key, value) {
    setInstallments(prev => prev.map((item, i) => i === index ? { ...item, [key]: value } : item))
  }

  function handleSubmit(e) {
    e.preventDefault()
    onSubmit({
      ...initial,
      cash:  installmentSummary.channelTotals.cash,
      bcel:  installmentSummary.channelTotals.bcel,
      bcel2: installmentSummary.channelTotals.bcel2,
      ldb:   installmentSummary.channelTotals.ldb,
      installments: installmentSummary.active,
      submit_date: submitDate || null,
      due_date: dueDate,
      date_paid: installmentSummary.latestDate,
      debt:  newDebt,
      aging_group: aging,
      note,
      debt_status: resolvePaymentStatus({ ...agingRow, balance: newDebt }),
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
          <p className="text-xs text-slate-400">ຍອດລວມສຸດທິ</p>
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">ວັນສົ່ງເອກະສານ</label>
          <input type="date" value={submitDate} onChange={e => setSubmitDate(e.target.value)} className={inputCls} />
          <p className="text-[11px] text-slate-400 mt-1">ເລີ່ມນັບກຳນົດຊຳລະຈາກວັນທີນີ້</p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">ກຳນົດຊຳລະ</label>
          <div className="px-3 py-2 rounded-lg border bg-slate-50 border-slate-200 text-sm font-semibold text-slate-700">
            {dueDate || '—'}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">{initial.insurance || 'Default'} · {dueDays} ມື້</p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">ວັນຊຳລະຫຼ້າສຸດ</label>
          <div className="px-3 py-2 rounded-lg border bg-slate-50 border-slate-200 text-sm font-semibold text-slate-700">
            {installmentSummary.latestDate || '—'}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">ດຶງຈາກງວດທີ່ມີວັນທີຫຼ້າສຸດ</p>
        </div>
      </div>

      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">ບັນທຶກການຊຳລະ</p>
        <div className="space-y-2">
          {installments.map((item, index) => (
            <div key={item.number} className="grid grid-cols-12 gap-2 items-end rounded-xl border border-slate-100 bg-slate-50/70 p-3">
              <div className="col-span-12 md:col-span-1">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-500">
                  {item.number}
                </span>
              </div>
              <div className="col-span-12 md:col-span-3">
                <label className="block text-xs font-semibold text-slate-600 mb-1">ວັນທີຊຳລະ</label>
                <input type="date" value={item.date} onChange={e => setInstallment(index, 'date', e.target.value)} className={inputCls} />
              </div>
              <div className="col-span-12 md:col-span-4">
                <label className="block text-xs font-semibold text-slate-600 mb-1">ຊ່ອງທາງ</label>
                <select value={item.method} onChange={e => setInstallment(index, 'method', e.target.value)} className={inputCls}>
                  <option value="">ເລືອກ...</option>
                  {PAYMENT_METHODS.map(method => (
                    <option key={method.value} value={method.value}>{method.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-12 md:col-span-4">
                <label className="block text-xs font-semibold text-slate-600 mb-1">ຈຳນວນເງິນ</label>
                <input type="number" min="0" step="any" value={item.amount}
                  onChange={e => setInstallment(index, 'amount', e.target.value)}
                  className={numCls} />
              </div>
            </div>
          ))}
        </div>

        {/* Collected total */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-slate-400">ຊຳລະເປັນງວດໄດ້ສູງສຸດ 3 ຄັ້ງ</span>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">ລວມຊຳລະ:</span>
            <span className="text-base font-bold font-mono text-emerald-600">{fmt(collected)} LAK</span>
          </div>
        </div>
      </div>

      {/* Aging + Note + Recorder */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Aging Group <span className="text-slate-400 font-normal">(ອັດຕະໂນມັດ)</span></label>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-slate-50 border-slate-200">
            <span className={`badge ${AGING_COLOR[aging] || 'bg-slate-100 text-slate-600'}`}>{getAgingLabel(aging)}</span>
            <span className="text-xs text-slate-400">
              {submitDate ? `${overdueDays} ມື້ຫຼັງກຳນົດຊຳລະ` : ''}
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
