import { useTranslation } from 'react-i18next'
import type { UserSearchResult } from '../../../shared/api/usersApi'
import { colorFromId, initials, userSubtitle } from '../../../shared/api/chatsApi'
import { useUserSearch } from '../../../shared/hooks/useUserSearch'
import { AvatarImage } from '../../../shared/ui/AvatarImage'
import { UserListSkeleton } from '../UserListSkeleton'
import s from './AddMemberModal.module.css'

interface AddMemberModalProps {
  isOpen: boolean
  excludeUserIds: string[]
  onClose: () => void
  onSelect: (user: UserSearchResult) => void
}

export function AddMemberModal({ isOpen, excludeUserIds, onClose, onSelect }: AddMemberModalProps) {
  const { t } = useTranslation()
  const { query, setQuery, results, loading, error } = useUserSearch(isOpen)

  if (!isOpen) return null

  const excluded = new Set(excludeUserIds)
  const visible = results.filter(u => !excluded.has(u.userId))

  return (
    <div className={s.modalOverlay} onClick={onClose}>
      <div className={s.modalPanel} onClick={e => e.stopPropagation()}>
        <button type="button" className={s.modalClose} onClick={onClose}>✕</button>
        <div className={s.title}>{t('group.addMember')}</div>
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
          ) : visible.length === 0 ? (
            <div className={s.hint}>{t('messenger.emptySearch')}</div>
          ) : (
            visible.map(user => {
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
            })
          )}
        </div>
      </div>
    </div>
  )
}
