import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useToastStore, type ToastItem } from '../../api/toastStore'
import s from './ToastViewport.module.css'

const ICON_BY_TYPE: Record<ToastItem['type'], string> = {
  success: '✓',
  error: '!',
  info: 'i',
}

function ToastCard({ toast }: { toast: ToastItem }) {
  const { t } = useTranslation()
  const dismissToast = useToastStore((state) => state.dismissToast)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => dismissToast(toast.id), toast.durationMs)
    return () => window.clearTimeout(timeoutId)
  }, [dismissToast, toast.durationMs, toast.id])

  return (
    <div className={`${s.toast} ${s[toast.type]}`} role={toast.type === 'error' ? 'alert' : 'status'}>
      <span className={s.icon} aria-hidden="true">{ICON_BY_TYPE[toast.type]}</span>
      <span className={s.message}>{toast.message}</span>
      <button
        type="button"
        className={s.close}
        onClick={() => dismissToast(toast.id)}
        aria-label={t('toast.dismiss')}
      >
        ×
      </button>
    </div>
  )
}

export function ToastViewport() {
  const toasts = useToastStore((state) => state.toasts)

  if (toasts.length === 0) return null

  return (
    <div className={s.viewport} aria-live="polite" aria-relevant="additions removals">
      {toasts.map((toast) => <ToastCard key={toast.id} toast={toast} />)}
    </div>
  )
}
