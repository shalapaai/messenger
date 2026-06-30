import { useTranslation } from 'react-i18next'
import type { ModalUser } from '../../../shared/types/messenger'
import s from './UserProfileModal.module.css'

interface UserProfileModalProps {
  user: ModalUser | null
  onClose: () => void
}

export function UserProfileModal({ user, onClose }: UserProfileModalProps) {
  const { t } = useTranslation()

  if (!user) return null

  return (
    <div className={s.modalOverlay} onClick={onClose}>
      <div className={s.modalPanel} onClick={e => e.stopPropagation()}>
        <button type="button" className={s.modalClose} onClick={onClose}>✕</button>
        <div className={s.umAvatar} style={{ background: user.color }}>{user.initials}</div>
        <div className={s.umName}>{user.name}</div>
        <div className={s.umStatus}>
          {user.online ? <><span className={s.umStatusDot} />{t('common.online')}</> : t('common.recently')}
        </div>
        {(user.phone || user.email || user.department) && (
          <>
            <div className={s.umDivider} />
            <div className={s.umSection}>{t('profile.contact')}</div>
            {user.phone      && <div className={s.umField}><span className={s.umFieldLabel}>{t('common.phone')}</span><span className={s.umFieldValue}>{user.phone}</span></div>}
            {user.email      && <div className={s.umField}><span className={s.umFieldLabel}>{t('common.email')}</span><span className={s.umFieldValue}>{user.email}</span></div>}
            {user.department && <div className={s.umField}><span className={s.umFieldLabel}>{t('common.department')}</span><span className={s.umFieldValue}>{user.department}</span></div>}
          </>
        )}
      </div>
    </div>
  )
}
