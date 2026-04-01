const selCls = 'text-xs border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100 h-[34px]'

export function FilterSelect({ label, value, onChange, options }) {
  return (
    <select value={value || ''} onChange={e => onChange(e.target.value)} className={selCls} title={label}>
      <option value="">ທັງໝົດ {label}</option>
      {options.map(o => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
    </select>
  )
}

export default function DateFilter({ filters, onChange }) {
  const presets = [
    { label: 'ທັງໝົດ', days: null },
    { label: 'ມື້ນີ້',  days: 0 },
    { label: '7 ວັນ',  days: 7 },
    { label: '30 ວັນ', days: 30 },
    { label: '90 ວັນ', days: 90 },
  ]

  function applyPreset(days) {
    if (days === null) {
      onChange({ dateFrom: '', dateTo: '' })
      return
    }
    const to = new Date()
    const from = new Date()
    if (days > 0) from.setDate(from.getDate() - days)
    onChange({
      dateFrom: from.toISOString().split('T')[0],
      dateTo: to.toISOString().split('T')[0],
    })
  }

  const isAll = !filters.dateFrom && !filters.dateTo

  return (
    <div className="flex flex-wrap items-center gap-2">
      {presets.map(p => (
        <button
          key={p.label}
          onClick={() => applyPreset(p.days)}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
            p.days === null && isAll
              ? 'bg-primary-600 border-primary-600 text-white'
              : 'bg-white border-slate-200 hover:border-primary-400 hover:text-primary-600'
          }`}
        >
          {p.label}
        </button>
      ))}
      <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5">
        <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <input
          type="date"
          value={filters.dateFrom || ''}
          onChange={e => onChange({ ...filters, dateFrom: e.target.value })}
          className="text-xs text-slate-700 outline-none bg-transparent"
        />
        <span className="text-slate-300">—</span>
        <input
          type="date"
          value={filters.dateTo || ''}
          onChange={e => onChange({ ...filters, dateTo: e.target.value })}
          className="text-xs text-slate-700 outline-none bg-transparent"
        />
      </div>
    </div>
  )
}
