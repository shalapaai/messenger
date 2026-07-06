import { useTranslation } from 'react-i18next'
import type { UserSearchResult } from '../../../shared/api/usersApi'
import { useChatsStore } from '../../../shared/api/chatsStore'
import { colorFromId, initials, userSubtitle } from '../../../shared/api/chatsApi'
import { useUserSearch } from '../../../shared/hooks/useUserSearch'
import { AvatarImage } from '../../../shared/ui/AvatarImage'
import { UserListSkeleton } from '../UserListSkeleton'
import s from './NewChatModal.module.css'

interface NewChatModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (user: UserSearchResult) => void
}

export function NewChatModal({ isOpen, onClose, onSelect }: NewChatModalProps) {
  const { t } = useTranslation()
  const { query, setQuery, results, loading, error } = useUserSearch(isOpen)
  const chats = useChatsStore((s) => s.chats)

  if (!isOpen) return null

  const contactIds = new Set(chats.flatMap(c => c.otherUserId ? [c.otherUserId] : []))
  const contacts = results.filter(u => contactIds.has(u.userId))
  const others    = results.filter(u => !contactIds.has(u.userId))

  function renderRow(user: UserSearchResult) {
    const init = initials(user.displayName)
    return (
      <div key={user.userId} className={`${s.row} ${s.rowClickable}`} onClick={() => onSelect(user)}>
        {user.avatarUrl
          ? <AvatarImage src={user.avatarUrl} alt={init} className={s.avatarImg} />
          : <div className={s.avatar} style={{ background: user.avatarColor ?? colorFromId(user.userId) }}>{init}</div>
        }
        <div className={s.info}>
          <span className={s.name}>{user.displayName}</span>
          <span className={s.sub}>{userSubtitle(user)}</span>
        </div>
      </div>
    )
  }

  return (
    <div className={s.modalOverlay} onClick={onClose}>
      <div className={s.modalPanel} onClick={e => e.stopPropagation()}>
        <button type="button" className={s.modalClose} onClick={onClose}>✕</button>
        <div className={s.title}>{t('messenger.newChat')}</div>
        <input
          className={s.searchInput}
          placeholder={t('messenger.searchPlaceholder')}
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoFocus
        />
        <div className={s.results}>
          {loading ? (
            <UserListSkeleton count={4} />
          ) : error ? (
            <div className={s.hint}>{t('messenger.searchFailed')}</div>
          ) : !query.trim() ? (
            <div className={s.hint}>{t('messenger.searchStartHint')}</div>
          ) : results.length === 0 ? (
            <div className={s.hint}>{t('messenger.emptySearch')}</div>
          ) : (
            <>
              {contacts.length > 0 && (
                <>
                  <div className={s.section}>{t('messenger.contacts')}</div>
                  {contacts.map(renderRow)}
                </>
              )}
              {others.length > 0 && (
                <>
                  <div className={s.section}>{t('messenger.users')}</div>
                  {others.map(renderRow)}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
