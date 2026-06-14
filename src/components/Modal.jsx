import { useEffect } from 'react'
import { confirmAction, confirmCodeAction } from '../lib/sweetAlert'

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

export function ConfirmCodeDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'ລົບທັງໝົດ' }) {
  useEffect(() => {
    if (!open) return
    let cancelled = false
    async function ask() {
      const confirmed = await confirmCodeAction({
        title,
        text: message,
        confirmButtonText: confirmLabel,
      })
      if (cancelled) return
      if (confirmed) await onConfirm?.()
      onClose?.()
    }
    ask()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return null
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'ລົບ' }) {
  useEffect(() => {
    if (!open) return
    let cancelled = false
    async function ask() {
      const confirmed = await confirmAction({
        title,
        text: message,
        confirmButtonText: confirmLabel,
      })
      if (cancelled) return
      if (confirmed) await onConfirm?.()
      onClose?.()
    }
    ask()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return null
}
