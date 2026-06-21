import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { createDataBackup, listRecentBackups, restoreDataBackup } from '../lib/autoBackup'
import { confirmAction, confirmCodeAction, showError, showSuccess } from '../lib/sweetAlert'

// ============================================================
// Tab definitions
// ============================================================
const TABS = [
  {
    group: 'ຂໍ້ມູນໃບບິນ',
    items: [
      { key: 'workload',      label: 'ກະວຽກ',          sublabel: 'Workload Shifts',    type: 'config', icon: '⏰', hint: 'ຊ່ວງເວລາເຮັດວຽກ ເຊັ່ນ: 8AM-4PM, 4PM-12AM' },
      { key: 'customer_type', label: 'ປະເພດລູກຄ້າ',     sublabel: 'Customer Type',      type: 'config', icon: '👥', hint: 'ປະເພດລູກຄ້າ ເຊັ່ນ: GN, INS, B2B' },
      { key: 'insite_onsite', label: 'Insite / Onsite', sublabel: 'Location Type',      type: 'config', icon: '📍', hint: 'ສະຖານທີ່ໃຫ້ບໍລິການ' },
      { key: 'opd_ipd',       label: 'OPD / IPD',       sublabel: 'Patient Type',       type: 'config', icon: '🏥', hint: 'ຜູ້ປ່ວຍນອກ (OPD) / ຜູ້ປ່ວຍໃນ (IPD)' },
      { key: 'gender',        label: 'ເພດ',              sublabel: 'Gender',             type: 'config', icon: '⚧', hint: 'ເພດຂອງຄົນເຈັບ' },
    ],
  },
  {
    group: 'ຂໍ້ມູນລາຍຊື່',
    items: [
      { key: 'ar_insurance_list', label: 'ບໍລິສັດປະກັນ', sublabel: 'Insurance Companies', type: 'simple', icon: '🛡️', hint: 'ລາຍຊື່ບໍລິສັດປະກັນທີ່ຮ່ວມງານ' },
      { key: 'ar_recorders_list', label: 'ຜູ້ບັນທຶກ',    sublabel: 'Recorders',           type: 'simple', icon: '👤', hint: 'ລາຍຊື່ພະນັກງານຜູ້ບັນທຶກຂໍ້ມູນ' },
    ],
  },
  {
    group: 'ລະບົບ',
    items: [
      { key: 'auto_backup', label: 'ສຳຮອງຂໍ້ມູນ', sublabel: 'ທຸກມື້ 23:00', type: 'backup', icon: '💾', hint: 'ສຳຮອງຂໍ້ມູນອັດຕະໂນມັດທຸກມື້ເວລາ 23:00' },
    ],
  },
]

const ALL_TABS = TABS.flatMap(g => g.items)

// ============================================================
// Empty state
// ============================================================
function EmptyState({ onAdd }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        <svg className="w-7 h-7 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      </div>
      <p className="text-sm font-semibold text-slate-500 mb-1">ຍັງບໍ່ມີລາຍການ</p>
      <p className="text-xs text-slate-400 mb-4">ເພີ່ມລາຍການທຳອິດດ້ານລຸ່ມ</p>
    </div>
  )
}

