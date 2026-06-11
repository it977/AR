import { useState, useRef, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { parseExcelFile, formatNumber } from '../lib/excelParser'
import { supabase } from '../lib/supabase'
import { logAction } from '../lib/log'

// ============================================================
// Template download — same column structure as the real Excel
// ============================================================
const DAILY_HEADERS = [
  'Date','Week','Workload','Bill No','Insite-Onsite','OPD-IPD',
  'Customer Type Code','Insurance','HN','Customer Name','Gender',
  'OPD','Diag & Image Services','IPD','Surg / OT Services',
  'Emergency Services','Chronic & Prev Services','Pharma & Consumables',
  'Supporting & Ancillary Services','Admin & Non-Clinical Services','Home care Services',
  'Total','Discounts','Grand Total','Cash Received',
  'Transfer Payment by BCEL','Transfer Payment by BCEL2','Transfer Payment by LDB',
  'Outstanding Debt','Prepayment','Payment Type','Due date','Bill Issued At','Payment Received Date','Note','Aging Group',
]
const PAYOFF_HEADERS = [
  'Date','Week','Workload','Bill No','Insite-Onsite','OPD-IPD',
  'Customer Type Code','Insurance','HN','Customer Name','Gender',
  'Grand Total','Outstanding Debt','Date Paid','Workload Debt','Submission Date',
  'Amount Paid','Cash Received Debt','Transfer Payment by BCEL Debt',
  'Transfer Payment by BCEL 2 Debt','Transfer Payment by LDB Debt',
  'Balance','Due date','Payment Type',
  'Payment 1 Date','Payment 1 Method','Payment 1 Amount',
  'Payment 2 Date','Payment 2 Method','Payment 2 Amount',
  'Payment 3 Date','Payment 3 Method','Payment 3 Amount',
  'Aging Group',
]
const SAMPLE_DAILY = [
  ['2026-01-01','Week 1','8AM-4PM','BILL-001','Insite','OPD','GN','','HN001','ສົມສາຍ','Male',
   50000,0,0,0,0,0,20000,0,0,0,70000,0,70000,70000,0,0,0,0,0,'Cash','','2026-01-01T08:30','2026-01-01','',''],
]
const SAMPLE_PAYOFF = [
  ['2026-01-01','Week 1','8AM-4PM','BILL-INS001','Insite','OPD','INS','APA','HN002','ນາງສີ','Female',
   500000,500000,'2026-01-10','','2026-01-10',200000,0,200000,0,0,300000,'2026-02-09','Deposit',
   '2026-01-10','bcel',200000,'','','','','','Current Receivables'],
]

function downloadTemplate() {
  const wb = XLSX.utils.book_new()
  // Daily sheet
  const wsDaily = XLSX.utils.aoa_to_sheet([DAILY_HEADERS, ...SAMPLE_DAILY])
  wsDaily['!cols'] = DAILY_HEADERS.map(() => ({ wch: 18 }))
  XLSX.utils.book_append_sheet(wb, wsDaily, 'Daily')
  // Pay off sheet
  const wsPayoff = XLSX.utils.aoa_to_sheet([PAYOFF_HEADERS, ...SAMPLE_PAYOFF])
  wsPayoff['!cols'] = PAYOFF_HEADERS.map(() => ({ wch: 18 }))
  XLSX.utils.book_append_sheet(wb, wsPayoff, 'Pay off')
  XLSX.writeFile(wb, 'AR_Finance_Template_LXH.xlsx')
}

// ============================================================
// Steps config
// ============================================================
const STEPS = [
  { label: 'ເລືອກໄຟລ',     desc: 'ລາກ & ວາງ ຫຼື ຄລິກ' },
  { label: 'ກວດສອບຂໍ້ມູນ', desc: 'Preview ກ່ອນ upload' },
  { label: 'ອັບໂຫຼດ',       desc: 'ສົ່ງຂໍ້ມູນ Supabase' },
  { label: 'ສຳເລັດ',        desc: 'ຂໍ້ມູນພ້ອມໃຊ້ງານ' },
]

const BATCH_SIZE = 200   // smaller batch to avoid conflicts
const OPTIONAL_COLUMNS = {
  ar_bills: [
    'payment_type', 'due_date', 'bill_issued_at', 'submit_date', 'recorded_by',
  ],
  ar_debt: [
    'insite_onsite', 'opd_ipd', 'payment_type',
    'payment_1_date', 'payment_1_method', 'payment_1_amount',
    'payment_2_date', 'payment_2_method', 'payment_2_amount',
    'payment_3_date', 'payment_3_method', 'payment_3_amount',
  ],
}

function StepIndicator({ current }) {
  return (
    <div className="flex items-start justify-center gap-0 mb-8">
      {STEPS.map((s, i) => (
        <div key={i} className="flex items-start">
          <div className="flex flex-col items-center w-24">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
              i < current  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200' :
              i === current ? 'bg-primary-600 text-white shadow-lg shadow-primary-200 ring-4 ring-primary-100' :
              'bg-slate-100 text-slate-400'
            }`}>
              {i < current
                ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
                : i + 1}
            </div>
            <p className={`text-xs mt-1.5 font-semibold text-center leading-tight ${i === current ? 'text-primary-600' : i < current ? 'text-emerald-600' : 'text-slate-400'}`}>
              {s.label}
            </p>
            <p className={`text-[10px] text-center leading-tight mt-0.5 ${i === current ? 'text-primary-400' : 'text-slate-300'}`}>
              {s.desc}
            </p>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`w-12 h-0.5 mt-5 transition-all flex-shrink-0 ${i < current ? 'bg-emerald-400' : 'bg-slate-200'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

async function upsertBatch(table, rows) {
  if (!rows.length) return
  
  // Deduplicate rows by conflict key before upsert
  const seen = new Map()
  const uniqueRows = []
  
  const conflictKey = (r) => r.source_key || (
    table === 'ar_bills'
      ? `${r.bill_no}__${r.date}__${r.workload || 'ALL'}`
      : `${r.bill_no}__${r.date}`
  )
  
  // Keep last occurrence of each unique key
  for (const row of rows) {
    const key = conflictKey(row)
    seen.set(key, row)
  }
  
  uniqueRows.push(...seen.values())
  
  // ແບ່ງເປັນກຸ່ມຍ່ອຍໆລະ 100 ແຖວ ເພື່ອຫຼີກລ່ຽງ conflict
  const CHUNK_SIZE = 100
  for (let i = 0; i < uniqueRows.length; i += CHUNK_SIZE) {
    const chunk = uniqueRows.slice(i, i + CHUNK_SIZE)
    
    const conflictKeyDb = chunk[0]?.source_key
      ? 'source_key'
      : (table === 'ar_bills' ? 'bill_no,date,workload' : 'bill_no,date')
    
    let { error } = await supabase.from(table).upsert(chunk, {
      onConflict: conflictKeyDb,
      ignoreDuplicates: false,
    })

    if (error && OPTIONAL_COLUMNS[table]?.some(col => error.message?.includes(col))) {
      const optional = new Set(OPTIONAL_COLUMNS[table])
      const stripped = chunk.map(row => Object.fromEntries(
        Object.entries(row).filter(([key]) => !optional.has(key))
      ))
      ;({ error } = await supabase.from(table).upsert(stripped, {
        onConflict: conflictKeyDb,
        ignoreDuplicates: false,
      }))
    }
    
    if (error) {
      // ຖ້າມີ conflict ອີກ ໃຫ້ລອງແບ່ງເຄິ່ງນຶ່ງອີກ
      if (chunk.length > 10) {
        const mid = Math.floor(chunk.length / 2)
        await upsertBatch(table, chunk.slice(0, mid))
        await upsertBatch(table, chunk.slice(mid))
      } else {
        throw new Error(`[${table}] ${error.message} - Row: ${JSON.stringify(chunk[0])}`)
      }
    }
  }
}

export default function UploadExcel() {
  const [step, setStep]             = useState(0)
  const [dragging, setDragging]     = useState(false)
  const [file, setFile]             = useState(null)
  const [parsed, setParsed]         = useState(null)
  const [parseError, setParseError] = useState(null)
  const [progress, setProgress]     = useState(0)
  const [uploadLog, setUploadLog]   = useState([])
  const [activeTab, setActiveTab]   = useState('bills')
  const fileRef = useRef()

  const addLog = (msg, ok = true) =>
    setUploadLog(prev => [...prev, { msg, ok, time: new Date().toLocaleTimeString('lo-LA') }])

  const handleFile = useCallback(async (f) => {
    if (!f?.name.match(/\.(xlsx|xls)$/i)) {
      setParseError('ກະລຸນາເລືອກໄຟລ .xlsx ຫຼື .xls ເທົ່ານັ້ນ')
      return
    }
    setFile(f); setParseError(null)
    try {
      const result = await parseExcelFile(f)
      if (!result.bills.length && !result.debt.length) {
        setParseError('ບໍ່ພົບຂໍ້ມູນ — ກວດສອບຊື່ sheet ຕ້ອງມີ "Daily" ຫຼື "Pay off"')
        return
      }
      setParsed(result)
      setStep(1)
    } catch (err) {
      setParseError(`ອ່ານໄຟລ ບໍ່ສຳເລັດ: ${err.message}`)
    }
  }, [])

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }, [handleFile])

  async function startUpload() {
    if (!parsed) return
    setStep(2); setProgress(0); setUploadLog([])
    try {
      addLog(`ເລີ່ມອັບໂຫຼດ "${file.name}"`)
      const debtRows = (parsed.debt || []).filter(row => row.customer_type === 'INS')
      const skippedNonInsDebt = (parsed.debt || []).length - debtRows.length
      const billsTotal = parsed.bills.length
      const debtTotal  = debtRows.length
      const cashflowTotal = parsed.cashflow?.length || 0
      const grandTotal = billsTotal + debtTotal + cashflowTotal
      if (skippedNonInsDebt > 0) {
        addLog(`Skipped ${formatNumber(skippedNonInsDebt)} non-INS Pay off rows; only INS goes to Debt Management.`, true)
      }

      if (billsTotal > 0) {
        addLog(`ກຳລັງອັບໂຫຼດ ar_bills (${formatNumber(billsTotal)} ແຖວ)...`)
        let done = 0
        for (let i = 0; i < billsTotal; i += BATCH_SIZE) {
          await upsertBatch('ar_bills', parsed.bills.slice(i, i + BATCH_SIZE))
          done += Math.min(BATCH_SIZE, billsTotal - i)
          setProgress(Math.round((done / grandTotal) * 85))
        }
        addLog(`✓ ar_bills: ${formatNumber(billsTotal)} ແຖວ ສຳເລັດ`)
      }

      if (debtTotal > 0) {
        addLog(`ກຳລັງອັບໂຫຼດ ar_debt (${formatNumber(debtTotal)} ແຖວ)...`)
        let done = billsTotal
        for (let i = 0; i < debtTotal; i += BATCH_SIZE) {
          await upsertBatch('ar_debt', debtRows.slice(i, i + BATCH_SIZE))
          done += Math.min(BATCH_SIZE, debtTotal - i)
          setProgress(Math.round((done / grandTotal) * 88))
        }
        addLog(`✓ ar_debt: ${formatNumber(debtTotal)} ແຖວ ສຳເລັດ`)

        // Sync Pay off debt_status → ar_bills (UPDATE debt_status only, keep original debt amount)
        const updates = parsed.billUpdates || []
        if (updates.length > 0) {
          addLog(`ກຳລັງປັບສະຖານະໜີ້ → ar_bills (${formatNumber(updates.length)} ແຖວ)...`)
          const CHUNK = 50
          for (let i = 0; i < updates.length; i += CHUNK) {
            const chunk = updates.slice(i, i + CHUNK)
            await Promise.all(
              chunk.map(({ bill_no, date, debt_status }) =>
                supabase.from('ar_bills')
                  .update({ debt_status })
                  .eq('bill_no', bill_no)
                  .eq('date', date)
              )
            )
            setProgress(Math.round(88 + ((i + CHUNK) / updates.length) * 10))
          }
          addLog(`✓ sync debt status: ${formatNumber(updates.length)} bills ອັບເດດ`)
        }
      }

      if (cashflowTotal > 0) {
        addLog(`ກຳລັງອັບໂຫຼດ ar_cashflow (${formatNumber(cashflowTotal)} ແຖວ)...`)
        let done = billsTotal + debtTotal
        for (let i = 0; i < cashflowTotal; i += BATCH_SIZE) {
          await upsertBatch('ar_cashflow', parsed.cashflow.slice(i, i + BATCH_SIZE))
          done += Math.min(BATCH_SIZE, cashflowTotal - i)
          setProgress(Math.round((done / grandTotal) * 98))
        }
        addLog(`✓ ar_cashflow: ${formatNumber(cashflowTotal)} ແຖວ ສຳເລັດ`)
      }

      setProgress(100)
      addLog('✓ ອັບໂຫຼດທຸກຢ່າງສຳເລັດ!')
      await logAction({
        action: 'ອັບໂຫຼດຂໍ້ມູນ Excel',
        action_type: 'data.upload',
        entity_type: 'excel_file',
        entity_id: file?.name,
        details: `ອັບໂຫຼດ ${grandTotal} ແຖວ ຈາກ ${file?.name || 'ໄຟລ Excel'}`,
        metadata: {
          file_name: file?.name,
          bills: billsTotal,
          debt: debtTotal,
          cashflow: cashflowTotal,
        },
      })
      setStep(3)
    } catch (err) {
      addLog(`✗ ${err.message}`, false)
      await logAction({
        action: 'Excel upload failed',
        action_type: 'data.upload.failed',
        entity_type: 'excel_file',
        entity_id: file?.name,
        details: err.message,
        metadata: {
          file_name: file?.name,
        },
      })
    }
  }

  const reset = () => {
    setStep(0); setFile(null); setParsed(null)
    setParseError(null); setProgress(0); setUploadLog([])
  }

  const tabs = [
    { key: 'bills', label: 'ar_bills',  icon: '📋', count: parsed?.bills?.length, desc: 'Daily Transactions' },
    { key: 'debt',  label: 'ar_debt',   icon: '💳', count: parsed?.debt?.length,  desc: 'Pay off Records' },
    { key: 'cashflow', label: 'ar_cashflow', icon: '💸', count: parsed?.cashflow?.length, desc: 'Looker Cash Flow' },
  ]

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">ອັບໂຫຼດໄຟລ Excel</h2>
          <p className="text-sm text-slate-500 mt-0.5">Upload AR Finance Data → Supabase (ar_bills + ar_debt)</p>
        </div>
        <button
          onClick={downloadTemplate}
          className="btn-secondary text-xs flex items-center gap-2 py-2"
        >
          <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="font-semibold text-emerald-700">ດາວໂຫຼດ Template</span>
        </button>
      </div>

      <StepIndicator current={step} />

      {/* ─── Step 0: Drop zone ─── */}
      {step === 0 && (
        <div className="space-y-4">
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-14 text-center cursor-pointer transition-all duration-200 ${
              dragging ? 'border-primary-400 bg-primary-50 scale-[1.01]' : 'border-slate-200 bg-white hover:border-primary-300 hover:bg-slate-50'
            }`}
          >
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
              onChange={e => handleFile(e.target.files[0])} />
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${dragging ? 'bg-primary-100' : 'bg-slate-100'}`}>
              <svg className={`w-8 h-8 ${dragging ? 'text-primary-600' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className="text-lg font-bold text-slate-700">ລາກ & ວາງໄຟລ Excel ທີ່ນີ້</p>
            <p className="text-sm text-slate-400 mt-1">ຫຼື <span className="text-primary-600 font-semibold">ຄລິກເພື່ອເລືອກໄຟລ</span></p>
            <p className="text-xs text-slate-300 mt-3">ຮອງຮັບ: .xlsx, .xls  •  ຕ້ອງມີ sheet: "Daily" ແລະ/ຫຼື "Pay off"</p>
          </div>

          {parseError && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
              <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-sm text-red-700 font-medium">{parseError}</p>
            </div>
          )}

          {/* Instructions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Sheet guide */}
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
              <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">①</span>
                ໂຄງສ້າງ Excel
              </h4>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-indigo-50 rounded-xl">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0">D</div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Sheet "Daily"</p>
                    <p className="text-xs text-slate-500 mt-0.5">ໃບບິນລາຍວັນ → ບັນທຶກໃນ <code className="bg-indigo-100 px-1 rounded">ar_bills</code></p>
                    <p className="text-xs text-indigo-600 mt-1">≈ 3,000+ ແຖວ ຕໍ່ເດືອນ</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-sky-50 rounded-xl">
                  <div className="w-8 h-8 rounded-lg bg-sky-600 text-white text-xs font-bold flex items-center justify-center shrink-0">P</div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Sheet "Pay off"</p>
                    <p className="text-xs text-slate-500 mt-0.5">ໜີ້ / ປະກັນ → ບັນທຶກໃນ <code className="bg-sky-100 px-1 rounded">ar_debt</code></p>
                    <p className="text-xs text-sky-600 mt-1">≈ 800+ ແຖວ</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Column mapping quick ref */}
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
              <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center">②</span>
                ການຈັບຄູ່ຄໍລຳ
              </h4>
              <div className="space-y-1.5 text-xs">
                {[
                  ['Customer Type Code', 'customer_type', 'GN / INS / B2B'],
                  ['Customer Name',      'patient_name',  'ຊື່ຄົນເຈັບ'],
                  ['Cash Received',      'cash',          'ເງິນສົດ'],
                  ['Transfer BCEL',      'bcel',          'BCEL Bank'],
                  ['Transfer BCEL2',     'bcel2',         'BCEL2 Bank'],
                  ['Transfer LDB',       'ldb',           'LDB Bank'],
                  ['Outstanding Debt',   'debt',          'ໜີ້ຄ້າງ'],
                ].map(([excel, db, note]) => (
                  <div key={db} className="flex items-center gap-2">
                    <code className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px] w-36 shrink-0 truncate">{excel}</code>
                    <svg className="w-3 h-3 text-slate-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                    <code className="bg-primary-50 text-primary-700 px-1.5 py-0.5 rounded text-[10px]">{db}</code>
                    <span className="text-slate-400 text-[10px]">{note}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Steps guide */}
          <div className="bg-gradient-to-r from-primary-600 to-indigo-600 rounded-2xl p-5 text-white">
            <h4 className="font-bold mb-3 text-sm">ຄຳແນະນຳການໃຊ້ງານ</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { n:'1', t:'ດາວໂຫຼດ Template', d:'ຄລິກ "ດາວໂຫຼດ Template" ດ້ານເທິງ' },
                { n:'2', t:'ຕື່ມຂໍ້ມູນ',      d:'ຕື່ມຂໍ້ມູນ sheet Daily ແລະ Pay off' },
                { n:'3', t:'ອັບໂຫຼດໄຟລ',      d:'ລາກ & ວາງ ຫຼື ຄລິກເລືອກໄຟລ' },
                { n:'4', t:'ຢືນຢັນ Upload',    d:'ກວດ preview ແລ້ວກົດ "ຢືນຢັນ"' },
              ].map(s => (
                <div key={s.n} className="bg-white/10 rounded-xl p-3">
                  <div className="w-7 h-7 rounded-full bg-white/20 text-white text-xs font-bold flex items-center justify-center mb-2">{s.n}</div>
                  <p className="text-xs font-semibold">{s.t}</p>
                  <p className="text-[10px] text-white/70 mt-0.5">{s.d}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── Step 1: Preview ─── */}
      {step === 1 && parsed && (
        <div className="space-y-4">
          {/* File info bar */}
          <div className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-4 shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-800 truncate">{file?.name}</p>
              <p className="text-xs text-slate-400">{(file?.size / 1024).toFixed(1)} KB  •  Sheets: {parsed.sheets.join(', ')}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-2xl font-bold text-primary-600">{formatNumber((parsed.bills?.length || 0) + (parsed.debt?.length || 0))}</p>
              <p className="text-xs text-slate-400">ແຖວ (ຫຼັງຕັດຂໍ້ມູນຊ້ຳ)</p>
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
              <p className="text-3xl font-bold text-indigo-700">{formatNumber(parsed.bills?.length || 0)}</p>
              <p className="text-sm font-semibold text-indigo-600 mt-1">ແຖວ ar_bills</p>
              <p className="text-xs text-slate-400">ຈາກ sheet "Daily"</p>
            </div>
            <div className="bg-sky-50 border border-sky-100 rounded-2xl p-4">
              <p className="text-3xl font-bold text-sky-700">{formatNumber(parsed.debt?.length || 0)}</p>
              <p className="text-sm font-semibold text-sky-600 mt-1">ແຖວ ar_debt</p>
              <p className="text-xs text-slate-400">ຈາກ sheet "Pay off"</p>
            </div>
          </div>

          {/* Data preview table */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center border-b border-slate-100">
              {tabs.map(t => (
                <button key={t.key} onClick={() => setActiveTab(t.key)}
                  className={`px-5 py-3 text-sm font-semibold transition-colors border-b-2 flex items-center gap-2 ${
                    activeTab === t.key ? 'text-primary-600 border-primary-600' : 'text-slate-500 border-transparent hover:text-slate-700'
                  }`}>
                  <span>{t.icon}</span>
                  <code>{t.label}</code>
                  <span className="text-xs bg-slate-100 text-slate-500 rounded-full px-2 py-0.5">{formatNumber(t.count || 0)}</span>
                </button>
              ))}
              <p className="ml-auto text-xs text-slate-400 px-4">ສະແດງ 5 ແຖວທຳອິດ</p>
            </div>
            {(() => {
              const data = activeTab === 'bills'
                ? parsed.bills?.slice(0, 5)
                : activeTab === 'debt'
                  ? parsed.debt?.slice(0, 5)
                  : parsed.cashflow?.slice(0, 5)
              if (!data?.length) return <div className="p-10 text-center text-slate-400 text-sm">ບໍ່ພົບຂໍ້ມູນໃນ sheet ນີ້</div>
              const keys = Object.keys(data[0] || {}).slice(0, 10)
              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="bg-slate-50">{keys.map(k => <th key={k} className="px-3 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{k}</th>)}</tr></thead>
                    <tbody className="divide-y divide-slate-50">
                      {data.map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          {keys.map(k => <td key={k} className="px-3 py-2 text-[11px] text-slate-700 max-w-[120px] truncate">{row[k] !== null && row[k] !== undefined ? String(row[k]) : '—'}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })()}
          </div>

          <div className="flex items-center justify-between">
            <button onClick={reset} className="btn-secondary">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
              ກັບຄືນ
            </button>
            <button onClick={startUpload} className="btn-primary px-8 py-2.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
              ຢືນຢັນອັບໂຫຼດ
            </button>
          </div>
        </div>
      )}

      {/* ─── Step 2: Uploading ─── */}
      {step === 2 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 space-y-5">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-primary-50 flex items-center justify-center mx-auto mb-4">
              <div className="w-9 h-9 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">ກຳລັງອັບໂຫຼດ...</h3>
            <p className="text-sm text-slate-400 mt-1">{file?.name}</p>
          </div>
          <div>
            <div className="flex justify-between text-xs text-slate-500 mb-1.5"><span>ຄວາມຄືບໜ້າ</span><span className="font-semibold">{progress}%</span></div>
            <div className="w-full bg-slate-100 rounded-full h-2.5">
              <div className="h-2.5 rounded-full bg-gradient-to-r from-primary-500 to-indigo-500 transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <div className="bg-slate-900 rounded-xl p-4 font-mono text-xs space-y-1 max-h-44 overflow-y-auto">
            {uploadLog.map((e, i) => (
              <p key={i} className={e.ok ? 'text-emerald-400' : 'text-red-400'}>
                <span className="text-slate-500 mr-1">{e.time}</span>{e.msg}
              </p>
            ))}
            {!uploadLog.length && <p className="text-slate-500">ກຳລັງລໍຖ້າ...</p>}
          </div>
        </div>
      )}

      {/* ─── Step 3: Done ─── */}
      {step === 3 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
            <svg className="w-11 h-11 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h3 className="text-2xl font-bold text-slate-800">ອັບໂຫຼດສຳເລັດ!</h3>
            <p className="text-slate-500 mt-1 text-sm">ຂໍ້ມູນໄດ້ຖືກບັນທຶກລົງ Supabase ແລ້ວ — Dashboard ພ້ອມສະແດງຂໍ້ມູນຈິງ</p>
          </div>
          <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto">
            <div className="bg-indigo-50 rounded-xl p-4">
              <p className="text-2xl font-bold text-indigo-700">{formatNumber(parsed?.bills?.length || 0)}</p>
              <p className="text-xs text-indigo-500 mt-0.5">ແຖວ ar_bills</p>
            </div>
            <div className="bg-sky-50 rounded-xl p-4">
              <p className="text-2xl font-bold text-sky-700">{formatNumber(parsed?.debt?.length || 0)}</p>
              <p className="text-xs text-sky-500 mt-0.5">ແຖວ ar_debt</p>
            </div>
          </div>
          <div className="bg-slate-900 rounded-xl p-3 font-mono text-xs text-left max-h-28 overflow-y-auto mx-auto max-w-lg">
            {uploadLog.map((e, i) => (
              <p key={i} className={e.ok ? 'text-emerald-400' : 'text-red-400'}>
                <span className="text-slate-500 mr-1">{e.time}</span>{e.msg}
              </p>
            ))}
          </div>
          <div className="flex gap-3 justify-center">
            <button onClick={reset} className="btn-secondary">ອັບໂຫຼດໄຟລໃໝ່</button>
            <a href="/" className="btn-primary px-6">ເບິ່ງ Dashboard →</a>
          </div>
        </div>
      )}
    </div>
  )
}
