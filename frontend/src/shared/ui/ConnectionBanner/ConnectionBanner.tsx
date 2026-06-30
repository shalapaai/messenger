import { useEffect, useRef, useState } from 'react'
import { useConnectionStore } from '../../api/connectionStore'
import { signalR } from '../../api/signalrClient'
import s from './ConnectionBanner.module.css'

export function ConnectionBanner() {
  const status = useConnectionStore((st) => st.status)
  const [visible, setVisible] = useState(false)
  const [justConnected, setJustConnected] = useState(false)
  const wasConnected = useRef(false)

  useEffect(() => {
    if (status === 'connected') {
      if (wasConnected.current) {
        // восстановление после обрыва — показываем "Подключено"
        setJustConnected(true)
        setVisible(true)
        const t = setTimeout(() => setVisible(false), 2000)
        return () => clearTimeout(t)
      }
      wasConnected.current = true
    } else {
      // показываем только если раньше уже были подключены
      if (wasConnected.current) {
        setJustConnected(false)
        setVisible(true)
      }
    }
  }, [status])

  if (!visible) return null

  return (
    <div className={`${s.banner} ${s[justConnected ? 'connected' : status]}`}>
      {justConnected && '✓ Подключено'}
      {!justConnected && status === 'reconnecting' && '⟳ Переподключение...'}
      {!justConnected && status === 'disconnected' && (
        <>
          Нет соединения
          <button className={s.retryBtn} onClick={() => signalR.connect().catch(console.error)}>
            Повторить
          </button>
        </>
      )}
    </div>
  )
}
