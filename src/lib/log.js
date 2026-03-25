import { supabase } from './supabase'

export async function logAction({ action, bill_no, patient_name, amount, details, recorder }) {
  await supabase.from('activity_logs').insert({
    action,
    bill_no:      bill_no      || null,
    patient_name: patient_name || null,
    amount:       amount       || null,
    details:      details      || null,
    recorder:     recorder     || null,
  })
}
