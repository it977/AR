import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function formatLoginError(error) {
  const message = error?.message || ''
  const lowerMessage = message.toLowerCase()

  if (lowerMessage.includes('invalid login credentials')) {
    return 'ອີເມວ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກ ກະລຸນາກວດບັນຊີໃນລະບົບຢືນຢັນຂອງ Supabase'
  }

  if (lowerMessage.includes('email not confirmed')) {
    return 'ອີເມວນີ້ຍັງບໍ່ໄດ້ຢືນຢັນ ໃຫ້ເຂົ້າໜ້າຈັດການຜູ້ໃຊ້ຂອງ Supabase ແລ້ວຢືນຢັນຜູ້ໃຊ້ ຫຼື ປິດການຢືນຢັນອີເມວ'
  }

  if (lowerMessage.includes('failed to fetch') || lowerMessage.includes('network')) {
    return 'ເຊື່ອມຕໍ່ Supabase ບໍ່ໄດ້ ກະລຸນາກວດ VITE_SUPABASE_URL ແລະ VITE_SUPABASE_ANON_KEY ໃນຕົວແປລະບົບຂອງເວັບ'
  }

  return message || 'ເຂົ້າລະບົບບໍ່ສຳເລັດ ກະລຸນາລອງໃໝ່'
}

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, loading, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const from = location.state?.from?.pathname || '/'

  if (!loading && isAuthenticated) {
    return <Navigate to={from} replace />
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await signIn({ email: email.trim(), password })
      navigate(from, { replace: true })
    } catch (err) {
      setError(formatLoginError(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative flex items-center overflow-hidden px-8 py-10 md:px-14">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(79,70,229,0.38),transparent_30%),radial-gradient(circle_at_80%_30%,rgba(20,184,166,0.28),transparent_28%),linear-gradient(135deg,#020617,#0f172a_58%,#111827)]" />
          <div className="relative max-w-xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-600 shadow-lg shadow-primary-600/30">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="mt-8 text-sm font-semibold uppercase tracking-[0.28em] text-primary-200">ແດຊບອດ OneMeds</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">AR Finance System by No V1</h1>
            <p className="mt-5 max-w-lg text-sm leading-7 text-slate-300">
              ເຂົ້າລະບົບເພື່ອເບິ່ງແດຊບອດການເງິນ, ຈັດການໃບບິນ, ຕິດຕາມໜີ້ຄ້າງ, ອັບໂຫຼດ Excel ແລະ ສົ່ງອອກ PDF ຕາມສິດຂອງທ່ານ.
            </p>
          </div>
        </section>

        <section className="flex items-center justify-center bg-slate-50 px-6 py-10 text-slate-900">
          <form onSubmit={handleSubmit} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-600">ເຂົ້າລະບົບປອດໄພ</p>
              <h2 className="mt-2 text-2xl font-black text-slate-900">ເຂົ້າລະບົບ</h2>
              <p className="mt-1 text-sm text-slate-500">ໃຊ້ບັນຊີ Supabase Auth ຂອງທ່ານ</p>
            </div>

            {error && (
              <div className="mt-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </div>
            )}

            <label className="mt-6 block">
              <span className="text-sm font-semibold text-slate-700">ອີເມວ</span>
              <input
                type="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                autoComplete="email"
                required
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-primary-400 focus:ring-4 focus:ring-primary-100"
                placeholder="name@company.com"
              />
            </label>

            <label className="mt-4 block">
              <span className="text-sm font-semibold text-slate-700">ລະຫັດຜ່ານ</span>
              <input
                type="password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                autoComplete="current-password"
                required
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-primary-400 focus:ring-4 focus:ring-primary-100"
                placeholder="••••••••"
              />
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-primary-600/20 transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-primary-300"
            >
              {submitting ? 'ກຳລັງເຂົ້າລະບົບ...' : 'ເຂົ້າລະບົບ'}
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}
