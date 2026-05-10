import { Navigate, useLocation } from 'react-router-dom'
import LoadingSpinner from './LoadingSpinner'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, permission }) {
  const location = useLocation()
  const { loading, isAuthenticated, isActive, can } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <LoadingSpinner />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (!isActive) {
    return <AccessDenied message="Your account is inactive or has not been assigned an application profile. Please contact an admin." />
  }

  if (permission && !can(permission)) {
    return <AccessDenied />
  }

  return children
}

export function AccessDenied({ message = 'Your role does not have permission to open this page.' }) {
  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="max-w-md rounded-2xl border border-red-100 bg-white p-6 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M5.07 19h13.86a2 2 0 001.74-3L13.74 4a2 2 0 00-3.48 0L3.33 16a2 2 0 001.74 3z" />
          </svg>
        </div>
        <h2 className="mt-4 text-lg font-bold text-slate-900">Access denied</h2>
        <p className="mt-2 text-sm text-slate-500">{message}</p>
      </div>
    </div>
  )
}
