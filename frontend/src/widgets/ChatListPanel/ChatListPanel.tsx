import type { Chat, Filter } from '../../shared/types/messenger'
import { useOnlineStore } from '../../shared/api/onlineStore'
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
  onUserClick?: (userId: string) => void
}

const TABS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'direct', label: 'Личные' },
  { id: 'group', label: 'Группы' },
]

export function ChatListPanel({ chats, loading, error, onRetry, activeId, filter, query, onFilterChange, onQueryChange, onSelect, onUserClick }: ChatListPanelProps) {
  const onlineStatuses = useOnlineStore((s) => s.statuses)

  const counts = {
    all:    chats.length,
    direct: chats.filter(c => !c.group).length,
    group:  chats.filter(c =>  c.group).length,
  }
  const q = query.trim().toLowerCase()
  const visible = chats
    .filter(c => filter === 'all' ? true : filter === 'group' ? c.group : !c.group)
    .filter(c => !q || c.name.toLowerCase().includes(q) || c.preview.toLowerCase().includes(q))

  const showSkeleton = loading && chats.length === 0 && !error
  const showError    = error && chats.length === 0

  return (
    <aside className={`${s.chatListPanel} ${activeId ? s.chatListPanelHidden : ''}`}>
      <div className={s.clHeader}>
        <h2 className={s.clTitle}>Сообщения</h2>
        <button className={s.clNewBtn} onClick={() => alert('Новый чат')}>＋</button>
      </div>

      <div className={s.clSearch}>
        <span className={s.clSearchIcon}>🔍</span>
        <input
          className={s.clSearchInput}
          placeholder="Поиск"
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
        ) : visible.length === 0 ? (
          <div className={s.clEmpty}>Ничего не найдено</div>
        ) : (
          visible.map(chat => {
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
          })
        )}
      </div>
    </aside>
  )
}
