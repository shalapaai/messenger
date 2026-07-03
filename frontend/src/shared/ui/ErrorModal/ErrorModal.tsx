import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useErrorModalStore } from '../../api/errorModalStore'
import s from './ErrorModal.module.css'

/** Единственный экземпляр на всё приложение (см. AppRouter/ConnectedLayout) — показывает
 *  последнюю ошибку, положенную в useErrorModalStore, вместо window.alert(). */
export function ErrorModal() {
  const { t } = useTranslation()
  const message = useErrorModalStore(st => st.message)
  const hideError = useErrorModalStore(st => st.hideError)

  useEffect(() => {
    if (!message) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') hideError() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [message, hideError])

  if (!message) return null

  return (
    <div className={s.overlay} onClick={hideError}>
      <div className={s.panel} onClick={e => e.stopPropagation()} role="alertdialog" aria-modal="true">
        <div className={s.icon}>⚠️</div>
        <div className={s.message}>{message}</div>
        <button type="button" className={s.okBtn} onClick={hideError} autoFocus>{t('common.ok')}</button>
      </div>
    </div>
  )
}
