import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

export default function RecorderSelect({ value, onChange, disabled }) {
  const [list, setList]         = useState([])
  const [open, setOpen]         = useState(false)
  const [search, setSearch]     = useState('')
  const [newName, setNewName]   = useState('')
  const [adding, setAdding]     = useState(false)
  const [editId, setEditId]     = useState(null)
  const [editName, setEditName] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    supabase.from('ar_recorders_list').select('*').order('name')
      .then(({ data }) => setList(data || []))
  }, [])

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false); setSearch(''); setEditId(null)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  async function addRecorder() {
    const name = newName.trim()
    if (!name) return
    setAdding(true)
    const { data, error } = await supabase.from('ar_recorders_list').insert({ name }).select().single()
    if (!error && data) {
      setList(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      onChange(name)
      setNewName('')
      setOpen(false)
      setSearch('')
    }
    setAdding(false)
  }

  async function saveEdit(id) {
    const name = editName.trim()
    if (!name) return
    const { error } = await supabase.from('ar_recorders_list').update({ name }).eq('id', id)
    if (!error) {
      setList(prev => prev.map(r => r.id === id ? { ...r, name } : r).sort((a, b) => a.name.localeCompare(b.name)))
      if (value === list.find(r => r.id === id)?.name) onChange(name)
    }
    setEditId(null)
  }

  async function deleteRecorder(e, id, name) {
    e.stopPropagation()
    await supabase.from('ar_recorders_list').delete().eq('id', id)
    setList(prev => prev.filter(r => r.id !== id))
    if (value === name) onChange('')
  }

  function select(name) {
    onChange(name); setOpen(false); setSearch('')
  }

  const filtered = list.filter(r => r.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 text-left bg-white disabled:bg-slate-50 disabled:cursor-not-allowed flex items-center justify-between transition-all"
      >
        <span className={value ? 'text-slate-800' : 'text-slate-400'}>
          {value || 'ເລືອກຜູ້ບັນທຶກ...'}
        </span>
        <svg className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-slate-100">
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="ຄົ້ນຫາ..."
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:border-primary-400"
              autoFocus
            />
          </div>

          {/* Options */}
          <div className="max-h-52 overflow-y-auto">
            <button type="button" onClick={() => select('')}
              className="w-full text-left px-3 py-2 text-sm text-slate-400 hover:bg-slate-50">
              -- ບໍ່ລະບຸ --
            </button>
            {filtered.map(rec => (
              <div key={rec.id} className="flex items-center group hover:bg-slate-50 transition-colors">
                {editId === rec.id ? (
                  <div className="flex-1 flex items-center gap-1 px-2 py-1">
                    <input
                      type="text" value={editName} onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveEdit(rec.id) } if (e.key === 'Escape') setEditId(null) }}
                      className="flex-1 text-sm border border-primary-300 rounded px-2 py-1 outline-none focus:border-primary-400"
                      autoFocus
                    />
                    <button type="button" onClick={() => saveEdit(rec.id)}
                      className="px-2 py-1 bg-primary-600 text-white text-xs rounded font-bold hover:bg-primary-700">
                      ບັນທຶກ
                    </button>
                    <button type="button" onClick={() => setEditId(null)}
                      className="px-2 py-1 text-slate-500 text-xs rounded hover:bg-slate-200">
                      ຍົກ
                    </button>
                  </div>
                ) : (
                  <>
                    <button type="button" onClick={() => select(rec.name)}
                      className={`flex-1 text-left px-3 py-2 text-sm ${value === rec.name ? 'font-semibold text-primary-600' : 'text-slate-800'}`}>
                      {rec.name}
                    </button>
                    <button type="button" onClick={() => { setEditId(rec.id); setEditName(rec.name) }}
                      title="ແກ້ໄຂ"
                      className="px-2 py-2 text-slate-300 hover:text-primary-500 opacity-0 group-hover:opacity-100 transition-all">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button type="button" onClick={e => deleteRecorder(e, rec.id, rec.name)}
                      title="ລົບ"
                      className="px-2 py-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all text-base leading-none">
                      ×
                    </button>
                  </>
                )}
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-2 text-xs text-slate-400">ບໍ່ພົບຂໍ້ມູນ</p>
            )}
          </div>

          {/* Add new */}
          <div className="p-2 border-t border-slate-100 flex gap-1.5">
            <input
              type="text" value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addRecorder() } }}
              placeholder="ເພີ່ມຜູ້ບັນທຶກໃໝ່..."
              className="flex-1 text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-primary-400"
            />
            <button type="button" onClick={addRecorder}
              disabled={adding || !newName.trim()}
              className="px-3 py-1.5 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 font-bold disabled:opacity-50 transition-colors">
              +
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
