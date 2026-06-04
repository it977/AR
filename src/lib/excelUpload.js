import { supabase } from './supabase'

const OPTIONAL_COLUMNS = {
  ar_bills: [
    'payment_type', 'due_date', 'bill_issued_at',
  ],
  ar_debt: [
    'insite_onsite', 'opd_ipd', 'payment_type',
    'payment_1_date', 'payment_1_method', 'payment_1_amount',
    'payment_2_date', 'payment_2_method', 'payment_2_amount',
    'payment_3_date', 'payment_3_method', 'payment_3_amount',
  ],
}

const CHUNK = 100

function conflictKeyOf(table, r) {
  return r.source_key || (
    table === 'ar_bills'
      ? `${r.bill_no}__${r.date}__${r.workload || 'ALL'}`
      : `${r.bill_no}__${r.date}`
  )
}

function conflictKeyDb(table, sample) {
  if (sample?.source_key) return 'source_key'
  return table === 'ar_bills' ? 'bill_no,date,workload' : 'bill_no,date'
}

async function upsertChunk(table, chunk) {
  const keyDb = conflictKeyDb(table, chunk[0])
  let { error } = await supabase.from(table).upsert(chunk, { onConflict: keyDb, ignoreDuplicates: false })
  if (error && OPTIONAL_COLUMNS[table]?.some(col => error.message?.includes(col))) {
    const optional = new Set(OPTIONAL_COLUMNS[table])
    const stripped = chunk.map(row => Object.fromEntries(
      Object.entries(row).filter(([k]) => !optional.has(k))
    ))
    ;({ error } = await supabase.from(table).upsert(stripped, { onConflict: keyDb, ignoreDuplicates: false }))
  }
  return error
}

export async function upsertRows(table, rows, onProgress) {
  if (!rows?.length) return 0
  const seen = new Map()
  for (const r of rows) seen.set(conflictKeyOf(table, r), r)
  const unique = [...seen.values()]

  let done = 0
  async function uploadSlice(slice) {
    if (!slice.length) return
    const err = await upsertChunk(table, slice)
    if (err) {
      if (slice.length > 10) {
        const mid = Math.floor(slice.length / 2)
        await uploadSlice(slice.slice(0, mid))
        await uploadSlice(slice.slice(mid))
      } else {
        throw new Error(`[${table}] ${err.message}`)
      }
    }
  }

  for (let i = 0; i < unique.length; i += CHUNK) {
    const chunk = unique.slice(i, i + CHUNK)
    await uploadSlice(chunk)
    done += chunk.length
    onProgress?.(Math.round(done / unique.length * 100), done, unique.length)
  }
  return unique.length
}

// Update only debt_status on ar_bills (from Pay off sheet)
export async function syncDebtStatus(billUpdates, onProgress) {
  if (!billUpdates?.length) return 0
  const CHUNK_UP = 50
  let done = 0
  for (let i = 0; i < billUpdates.length; i += CHUNK_UP) {
    const chunk = billUpdates.slice(i, i + CHUNK_UP)
    await Promise.all(chunk.map(({ bill_no, date, debt_status }) =>
      supabase.from('ar_bills').update({ debt_status }).eq('bill_no', bill_no).eq('date', date)
    ))
    done += chunk.length
    onProgress?.(Math.round(done / billUpdates.length * 100), done, billUpdates.length)
  }
  return billUpdates.length
}
