export default function LoadingSpinner({ message = 'ກຳລັງໂຫຼດຂໍ້ມູນ...' }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
      <p className="text-sm text-slate-500 font-medium">{message}</p>
    </div>
  )
}

export function EmptyState({ message = 'ບໍ່ມີຂໍ້ມູນ', sublabel }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 text-center px-8">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
        <svg className="w-7 h-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
      </div>
      <p className="font-semibold text-slate-600">{message}</p>
      {sublabel && <p className="text-sm text-slate-400">{sublabel}</p>}
    </div>
  )
}
