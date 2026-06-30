const fs = require('fs')
const path = require('path')
const XLSX = require('xlsx')

const SRC = process.argv[2] || path.join(process.cwd(), '.tmp', 'looker-sheet-audit', 'source.xlsx')
const OUT_DIR = process.argv[3] || path.join(process.cwd(), '.tmp', 'report-page-audit')
const TOLERANCE = 0.5

function normKeys(row) {
  const out = {}
  for (const [key, value] of Object.entries(row)) {
    out[key.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim()] = value
  }
  return out
}

function isoDate(value) {
  if (value == null || value === '') return ''
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value)
    return parsed
      ? `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`
      : ''
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
  }
  const text = String(value).trim()
  let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (match) return `${match[1]}-${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}`
  match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/)
  if (match) return `${match[3]}-${String(match[2]).padStart(2, '0')}-${String(match[1]).padStart(2, '0')}`
  return ''
}

function num(value) {
  if (value == null || value === '') return 0
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const parsed = Number(String(value).replace(/,/g, '').trim())
  return Number.isFinite(parsed) ? parsed : 0
}

function fmt(value) {
  return Math.round(num(value)).toLocaleString('en-US')
}

function sheetRows(workbook, name) {
  const sheet = workbook.Sheets[name]
  if (!sheet) return []
  return XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true }).map(normKeys)
}

function distinctCount(rows, key) {
  const values = new Set(rows.map(row => row[key]).filter(Boolean).map(String))
  return values.size
}

function paymentTotal(row) {
  return num(row['Cash Received']) +
    num(row['Transfer Payment by BCEL']) +
    num(row['Transfer Payment by BCEL2'] ?? row['Transfer Payment by BCEL 2']) +
    num(row['Transfer Payment by LDB']) +
    num(row.Prepayment)
}

function payoffChannelTotal(row) {
  return num(row['Cash Received Debt']) +
    num(row['Transfer Payment by BCEL Debt']) +
    num(row['Transfer Payment by BCEL2 Debt'] ?? row['Transfer Payment by BCEL 2 Debt']) +
    num(row['Transfer Payment by LDB Debt'])
}

function payoffAmount(row) {
  return num(row['Amount Paid']) || payoffChannelTotal(row)
}

function addMetric(rows, dateKey, date) {
  return rows.filter(row => isoDate(row[dateKey]) === date)
}

function sum(rows, field) {
  return rows.reduce((total, row) => total + num(row[field]), 0)
}

function sumTransferBcel2(rows) {
  return rows.reduce((total, row) =>
    total + num(row['Transfer Payment by BCEL2'] ?? row['Transfer Payment by BCEL 2']), 0)
}

const SERVICE_FIELDS = [
  'OPD',
  'Diag & Image Services',
  'IPD',
  'Surg / OT Services',
  'Emergency Services',
  'Chronic & Prev Services',
  'Pharma & Consumables',
  'Supporting & Ancillary Services',
  'Admin & Non-Clinical Services',
  'Home care Services',
]

