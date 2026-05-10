import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { logAction } from '../lib/log'
import { can, DEFAULT_ROLE_PERMISSIONS, normalizeRolePermissions, ROLE_LABELS, ROLES } from '../lib/rbac'

const AuthContext = createContext(null)

function fallbackProfile(user) {
  return {
    id: user?.id,
    email: user?.email || '',
    full_name: user?.user_metadata?.full_name || user?.email || 'User',
    role: ROLES.VIEWER,
    active: false,
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [rolePermissions, setRolePermissions] = useState(DEFAULT_ROLE_PERMISSIONS)
  const [userPermissions, setUserPermissions] = useState({ allowed: [], denied: [] })
  const [loading, setLoading] = useState(true)

  const loadRolePermissions = useCallback(async () => {
    const { data, error } = await supabase
      .from('role_permissions')
      .select('role,permissions')

    if (error) {
      setRolePermissions(DEFAULT_ROLE_PERMISSIONS)
      return DEFAULT_ROLE_PERMISSIONS
    }

    const normalized = normalizeRolePermissions(data)
    setRolePermissions(normalized)
    return normalized
  }, [])

  const loadUserPermissions = useCallback(async userId => {
    if (!userId) {
      setUserPermissions({ allowed: [], denied: [] })
      return { allowed: [], denied: [] }
    }

    const { data, error } = await supabase
      .from('user_permissions')
      .select('allowed_permissions,denied_permissions')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      setUserPermissions({ allowed: [], denied: [] })
      return { allowed: [], denied: [] }
    }

    const normalized = {
      allowed: Array.isArray(data?.allowed_permissions) ? data.allowed_permissions : [],
      denied: Array.isArray(data?.denied_permissions) ? data.denied_permissions : [],
    }
    setUserPermissions(normalized)
    return normalized
  }, [])

  const loadProfile = useCallback(async user => {
    if (!user) {
      setProfile(null)
      setRolePermissions(DEFAULT_ROLE_PERMISSIONS)
      setUserPermissions({ allowed: [], denied: [] })
      return null
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id,email,full_name,role,active,created_at,updated_at')
      .eq('id', user.id)
      .maybeSingle()

    if (data && !error) {
      setProfile(data)
      await loadRolePermissions()
      await loadUserPermissions(user.id)
      return data
    }

    const fallback = fallbackProfile(user)
    setProfile(fallback)
    setUserPermissions({ allowed: [], denied: [] })

    return fallback
  }, [loadRolePermissions, loadUserPermissions])

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(async ({ data, error }) => {
      if (!mounted) return
      setSession(data.session)
      await loadProfile(data.session?.user)
      if (mounted) setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      loadProfile(nextSession?.user).finally(() => setLoading(false))
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [loadProfile])

  const signIn = useCallback(async ({ email, password }) => {
    setLoading(true)
    try {
      const credentials = {
        email: email.trim(),
        password,
      }
      const { data, error } = await supabase.auth.signInWithPassword(credentials)
      if (error) throw error
      setSession(data.session)
      await loadProfile(data.user)
      await loadRolePermissions()
      await logAction({
        action: 'login',
        action_type: 'auth.login',
        entity_type: 'auth_user',
        entity_id: data.user?.id,
        details: `${data.user?.email || email.trim()} signed in`,
      })
      return data
    } finally {
      setLoading(false)
    }
  }, [loadProfile, loadRolePermissions])

  const signOut = useCallback(async () => {
    const currentEmail = session?.user?.email
    const currentId = session?.user?.id
    await logAction({
      action: 'logout',
      action_type: 'auth.logout',
      entity_type: 'auth_user',
      entity_id: currentId,
      details: `${currentEmail || 'User'} signed out`,
    })
    await supabase.auth.signOut()
    setSession(null)
    setProfile(null)
    setRolePermissions(DEFAULT_ROLE_PERMISSIONS)
    setUserPermissions({ allowed: [], denied: [] })
  }, [session])

  const value = useMemo(() => {
    const role = profile?.role || ROLES.VIEWER
    const isActive = profile?.active !== false && !!profile?.id
    return {
      session,
      user: session?.user || null,
      profile,
      role,
      roleLabel: ROLE_LABELS[role] || ROLE_LABELS[ROLES.VIEWER],
      rolePermissions,
      userPermissions,
      isActive,
      loading,
      isAuthenticated: !!session?.user,
      signIn,
      signOut,
      refreshPermissions: loadRolePermissions,
      refreshUserPermissions: () => loadUserPermissions(session?.user?.id),
      can: permission => isActive && can(role, permission, rolePermissions, userPermissions),
    }
  }, [loadRolePermissions, loadUserPermissions, loading, profile, rolePermissions, session, signIn, signOut, userPermissions])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}

export function useCan(permission) {
  return useAuth().can(permission)
}
