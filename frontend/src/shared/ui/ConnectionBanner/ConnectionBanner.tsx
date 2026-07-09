import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useConnectionStore } from '../../api/connectionStore'
import { signalR } from '../../api/signalrClient'
import s from './ConnectionBanner.module.css'

export function ConnectionBanner() {
  const { t } = useTranslation()
  const status = useConnectionStore((st) => st.status)
  const [visible, setVisible] = useState(false)
  const [justConnected, setJustConnected] = useState(false)
  const wasConnected = useRef(false)

  useEffect(() => {
    if (status === 'connected') {
      if (wasConnected.current) {
        setJustConnected(true)
        setVisible(true)
        const t = setTimeout(() => setVisible(false), 2000)
        return () => clearTimeout(t)
      }
      wasConnected.current = true
    } else {
      if (wasConnected.current) {
        setJustConnected(false)
        setVisible(true)
      }
    }
  }, [status])

  if (!visible) return null

  return (
    <div className={`${s.banner} ${s[justConnected ? 'connected' : status]}`}>
      {justConnected && t('connection.connected')}
      {!justConnected && status === 'reconnecting' && t('connection.reconnecting')}
      {!justConnected && status === 'disconnected' && (
        <>
          {t('connection.disconnected')}
          <button className={s.retryBtn} onClick={() => signalR.connect().catch(console.error)}>
            {t('common.retry')}
          </button>
        </>
      )}
    </div>
  )
}
