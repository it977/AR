import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const validRoles = new Set(['admin', 'manager', 'staff', 'viewer'])

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.' }, 500)
  }

  const authHeader = req.headers.get('Authorization') || ''
  const token = authHeader.replace('Bearer ', '').trim()

  if (!token) {
    return jsonResponse({ error: 'Missing admin session.' }, 401)
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: requesterData, error: requesterError } = await admin.auth.getUser(token)
  if (requesterError || !requesterData.user) {
    return jsonResponse({ error: 'Invalid admin session.' }, 401)
  }

  const { data: requesterProfile, error: profileError } = await admin
    .from('profiles')
    .select('role,active')
    .eq('id', requesterData.user.id)
    .maybeSingle()

  if (profileError || requesterProfile?.role !== 'admin' || requesterProfile?.active === false) {
    return jsonResponse({ error: 'Only active admins can create users.' }, 403)
  }

  const body = await req.json().catch(() => ({}))
  const email = String(body.email || '').trim().toLowerCase()
  const password = String(body.password || '')
  const fullName = String(body.full_name || email).trim()
  const role = String(body.role || 'viewer')
  const active = body.active !== false

  if (!email) {
    return jsonResponse({ error: 'Email is required.' }, 400)
  }

  if (password.length < 6) {
    return jsonResponse({ error: 'Password must be at least 6 characters.' }, 400)
  }

  if (!validRoles.has(role)) {
    return jsonResponse({ error: `Invalid role: ${role}` }, 400)
  }

  const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName || email },
  })

  if (createError || !createdUser.user) {
    return jsonResponse({ error: createError?.message || 'Could not create auth user.' }, 400)
  }

  const { data: profile, error: upsertError } = await admin
    .from('profiles')
    .upsert(
      {
        id: createdUser.user.id,
        email,
        full_name: fullName || email,
        role,
        active,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    )
    .select('id,email,full_name,role,active,created_at,updated_at')
    .single()

  if (upsertError) {
    return jsonResponse({ error: upsertError.message }, 400)
  }

  return jsonResponse({ user: createdUser.user, profile })
})
