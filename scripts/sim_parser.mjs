// Simulate excelParser behavior on the user-supplied Excel
import * as XLSX from '../node_modules/xlsx/xlsx.mjs'
import fs from 'fs'

const fp = String.raw`C:\Users\asus\Downloads\Report AR Finance Test (3).xlsx`
const buf = fs.readFileSync(fp)
const wb = XLSX.read(new Uint8Array(buf), { type: 'array' })
const sheet = wb.Sheets['Daily']

function toIsoDate(val) {
  let y, m, d
  if (val instanceof Date) {
    y = val.getFullYear()
    m = val.getMonth() + 1
    d = val.getDate()
  } else if (typeof val === 'number') {
    const parsed = XLSX.SSF.parse_date_code(val)
    if (parsed?.y && parsed?.m && parsed?.d) {
      y = parsed.y; m = parsed.m; d = parsed.d
    }
  } else {
    const s = String(val).trim()
    const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (slash) {
      y = parseInt(slash[3]); m = parseInt(slash[2]); d = parseInt(slash[1])
    } else {
      const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
      if (iso) { y = parseInt(iso[1]); m = parseInt(iso[2]); d = parseInt(iso[3]) }
      else {
        const parsed = new Date(s)
        if (parsed && !isNaN(parsed.getTime())) {
          y = parsed.getFullYear(); m = parsed.getMonth() + 1; d = parsed.getDate()
        }
      }
    }
  }
  if (!y || !m || !d) return null
  if (y < 2000 || m > 12 || d > 31) return null
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

const rows = XLSX.utils.sheet_to_json(sheet, { defval: null })
console.log('Total rows:', rows.length)
console.log('TZ offset:', new Date().getTimezoneOffset(), 'min (positive = behind UTC)')
console.log('Process TZ env:', process.env.TZ)

// Sample raw vs parsed for first row of each unique date
const byDate = new Map()
for (const r of rows) {
  const raw = r['Date']
  const iso = toIsoDate(raw)
  const key = iso
  if (!byDate.has(key) && byDate.size < 8) {
    byDate.set(key, { raw, type: raw?.constructor?.name, iso })
  }
}
for (const [iso, v] of byDate) {
  console.log(`raw=${v.raw} type=${v.type} → ${v.iso}`)
}

// Aggregate by ISO date and show 5/1, 5/2
const agg = {}
for (const r of rows) {
  const iso = toIsoDate(r['Date'])
  if (!iso) continue
  agg[iso] = agg[iso] || { bills: new Set(), gross: 0, grand: 0, debt: 0 }
  if (r['Bill No']) agg[iso].bills.add(r['Bill No'])
  agg[iso].gross += Number(r['Total']) || 0
  agg[iso].grand += Number(r['Grand Total']) || 0
  agg[iso].debt += Number(r['Outstanding Debt']) || 0
}
for (const day of ['2026-04-30','2026-05-01','2026-05-02','2026-05-03']) {
  const a = agg[day]
  if (!a) { console.log(day, '(none)'); continue }
  console.log(day, 'bills=', a.bills.size, 'gross=', a.gross, 'grand=', a.grand, 'debt=', a.debt)
}
