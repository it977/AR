import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_GROUPS,
  ROLE_LABELS,
  ROLE_OPTIONS,
  ROLES,
} from '../lib/rbac'
import { logAction } from '../lib/log'
import { useAuth } from '../context/AuthContext'

const emptyForm = {
  email: '',
  password: '',
  full_name: '',
  role: ROLES.VIEWER,
  active: true,
}

const ROLE_BADGES = {
  [ROLES.ADMIN]: 'bg-violet-100 text-violet-700 border-violet-200',
  [ROLES.MANAGER]: 'bg-blue-100 text-blue-700 border-blue-200',
  [ROLES.STAFF]: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  [ROLES.VIEWER]: 'bg-slate-100 text-slate-700 border-slate-200',
}

function allPermissionKeys() {
  return PERMISSION_GROUPS.flatMap(group => group.permissions.map(permission => permission.key))
}

function normalizeOverrides(row) {
  return {
    allowed: Array.isArray(row?.allowed_permissions) ? row.allowed_permissions : [],
    denied: Array.isArray(row?.denied_permissions) ? row.denied_permissions : [],
  }
}

function rolePermissionsFor(role, permissionsByRole) {
  return new Set(permissionsByRole?.[role] || DEFAULT_ROLE_PERMISSIONS[role] || [])
}

function applyUserOverrides(rolePermissions, overrides) {
  const effective = new Set(rolePermissions)
  for (const key of overrides.allowed) effective.add(key)
  for (const key of overrides.denied) effective.delete(key)
  return effective
}

