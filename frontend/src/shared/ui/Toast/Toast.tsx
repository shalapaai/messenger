import { useEffect } from 'react'
import { useToastStore } from '../../api/toastStore'
import s from './Toast.module.css'

const AUTO_DISMISS_MS = 5000

function ToastRow({ id, message }: { id: number; message: string }) {
  const dismissToast = useToastStore((st) => st.dismissToast)

  useEffect(() => {
    const timer = setTimeout(() => dismissToast(id), AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [id, dismissToast])

  return (
    <div className={s.toast} role="alert">
      <span className={s.message}>{message}</span>
      <button type="button" className={s.dismissBtn} onClick={() => dismissToast(id)}>✕</button>
    </div>
  )
}

/** Стек лёгких тостов для ошибок действий (удаление сообщения, выход из группы и т.п.) —
 *  единственная замена убранному модальному ErrorModal для этого класса ошибок. */
export function Toast() {
  const toasts = useToastStore((st) => st.toasts)

  if (toasts.length === 0) return null

  return (
    <div className={s.stack}>
      {toasts.map((toast) => <ToastRow key={toast.id} id={toast.id} message={toast.message} />)}
    </div>
  )
}
