import type { ModalUser } from '../../../shared/types/messenger'
import s from './UserProfileModal.module.css'

interface UserProfileModalProps {
  user: ModalUser | null
  onClose: () => void
  onDeleteChat?: () => void
}

export function UserProfileModal({ user, onClose, onDeleteChat }: UserProfileModalProps) {
  if (!user) return null

  return (
    <div className={s.modalOverlay} onClick={onClose}>
      <div className={s.modalPanel} onClick={e => e.stopPropagation()}>
        <button type="button" className={s.modalClose} onClick={onClose}>✕</button>
        <div className={s.umAvatar} style={{ background: user.color }}>{user.initials}</div>
        <div className={s.umName}>{user.name}</div>
        <div className={s.umStatus}>
          {user.online ? <><span className={s.umStatusDot} />в сети</> : 'был(а) недавно'}
        </div>
        {(user.phone || user.email || user.department) && (
          <>
            <div className={s.umDivider} />
            <div className={s.umSection}>Контакт</div>
            {user.phone      && <div className={s.umField}><span className={s.umFieldLabel}>Телефон</span><span className={s.umFieldValue}>{user.phone}</span></div>}
            {user.email      && <div className={s.umField}><span className={s.umFieldLabel}>Email</span><span className={s.umFieldValue}>{user.email}</span></div>}
            {user.department && <div className={s.umField}><span className={s.umFieldLabel}>Отдел</span><span className={s.umFieldValue}>{user.department}</span></div>}
          </>
        )}
        {onDeleteChat && (
          <button
            type="button"
            className={s.umDeleteChatBtn}
            onClick={() => { if (window.confirm('Удалить чат? Переписка будет удалена безвозвратно.')) onDeleteChat() }}
          >
            Удалить чат
          </button>
        )}
      </div>
    </div>
  )
}