function IconButton({ title, tone = 'teal', children, onClick, disabled }) {
  const tones = {
    teal: 'bg-teal-500 text-white hover:bg-teal-600 disabled:bg-teal-200',
    blue: 'bg-sky-500 text-white hover:bg-sky-600 disabled:bg-sky-200',
    red: 'border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50',
  }
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-black transition ${tones[tone]}`}
    >
      {children}
    </button>
  )
}

function PermissionChecklist({ role, permissionsByRole, overrides, onChange, disabled }) {
  const base = rolePermissionsFor(role, permissionsByRole)
  const effective = applyUserOverrides(base, overrides)

  function setPermission(permissionKey, checked) {
    const nextAllowed = new Set(overrides.allowed)
    const nextDenied = new Set(overrides.denied)
    const isBaseAllowed = base.has(permissionKey)

    if (checked) {
      nextDenied.delete(permissionKey)
      if (!isBaseAllowed) nextAllowed.add(permissionKey)
    } else {
      nextAllowed.delete(permissionKey)
      if (isBaseAllowed) nextDenied.add(permissionKey)
    }

    onChange({
      allowed: Array.from(nextAllowed),
      denied: Array.from(nextDenied),
    })
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {PERMISSION_GROUPS.map(group => (
        <div key={group.title} className="overflow-hidden rounded-2xl border border-teal-100 bg-white">
          <div className="border-b border-teal-50 bg-teal-50/40 px-4 py-3">
            <h3 className="text-sm font-black text-slate-800">{group.title}</h3>
            <p className="mt-1 text-xs text-slate-500">{group.description}</p>
          </div>
          <div className="space-y-2 p-4">
            {group.permissions.map(permission => {
              const checked = effective.has(permission.key)
              return (
                <label key={permission.key} className="flex cursor-pointer items-start gap-3 rounded-xl px-2 py-2 hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={event => setPermission(permission.key, event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-500 focus:ring-teal-400"
                  />
                  <span>
                    <span className="block text-sm font-bold text-slate-800">{permission.label}</span>
                    <span className="block text-xs leading-5 text-slate-500">{permission.detail}</span>
                  </span>
                </label>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function RBACManagement() {
  const { profile, rolePermissions, refreshUserPermissions } = useAuth()
  const [users, setUsers] = useState([])
  const [permissionsByRole, setPermissionsByRole] = useState(rolePermissions || DEFAULT_ROLE_PERMISSIONS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [formMode, setFormMode] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [editingUser, setEditingUser] = useState(null)
  const [permissionUser, setPermissionUser] = useState(null)
  const [permissionOverrides, setPermissionOverrides] = useState({ allowed: [], denied: [] })

  const filteredUsers = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return users
    return users.filter(user =>
      [user.full_name, user.email, user.role]
        .filter(Boolean)
        .some(value => value.toLowerCase().includes(needle))
    )
  }, [query, users])

  const selectedCount = selectedIds.length

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    setMessage('')

    const [usersResult, roleResult, userPermissionResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('id,email,full_name,role,active,created_at,updated_at')
        .order('email', { ascending: true }),
      supabase
        .from('role_permissions')
        .select('role,permissions')
        .order('role', { ascending: true }),
      supabase
        .from('user_permissions')
        .select('user_id,allowed_permissions,denied_permissions'),
    ])

    if (usersResult.error) {
      setError(usersResult.error.message)
    } else {
      const overridesByUser = new Map(
        (userPermissionResult.data || []).map(row => [row.user_id, normalizeOverrides(row)])
      )
      setUsers((usersResult.data || []).map(user => ({
        ...user,
        active: user.active !== false,
        overrides: overridesByUser.get(user.id) || { allowed: [], denied: [] },
      })))
    }

    if (roleResult.error) {
      setError(current => current || 'Run supabase/rbac_management.sql in Supabase SQL Editor to enable editable permissions.')
      setPermissionsByRole(DEFAULT_ROLE_PERMISSIONS)
    } else {
      const nextPermissions = { ...DEFAULT_ROLE_PERMISSIONS }
      for (const row of roleResult.data || []) {
        nextPermissions[row.role] = Array.isArray(row.permissions) ? row.permissions : []
      }
      setPermissionsByRole(nextPermissions)
    }

    if (userPermissionResult.error) {
      setError(current => current || 'Run supabase/rbac_management.sql again to enable user-specific permissions.')
    }

    setSelectedIds([])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    setPermissionsByRole(rolePermissions || DEFAULT_ROLE_PERMISSIONS)
  }, [rolePermissions])

  function openAddModal() {
    setError('')
    setFormMode('add')
    setEditingUser(null)
    setForm(emptyForm)
  }

  function openEditModal(user) {
    setError('')
    setFormMode('edit')
    setEditingUser(user)
    setForm({
      email: user.email || '',
      password: '',
      full_name: user.full_name || '',
      role: user.role || ROLES.VIEWER,
      active: user.active !== false,
    })
  }

  function closeFormModal() {
    setFormMode('')
    setEditingUser(null)
    setForm(emptyForm)
  }

  async function saveUserProfile(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')

    if (formMode === 'add') {
      const email = form.email.trim().toLowerCase()
      const fullName = form.full_name.trim() || email
      const { data: rpcData, error: rpcError } = await supabase.rpc('admin_create_app_user', {
        p_email: email,
        p_password: form.password,
        p_full_name: fullName,
        p_role: form.role,
        p_active: form.active,
      })

      if (rpcError) {
        setError(
          rpcError.message.includes('admin_create_app_user')
            ? 'Run supabase/rbac_management.sql again in Supabase SQL Editor to enable Add user.'
            : rpcError.message
        )
        setSaving(false)
        return
      }

      const profileEmail = rpcData?.[0]?.email || email
      await logAction({
        action: 'create user',
        action_type: 'rbac.user.create',
        entity_type: 'profile',
        entity_id: rpcData?.[0]?.id,
        details: `Created ${profileEmail} as ${form.role}`,
        metadata: { role: form.role, active: form.active },
      })
      setMessage(`ສ້າງ ${profileEmail} ສຳເລັດ`)
      closeFormModal()
      await loadData()
      setSaving(false)
      return
    }

    if (editingUser?.id === profile?.id && (form.role !== ROLES.ADMIN || !form.active)) {
      setError('You cannot remove admin access or deactivate your own account.')
      setSaving(false)
      return
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        email: form.email.trim(),
        full_name: form.full_name.trim() || form.email.trim(),
        role: form.role,
        active: form.active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', editingUser.id)

    if (updateError) {
      setError(updateError.message)
    } else {
      await logAction({
        action: 'update user',
        action_type: 'rbac.user.update',
        entity_type: 'profile',
        entity_id: editingUser.id,
        details: `Updated ${form.email.trim()}`,
        metadata: { role: form.role, active: form.active },
      })
      setMessage(`Updated ${form.email.trim()}.`)
      closeFormModal()
      await loadData()
    }
    setSaving(false)
  }

  async function toggleStatus(user) {
    if (user.id === profile?.id) {
      setError('You cannot deactivate your own account.')
      return
    }

    setSaving(true)
    setError('')
    setMessage('')
    const nextActive = !user.active
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ active: nextActive, updated_at: new Date().toISOString() })
      .eq('id', user.id)

    if (updateError) {
      setError(updateError.message)
    } else {
      await logAction({
        action: nextActive ? 'activate user' : 'deactivate user',
        action_type: 'rbac.user.status',
        entity_type: 'profile',
        entity_id: user.id,
        details: `${user.email} is now ${nextActive ? 'active' : 'inactive'}`,
        metadata: { active: nextActive },
      })
      setUsers(currentUsers => currentUsers.map(item => item.id === user.id ? { ...item, active: nextActive } : item))
      setMessage(`${user.email} is now ${nextActive ? 'active' : 'inactive'}.`)
    }
    setSaving(false)
  }

  async function deleteUsers(ids) {
    const targetIds = ids.filter(id => id !== profile?.id)
    if (targetIds.length !== ids.length) {
      setError('Your own account was skipped. You cannot delete your own access.')
    }
    if (targetIds.length === 0) return
    if (!window.confirm(`Delete ${targetIds.length} user profile(s) from app access?`)) return

    setSaving(true)
    const { error: permissionDeleteError } = await supabase
      .from('user_permissions')
      .delete()
      .in('user_id', targetIds)

    const { error: profileDeleteError } = await supabase
      .from('profiles')
      .delete()
      .in('id', targetIds)

    if (permissionDeleteError || profileDeleteError) {
      setError(permissionDeleteError?.message || profileDeleteError?.message)
    } else {
      await logAction({
        action: 'delete users',
        action_type: 'rbac.user.delete',
        entity_type: 'profile',
        details: `Deleted ${targetIds.length} user profile(s)`,
        metadata: { user_ids: targetIds },
      })
      setMessage(`Deleted ${targetIds.length} user profile(s).`)
      await loadData()
    }
    setSaving(false)
  }

  async function openPermissionModal(user) {
    setPermissionUser(user)
    setPermissionOverrides(user.overrides || { allowed: [], denied: [] })
    setError('')
    setMessage('')
  }

  async function saveUserPermissions() {
    if (!permissionUser) return
    setSaving(true)
    setError('')
    setMessage('')

    const validKeys = new Set(allPermissionKeys())
    let allowed = permissionOverrides.allowed.filter(key => validKeys.has(key))
    let denied = permissionOverrides.denied.filter(key => validKeys.has(key))

    if (permissionUser.id === profile?.id) {
      allowed = Array.from(new Set([...allowed, 'page.rbac', 'users.manage']))
      denied = denied.filter(key => !['page.rbac', 'users.manage'].includes(key))
    }

    const { error: saveError } = await supabase
      .from('user_permissions')
      .upsert(
        {
          user_id: permissionUser.id,
          allowed_permissions: allowed,
          denied_permissions: denied,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )

    if (saveError) {
      setError(saveError.message)
    } else {
      await logAction({
        action: 'save user permissions',
        action_type: 'rbac.permissions.update',
        entity_type: 'profile',
        entity_id: permissionUser.id,
        details: `Saved permissions for ${permissionUser.email}`,
        metadata: { allowed_permissions: allowed, denied_permissions: denied },
      })
      setMessage(`Saved page permissions for ${permissionUser.email}.`)
      setPermissionUser(null)
      await loadData()
      if (permissionUser.id === profile?.id) await refreshUserPermissions()
    }
    setSaving(false)
  }

  function toggleSelected(id) {
    setSelectedIds(current =>
      current.includes(id) ? current.filter(item => item !== id) : [...current, id]
    )
  }

  function toggleAllVisible(checked) {
    setSelectedIds(checked ? filteredUsers.map(user => user.id) : [])
  }

  return (
    <div className="min-h-full bg-gradient-to-br from-teal-50/80 via-white to-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-teal-100 pb-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-600">Administration</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">User & RBAC Management</h1>
            <p className="mt-1 text-sm text-slate-500">Add, edit, delete, activate users and assign page permissions.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => deleteUsers(selectedIds)}
              disabled={selectedCount === 0 || saving}
              className="btn-secondary border-red-200 bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50"
            >
              Delete selected
            </button>
            <button type="button" onClick={openAddModal} className="btn-primary bg-teal-500 hover:bg-teal-600">
              Add user
            </button>
          </div>
        </header>

        {(message || error) && (
          <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
            error
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}>
            {error || message}
          </div>
        )}

        <section className="overflow-hidden rounded-[26px] border border-teal-100 bg-white shadow-[0_24px_80px_rgba(15,118,110,0.12)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-500">ສະແດງ</span>
              <span className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700">10</span>
              <span className="text-sm text-slate-500">ແຖວ</span>
            </div>
            <input
              type="search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="ຄົ້ນຫາຜູ້ໃຊ້..."
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-teal-300 focus:ring-4 focus:ring-teal-100 md:w-72"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-teal-50/40">
                <tr>
                  <th className="table-th w-12">
                    <input
                      type="checkbox"
                      checked={filteredUsers.length > 0 && selectedIds.length === filteredUsers.length}
                      onChange={event => toggleAllVisible(event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-teal-500 focus:ring-teal-400"
                    />
                  </th>
                  <th className="table-th">Name</th>
                  <th className="table-th">ອີເມວ</th>
                  <th className="table-th">Role</th>
                  <th className="table-th">Status</th>
                  <th className="table-th text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr>
                    <td className="table-td" colSpan={6}>Loading users...</td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td className="table-td" colSpan={6}>No users found.</td>
                  </tr>
                ) : filteredUsers.map(user => (
                  <tr key={user.id} className="hover:bg-teal-50/30">
                    <td className="table-td">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(user.id)}
                        onChange={() => toggleSelected(user.id)}
                        className="h-4 w-4 rounded border-slate-300 text-teal-500 focus:ring-teal-400"
                      />
                    </td>
                    <td className="table-td">
                      <p className="font-black text-slate-900">{user.full_name || user.email || 'No name'}</p>
                    </td>
                    <td className="table-td text-slate-500">{user.email || '-'}</td>
                    <td className="table-td">
                      <span className={`inline-flex min-w-24 justify-center rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${ROLE_BADGES[user.role] || ROLE_BADGES[ROLES.VIEWER]}`}>
                        {ROLE_LABELS[user.role] || user.role || 'Viewer'}
                      </span>
                    </td>
                    <td className="table-td">
                      <button
                        type="button"
                        onClick={() => toggleStatus(user)}
                        disabled={saving}
                        className={`rounded-full border px-3 py-1 text-xs font-black transition ${
                          user.active
                            ? 'border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100'
                            : 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
                        }`}
                      >
                        {user.active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="table-td">
                      <div className="flex items-center justify-center gap-2">
                        <IconButton title="Page permissions" onClick={() => openPermissionModal(user)}>P</IconButton>
                        <IconButton title="Edit user" tone="blue" onClick={() => openEditModal(user)}>E</IconButton>
                        <IconButton title="Delete user" tone="red" onClick={() => deleteUsers([user.id])}>D</IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 p-4 text-sm text-slate-500">
            <span>Showing {filteredUsers.length} of {users.length} users</span>
            <span>Selected: {selectedCount}</span>
          </div>
        </section>
      </div>

      {formMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form onSubmit={saveUserProfile} className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="bg-teal-500 px-6 py-4 text-white">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-black">{formMode === 'add' ? 'Add user profile' : 'Edit user profile'}</h2>
                <button type="button" onClick={closeFormModal} className="text-2xl leading-none text-white/80 hover:text-white">x</button>
              </div>
            </div>

            <div className="space-y-4 p-6">
              {formMode === 'add' && (
                <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-700">
                  This creates the login account and app profile in one step without sending a confirmation email.
                </div>
              )}

              <label className="block">
                <span className="text-sm font-bold text-slate-700">ອີເມວ</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={event => setForm(current => ({ ...current, email: event.target.value }))}
                  required
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100"
                />
              </label>

              {formMode === 'add' && (
                <label className="block">
                  <span className="text-sm font-bold text-slate-700">ລະຫັດຜ່ານ</span>
                  <input
                    type="password"
                    value={form.password}
                    onChange={event => setForm(current => ({ ...current, password: event.target.value }))}
                    minLength={6}
                    required
                    autoComplete="new-password"
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100"
                    placeholder="At least 6 characters"
                  />
                </label>
              )}

              <label className="block">
                <span className="text-sm font-bold text-slate-700">Full name</span>
                <input
                  type="text"
                  value={form.full_name}
                  onChange={event => setForm(current => ({ ...current, full_name: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-bold text-slate-700">Role</span>
                  <select
                    value={form.role}
                    onChange={event => setForm(current => ({ ...current, role: event.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100"
                  >
                    {ROLE_OPTIONS.map(role => (
                      <option key={role.value} value={role.value}>{role.label}</option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-bold text-slate-700">Status</span>
                  <select
                    value={form.active ? 'active' : 'inactive'}
                    onChange={event => setForm(current => ({ ...current, active: event.target.value === 'active' }))}
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
              <button type="button" onClick={closeFormModal} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary bg-teal-500 hover:bg-teal-600">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      {permissionUser && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/55 p-4">
          <div className="mx-auto my-8 max-w-6xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 bg-teal-500 px-6 py-4 text-white">
              <h2 className="text-lg font-black">Page permissions: <span className="text-yellow-200">{permissionUser.full_name || permissionUser.email}</span></h2>
              <button type="button" onClick={() => setPermissionUser(null)} className="text-2xl leading-none text-white/80 hover:text-white">x</button>
            </div>

            <div className="p-6">
              <div className="mb-5 rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white">
                Checked permissions are active for this user. Role defaults are preselected, and your changes are saved as user-specific overrides.
              </div>

              <PermissionChecklist
                role={permissionUser.role || ROLES.VIEWER}
                permissionsByRole={permissionsByRole}
                overrides={permissionOverrides}
                onChange={setPermissionOverrides}
                disabled={saving}
              />
            </div>

            <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-100 bg-white px-6 py-4">
              <button type="button" onClick={() => setPermissionOverrides({ allowed: [], denied: [] })} className="btn-secondary">
                Use role defaults
              </button>
              <button type="button" onClick={() => setPermissionUser(null)} className="btn-secondary">
                Cancel
              </button>
              <button type="button" onClick={saveUserPermissions} disabled={saving} className="btn-primary bg-teal-500 hover:bg-teal-600">
                {saving ? 'Saving...' : 'Save permissions'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