// ============================================================
// CRUD table for app_config_options
// ============================================================
function ConfigTable({ category, hint }) {
  const [items,    setItems]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [editId,   setEditId]   = useState(null)
  const [editData, setEditData] = useState({})
  const [newValue, setNewValue] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  useEffect(() => { load() }, [category])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('ar_config_options')
      .select('*').eq('category', category).order('sort_order')
    setItems(data || [])
    setLoading(false)
  }

  async function add() {
    const val = newValue.trim()
    if (!val) return
    setError('')
    setSaving(true)
    const maxOrder = items.length ? Math.max(...items.map(i => i.sort_order)) : 0
    const { data, error: err } = await supabase
      .from('ar_config_options')
      .insert({ category, value: val, label: newLabel.trim() || val, sort_order: maxOrder + 1, is_active: true })
      .select().single()
    if (err) {
      setError(err.message)
      showError('ເພີ່ມບໍ່ສຳເລັດ', err.message)
    }
    else { setItems(prev => [...prev, data]); setNewValue(''); setNewLabel(''); showSuccess('ເພີ່ມຂໍ້ມູນສຳເລັດ') }
    setSaving(false)
  }

  async function saveEdit(id) {
    setSaving(true)
    const { error } = await supabase.from('ar_config_options').update(editData).eq('id', id)
    if (error) {
      setSaving(false)
      showError('ບັນທຶກບໍ່ສຳເລັດ', error.message)
      return
    }
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...editData } : i))
    setEditId(null)
    showSuccess('ບັນທຶກການແກ້ໄຂສຳເລັດ')
    setSaving(false)
  }

  async function remove(id, value) {
    const confirmed = await confirmAction({
      title: 'ຢືນຢັນການລົບ',
      text: `ລົບ "${value}" ອອກ?`,
      confirmButtonText: 'ລົບ',
    })
    if (!confirmed) return
    const { error } = await supabase.from('ar_config_options').delete().eq('id', id)
    if (error) {
      showError('ລົບບໍ່ສຳເລັດ', error.message)
      return
    }
    setItems(prev => prev.filter(i => i.id !== id))
    showSuccess('ລົບຂໍ້ມູນສຳເລັດ')
  }

  async function toggleActive(id, current) {
    await supabase.from('ar_config_options').update({ is_active: !current }).eq('id', id)
    setItems(prev => prev.map(i => i.id === id ? { ...i, is_active: !current } : i))
  }

  return (
    <div className="flex flex-col h-full">
      {/* Hint banner */}
      <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl mb-5 text-xs text-blue-700">
        <svg className="w-4 h-4 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {hint}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-100">
                <th className="text-left py-3 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider w-14">#</th>
                <th className="text-left py-3 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">ຄ່າ (Value)</th>
                <th className="text-left py-3 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">ຊື່ສະແດງ (Label)</th>
                <th className="text-center py-3 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider w-28">ສະຖານະ</th>
                <th className="py-3 px-4 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={5}><EmptyState /></td></tr>
              )}
              {items.map((item, idx) => (
                <tr key={item.id}
                  className={`group border-b border-slate-50 transition-colors ${item.is_active ? 'hover:bg-slate-50/80' : 'opacity-50'}`}>
                  {editId === item.id ? (
                    <>
                      <td className="py-2.5 px-4 text-slate-400 text-xs">{item.sort_order}</td>
                      <td className="py-2 px-3">
                        <input type="text" value={editData.value} autoFocus
                          onChange={e => setEditData(p => ({ ...p, value: e.target.value }))}
                          className="w-full text-sm border border-primary-300 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-primary-100" />
                      </td>
                      <td className="py-2 px-3">
                        <input type="text" value={editData.label}
                          onChange={e => setEditData(p => ({ ...p, label: e.target.value }))}
                          className="w-full text-sm border border-primary-300 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-primary-100" />
                      </td>
                      <td className="py-2 px-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${item.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {item.is_active ? 'ໃຊ້ງານ' : 'ປິດ'}
                        </span>
                      </td>
                      <td className="py-2 px-4">
                        <div className="flex gap-1.5 justify-end">
                          <button onClick={() => saveEdit(item.id)} disabled={saving}
                            className="px-3 py-1.5 bg-primary-600 text-white text-xs rounded-lg hover:bg-primary-700 font-semibold transition-colors disabled:opacity-50">
                            ບັນທຶກ
                          </button>
                          <button onClick={() => setEditId(null)}
                            className="px-3 py-1.5 text-slate-500 text-xs rounded-lg hover:bg-slate-100 transition-colors">
                            ຍົກ
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-3.5 px-4">
                        <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-400 text-xs font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg text-xs tracking-wide">
                          {item.value}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">{item.label || item.value}</td>
                      <td className="py-3.5 px-4 text-center">
                        <button onClick={() => toggleActive(item.id, item.is_active)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors cursor-pointer ${
                            item.is_active
                              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${item.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                          {item.is_active ? 'ໃຊ້ງານ' : 'ປິດ'}
                        </button>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditId(item.id); setEditData({ value: item.value, label: item.label || item.value, sort_order: item.sort_order }) }}
                            className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="ແກ້ໄຂ">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button onClick={() => remove(item.id, item.value)}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="ລົບ">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add row */}
      <div className="mt-5 pt-5 border-t border-slate-100">
        {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">ຄ່າ (Value) <span className="text-red-400">*</span></label>
            <input type="text" value={newValue} onChange={e => setNewValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
              placeholder="ເຊັ່ນ: 8AM-4PM"
              className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all bg-slate-50 focus:bg-white" />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">ຊື່ສະແດງ (Label)</label>
            <input type="text" value={newLabel} onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
              placeholder="ຫາກຫວ່າງ ໃຊ້ Value ແທນ"
              className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all bg-slate-50 focus:bg-white" />
          </div>
          <button onClick={add} disabled={saving || !newValue.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white text-sm font-bold rounded-xl hover:bg-primary-700 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            ເພີ່ມ
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// CRUD table for insurance_list / recorders_list
// ============================================================
function SimpleTable({ tableName, hint }) {
  const isInsurance = tableName === 'ar_insurance_list'
  const [items,    setItems]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [editId,   setEditId]   = useState(null)
  const [editName, setEditName] = useState('')
  const [editDueDays, setEditDueDays] = useState(30)
  const [newName,  setNewName]  = useState('')
  const [newDueDays, setNewDueDays] = useState(30)
  const [saving,   setSaving]   = useState(false)

  useEffect(() => { load() }, [tableName])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from(tableName).select('*').order('name')
    setItems(data || [])
    setLoading(false)
  }

  async function add() {
    const name = newName.trim()
    if (!name) return
    setSaving(true)
    const payload = isInsurance ? { name, due_days: Number(newDueDays) || 30 } : { name }
    let { data, error } = await supabase.from(tableName).insert(payload).select().single()
    if (error && isInsurance && error.message?.includes('due_days')) {
      ;({ data, error } = await supabase.from(tableName).insert({ name }).select().single())
    }
    if (!error && data) {
      setItems(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      setNewName('')
      setNewDueDays(30)
      showSuccess('ເພີ່ມຂໍ້ມູນສຳເລັດ')
    } else if (error) {
      showError('ເພີ່ມບໍ່ສຳເລັດ', error.message)
    }
    setSaving(false)
  }

  async function saveEdit(id) {
    const name = editName.trim()
    if (!name) return
    setSaving(true)
    const payload = isInsurance ? { name, due_days: Number(editDueDays) || 30 } : { name }
    const { error } = await supabase.from(tableName).update(payload).eq('id', id)
    if (error && isInsurance && error.message?.includes('due_days')) {
      await supabase.from(tableName).update({ name }).eq('id', id)
    } else if (error) {
      setSaving(false)
      showError('ບັນທຶກບໍ່ສຳເລັດ', error.message)
      return
    }
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...payload } : i).sort((a, b) => a.name.localeCompare(b.name)))
    setEditId(null)
    showSuccess('ບັນທຶກການແກ້ໄຂສຳເລັດ')
    setSaving(false)
  }

  async function remove(id, name) {
    const confirmed = await confirmAction({
      title: 'ຢືນຢັນການລົບ',
      text: `ລົບ "${name}" ອອກ?`,
      confirmButtonText: 'ລົບ',
    })
    if (!confirmed) return
    const { error } = await supabase.from(tableName).delete().eq('id', id)
    if (error) {
      showError('ລົບບໍ່ສຳເລັດ', error.message)
      return
    }
    setItems(prev => prev.filter(i => i.id !== id))
    showSuccess('ລົບຂໍ້ມູນສຳເລັດ')
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl mb-5 text-xs text-blue-700">
        <svg className="w-4 h-4 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {hint}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-100">
                <th className="text-left py-3 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider w-14">#</th>
                <th className="text-left py-3 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">ຊື່</th>
                {isInsurance && <th className="text-left py-3 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider w-36">ກຳນົດຊຳລະ (ມື້)</th>}
                <th className="py-3 px-4 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={isInsurance ? 4 : 3}><EmptyState /></td></tr>
              )}
              {items.map((item, idx) => (
                <tr key={item.id} className="group border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
                  {editId === item.id ? (
                    <>
                      <td className="py-2.5 px-4 text-slate-400 text-xs">{idx + 1}</td>
                      <td className="py-2 px-3">
                        <input type="text" value={editName} autoFocus
                          onChange={e => setEditName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveEdit(item.id) } if (e.key === 'Escape') setEditId(null) }}
                          className="w-full text-sm border border-primary-300 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-primary-100" />
                      </td>
                      {isInsurance && (
                        <td className="py-2 px-3">
                          <input type="number" min="1" max="365" value={editDueDays}
                            onChange={e => setEditDueDays(e.target.value)}
                            className="w-full text-sm border border-primary-300 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-primary-100" />
                        </td>
                      )}
                      <td className="py-2 px-4">
                        <div className="flex gap-1.5 justify-end">
                          <button onClick={() => saveEdit(item.id)} disabled={saving}
                            className="px-3 py-1.5 bg-primary-600 text-white text-xs rounded-lg hover:bg-primary-700 font-semibold disabled:opacity-50">
                            ບັນທຶກ
                          </button>
                          <button onClick={() => setEditId(null)}
                            className="px-3 py-1.5 text-slate-500 text-xs rounded-lg hover:bg-slate-100">
                            ຍົກ
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-3.5 px-4">
                        <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-400 text-xs font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-800">{item.name}</td>
                      {isInsurance && (
                        <td className="py-3.5 px-4">
                          <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg text-xs">
                            {item.due_days || 30}
                          </span>
                        </td>
                      )}
                      <td className="py-3.5 px-4">
                        <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditId(item.id); setEditName(item.name); setEditDueDays(item.due_days || 30) }}
                            className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="ແກ້ໄຂ">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button onClick={() => remove(item.id, item.name)}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="ລົບ">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-5 pt-5 border-t border-slate-100">
        <div className="flex gap-3">
          <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
            placeholder="ພິມຊື່ລາຍການໃໝ່ແລ້ວກົດ Enter..."
            className="flex-1 text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all bg-slate-50 focus:bg-white" />
          {isInsurance && (
            <input type="number" min="1" max="365" value={newDueDays} onChange={e => setNewDueDays(e.target.value)}
              title="ຈຳນວນມື້ກຳນົດຊຳລະ"
              className="w-36 text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all bg-slate-50 focus:bg-white" />
          )}
          <button onClick={add} disabled={saving || !newName.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white text-sm font-bold rounded-xl hover:bg-primary-700 active:scale-95 transition-all disabled:opacity-40 shadow-sm shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            ເພີ່ມ
          </button>
        </div>
      </div>
    </div>
  )
}

// Auto backup panel
// ============================================================
function BackupPanel({ hint }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [selectedBackupId, setSelectedBackupId] = useState('')
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const backups = await listRecentBackups(30)
      setItems(backups)
      setSelectedBackupId(current => {
        if (current && backups.some(item => item.id === current)) return current
        return backups[0]?.id || ''
      })
    } catch (err) {
      setError(err.message)
      setItems([])
      setSelectedBackupId('')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function backupNow() {
    setSaving(true)
    setError('')
    try {
      await createDataBackup('manual_settings')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  function backupLabel(item) {
    if (!item) return ''
    const created = item.created_at ? new Date(item.created_at).toLocaleString('lo-LA') : ''
    return `${item.backup_date} ${item.backup_time || ''} · ${item.source}${created ? ` · ${created}` : ''}`
  }

  async function restoreBackup(backupId = selectedBackupId) {
    const backup = items.find(item => item.id === backupId)
    if (!backup) {
      showError('ບໍ່ພົບ backup', 'ກະລຸນາເລືອກ backup ກ່ອນ')
      return
    }

    const confirmed = await confirmCodeAction({
      title: 'ຢືນຢັນ Restore',
      text: `ຈະກັບໄປຫາ backup: ${backup.backup_date} ${backup.backup_time}. ລະບົບຈະສ້າງ safety backup ກ່ອນທັບຂໍ້ມູນປັດຈຸບັນ.`,
      confirmButtonText: 'Restore',
    })
    if (!confirmed) return

    setRestoring(true)
    setError('')
    try {
      const result = await restoreDataBackup(backup.id)
      await load()
      showSuccess('Restore ສຳເລັດ', `ກັບໄປຫາ ${result?.restored_backup_date || backup.backup_date} ${result?.restored_backup_time || backup.backup_time}`)
    } catch (err) {
      setError(err.message)
      showError('Restore ບໍ່ສຳເລັດ', err.message)
    } finally {
      setRestoring(false)
    }
  }

  const latest = items[0]

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-700">
        <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {hint}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">ຕາຕະລາງເວລາ</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">23:00</p>
          <p className="text-xs text-slate-400 mt-1">Asia/Bangkok · ທຸກມື້</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">ສຳຮອງຫຼ້າສຸດ</p>
          <p className="text-lg font-bold text-slate-800 mt-1">{latest?.backup_date || '—'}</p>
          <p className="text-xs text-slate-400 mt-1">{latest?.source || 'ຍັງບໍ່ມີ backup'}</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">ສຳຮອງທັນທີ</p>
            <p className="text-xs text-slate-400 mt-1">ກົດເພື່ອສຳຮອງທັນທີ</p>
          </div>
          <button onClick={backupNow} disabled={saving}
            className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-bold hover:bg-primary-700 disabled:opacity-50">
            {saving ? 'ກຳລັງສຳຮອງ...' : 'ສຳຮອງດຽວນີ້'}
          </button>
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Restore</p>
          <select
            value={selectedBackupId}
            onChange={event => setSelectedBackupId(event.target.value)}
            disabled={loading || restoring || !items.length}
            className="mt-2 w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 disabled:opacity-50"
          >
            {!items.length && <option value="">ບໍ່ມີ backup</option>}
            {items.map(item => (
              <option key={item.id} value={item.id}>{backupLabel(item)}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => restoreBackup()}
            disabled={loading || saving || restoring || !selectedBackupId}
            className="mt-3 w-full rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {restoring ? 'ກຳລັງ Restore...' : 'Restore ຈຸດນີ້'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {error.includes('ar_data_backups')
            ? 'ຍັງບໍ່ພົບ table ar_data_backups — ໃຫ້ run SQL supabase/auto_backup.sql ກ່ອນ'
            : error.includes('restore_ar_data_backup')
              ? 'ຍັງບໍ່ພົບ function restore_ar_data_backup — ໃຫ້ run SQL supabase/auto_backup.sql ກ່ອນ'
              : error}
        </div>
      )}

      <div className="rounded-xl border border-slate-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="table-th">ວັນທີ</th>
              <th className="table-th">ແຫຼ່ງທີ່ມາ</th>
              <th className="table-th text-right">ໃບບິນ</th>
              <th className="table-th text-right">ໜີ້</th>
              <th className="table-th text-right">ກະແສເງິນ</th>
              <th className="table-th text-right">Restore</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr><td colSpan={6} className="table-td text-center text-slate-400 py-8">ກຳລັງໂຫຼດ...</td></tr>
            ) : items.length ? items.map(item => (
              <tr key={item.id}>
                <td className="table-td font-semibold text-slate-700">{item.backup_date} {item.backup_time}</td>
                <td className="table-td text-slate-500">{item.source}</td>
                <td className="table-td text-right font-mono">{item.counts?.ar_bills || 0}</td>
                <td className="table-td text-right font-mono">{item.counts?.ar_debt || 0}</td>
                <td className="table-td text-right font-mono">{item.counts?.ar_cashflow || 0}</td>
                <td className="table-td text-right">
                  <button
                    type="button"
                    onClick={() => restoreBackup(item.id)}
                    disabled={saving || restoring}
                    className="rounded-lg border border-amber-200 px-3 py-1 text-[11px] font-bold text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                  >
                    Restore
                  </button>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={6} className="table-td text-center text-slate-400 py-8">ຍັງບໍ່ມີ backup</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ============================================================
// Main Page
// ============================================================
export default function GeneralSettings() {
  const [activeTab, setActiveTab] = useState(ALL_TABS[0].key)
  const active = ALL_TABS.find(t => t.key === activeTab)

  return (
    <div className="flex flex-col h-screen bg-slate-50">

      {/* ── Top Header ── */}
      <div className="bg-white border-b border-slate-200 px-8 pt-6 pb-0 shrink-0">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-lg shadow-indigo-200 shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 leading-tight">ຕັ້ງຄ່າທົ່ວໄປ</h1>
            <p className="text-sm text-slate-400">ຈັດການຄ່າຕັ້ງຕ່າງໆທີ່ໃຊ້ໃນລະບົບ</p>
          </div>
        </div>

        {/* ── Tab Bar ── */}
        <div className="flex items-end gap-1 overflow-x-auto">
          {TABS.map(group => (
            <div key={group.group} className="flex items-end gap-0.5">
              {/* Group divider label */}
              <div className="flex items-center self-center mr-1 ml-2 first:ml-0">
                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest whitespace-nowrap hidden md:block">
                  {group.group}
                </span>
                <span className="w-px h-5 bg-slate-200 ml-2 hidden md:block" />
              </div>
              {group.items.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-xl transition-all whitespace-nowrap border-b-2 ${
                    activeTab === tab.key
                      ? 'text-indigo-600 border-indigo-500 bg-white'
                      : 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-base leading-none">{tab.icon}</span>
                  <span>{tab.label}</span>
                  {activeTab === tab.key && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-t-full" />
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── Content Area ── */}
      <div className="flex-1 overflow-hidden p-8">
        <div className="h-full bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">

          {/* Content Header */}
          <div className="flex items-center justify-between px-7 py-5 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{active?.icon}</span>
              <div>
                <h2 className="text-base font-bold text-slate-800 leading-tight">{active?.label}</h2>
                <p className="text-xs text-slate-400 leading-tight">{active?.sublabel}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 bg-slate-100 px-3 py-1.5 rounded-full font-medium">
                {active?.type === 'config' ? 'ar_config_options' : active?.type === 'backup' ? 'ar_data_backups' : active?.key}
              </span>
            </div>
          </div>

          {/* Table Content */}
          <div className="flex-1 overflow-auto px-7 py-5">
            {active?.type === 'config' && (
              <ConfigTable category={active.key} hint={active.hint} />
            )}
            {active?.type === 'simple' && (
              <SimpleTable tableName={active.key} hint={active.hint} />
            )}
            {active?.type === 'backup' && (
              <BackupPanel hint={active.hint} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
