import { useState, useEffect } from 'react'
import InsuranceSelect from '../InsuranceSelect'
import RecorderSelect from '../RecorderSelect'

const WORKLOADS   = ['8AM-4PM', '4PM-12AM', '12AM-8AM']
const CUST_TYPES  = ['GN', 'INS', 'B2B']
const GENDERS     = ['Male', 'Female']
const INSITE_OPTS = ['Insite', 'Onsite']
const OPD_OPTS    = ['OPD', 'IPD']
const WEEKS       = Array.from({ length: 53 }, (_, i) => `Week ${i + 1}`)

const EMPTY = {
  date: '', week: '', workload: '8AM-4PM', bill_no: '',
  insite_onsite: 'Insite', opd_ipd: 'OPD',
  customer_type: 'GN', insurance: '', hn: '', patient_name: '', gender: 'Male',
  svc_opd: 0, svc_diag_image: 0, svc_ipd: 0, svc_surg_ot: 0, svc_emergency: 0,
  svc_chronic: 0, svc_pharma: 0, svc_support: 0, svc_admin: 0, svc_homecare: 0,
  total: 0, discounts: 0, grand_total: 0,
  cash: 0, bcel: 0, bcel2: 0, ldb: 0,
  debt: 0, prepayment: 0, note: '', aging_group: 'N', recorded_by: '',
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

export default function BillForm({ initial, onSubmit, onCancel, loading }) {
  const [form, setForm]       = useState({ ...EMPTY, ...initial })
  const [showSvc, setShowSvc] = useState(true)

  useEffect(() => { setForm({ ...EMPTY, ...initial }) }, [initial])

  function set(k, v) {
    setForm(prev => {
      const next = { ...prev, [k]: v }
      // Auto-compute total & grand_total
      const svcTotal = ['svc_opd','svc_diag_image','svc_ipd','svc_surg_ot','svc_emergency',
        'svc_chronic','svc_pharma','svc_support','svc_admin','svc_homecare']
        .reduce((s, f) => s + (parseFloat(next[f]) || 0), 0)
      next.total = svcTotal
      next.grand_total = svcTotal - (parseFloat(next.discounts) || 0)
      // Auto debt = grand_total - collected
      const collected = (parseFloat(next.cash)||0)+(parseFloat(next.bcel)||0)+(parseFloat(next.bcel2)||0)+(parseFloat(next.ldb)||0)
      next.debt = Math.max(0, next.grand_total - collected)
      return next
    })
  }

  function num(k) { return e => set(k, parseFloat(e.target.value) || 0) }
  function txt(k) { return e => set(k, e.target.value) }

  function handleSubmit(e) {
    e.preventDefault()
    // Convert all numeric fields
    const out = { ...form }
    const numericKeys = ['svc_opd','svc_diag_image','svc_ipd','svc_surg_ot','svc_emergency',
      'svc_chronic','svc_pharma','svc_support','svc_admin','svc_homecare',
      'total','discounts','grand_total','cash','bcel','bcel2','ldb','debt','prepayment']
    numericKeys.forEach(k => { out[k] = parseFloat(out[k]) || 0 })
    onSubmit(out)
  }

  const isEdit = !!initial?.id

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* ── Section 1: Basic Info ── */}
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">ຂໍ້ມູນພື້ນຖານ</p>
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
          <Field label="ກະວຽກ" required>
            <select value={form.workload} onChange={txt('workload')} className={inputCls}>
              {WORKLOADS.map(w => <option key={w}>{w}</option>)}
            </select>
          </Field>
          <Field label="ເລກໃບບິນ" required>
            <input type="text" value={form.bill_no} onChange={txt('bill_no')} required
              placeholder="BILL-001" className={inputCls} disabled={isEdit} />
          </Field>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
          <Field label="Insite / Onsite">
            <select value={form.insite_onsite} onChange={txt('insite_onsite')} className={inputCls}>
              {INSITE_OPTS.map(o => <option key={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="OPD / IPD">
            <select value={form.opd_ipd} onChange={txt('opd_ipd')} className={inputCls}>
              {OPD_OPTS.map(o => <option key={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="ປະເພດລູກຄ້າ">
            <select value={form.customer_type} onChange={txt('customer_type')} className={inputCls}>
              {CUST_TYPES.map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="ບໍລິສັດປະກັນ">
            <InsuranceSelect
              value={form.insurance}
              onChange={v => set('insurance', v)}
            />
          </Field>
        </div>
      </div>

      {/* ── Section 2: Patient ── */}
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">ຂໍ້ມູນຄົນເຈັບ</p>
        <div className="grid grid-cols-3 gap-3">
          <Field label="HN">
            <input type="text" value={form.hn} onChange={txt('hn')} placeholder="HN001" className={inputCls} />
          </Field>
          <Field label="ຊື່ - ນາມສະກຸນ" required>
            <input type="text" value={form.patient_name} onChange={txt('patient_name')} required
              placeholder="ຊື່ - ນາມສະກຸນ" className={inputCls} />
          </Field>
          <Field label="ເພດ">
            <select value={form.gender} onChange={txt('gender')} className={inputCls}>
              {GENDERS.map(g => <option key={g}>{g}</option>)}
            </select>
          </Field>
        </div>
      </div>

      {/* ── Section 3: Services (collapsible) ── */}
      <div className="border border-slate-100 rounded-xl overflow-hidden">
        <button type="button" onClick={() => setShowSvc(!showSvc)}
          className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
          <div className="flex items-center gap-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">ລາຍຮັບຕາມການບໍລິການ</p>
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
              ['svc_opd','OPD'],['svc_diag_image','Diag & Image'],['svc_ipd','IPD'],
              ['svc_surg_ot','Surg / OT'],['svc_emergency','Emergency'],['svc_chronic','Chronic'],
              ['svc_pharma','Pharma'],['svc_support','Support'],['svc_admin','Admin'],['svc_homecare','Home Care'],
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
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">ຍອດເງິນ & ການຊຳລະ</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="ສ່ວນຫຼຸດ (Discounts)">
            <input type="number" min="0" step="any" value={form.discounts} onChange={num('discounts')} className={numCls} />
          </Field>
          <Field label="ຍອດລວມ (Grand Total)" hint="ຄຳນວນອັດຕະໂນມັດ">
            <input type="number" value={form.grand_total} readOnly className={numCls + ' bg-slate-50 cursor-not-allowed'} />
          </Field>
          <Field label="ເງິນສົດ (Cash)">
            <input type="number" min="0" step="any" value={form.cash} onChange={num('cash')} className={numCls} />
          </Field>
          <Field label="BCEL">
            <input type="number" min="0" step="any" value={form.bcel} onChange={num('bcel')} className={numCls} />
          </Field>
          <Field label="BCEL 2">
            <input type="number" min="0" step="any" value={form.bcel2} onChange={num('bcel2')} className={numCls} />
          </Field>
          <Field label="LDB Bank">
            <input type="number" min="0" step="any" value={form.ldb} onChange={num('ldb')} className={numCls} />
          </Field>
          <Field label="ໜີ້ຄ້າງ (Debt)" hint="ຄຳນວນອັດຕະໂນມັດ">
            <input type="number" min="0" step="any" value={form.debt} onChange={num('debt')}
              className={numCls + ' text-red-600 font-semibold'} />
          </Field>
          <Field label="Prepayment">
            <input type="number" min="0" step="any" value={form.prepayment} onChange={num('prepayment')} className={numCls} />
          </Field>
        </div>
      </div>

      {/* ── Section 5: Notes ── */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="ໝາຍເຫດ (Note)">
          <input type="text" value={form.note} onChange={txt('note')} className={inputCls} />
        </Field>
        <Field label="ຊື່ຜູ້ບັນທຶກ">
          <RecorderSelect value={form.recorded_by} onChange={v => set('recorded_by', v)} />
        </Field>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <div className="text-xs text-slate-400">
          Grand Total: <span className="font-bold text-slate-700">{new Intl.NumberFormat().format(form.grand_total)}</span> LAK  |
          Debt: <span className="font-bold text-red-600">{new Intl.NumberFormat().format(form.debt)}</span> LAK
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onCancel} className="btn-secondary">ຍົກເລີກ</button>
          <button type="submit" disabled={loading} className="btn-primary px-6 disabled:opacity-50">
            {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {isEdit ? 'ບັນທຶກການແກ້ໄຂ' : 'ເພີ່ມໃບບິນ'}
          </button>
        </div>
      </div>
    </form>
  )
}
