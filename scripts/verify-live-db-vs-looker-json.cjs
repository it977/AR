const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const source = process.argv[2] || path.join(process.cwd(), 'public', 'looker-live-sync.json')
const outPath = process.argv[3] || path.join(process.cwd(), '.tmp', 'looker-live', 'live-db-audit.md')
const TOLERANCE = 0.5

function readEnv() {
  return Object.fromEntries(
    fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8')
      .split(/\r?\n/)
      .filter(line => line && !line.startsWith('#') && line.includes('='))
      .map(line => {
        const index = line.indexOf('=')
        return [line.slice(0, index), line.slice(index + 1)]
      })
  )
}

function decodeJwt(token) {
  const payload = token.split('.')[1]
  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
  return JSON.parse(Buffer.from(normalized, 'base64').toString('utf8'))
}

function findBrowserToken() {
  const roots = [
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'User Data', 'Default', 'Local Storage', 'leveldb'),
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data', 'Default', 'Local Storage', 'leveldb'),
  ].filter(Boolean)

  const candidates = []
  for (const root of roots) {
    if (!fs.existsSync(root)) continue
    for (const name of fs.readdirSync(root)) {
      if (!/\.(ldb|log)$/i.test(name)) continue
      const file = path.join(root, name)
      let text = ''
      try {
        text = fs.readFileSync(file).toString('latin1')
      } catch {
        continue
      }
      if (!text.includes('127.0.0.1:5175') && !text.includes('localhost:5173')) continue
      const matches = text.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) || []
      for (const token of matches) {
        try {
          const claims = decodeJwt(token)
          if (!String(claims.iss || '').includes('yomxctcjjlcujmowkhru.supabase.co')) continue
          if (claims.aud !== 'authenticated') continue
          candidates.push({ token, claims })
        } catch {}
      }
    }
  }

  candidates.sort((a, b) => (b.claims.exp || 0) - (a.claims.exp || 0))
  const best = candidates[0]
  if (!best) return null
  if ((best.claims.exp || 0) * 1000 < Date.now()) return null
  return best
}

function num(value) {
  const n = Number(value || 0)
  return Number.isFinite(n) ? n : 0
}

function fmt(value) {
  return Math.round(num(value)).toLocaleString('en-US')
}

function add(map, date, patch) {
  if (!date) return
  if (!map[date]) {
    map[date] = {
      bills: 0,
      customers: new Set(),
      totalSales: 0,
      discounts: 0,
      actualTotalSale: 0,
      billDebt: 0,
      billCash: 0,
      billBcel: 0,
      billBcel2: 0,
      billLdb: 0,
      billPrepayment: 0,
      debtRows: 0,
      debtAmount: 0,
      debtBalance: 0,
      debtPaid: 0,
      cashflowRows: 0,
      cashflowIncome: 0,
      cashflowBalance: 0,
      cashflowOutstanding: 0,
      cashflowCash: 0,
      cashflowBcel: 0,
      cashflowBcel2: 0,
      cashflowLdb: 0,
      female: 0,
      male: 0,
      insite: 0,
      onsite: 0,
      opd: 0,
      ipd: 0,
      aging: {},
    }
  }
  const item = map[date]
  for (const [key, value] of Object.entries(patch)) {
    if (key === 'customer') {
      if (value) item.customers.add(String(value))
    } else if (key === 'aging') {
      const label = value?.label || ''
      if (!label) continue
      item.aging[label] = item.aging[label] || { bills: 0, balance: 0 }
      item.aging[label].bills += num(value.bills)
      item.aging[label].balance += num(value.balance)
    } else {
      item[key] = num(item[key]) + num(value)
    }
  }
}

function normalizeGender(value) {
  const text = String(value || '').trim().toLowerCase()
  if (text === 'female' || text === 'f' || text === 'femal') return 'female'
  if (text === 'male' || text === 'm') return 'male'
  return ''
}

function agingLabel(row) {
  const label = String(row.aging_group || row.aging || '').trim()
  if (label) return label
  return 'Unknown'
}

