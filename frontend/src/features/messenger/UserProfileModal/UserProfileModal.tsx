import { useEffect, useState } from 'react'
import { profileApi, type PublicUserProfile } from '../../../shared/api/profileApi'
import { initials as getInitials, colorFromId } from '../../../shared/api/chatsApi'
import type { ModalUser } from '../../../shared/types/messenger'
import s from './UserProfileModal.module.css'

interface UserProfileModalProps {
  user: ModalUser | null
  onClose: () => void
  onDeleteChat?: () => void
}

export function UserProfileModal({ user, onClose, onDeleteChat }: UserProfileModalProps) {
  const [full, setFull] = useState<PublicUserProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!user?.userId) { setFull(null); setLoading(false); return }
    setFull(null)
    setLoading(true)
    profileApi.getUserById(user.userId)
      .then(setFull)
      .catch(() => setFull(null))
      .finally(() => setLoading(false))
  }, [user?.userId])


  if (!user) return null

  const avatarUrl  = full?.avatarUrl ?? user.avatarUrl
  const name       = full?.displayName ?? user.name
  const login      = full?.login ?? user.login
  const status     = full?.status ?? user.status
  const initials   = getInitials(name)
  const color      = full?.avatarColor ?? colorFromId(user.userId ?? '')

  const phone      = full?.phone
  const email      = full?.email
  const department = full?.department
  const city       = full?.city

  const hasContact = !!(phone || email || department || city || login || status)

  return (
    <>
    <div className={s.modalOverlay} onClick={onClose}>
      <div className={s.modalPanel} onClick={e => e.stopPropagation()}>
        <button type="button" className={s.modalClose} onClick={onClose}>✕</button>

        {avatarUrl
          ? <img src={avatarUrl} alt={name} className={s.umAvatarImg} />
          : <div className={s.umAvatar} style={{ background: color }}>{initials}</div>
        }

        <div className={s.umName}>{name}</div>
        <div className={s.umStatus}>
          {user.online
            ? <><span className={s.umStatusDot} />в сети</>
            : 'был(а) недавно'
          }
        </div>

        {loading && <div className={s.umLoading}>Загрузка...</div>}

        {!loading && hasContact && (
          <>
            <div className={s.umDivider} />
            <div className={s.umSection}>Контакт</div>
            {login      && <div className={s.umField}><span className={s.umFieldLabel}>Логин</span><span className={s.umFieldValue}>{login}</span></div>}
            {status     && <div className={s.umField}><span className={s.umFieldLabel}>Статус</span><span className={s.umFieldValue}>{status}</span></div>}
            {email      && <div className={s.umField}><span className={s.umFieldLabel}>Email</span><span className={s.umFieldValue}>{email}</span></div>}
            {phone      && <div className={s.umField}><span className={s.umFieldLabel}>Телефон</span><span className={s.umFieldValue}>{phone}</span></div>}
            {city       && <div className={s.umField}><span className={s.umFieldLabel}>Город</span><span className={s.umFieldValue}>{city}</span></div>}
            {department && <div className={s.umField}><span className={s.umFieldLabel}>Отдел</span><span className={s.umFieldValue}>{department}</span></div>}
          </>
        )}
        {onDeleteChat && (
          <button
            type="button"
            className={s.umDeleteChatBtn}
            onClick={() => setConfirmDelete(true)}
          >
            Удалить чат
          </button>
        )}
      </div>
    </div>

    {confirmDelete && onDeleteChat && (

      <div className={s.confirmOverlay} onClick={() => setConfirmDelete(false)}>
        <div className={s.confirmPanel} onClick={e => e.stopPropagation()}>
          <div className={s.confirmIcon}>🗑️</div>
          <div className={s.confirmTitle}>Удалить чат?</div>
          <div className={s.confirmText}>
            Вся переписка с <strong>{name}</strong> будет удалена безвозвратно.
          </div>
          <div className={s.confirmActions}>
            <button
              type="button"
              className={s.confirmCancel}
              onClick={() => setConfirmDelete(false)}
            >
              Отмена
            </button>
            <button
              type="button"
              className={s.confirmDelete}
              onClick={() => { setConfirmDelete(false); onDeleteChat(); onClose() }}
            >
              Удалить
            </button>
          </div>
        </div>
      </div>
    )}
  </>
  )
}
