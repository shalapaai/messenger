import { useEffect, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { profileApi, type PublicUserProfile } from '../../../shared/api/profileApi'
import { initials as getInitials, colorFromId } from '../../../shared/api/chatsApi'
import type { ModalUser } from '../../../shared/types/messenger'
import { AvatarImage } from '../../../shared/ui/AvatarImage'
import { UserProfileSkeleton } from './UserProfileSkeleton'
import s from './UserProfileModal.module.css'

interface UserProfileModalProps {
  user: ModalUser | null
  onClose: () => void
  onDeleteChat?: () => void
  /** Открыть/создать личный чат с этим пользователем — undefined для собственного профиля */
  onMessage?: () => void
}

export function UserProfileModal({ user, onClose, onDeleteChat, onMessage }: UserProfileModalProps) {
  const { t } = useTranslation()
  const [full, setFull] = useState<PublicUserProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    let cancelled = false

    const timer = setTimeout(() => {
      if (!user?.userId) {
        setFull(null)
        setLoading(false)
        return
      }

      setFull(null)
      setLoading(true)
      profileApi.getUserById(user.userId)
        .then(profile => { if (!cancelled) setFull(profile) })
        .catch(() => { if (!cancelled) setFull(null) })
        .finally(() => { if (!cancelled) setLoading(false) })
    }, 0)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
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
          ? <AvatarImage src={avatarUrl} alt={name} className={s.umAvatarImg} />
          : <div className={s.umAvatar} style={{ background: color }}>{initials}</div>
        }

        <div className={s.umName}>{name}</div>
        <div className={s.umStatus}>
          {user.online
            ? <><span className={s.umStatusDot} />{t('common.online')}</>
            : t('common.recently')
          }
        </div>

        {loading && <UserProfileSkeleton />}

        {!loading && hasContact && (
          <>
            <div className={s.umDivider} />
            <div className={s.umSection}>{t('profile.contact')}</div>
            {login      && <div className={s.umField}><span className={s.umFieldLabel}>{t('common.login')}</span><span className={s.umFieldValue}>{login}</span></div>}
            {status     && <div className={s.umField}><span className={s.umFieldLabel}>{t('common.status')}</span><span className={s.umFieldValue}>{status}</span></div>}
            {email      && <div className={s.umField}><span className={s.umFieldLabel}>{t('common.email')}</span><span className={s.umFieldValue}>{email}</span></div>}
            {phone      && <div className={s.umField}><span className={s.umFieldLabel}>{t('common.phone')}</span><span className={s.umFieldValue}>{phone}</span></div>}
            {city       && <div className={s.umField}><span className={s.umFieldLabel}>{t('common.city')}</span><span className={s.umFieldValue}>{city}</span></div>}
            {department && <div className={s.umField}><span className={s.umFieldLabel}>{t('common.department')}</span><span className={s.umFieldValue}>{department}</span></div>}
          </>
        )}
        {onMessage && (
          <button
            type="button"
            className={s.umMessageBtn}
            onClick={onMessage}
          >
            {t('messenger.writeMessage')}
          </button>
        )}
        {onDeleteChat && (
          <button
            type="button"
            className={s.umDeleteChatBtn}
            onClick={() => setConfirmDelete(true)}
          >
            {t('messenger.deleteChat')}
          </button>
        )}
      </div>
    </div>

    {confirmDelete && onDeleteChat && (

      <div className={s.confirmOverlay} onClick={() => setConfirmDelete(false)}>
        <div className={s.confirmPanel} onClick={e => e.stopPropagation()}>
          <div className={s.confirmIcon}>🗑️</div>
          <div className={s.confirmTitle}>{t('messenger.deleteChatTitle')}</div>
          <div className={s.confirmText}>
            <Trans i18nKey="messenger.deleteChatText" values={{ name }} components={{ strong: <strong /> }} />
          </div>
          <div className={s.confirmActions}>
            <button
              type="button"
              className={s.confirmCancel}
              onClick={() => setConfirmDelete(false)}
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className={s.confirmDelete}
              onClick={() => { setConfirmDelete(false); onDeleteChat(); onClose() }}
            >
              {t('messenger.deleteChat')}
            </button>
          </div>
        </div>
      </div>
    )}
  </>
  )
}