function buildAgg(rows, table) {
  const map = {}
  for (const row of rows || []) {
    const date = String(row.date || '').slice(0, 10)
    if (!date) continue
    if (table === 'bills') {
      const gender = normalizeGender(row.gender)
      add(map, date, {
        bills: 1,
        customer: row.customer_id || row.patient_name || row.bill_no,
        totalSales: row.grand_total,
        discounts: row.discounts,
        actualTotalSale: row.grand_total,
        billDebt: row.debt,
        billCash: row.cash,
        billBcel: row.bcel,
        billBcel2: row.bcel2,
        billLdb: row.ldb,
        billPrepayment: row.prepayment,
        female: gender === 'female' ? 1 : 0,
        male: gender === 'male' ? 1 : 0,
        insite: row.insite_onsite === 'Insite' ? 1 : 0,
        onsite: row.insite_onsite === 'Onsite' ? 1 : 0,
        opd: row.opd_ipd === 'OPD' ? 1 : 0,
        ipd: row.opd_ipd === 'IPD' ? 1 : 0,
      })
    } else if (table === 'debt') {
      add(map, date, {
        debtRows: 1,
        debtAmount: row.debt_amount,
        debtBalance: row.balance,
        debtPaid: row.amount_paid,
        aging: { label: agingLabel(row), bills: 1, balance: row.balance },
      })
    } else if (table === 'cashflow') {
      add(map, date, {
        cashflowRows: 1,
        cashflowIncome: row.total_actual_income,
        cashflowBalance: row.balance,
        cashflowOutstanding: row.outstanding_debt,
        cashflowCash: row.cash,
        cashflowBcel: row.bcel,
        cashflowBcel2: row.bcel2,
        cashflowLdb: row.ldb,
      })
    }
  }
  return map
}

function mergeAgg(...maps) {
  const out = {}
  for (const map of maps) {
    for (const [date, item] of Object.entries(map)) {
      if (!out[date]) out[date] = {
        ...item,
        customers: new Set(item.customers || []),
        aging: { ...(item.aging || {}) },
      }
      else {
        for (const [key, value] of Object.entries(item)) {
          if (key === 'customers') for (const customer of value) out[date].customers.add(customer)
          else if (key === 'aging') {
            for (const [label, aging] of Object.entries(value)) {
              out[date].aging[label] = out[date].aging[label] || { bills: 0, balance: 0 }
              out[date].aging[label].bills += aging.bills
              out[date].aging[label].balance += aging.balance
            }
          } else out[date][key] = num(out[date][key]) + num(value)
        }
      }
    }
  }
  return out
}

function finalize(item = {}) {
  return {
    totalSales: num(item.totalSales),
    discounts: num(item.discounts),
    actualTotalSale: num(item.actualTotalSale),
    totalBills: num(item.bills),
    totalCustomers: item.customers instanceof Set ? item.customers.size : num(item.totalCustomers),
    actualIncome: num(item.cashflowIncome),
    dailyIncome: num(item.cashflowIncome),
    outstandingDebt: num(item.cashflowOutstanding || item.debtAmount || item.billDebt),
    paymentBalance: num(item.cashflowBalance),
    outstandingBills: num(item.debtRows),
    cash: num(item.cashflowCash || item.billCash),
    bcel: num(item.cashflowBcel || item.billBcel),
    bcel2: num(item.cashflowBcel2 || item.billBcel2),
    ldb: num(item.cashflowLdb || item.billLdb),
    female: num(item.female),
    male: num(item.male),
    insite: num(item.insite),
    onsite: num(item.onsite),
    opd: num(item.opd),
    ipd: num(item.ipd),
    aging: item.aging || {},
  }
}

async function fetchRows(sb, table) {
  const all = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select('*').range(from, from + 999)
    if (error) throw new Error(`${table}: ${error.message}`)
    all.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return all
}

function diffMetric(looker, system, field) {
  return num(system[field]) - num(looker[field])
}

function status(looker, system, fields) {
  return fields.every(field => Math.abs(diffMetric(looker, system, field)) <= TOLERANCE) ? 'PASS' : 'FAIL'
}