function summarizeDate(date, dailyRows, payoffRows, cashflowRows, lookerRows) {
  const daily = addMetric(dailyRows, 'Date', date)
  const payoffIssued = addMetric(payoffRows, 'Date', date)
  const payoffPaid = addMetric(payoffRows, 'Date Paid', date)
  const cashflow = addMetric(cashflowRows, 'Date', date)
  const looker = addMetric(lookerRows, 'Date', date)

  const actualTotalSale = sum(daily, 'Grand Total')
  const dailyOutstanding = sum(daily, 'Outstanding Debt')
  const payoffIssuedOutstanding = sum(payoffIssued, 'Outstanding Debt')
  const initialOutstanding = dailyOutstanding || payoffIssuedOutstanding
  const debtPageInitialOutstanding = payoffIssuedOutstanding
  const remainingBalance = sum(payoffIssued, 'Balance')
  const collection = payoffPaid.reduce((total, row) => total + payoffAmount(row), 0)
  const dailyIncome = actualTotalSale - initialOutstanding
  const actualIncome = dailyIncome + collection

  const system = {
    totalSales: sum(daily, 'Total'),
    discounts: sum(daily, 'Discounts'),
    actualTotalSale,
    totalBills: distinctCount(daily, 'Bill No') || daily.length,
    totalCustomers: daily.length,
    dailyIncome,
    collection,
    actualIncome,
    initialOutstanding,
    debtPageInitialOutstanding,
    remainingBalance,
    paidBills: daily.filter(row => paymentTotal(row) > 0).length,
    outstandingBills: payoffIssued.filter(row => num(row['Outstanding Debt']) > 0).length ||
      daily.filter(row => num(row['Outstanding Debt']) > 0).length,
    collectionBills: distinctCount(payoffPaid, 'Bill No') || payoffPaid.filter(row => payoffAmount(row) > 0).length,
    cash: sum(daily, 'Cash Received') + sum(payoffPaid, 'Cash Received Debt'),
    bcel: sum(daily, 'Transfer Payment by BCEL') + sum(payoffPaid, 'Transfer Payment by BCEL Debt'),
    bcel2: sumTransferBcel2(daily) + payoffPaid.reduce((total, row) =>
      total + num(row['Transfer Payment by BCEL2 Debt'] ?? row['Transfer Payment by BCEL 2 Debt']), 0),
    ldb: sum(daily, 'Transfer Payment by LDB') + sum(payoffPaid, 'Transfer Payment by LDB Debt'),
  }

  const customerService = {
    totalCustomers: daily.length,
    female: daily.filter(row => String(row.Gender || '').trim() === 'Female').length,
    male: daily.filter(row => String(row.Gender || '').trim() === 'Male').length,
    insite: daily.filter(row => row['Insite-Onsite'] === 'Insite').length,
    onsite: daily.filter(row => row['Insite-Onsite'] === 'Onsite').length,
    opd: daily.filter(row => row['OPD-IPD'] === 'OPD').length,
    ipd: daily.filter(row => row['OPD-IPD'] === 'IPD').length,
    gn: daily.filter(row => row['Customer Type Code'] === 'GN').length,
    ins: daily.filter(row => row['Customer Type Code'] === 'INS').length,
    b2b: daily.filter(row => row['Customer Type Code'] === 'B2B').length,
    iNS: daily.filter(row => row['Customer Type Code'] === 'iNS').length,
  }
  const serviceRevenue = Object.fromEntries(
    SERVICE_FIELDS.map(field => [field, sum(daily, field)])
  )

  const aging = payoffIssued.reduce((acc, row) => {
    const balance = num(row.Balance)
    if (balance <= 0) return acc
    const group = String(row['Aging Group'] || 'Unknown').trim() || 'Unknown'
    if (!acc[group]) acc[group] = { balance: 0, bills: 0 }
    acc[group].balance += balance
    acc[group].bills += 1
    return acc
  }, {})
  const agingTotalDebt = Object.values(aging).reduce((total, row) => total + row.balance, 0)
  const agingTotalBills = Object.values(aging).reduce((total, row) => total + row.bills, 0)

  const lookerCollected = looker
    .filter(row => /Collected/i.test(String(row.Category || '')))
    .reduce((total, row) => total + num(row.Total_Value), 0)
  const lookerOutstanding = looker
    .filter(row => /Outstanding/i.test(String(row.Category || '')))
    .reduce((total, row) => total + num(row.Total_Value), 0)

  const reference = {
    totalSales: system.totalSales,
    discounts: system.discounts,
    actualTotalSale: system.actualTotalSale,
    totalBills: system.totalBills,
    totalCustomers: system.totalCustomers,
    actualIncome: sum(cashflow, 'Total Actual Income') || lookerCollected,
    initialOutstanding: sum(cashflow, 'Outstanding Debt') || system.initialOutstanding,
    remainingBalance: sum(cashflow, 'Balance') || system.remainingBalance,
    cash: sum(cashflow, 'Cash Received'),
    bcel: sum(cashflow, 'Transfer Payment by BCEL'),
    bcel2: sum(cashflow, 'Transfer Payment by BCEL2'),
    ldb: sum(cashflow, 'Transfer Payment by LDB'),
    lookerCollected,
    lookerOutstanding,
  }
  reference.dailyIncome = reference.actualTotalSale - reference.initialOutstanding
  reference.collection = reference.actualIncome - reference.dailyIncome
  reference.debtPageInitialOutstanding = debtPageInitialOutstanding
  reference.debtPageRemainingBalance = remainingBalance

  const anomalies = []
  const dailyVsPayoffDiff = dailyOutstanding - payoffIssuedOutstanding
  if (Math.abs(dailyVsPayoffDiff) > TOLERANCE) {
    anomalies.push({
      date,
      type: 'daily_vs_payoff_outstanding',
      daily_outstanding: dailyOutstanding,
      payoff_outstanding: payoffIssuedOutstanding,
      diff: dailyVsPayoffDiff,
    })
  }
  const cashflowOutstanding = sum(cashflow, 'Outstanding Debt')
  if (cashflow.length && Math.abs(dailyOutstanding - cashflowOutstanding) > TOLERANCE) {
    anomalies.push({
      date,
      type: 'daily_vs_cashflow_outstanding',
      daily_outstanding: dailyOutstanding,
      cashflow_outstanding: cashflowOutstanding,
      diff: dailyOutstanding - cashflowOutstanding,
    })
  }
  const cashflowBalance = sum(cashflow, 'Balance')
  if (cashflowBalance < -TOLERANCE) {
    anomalies.push({
      date,
      type: 'negative_cashflow_balance',
      balance: cashflowBalance,
    })
  }
  daily
    .filter(row => num(row['Outstanding Debt']) < -TOLERANCE)
    .forEach(row => anomalies.push({
      date,
      type: 'negative_daily_outstanding_row',
      bill_no: row['Bill No'] || '',
      customer_name: row['Customer Name'] || '',
      outstanding_debt: num(row['Outstanding Debt']),
    }))

  const pages = []
  const add = (page, metric, systemValue, lookerValue) => {
    const diff = num(systemValue) - num(lookerValue)
    pages.push({
      date,
      page,
      metric,
      system: num(systemValue),
      looker: num(lookerValue),
      diff,
      status: Math.abs(diff) <= TOLERANCE ? 'PASS' : 'FAIL',
    })
  }

  add('Daily Sales', 'Total Sales', system.totalSales, reference.totalSales)
  add('Daily Sales', 'Discounts', system.discounts, reference.discounts)
  add('Daily Sales', 'Actual Total Sale', system.actualTotalSale, reference.actualTotalSale)
  add('Daily Sales', 'Actual Income', system.actualIncome, reference.actualIncome)
  add('Daily Sales', 'Outstanding Debts', system.initialOutstanding, reference.initialOutstanding)
  add('Daily Sales', 'Daily Income', system.dailyIncome, reference.dailyIncome)
  add('Daily Sales', 'Collection', system.collection, reference.collection)

  add('Payment Channel', 'Actual Income', system.actualIncome, reference.actualIncome)
  add('Payment Channel', 'Daily Income', system.dailyIncome, reference.dailyIncome)
  add('Payment Channel', 'Collection', system.collection, reference.collection)
  add('Payment Channel', 'Cash', system.cash, reference.cash)
  add('Payment Channel', 'BCEL', system.bcel, reference.bcel)
  add('Payment Channel', 'BCEL2', system.bcel2, reference.bcel2)
  add('Payment Channel', 'LDB', system.ldb, reference.ldb)

  add('Outstanding Debt', 'Initial Outstanding', system.debtPageInitialOutstanding, reference.debtPageInitialOutstanding)
  add('Outstanding Debt', 'Remaining Balance', system.remainingBalance, reference.debtPageRemainingBalance)
  add('Debt Management', 'Initial Debt', system.debtPageInitialOutstanding, reference.debtPageInitialOutstanding)
  add('Debt Management', 'Remaining Balance', system.remainingBalance, reference.debtPageRemainingBalance)

  add('Customer & Service', 'Total Customers', customerService.totalCustomers, daily.length)
  add('Customer & Service', 'Female', customerService.female, daily.filter(row => String(row.Gender || '').trim() === 'Female').length)
  add('Customer & Service', 'Male', customerService.male, daily.filter(row => String(row.Gender || '').trim() === 'Male').length)
  add('Customer & Service', 'Insite', customerService.insite, daily.filter(row => row['Insite-Onsite'] === 'Insite').length)
  add('Customer & Service', 'Onsite', customerService.onsite, daily.filter(row => row['Insite-Onsite'] === 'Onsite').length)
  add('Customer & Service', 'OPD', customerService.opd, daily.filter(row => row['OPD-IPD'] === 'OPD').length)
  add('Customer & Service', 'IPD', customerService.ipd, daily.filter(row => row['OPD-IPD'] === 'IPD').length)
  add('Customer & Service', 'GN', customerService.gn, daily.filter(row => row['Customer Type Code'] === 'GN').length)
  add('Customer & Service', 'INS', customerService.ins, daily.filter(row => row['Customer Type Code'] === 'INS').length)
  add('Customer & Service', 'B2B', customerService.b2b, daily.filter(row => row['Customer Type Code'] === 'B2B').length)
  add('Customer & Service', 'iNS', customerService.iNS, daily.filter(row => row['Customer Type Code'] === 'iNS').length)
  for (const field of SERVICE_FIELDS) {
    add('Customer & Service', `Service: ${field}`, serviceRevenue[field], sum(daily, field))
  }

  add('Debt Aging', 'Total Debt', agingTotalDebt, payoffIssued.reduce((total, row) => total + Math.max(0, num(row.Balance)), 0))
  add('Debt Aging', 'Total Bills', agingTotalBills, payoffIssued.filter(row => num(row.Balance) > 0).length)
  for (const [group, value] of Object.entries(aging)) {
    add('Debt Aging', `${group} Balance`, value.balance, payoffIssued
      .filter(row => String(row['Aging Group'] || 'Unknown').trim() === group)
      .reduce((total, row) => total + Math.max(0, num(row.Balance)), 0))
    add('Debt Aging', `${group} Bills`, value.bills, payoffIssued
      .filter(row => String(row['Aging Group'] || 'Unknown').trim() === group && num(row.Balance) > 0).length)
  }

  return {
    date,
    dailyRows: daily.length,
    payoffIssuedRows: payoffIssued.length,
    payoffPaidRows: payoffPaid.length,
    cashflowRows: cashflow.length,
    lookerRows: looker.length,
    system,
    reference,
    pages,
    anomalies,
  }
}

