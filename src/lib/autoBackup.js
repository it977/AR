import { supabase } from './supabase'

const TABLES = [
  'ar_bills',
  'ar_debt',
  'ar_cashflow',
  'ar_insurance_list',
  'ar_recorders_list',
  'ar_config_options',
]

const BACKUP_KIND = 'daily'
const BACKUP_TIME = '23:00'
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000

function bangkokNow() {
  return new Date(Date.now() + BANGKOK_OFFSET_MS)
}

export function getBackupClock(now = bangkokNow()) {
  const iso = now.toISOString()
  return {
    date: iso.slice(0, 10),
    time: iso.slice(11, 16),
    fullTime: iso.slice(11, 19),
  }
}

async function fetchAllRows(table) {
  const PAGE = 1000
  let rows = []
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(from, from + PAGE - 1)

    if (error) throw error
    if (!data?.length) break

    rows = rows.concat(data)
    if (data.length < PAGE) break
    from += PAGE
  }

  return rows
}

export async function createDataBackup(source = 'manual') {
  const { date, fullTime } = getBackupClock()
  const payload = {}
  const counts = {}
  const isDailyAuto = source === 'client_auto_23_00' || source === 'pg_cron_23_00'
  const backupKind = isDailyAuto ? BACKUP_KIND : `manual_${fullTime.replace(/:/g, '')}_${Date.now()}`

  for (const table of TABLES) {
    const rows = await fetchAllRows(table)
    payload[table] = rows
    counts[table] = rows.length
  }

  const record = {
    backup_date: date,
    backup_time: isDailyAuto ? BACKUP_TIME : fullTime,
    backup_kind: backupKind,
    source,
    counts,
    payload,
  }

  const query = supabase
    .from('ar_data_backups')

  const { data, error } = isDailyAuto
    ? await query
      .upsert(record, { onConflict: 'backup_date,backup_kind' })
      .select('id,backup_date,backup_time,backup_kind,source,counts,created_at')
      .single()
    : await query
      .insert(record)
      .select('id,backup_date,backup_time,backup_kind,source,counts,created_at')
      .single()

  if (error) throw error
  localStorage.setItem(`ar_auto_backup_${date}`, 'done')
  return data
}

export async function runAutoBackupIfDue() {
  const { date, time } = getBackupClock()
  if (time < BACKUP_TIME) return { skipped: true, reason: 'before_backup_time' }
  if (localStorage.getItem(`ar_auto_backup_${date}`) === 'done') {
    return { skipped: true, reason: 'already_done_local' }
  }

  const { data, error } = await supabase
    .from('ar_data_backups')
    .select('id')
    .eq('backup_date', date)
    .eq('backup_kind', BACKUP_KIND)
    .maybeSingle()

  if (!error && data?.id) {
    localStorage.setItem(`ar_auto_backup_${date}`, 'done')
    return { skipped: true, reason: 'already_done_db' }
  }

  if (error && !String(error.message || '').includes('does not exist')) throw error

  return createDataBackup('client_auto_23_00')
}

export async function listRecentBackups(limit = 7) {
  const { data, error } = await supabase
    .from('ar_data_backups')
    .select('id,backup_date,backup_time,backup_kind,source,counts,created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data || []
}

export async function restoreDataBackup(backupId) {
  const { data, error } = await supabase.rpc('restore_ar_data_backup', {
    p_backup_id: backupId,
    p_make_safety_backup: true,
  })

  if (error) throw error
  return data
}