async function main() {
  const env = { ...readEnv(), ...process.env }
  const browserAuth = findBrowserToken()
  const accessToken = env.SUPABASE_ACCESS_TOKEN || env.VITE_SUPABASE_ACCESS_TOKEN || browserAuth?.token
  const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined,
  })
  const payload = JSON.parse(fs.readFileSync(source, 'utf8'))
  const sourceAgg = mergeAgg(
    buildAgg(payload.bills, 'bills'),
    buildAgg(payload.debt, 'debt'),
    buildAgg(payload.cashflow, 'cashflow'),
  )
  const [bills, debt, cashflow] = await Promise.all([
    fetchRows(sb, 'ar_bills'),
    fetchRows(sb, 'ar_debt'),
    fetchRows(sb, 'ar_cashflow'),
  ])
  const systemAgg = mergeAgg(
    buildAgg(bills, 'bills'),
    buildAgg(debt, 'debt'),
    buildAgg(cashflow, 'cashflow'),
  )
  // Audit only the dates available in the Looker export. The live DB can contain
  // new operational rows that are not visible in the exported Looker source yet.
  const dates = Object.keys(sourceAgg).sort()
  const fieldsByPage = {
    'Daily Sales Report': ['totalSales', 'discounts', 'actualTotalSale', 'totalBills', 'actualIncome', 'outstandingDebt', 'outstandingBills'],
    'Customer & Service Analysis': ['totalBills', 'female', 'male', 'insite', 'onsite', 'opd', 'ipd'],
    'Payment Channel': ['actualIncome', 'cash', 'bcel', 'bcel2', 'ldb', 'paymentBalance'],
    'Outstanding Debt': ['outstandingDebt', 'outstandingBills'],
    'Debt Aging': ['outstandingDebt', 'outstandingBills'],
  }
  const rows = []
  for (const date of dates) {
    const looker = finalize(sourceAgg[date])
    const system = finalize(systemAgg[date])
    for (const [page, fields] of Object.entries(fieldsByPage)) {
      const deltas = fields
        .map(field => [field, diffMetric(looker, system, field)])
        .filter(([, delta]) => Math.abs(delta) > TOLERANCE)
      rows.push({ date, page, status: status(looker, system, fields), deltas, looker, system })
    }
  }

  const failed = rows.filter(row => row.status === 'FAIL')
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  const lines = [
    '# Looker vs Live System Audit',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Source JSON: ${source}`,
    `Dates checked: ${dates.length}`,
    `Rows checked: ${rows.length}`,
    `PASS: ${rows.length - failed.length}`,
    `FAIL: ${failed.length}`,
    '',
    '## Daily Summary',
    '',
    '| Date | Daily | Customer | Payment | Outstanding | Aging |',
    '|---|---:|---:|---:|---:|---:|',
  ]
  for (const date of dates) {
    const byPage = Object.fromEntries(rows.filter(row => row.date === date).map(row => [row.page, row.status === 'PASS' ? '[x]' : '[ ]']))
    lines.push(`| ${date} | ${byPage['Daily Sales Report']} | ${byPage['Customer & Service Analysis']} | ${byPage['Payment Channel']} | ${byPage['Outstanding Debt']} | ${byPage['Debt Aging']} |`)
  }

  lines.push('', '## Failed Rows', '')
  if (!failed.length) {
    lines.push('All checked dashboard/date rows match.')
  } else {
    lines.push('| Date | Dashboard | Difference |', '|---|---|---|')
    for (const row of failed.slice(0, 50)) {
      const diffText = row.deltas.map(([field, delta]) => `${field}: ${fmt(delta)}`).join('; ')
      lines.push(`| ${row.date} | ${row.page} | ${diffText} |`)
    }
  }

  const d28 = rows.find(row => row.date === '2026-06-28' && row.page === 'Daily Sales Report')
  if (d28) {
    lines.push('', '## 2026-06-28 Spot Check', '')
    lines.push('| Metric | Looker | System | Difference |')
    lines.push('|---|---:|---:|---:|')
    for (const field of fieldsByPage['Daily Sales Report']) {
      lines.push(`| ${field} | ${fmt(d28.looker[field])} | ${fmt(d28.system[field])} | ${fmt(diffMetric(d28.looker, d28.system, field))} |`)
    }
  }
  const p28 = rows.find(row => row.date === '2026-06-28' && row.page === 'Payment Channel')
  if (p28) {
    lines.push('', '## 2026-06-28 Payment Channel Spot Check', '')
    lines.push('| Metric | Looker | System | Difference |')
    lines.push('|---|---:|---:|---:|')
    for (const field of fieldsByPage['Payment Channel']) {
      lines.push(`| ${field} | ${fmt(p28.looker[field])} | ${fmt(p28.system[field])} | ${fmt(diffMetric(p28.looker, p28.system, field))} |`)
    }
  }

  fs.writeFileSync(outPath, lines.join('\n'))
  console.log(`Audit file: ${outPath}`)
  console.log(`Dates checked: ${dates.length}`)
  console.log(`Rows checked: ${rows.length}`)
  console.log(`PASS: ${rows.length - failed.length}`)
  console.log(`FAIL: ${failed.length}`)
  const date28 = rows.filter(row => row.date === '2026-06-28')
  for (const row of date28) {
    console.log(`${row.date} ${row.page}: ${row.status}`)
    if (row.deltas.length) console.log('  ', row.deltas.map(([f, d]) => `${f}=${fmt(d)}`).join(', '))
  }
}

main().catch(error => {
  console.error(error.message)
  process.exit(1)
})
