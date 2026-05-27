import { useEffect } from 'react'
import { runAutoBackupIfDue } from '../lib/autoBackup'

export default function AutoBackupRunner() {
  useEffect(() => {
    let cancelled = false

    async function run() {
      try {
        if (!cancelled) await runAutoBackupIfDue()
      } catch (error) {
        console.warn('Auto backup skipped:', error.message)
      }
    }

    run()
    const timer = window.setInterval(run, 15 * 60 * 1000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  return null
}
