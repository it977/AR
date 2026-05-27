import { useEffect, useState } from 'react'

export default function Modal({ open, onClose, title, subtitle, size = 'lg', children }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-xl',
    lg: 'max-w-3xl',
    xl: 'max-w-5xl',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      {/* Panel */}
      <div className={`relative bg-white rounded-2xl shadow-2xl w-full ${sizes[size]} max-h-[90vh] flex flex-col`}>
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-slate-800">{title}</h3>
            {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors ml-4 shrink-0">
            <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-4">{children}</div>
      </div>
    </div>
  )
}

export function ConfirmCodeDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'ລົບທັງໝົດ', loading }) {
  const [input, setInput] = useState('')
  const [code, setCode] = useState('')

  useEffect(() => {
    if (open) {
      setInput('')
      // ສຸ່ມລະຫັດ 4 ຕົວເລກ ໃໝ່ທຸກໆຄັ້ງທີ່ເປີດ
      setCode(String(Math.floor(1000 + Math.random() * 9000)))
    }
  }, [open])

  if (!open) return null
  const matched = input.trim() === code

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-center font-bold text-slate-800 text-lg">{title}</h3>
        <p className="text-center text-slate-500 text-sm mt-1">{message}</p>
        <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
          <p className="text-[11px] text-slate-500 mb-1">ກະລຸນາພິມລະຫັດຢືນຢັນ:</p>
          <p className="text-3xl font-bold text-red-600 font-mono tracking-[0.4em] select-none">{code}</p>
        </div>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
          placeholder="••••"
          inputMode="numeric"
          autoFocus
          className="mt-3 w-full text-center font-mono text-xl tracking-[0.4em] border-2 border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-red-400"
        />
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">ຍົກເລີກ</button>
          <button
            onClick={onConfirm}
            disabled={loading || !matched}
            className="flex-1 justify-center inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-40 disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'ລົບ', loading }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-center font-bold text-slate-800 text-lg">{title}</h3>
        <p className="text-center text-slate-500 text-sm mt-1">{message}</p>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">ຍົກເລີກ</button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 justify-center inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
          >
            {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
