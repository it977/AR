import { useState, useMemo } from 'react'
import ReactApexChart from 'react-apexcharts'
import KPICard from '../components/KPICard'
import DateFilter, { FilterSelect } from '../components/DateFilter'
import LoadingSpinner, { EmptyState } from '../components/LoadingSpinner'
import { useARData, usePayoffData, computeKPIs } from '../lib/useARData'
import { formatLAK, formatNumber } from '../lib/excelParser'
import { useGlobalFilters } from '../context/FilterContext'

const METHODS = [
  { key: 'cash',  label: 'ເງິນສົດ', sublabel: 'Cash',               color: '#10b981', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100' },
  { key: 'bcel',  label: 'BCEL',    sublabel: 'BCEL Bank Transfer',  color: '#cc1c2e', bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-100' },
  { key: 'bcel2', label: 'BCEL 2',  sublabel: 'BCEL2 Bank Transfer', color: '#1a56a0', bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-100' },
  { key: 'ldb',   label: 'LDB',     sublabel: 'Lao Dev Bank',        color: '#e07b00', bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-100' },
]

// Bank logo icons (SVG inline)
const BankIcon = ({ method }) => {
  if (method === 'cash') return (
    <svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect width="44" height="44" rx="12" fill="#10b981"/>
      <rect x="7" y="15" width="30" height="14" rx="3" stroke="white" strokeWidth="1.5" fill="white" fillOpacity="0.15"/>
      <circle cx="22" cy="22" r="4.5" stroke="white" strokeWidth="1.5"/>
      <circle cx="22" cy="22" r="2.2" fill="white"/>
      <rect x="9" y="17" width="4" height="4" rx="1.5" fill="white" fillOpacity="0.5"/>
      <rect x="31" y="23" width="4" height="4" rx="1.5" fill="white" fillOpacity="0.5"/>
      <text x="22" y="36" textAnchor="middle" fill="white" fontSize="6" fontWeight="700" fontFamily="Arial" fillOpacity="0.8">CASH</text>
    </svg>
  )
  if (method === 'bcel') return (
    <svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect width="44" height="44" rx="12" fill="#cc1c2e"/>
      <rect x="5" y="5" width="34" height="34" rx="8" fill="url(#bcel_grad)"/>
      <defs>
        <linearGradient id="bcel_grad" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#e8283e"/>
          <stop offset="1" stopColor="#9b1020"/>
        </linearGradient>
      </defs>
      <text x="22" y="19" textAnchor="middle" fill="white" fontSize="10" fontWeight="900" fontFamily="Arial, sans-serif" letterSpacing="0.5">BCEL</text>
      <rect x="10" y="22" width="24" height="1.5" fill="white" fillOpacity="0.5" rx="1"/>
      <text x="22" y="32" textAnchor="middle" fill="white" fontSize="6.5" fontWeight="500" fontFamily="Arial, sans-serif" fillOpacity="0.9" letterSpacing="0.3">BANK</text>
    </svg>
  )
  if (method === 'bcel2') return (
    <svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect width="44" height="44" rx="12" fill="#1a56a0"/>
      <rect x="5" y="5" width="34" height="34" rx="8" fill="url(#bcel2_grad)"/>
      <defs>
        <linearGradient id="bcel2_grad" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2563c4"/>
          <stop offset="1" stopColor="#0e3472"/>
        </linearGradient>
      </defs>
      <text x="18" y="19" textAnchor="middle" fill="white" fontSize="9" fontWeight="900" fontFamily="Arial, sans-serif" letterSpacing="0.5">BCEL</text>
      <rect x="10" y="22" width="24" height="1.5" fill="white" fillOpacity="0.5" rx="1"/>
      <text x="34" y="34" textAnchor="middle" fill="white" fontSize="14" fontWeight="900" fontFamily="Arial, sans-serif" fillOpacity="0.9">2</text>
      <text x="16" y="32" textAnchor="middle" fill="white" fontSize="6.5" fontWeight="500" fontFamily="Arial, sans-serif" fillOpacity="0.9" letterSpacing="0.3">BANK</text>
    </svg>
  )
  if (method === 'ldb') return (
    <svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect width="44" height="44" rx="12" fill="#e07b00"/>
      <rect x="5" y="5" width="34" height="34" rx="8" fill="url(#ldb_grad)"/>
      <defs>
        <linearGradient id="ldb_grad" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f59e0b"/>
          <stop offset="1" stopColor="#b45309"/>
        </linearGradient>
      </defs>
      <text x="22" y="19" textAnchor="middle" fill="white" fontSize="11" fontWeight="900" fontFamily="Arial, sans-serif" letterSpacing="0.5">LDB</text>
      <rect x="10" y="22" width="24" height="1.5" fill="white" fillOpacity="0.5" rx="1"/>
      <text x="22" y="32" textAnchor="middle" fill="white" fontSize="5.5" fontWeight="500" fontFamily="Arial, sans-serif" fillOpacity="0.9" letterSpacing="0.5">LAO DEV BANK</text>
    </svg>
  )
  return null
}

export default function PaymentChannel() {
  const { filters, updateFilters } = useGlobalFilters()

  const { data: rows, loading } = useARData(filters)
  const { data: debtRows } = usePayoffData(filters)
  const kpis = useMemo(() => computeKPIs(rows || []), [rows])

  // Collection stats from ar_debt — channel-by-channel (ຕາມ Summary_CashFlow)
  const collectionStats = useMemo(() => {
    const dr = debtRows || []
    const cash  = dr.reduce((s, r) => s + (r.cash_paid  || 0), 0)
    const bcel  = dr.reduce((s, r) => s + (r.bcel_paid  || 0), 0)
    const bcel2 = dr.reduce((s, r) => s + (r.bcel2_paid || 0), 0)
    const ldb   = dr.reduce((s, r) => s + (r.ldb_paid   || 0), 0)
    return { amount: cash + bcel + bcel2 + ldb, cash, bcel, bcel2, ldb }
  }, [debtRows])

  // ຮວມ billing (ar_bills) + Pay off (ar_debt) ທຸກ channel
  const totals = useMemo(() => {
    const t = { cash: 0, bcel: 0, bcel2: 0, ldb: 0 }
    ;(rows || []).forEach(r => {
      t.cash  += r.cash  || 0
      t.bcel  += r.bcel  || 0
      t.bcel2 += r.bcel2 || 0
      t.ldb   += r.ldb   || 0
    })
    // ເພີ່ມ Pay off payment channels
    t.cash  += collectionStats.cash
    t.bcel  += collectionStats.bcel
    t.bcel2 += collectionStats.bcel2
    t.ldb   += collectionStats.ldb
    return t
  }, [rows, collectionStats])

  const totalCollected = totals.cash + totals.bcel + totals.bcel2 + totals.ldb

  // Monthly breakdown
  const monthly = useMemo(() => {
    const map = {}
    ;(rows || []).forEach(r => {
      if (!r.date) return
      const mo = r.date.slice(0, 7)
      if (!map[mo]) map[mo] = { cash: 0, bcel: 0, bcel2: 0, ldb: 0 }
      map[mo].cash  += r.cash  || 0
      map[mo].bcel  += r.bcel  || 0
      map[mo].bcel2 += r.bcel2 || 0
      map[mo].ldb   += r.ldb   || 0
    })
    return map
  }, [rows])

  const months = Object.keys(monthly).sort()

  const trendOpts = {
    chart: { type: 'bar', stacked: false, toolbar: { show: false }, fontFamily: 'Inter, Noto Sans Lao, sans-serif' },
    plotOptions: { bar: { borderRadius: 6, columnWidth: '70%' } },
    colors: METHODS.map(m => m.color),
    xaxis: { categories: months, labels: { style: { colors: '#94a3b8', fontSize: '11px' } } },
    yaxis: { labels: { formatter: v => formatLAK(v), style: { colors: '#94a3b8', fontSize: '10px' } } },
    legend: { labels: { colors: '#64748b' }, position: 'top' },
    grid: { borderColor: '#f1f5f9', strokeDashArray: 4 },
    dataLabels: { enabled: false },
    tooltip: { y: { formatter: v => `${formatNumber(v)} LAK` } },
  }

  const pieOpts = {
    chart: { type: 'donut', fontFamily: 'Inter, Noto Sans Lao, sans-serif' },
    labels: METHODS.map(m => m.label),
    colors: METHODS.map(m => m.color),
    legend: { position: 'bottom', labels: { colors: '#64748b' } },
    plotOptions: { pie: { donut: { size: '65%', labels: { show: true, total: { show: true, label: 'Total', color: '#64748b', formatter: () => formatLAK(totalCollected) } } } } },
    dataLabels: { formatter: v => `${v.toFixed(1)}%` },
    tooltip: { y: { formatter: v => `${formatNumber(v)} LAK` } },
  }

  const grandTotal = kpis.actualIncome + kpis.outstandingDebt
  const collectedPct    = grandTotal > 0 ? (totalCollected / grandTotal * 100).toFixed(1) : '0.0'
  const outstandingPct  = grandTotal > 0 ? (kpis.outstandingDebt / grandTotal * 100).toFixed(1) : '0.0'

  // For PDF-style: Actual Income = Daily Income + Collection from payoff
  // Daily Income = Actual Total Sale - Outstanding Debts
  const dailyIncome = kpis.totalSales - kpis.outstandingDebt
  const actualIncomeTotal = dailyIncome + collectionStats.amount

  if (loading) return <div className="p-6"><LoadingSpinner /></div>

  return (
    <div className="p-6 space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">ຊ່ອງທາງການຊຳລະ</h2>
          <p className="text-sm text-slate-500 mt-0.5">Payment Channel Analysis • ໜ່ວຍ: LAK</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateFilter filters={filters} onChange={updateFilters} />
          <FilterSelect label="ປະເພດລູກຄ້າ" value={filters.customerType}
            onChange={v => updateFilters({ customerType: v })}
            options={['GN','INS','B2B']} />
          <FilterSelect label="ກະວຽກ" value={filters.workload}
            onChange={v => updateFilters({ workload: v })}
            options={['8AM-4PM','4PM-12AM','12AM-8AM']} />
        </div>
      </div>

      {/* ── Row 1: 4 Summary KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Actual Income */}
        <div className="rounded-2xl p-5 text-white bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-lg shadow-indigo-200">
          <p className="text-xs font-semibold text-indigo-200 uppercase tracking-wider">ລາຍຮັບຈິງ</p>
          <p className="text-xs text-indigo-200 mb-3">Actual Income</p>
          <p className="text-2xl font-extrabold leading-tight">{formatLAK(actualIncomeTotal)}</p>
          <p className="text-xs text-indigo-200 mt-1">= ເກັບໄດ້ + Pay off</p>
        </div>
        {/* Collected at billing */}
        <div className="rounded-2xl p-5 text-white bg-gradient-to-br from-cyan-500 to-cyan-700 shadow-lg shadow-cyan-200">
          <p className="text-xs font-semibold text-cyan-200 uppercase tracking-wider">ເກັບໄດ້ (ເວລາອອກບິນ)</p>
          <p className="text-xs text-cyan-200 mb-3">Collected at Billing</p>
          <p className="text-2xl font-extrabold leading-tight">{formatLAK(totalCollected)}</p>
          <p className="text-xs text-cyan-200 mt-1">{collectedPct}% ຂອງຍອດລວມ</p>
        </div>
        {/* Pay off collection */}
        <div className="rounded-2xl p-5 text-white bg-gradient-to-br from-violet-500 to-violet-700 shadow-lg shadow-violet-200">
          <p className="text-xs font-semibold text-violet-200 uppercase tracking-wider">ເກັບໜີ້ (Pay off)</p>
          <p className="text-xs text-violet-200 mb-3">Debt Collection</p>
          <p className="text-2xl font-extrabold leading-tight">{formatLAK(collectionStats.amount)}</p>
          <p className="text-xs text-violet-200 mt-1">ຈາກ ar_debt</p>
        </div>
        {/* Outstanding */}
        <div className="rounded-2xl p-5 text-white bg-gradient-to-br from-rose-500 to-rose-700 shadow-lg shadow-rose-200">
          <p className="text-xs font-semibold text-rose-200 uppercase tracking-wider">ໜີ້ຄ້າງ</p>
          <p className="text-xs text-rose-200 mb-3">Outstanding Balance</p>
          <p className="text-2xl font-extrabold leading-tight">{formatLAK(kpis.outstandingDebt)}</p>
          <p className="text-xs text-rose-200 mt-1">{outstandingPct}% ຂອງຍອດລວມ</p>
        </div>
      </div>

      {/* ── Row 2: Payment Method Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {METHODS.map(m => {
          const val = totals[m.key] || 0
          const pct = totalCollected > 0 ? (val / totalCollected * 100).toFixed(1) : '0.0'
          return (
            <div key={m.key} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl overflow-hidden shadow-md shrink-0">
                  <BankIcon method={m.key} />
                </div>
                <span className="text-2xl font-extrabold" style={{ color: m.color }}>{pct}%</span>
              </div>
              <p className="text-xl font-bold text-slate-800">{formatLAK(val)}</p>
              <p className="text-xs text-slate-400 mb-3">LAK</p>
              <p className="text-sm font-semibold text-slate-700">{m.label}</p>
              <p className="text-xs text-slate-400 mb-3">{m.sublabel}</p>
              {/* Progress bar */}
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="h-2 rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: m.color }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Row 3: Stacked bar proportion ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h3 className="font-bold text-slate-700 text-sm mb-1">ສ່ວນແບ່ງຊ່ອງທາງການຊຳລະ</h3>
        <p className="text-xs text-slate-400 mb-4">Payment Channel Proportion</p>
        <div className="flex rounded-xl overflow-hidden h-8 mb-3">
          {METHODS.map(m => {
            const pct = totalCollected > 0 ? (totals[m.key] || 0) / totalCollected * 100 : 0
            return pct > 0 ? (
              <div key={m.key} style={{ width: `${pct}%`, backgroundColor: m.color }}
                className="flex items-center justify-center text-white text-xs font-bold transition-all"
                title={`${m.label}: ${pct.toFixed(1)}%`}>
                {pct > 8 ? `${pct.toFixed(0)}%` : ''}
              </div>
            ) : null
          })}
        </div>
        <div className="flex flex-wrap gap-4">
          {METHODS.map(m => (
            <div key={m.key} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: m.color }} />
              <span className="text-xs text-slate-600 font-medium">{m.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Row 3b: Collected VS Outstanding  +  Cash VS Transfer ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Collected vs Outstanding */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h3 className="font-bold text-slate-700 text-sm mb-1">ເກັບໄດ້ VS ໜີ້ຄ້າງ</h3>
          <p className="text-xs text-slate-400 mb-4">Collected (Amount) VS Outstanding (Balance)</p>
          <ReactApexChart
            options={{
              chart: { type: 'donut', fontFamily: 'Inter, Noto Sans Lao, sans-serif' },
              labels: ['Collected', 'Outstanding'],
              colors: ['#06b6d4', '#f43f5e'],
              legend: { position: 'bottom', labels: { colors: '#64748b' } },
              plotOptions: { pie: { donut: { size: '68%', labels: { show: true,
                total: { show: true, label: 'Total', color: '#64748b',
                  formatter: () => formatLAK(totalCollected + kpis.outstandingDebt) }
              } } } },
              dataLabels: { formatter: v => `${v.toFixed(1)}%` },
              tooltip: { y: { formatter: v => `${formatNumber(v)} LAK` } },
            }}
            series={[totalCollected, kpis.outstandingDebt]}
            type="donut" height={260}
          />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-cyan-50 border border-cyan-100 p-3 text-center">
              <p className="text-xs text-cyan-600 font-medium">Collected</p>
              <p className="text-base font-extrabold text-cyan-700">{formatLAK(totalCollected)}</p>
            </div>
            <div className="rounded-xl bg-rose-50 border border-rose-100 p-3 text-center">
              <p className="text-xs text-rose-600 font-medium">Outstanding</p>
              <p className="text-base font-extrabold text-rose-700">{formatLAK(kpis.outstandingDebt)}</p>
            </div>
          </div>
        </div>

        {/* Cash vs Transfer */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h3 className="font-bold text-slate-700 text-sm mb-1">ເງິນສົດ VS ໂອນ</h3>
          <p className="text-xs text-slate-400 mb-4">Cash Received VS Bank Transfer</p>
          {(() => {
            const transfer = (totals.bcel || 0) + (totals.bcel2 || 0) + (totals.ldb || 0)
            const cash = totals.cash || 0
            const cashPct = totalCollected > 0 ? (cash / totalCollected * 100).toFixed(1) : '0.0'
            const tranPct = totalCollected > 0 ? (transfer / totalCollected * 100).toFixed(1) : '0.0'
            return (
              <>
                <ReactApexChart
                  options={{
                    chart: { type: 'donut', fontFamily: 'Inter, Noto Sans Lao, sans-serif' },
                    labels: ['ເງິນສົດ (Cash)', 'ໂອນ (Transfer)'],
                    colors: ['#10b981', '#4f46e5'],
                    legend: { position: 'bottom', labels: { colors: '#64748b' } },
                    plotOptions: { pie: { donut: { size: '68%', labels: { show: true,
                      total: { show: true, label: 'Total', color: '#64748b',
                        formatter: () => formatLAK(totalCollected) }
                    } } } },
                    dataLabels: { formatter: v => `${v.toFixed(1)}%` },
                    tooltip: { y: { formatter: v => `${formatNumber(v)} LAK` } },
                  }}
                  series={[cash, transfer]}
                  type="donut" height={260}
                />
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-center">
                    <p className="text-xs text-emerald-600 font-medium">ເງິນສົດ · {cashPct}%</p>
                    <p className="text-base font-extrabold text-emerald-700">{formatLAK(cash)}</p>
                  </div>
                  <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3 text-center">
                    <p className="text-xs text-indigo-600 font-medium">ໂອນ · {tranPct}%</p>
                    <p className="text-base font-extrabold text-indigo-700">{formatLAK(transfer)}</p>
                  </div>
                </div>
              </>
            )
          })()}
        </div>
      </div>

      {/* ── Row 4: Trend chart + Donut ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h3 className="font-bold text-slate-700 text-sm mb-1">ທ່າອ່ຽງລາຍຮັບຕາມຊ່ອງທາງ</h3>
          <p className="text-xs text-slate-400 mb-4">Monthly Payment Channel Trend</p>
          {months.length > 0 ? (
            <ReactApexChart
              options={trendOpts}
              series={METHODS.map(m => ({ name: m.label, data: months.map(mo => monthly[mo]?.[m.key] || 0) }))}
              type="bar" height={280}
            />
          ) : <EmptyState message="ບໍ່ມີຂໍ້ມູນ" sublabel="ກະລຸນາອັບໂຫຼດ Excel ກ່ອນ" />}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h3 className="font-bold text-slate-700 text-sm mb-1">ສ່ວນແບ່ງຊ່ອງທາງ</h3>
          <p className="text-xs text-slate-400 mb-4">Payment Method Share</p>
          {totalCollected > 0 ? (
            <ReactApexChart options={pieOpts} series={METHODS.map(m => totals[m.key] || 0)} type="donut" height={280} />
          ) : <EmptyState message="ບໍ່ມີຂໍ້ມູນ" />}
        </div>
      </div>

      {/* ── Row 5: Summary Table ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-700 text-sm">ສະຫຼຸບຊ່ອງທາງການຊຳລະ</h3>
          <p className="text-xs text-slate-400">Payment Channel Summary</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="table-th">ຊ່ອງທາງ / Channel</th>
                <th className="table-th text-right">ຈຳນວນ (LAK)</th>
                <th className="table-th text-right">ສ່ວນແບ່ງ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {METHODS.map(m => {
                const val = totals[m.key] || 0
                const pct = totalCollected > 0 ? (val / totalCollected * 100).toFixed(1) : '0.0'
                return (
                  <tr key={m.key} className="hover:bg-slate-50 transition-colors">
                    <td className="table-td">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg overflow-hidden shadow-sm shrink-0">
                          <BankIcon method={m.key} />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{m.label}</p>
                          <p className="text-xs text-slate-400">{m.sublabel}</p>
                        </div>
                      </div>
                    </td>
                    <td className="table-td text-right font-mono font-semibold text-slate-800">{formatNumber(val)}</td>
                    <td className="table-td text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-24 bg-slate-100 rounded-full h-2">
                          <div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: m.color }} />
                        </div>
                        <span className="text-sm font-bold w-12 text-right" style={{ color: m.color }}>{pct}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
              <tr className="bg-slate-50">
                <td className="table-td font-bold text-slate-700">ລວມທັງໝົດ (Collected)</td>
                <td className="table-td text-right font-mono font-bold text-slate-800">{formatNumber(totalCollected)}</td>
                <td className="table-td text-right font-bold text-slate-600">100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
