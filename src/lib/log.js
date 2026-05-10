import { supabase } from './supabase'

function getClientContext() {
  if (typeof window === 'undefined') return {}
  return {
    path: window.location.pathname,
    user_agent: window.navigator.userAgent,
  }
}

export async function logAction({
  action,
  action_type,
  entity_type,
  entity_id,
  bill_no,
  patient_name,
  amount,
  details,
  metadata,
  recorder,
}) {
  try {
    const { data: authData } = await supabase.auth.getUser()
    const user = authData?.user
    const client = getClientContext()

    await supabase.from('activity_logs').insert({
      action,
      action_type: action_type || action,
      entity_type: entity_type || null,
      entity_id: entity_id || bill_no || null,
      bill_no: bill_no || null,
      patient_name: patient_name || null,
      amount: amount || null,
      details: details || null,
      metadata: {
        ...(metadata || {}),
        path: client.path,
      },
      recorder: recorder || user?.email || null,
      user_id: user?.id || null,
      user_email: user?.email || null,
      user_agent: client.user_agent || null,
    })
  } catch {
    // Audit logging must never block the user's primary action.
  }
}
