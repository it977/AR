import { formatLAK } from '../lib/excelParser'

const colorMap = {
  blue: { bg: 'bg-blue-50', icon: 'bg-blue-100 text-blue-600', text: 'text-blue-700', border: 'border-blue-100' },
  green: { bg: 'bg-emerald-50', icon: 'bg-emerald-100 text-emerald-600', text: 'text-emerald-700', border: 'border-emerald-100' },
  red: { bg: 'bg-red-50', icon: 'bg-red-100 text-red-600', text: 'text-red-700', border: 'border-red-100' },
  purple: { bg: 'bg-purple-50', icon: 'bg-purple-100 text-purple-600', text: 'text-purple-700', border: 'border-purple-100' },
  orange: { bg: 'bg-orange-50', icon: 'bg-orange-100 text-orange-600', text: 'text-orange-700', border: 'border-orange-100' },
  indigo: { bg: 'bg-indigo-50', icon: 'bg-indigo-100 text-indigo-600', text: 'text-indigo-700', border: 'border-indigo-100' },
  sky: { bg: 'bg-sky-50', icon: 'bg-sky-100 text-sky-600', text: 'text-sky-700', border: 'border-sky-100' },
  amber: { bg: 'bg-amber-50', icon: 'bg-amber-100 text-amber-600', text: 'text-amber-700', border: 'border-amber-100' },
}

export default function KPICard({ label, sublabel, value, isLAK = true, color = 'blue', icon, badge, badgeColor, trend }) {
  const c = colorMap[color] || colorMap.blue
  const display = isLAK ? formatLAK(value) : new Intl.NumberFormat('en-US').format(value || 0)

  return (
    <div className={`kpi-card ${c.bg} border ${c.border}`}>
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-xl ${c.icon} flex items-center justify-center shrink-0`}>
          {icon}
        </div>
        {badge !== undefined && (
          <span className={`badge ${badgeColor || 'bg-slate-100 text-slate-600'}`}>
            {badge}
          </span>
        )}
        {trend !== undefined && (
          <span className={`badge ${trend >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
            {trend >= 0 ? '▲' : '▼'} {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      <div>
        <p className={`kpi-value ${c.text}`}>{display}</p>
        {isLAK && <p className="text-[10px] text-slate-400 font-medium -mt-1">LAK</p>}
        <p className="kpi-label mt-1">{label}</p>
        {sublabel && <p className="text-[11px] text-slate-400">{sublabel}</p>}
      </div>
    </div>
  )
}

// Simple count card
export function CountCard({ label, value, color = 'blue', icon, sublabel }) {
  const c = colorMap[color] || colorMap.blue
  return (
    <div className={`kpi-card ${c.bg} border ${c.border}`}>
      <div className={`w-10 h-10 rounded-xl ${c.icon} flex items-center justify-center`}>
        {icon}
      </div>
      <div>
        <p className={`text-3xl font-bold ${c.text}`}>{new Intl.NumberFormat().format(value || 0)}</p>
        <p className="kpi-label mt-1">{label}</p>
        {sublabel && <p className="text-[11px] text-slate-400">{sublabel}</p>}
      </div>
    </div>
  )
}
