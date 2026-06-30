import { useEffect, useState } from 'react'
import type { Chat, Filter } from '../../shared/types/messenger'
import { useOnlineStore } from '../../shared/api/onlineStore'
import { searchUsers, type UserSearchResult } from '../../shared/api/usersApi'
import { initials, colorFromId } from '../../shared/api/chatsApi'
import s from './ChatListPanel.module.css'

interface ChatListPanelProps {
  chats: Chat[]
  loading: boolean
  error: boolean
  onRetry: () => void
  activeId: string | undefined
  filter: Filter
  query: string
  onFilterChange: (f: Filter) => void
  onQueryChange: (q: string) => void
  onSelect: (id: string) => void
  onNewChat: () => void
  onUserClick?: (userId: string) => void
  onUserSelect: (user: UserSearchResult) => void
}

const TABS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'direct', label: 'Личные' },
  { id: 'group', label: 'Группы' },
]

export function ChatListPanel({ chats, loading, error, onRetry, activeId, filter, query, onFilterChange, onQueryChange, onSelect, onNewChat, onUserClick, onUserSelect }: ChatListPanelProps) {
  const onlineStatuses = useOnlineStore((s) => s.statuses)
  const [userResults, setUserResults]         = useState<UserSearchResult[]>([])
  const [userSearchLoading, setUserSearchLoading] = useState(false)

  const counts = {
    all:    chats.length,
    direct: chats.filter(c => !c.group).length,
    group:  chats.filter(c =>  c.group).length,
  }
  const q = query.trim().toLowerCase()
  const visible = chats
    .filter(c => filter === 'all' ? true : filter === 'group' ? c.group : !c.group)
    .filter(c => !q || c.name.toLowerCase().includes(q) || c.preview.toLowerCase().includes(q))

  useEffect(() => {
    if (!q) { setUserResults([]); setUserSearchLoading(false); return }
    setUserSearchLoading(true)
    const existingIds = new Set(chats.flatMap(c => c.otherUserId ? [c.otherUserId] : []))
    const timer = setTimeout(() => {
      searchUsers(q)
        .then(res => setUserResults(res.filter(u => !existingIds.has(u.userId))))
        .catch(() => setUserResults([]))
        .finally(() => setUserSearchLoading(false))
    }, 300)
    return () => clearTimeout(timer)
  }, [q, chats])

  const showSkeleton = loading && chats.length === 0 && !error
  const showError    = error && chats.length === 0
  const showEmpty    = visible.length === 0 && (!q || (!userSearchLoading && userResults.length === 0))

  return (
    <aside className={`${s.chatListPanel} ${activeId ? s.chatListPanelHidden : ''}`}>
      <div className={s.clHeader}>
        <h2 className={s.clTitle}>Сообщения</h2>
        <button className={s.clNewBtn} onClick={onNewChat}>＋</button>
      </div>

      <div className={s.clSearch}>
        <span className={s.clSearchIcon}>🔍</span>
        <input
          className={s.clSearchInput}
          placeholder="Поиск или новый чат"
          value={query}
          onChange={e => onQueryChange(e.target.value)}
        />
      </div>

      <div className={s.clTabs}>
        {TABS.map(t => (
          <button
            key={t.id}
            className={`${s.clTab} ${filter === t.id ? s.clTabActive : ''}`}
            onClick={() => onFilterChange(t.id)}
          >
            {t.label}
            <span className={`${s.clTabCount} ${filter === t.id ? s.clTabCountActive : ''}`}>{counts[t.id]}</span>
          </button>
        ))}
      </div>

      <div className={s.clList}>
        {showError ? (
          <div className={s.clError}>
            <p>Не удалось загрузить чаты</p>
            <button className={s.clRetryBtn} onClick={onRetry}>Повторить</button>
          </div>
        ) : showSkeleton ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={s.clSkeletonRow}>
              <div className={s.clSkeletonAvatar} />
              <div className={s.clSkeletonLines}>
                <div className={s.clSkeletonLine} style={{ width: '55%' }} />
                <div className={s.clSkeletonLine} style={{ width: '80%' }} />
              </div>
            </div>
          ))
        ) : (
          <>
            {visible.map(chat => {
              const online = chat.otherUserId ? (onlineStatuses[chat.otherUserId] ?? false) : chat.online
              return (
                <div
                  key={chat.id}
                  className={`${s.clRow} ${activeId === String(chat.id) ? s.clRowActive : ''}`}
                  onClick={() => onSelect(String(chat.id))}
                >
                  <button
                    type="button"
                    className={`${s.clAvatar} ${chat.group ? s.clAvatarGroup : ''}`}
                    style={chat.avatarUrl ? undefined : { background: chat.color }}
                    onClick={e => {
                      if (!chat.group && chat.otherUserId && onUserClick) {
                        e.stopPropagation()
                        onUserClick(chat.otherUserId)
                      }
                    }}
                  >
                    {chat.avatarUrl
                      ? <img src={chat.avatarUrl} alt={chat.name} className={s.clAvatarImg} />
                      : chat.initials
                    }
                    {online && <span className={s.clOnlineDot} />}
                  </button>
                  <div className={s.clInfo}>
                    <div className={s.clNameRow}>
                      <span className={s.clName}>{chat.name}</span>
                      {chat.group && <span className={s.clGroupBadge}>ГРУППА</span>}
                    </div>
                    <div className={s.clPreview}>
                      {chat.preview || <span className={s.clPreviewEmpty}>Нет сообщений</span>}
                    </div>
                  </div>
                  <div className={s.clMeta}>
                    <span className={s.clTime}>{chat.time}</span>
                    {chat.unread > 0 && <span className={s.clUnread}>{chat.unread}</span>}
                  </div>
                </div>
              )
            })}

            {q && (userSearchLoading || userResults.length > 0) && (
              <>
                <div className={s.clUserDivider}>Новые пользователи</div>
                {userSearchLoading ? (
                  <div className={s.clUserSearching}>Поиск…</div>
                ) : (
                  userResults.map(user => {
                    const init = initials(user.displayName)
                    const online = onlineStatuses[user.userId] ?? false
                    return (
                      <div
                        key={user.userId}
                        className={s.clRow}
                        onClick={() => onUserSelect(user)}
                      >
                        <div
                          className={s.clAvatar}
                          style={user.avatarUrl ? undefined : { background: colorFromId(user.userId) }}
                        >
                          {user.avatarUrl
                            ? <img src={user.avatarUrl} alt={init} className={s.clAvatarImg} />
                            : init
                          }
                          {online && <span className={s.clOnlineDot} />}
                        </div>
                        <div className={s.clInfo}>
                          <div className={s.clNameRow}>
                            <span className={s.clName}>{user.displayName}</span>
                          </div>
                          <div className={s.clPreview}>{user.login ?? user.email}</div>
                        </div>
                      </div>
                    )
                  })
                )}
              </>
            )}

            {showEmpty && (
              <div className={s.clEmpty}>Ничего не найдено</div>
            )}
          </>
        )}
      </div>
    </aside>
  )
}
