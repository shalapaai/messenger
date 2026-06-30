import { useEffect, useState } from 'react'
import { searchUsers, type UserSearchResult } from '../../../shared/api/usersApi'
import { useChatsStore } from '../../../shared/api/chatsStore'
import { colorFromId, initials } from '../../../shared/api/chatsApi'
import s from './NewChatModal.module.css'

interface NewChatModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (user: UserSearchResult) => void
}

export function NewChatModal({ isOpen, onClose, onSelect }: NewChatModalProps) {
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState<UserSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(false)
  const chats = useChatsStore((s) => s.chats)

  useEffect(() => {
    if (!isOpen) { setQuery(''); setResults([]); setError(false) }
  }, [isOpen])

  useEffect(() => {
    const q = query.trim()
    if (!q) { setResults([]); setError(false); setLoading(false); return }

    setLoading(true)
    setError(false)
    const timer = setTimeout(() => {
      searchUsers(q)
        .then(setResults)
        .catch(() => setError(true))
        .finally(() => setLoading(false))
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  if (!isOpen) return null

  const contactIds = new Set(chats.flatMap(c => c.otherUserId ? [c.otherUserId] : []))
  const contacts = results.filter(u => contactIds.has(u.userId))
  const others    = results.filter(u => !contactIds.has(u.userId))

  function renderRow(user: UserSearchResult) {
    const init = initials(user.displayName)
    return (
      <div key={user.userId} className={`${s.row} ${s.rowClickable}`} onClick={() => onSelect(user)}>
        {user.avatarUrl
          ? <img src={user.avatarUrl} alt={init} className={s.avatarImg} />
          : <div className={s.avatar} style={{ background: colorFromId(user.userId) }}>{init}</div>
        }
        <div className={s.info}>
          <span className={s.name}>{user.displayName}</span>
          <span className={s.sub}>{user.login ?? user.email}</span>
        </div>
      </div>
    )
  }

  return (
    <div className={s.modalOverlay} onClick={onClose}>
      <div className={s.modalPanel} onClick={e => e.stopPropagation()}>
        <button type="button" className={s.modalClose} onClick={onClose}>✕</button>
        <div className={s.title}>Новый чат</div>
        <input
          className={s.searchInput}
          placeholder="Имя, @login или почта"
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoFocus
        />
        <div className={s.results}>
          {loading ? (
            <div className={s.hint}>Поиск…</div>
          ) : error ? (
            <div className={s.hint}>Не удалось выполнить поиск</div>
          ) : !query.trim() ? (
            <div className={s.hint}>Начните вводить имя, @login или почту</div>
          ) : results.length === 0 ? (
            <div className={s.hint}>Никого не найдено</div>
          ) : (
            <>
              {contacts.length > 0 && (
                <>
                  <div className={s.section}>Контакты</div>
                  {contacts.map(renderRow)}
                </>
              )}
              {others.length > 0 && (
                <>
                  <div className={s.section}>Пользователи</div>
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