function main() {
  if (!fs.existsSync(SRC)) throw new Error(`Source workbook not found: ${SRC}`)
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const workbook = XLSX.readFile(SRC, { cellDates: false })
  const dailyRows = sheetRows(workbook, 'Daily')
  const payoffRows = sheetRows(workbook, 'Pay off')
  const cashflowRows = sheetRows(workbook, 'Summary_CashFlow')
  const lookerRows = sheetRows(workbook, 'Looker_Data')

  const dates = [...new Set([
    ...dailyRows.map(row => isoDate(row.Date)),
    ...payoffRows.map(row => isoDate(row.Date)),
    ...payoffRows.map(row => isoDate(row['Date Paid'])),
    ...cashflowRows.map(row => isoDate(row.Date)),
  ].filter(Boolean))].sort()

  const byDate = dates.map(date => summarizeDate(date, dailyRows, payoffRows, cashflowRows, lookerRows))
  const comparisons = byDate.flatMap(item => item.pages)
  const failures = comparisons.filter(row => row.status === 'FAIL')
  const anomalies = byDate.flatMap(item => item.anomalies)

  const csvRows = [
    'date,page,metric,system,looker,diff,status',
    ...comparisons.map(row => [
      row.date,
      row.page,
      row.metric,
      Math.round(row.system),
      Math.round(row.looker),
      Math.round(row.diff),
      row.status,
    ].map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')),
  ]

  const latest = byDate.filter(item => item.dailyRows || item.cashflowRows).slice(-10)
  const failByPage = failures.reduce((acc, row) => {
    acc[row.page] = (acc[row.page] || 0) + 1
    return acc
  }, {})
  const failByDate = failures.reduce((acc, row) => {
    acc[row.date] = (acc[row.date] || 0) + 1
    return acc
  }, {})

  const md = [
    '# AR Finance Report Page Audit',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Source: ${SRC}`,
    `Date range: ${dates[0] || '-'} to ${dates.at(-1) || '-'}`,
    '',
    '## Summary',
    '',
    `- Dates checked: ${dates.length}`,
    `- Comparisons checked: ${comparisons.length}`,
    `- Passed: ${comparisons.length - failures.length}`,
    `- Failed: ${failures.length}`,
    `- Data anomalies: ${anomalies.length}`,
    '',
    '## Latest Dates',
    '',
    '| Date | Daily Rows | Payoff Issued | Payoff Paid | Cashflow Rows | Actual Income | Outstanding | Daily Income | Collection | Status |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
    ...latest.map(item => {
      const failed = item.pages.some(row => row.status === 'FAIL')
      return `| ${item.date} | ${item.dailyRows} | ${item.payoffIssuedRows} | ${item.payoffPaidRows} | ${item.cashflowRows} | ${fmt(item.system.actualIncome)} | ${fmt(item.system.initialOutstanding)} | ${fmt(item.system.dailyIncome)} | ${fmt(item.system.collection)} | ${failed ? 'FAIL' : 'PASS'} |`
    }),
    '',
    '## Failures By Page',
    '',
    Object.keys(failByPage).length
      ? Object.entries(failByPage).map(([page, count]) => `- ${page}: ${count}`).join('\n')
      : '- No failures',
    '',
    '## Failure Details',
    '',
    failures.length
      ? '| Date | Page | Metric | System | Looker | Diff |\n| --- | --- | --- | ---: | ---: | ---: |\n' +
        failures.slice(0, 200).map(row =>
          `| ${row.date} | ${row.page} | ${row.metric} | ${fmt(row.system)} | ${fmt(row.looker)} | ${fmt(row.diff)} |`
        ).join('\n')
      : 'No failed comparisons.',
    '',
    '## Data Anomalies',
    '',
    anomalies.length
      ? '| Date | Type | Detail | Diff |\n| --- | --- | --- | ---: |\n' +
        anomalies.slice(0, 200).map(row => {
          const detail = row.bill_no
            ? `${row.bill_no} ${row.customer_name || ''}`.trim()
            : Object.entries(row)
              .filter(([key]) => !['date', 'type', 'diff'].includes(key))
              .map(([key, value]) => `${key}=${fmt(value)}`)
              .join('; ')
          return `| ${row.date} | ${row.type} | ${detail} | ${fmt(row.diff || row.outstanding_debt || row.balance || 0)} |`
        }).join('\n')
      : 'No data anomalies.',
    '',
    '## Failure Dates',
    '',
    Object.keys(failByDate).length
      ? Object.entries(failByDate).map(([date, count]) => `- ${date}: ${count}`).join('\n')
      : '- No failure dates',
    '',
  ].join('\n')

  const report = {
    generated_at: new Date().toISOString(),
    source: SRC,
    date_range: { from: dates[0] || '', to: dates.at(-1) || '' },
    counts: {
      dates: dates.length,
      comparisons: comparisons.length,
      passed: comparisons.length - failures.length,
      failed: failures.length,
      data_anomalies: anomalies.length,
      daily_rows: dailyRows.length,
      payoff_rows: payoffRows.length,
      cashflow_rows: cashflowRows.length,
      looker_rows: lookerRows.length,
    },
    fail_by_page: failByPage,
    fail_by_date: failByDate,
    latest,
    failures,
    anomalies,
    comparisons,
  }

  const jsonPath = path.join(OUT_DIR, 'audit-report.json')
  const csvPath = path.join(OUT_DIR, 'audit-comparisons.csv')
  const mdPath = path.join(OUT_DIR, 'audit-summary.md')
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2))
  fs.writeFileSync(csvPath, csvRows.join('\n'))
  fs.writeFileSync(mdPath, md)

  console.log(`Summary: ${mdPath}`)
  console.log(`CSV: ${csvPath}`)
  console.log(`JSON: ${jsonPath}`)
  console.log(`Dates: ${dates[0]} to ${dates.at(-1)} (${dates.length})`)
  console.log(`Comparisons: ${comparisons.length}, failures: ${failures.length}`)
  console.log('Failures by page:', failByPage)
}

main()
