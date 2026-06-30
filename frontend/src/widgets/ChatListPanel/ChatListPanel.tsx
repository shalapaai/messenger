import { useTranslation } from 'react-i18next'
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
}

const TABS: Filter[] = ['all', 'direct', 'group']

export function ChatListPanel({ chats, loading, error, onRetry, activeId, filter, query, onFilterChange, onQueryChange, onSelect }: ChatListPanelProps) {
  const { t } = useTranslation()
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
        <h2 className={s.clTitle}>{t('messenger.messages')}</h2>
        <button className={s.clNewBtn} onClick={() => alert(t('messenger.newChat'))}>＋</button>
      </div>

      <div className={s.clSearch}>
        <span className={s.clSearchIcon}>🔍</span>
        <input
          className={s.clSearchInput}
          placeholder={t('messenger.search')}
          value={query}
          onChange={e => onQueryChange(e.target.value)}
        />
      </div>

      <div className={s.clTabs}>
        {TABS.map(tab => (
          <button
            key={tab}
            className={`${s.clTab} ${filter === tab ? s.clTabActive : ''}`}
            onClick={() => onFilterChange(tab)}
          >
            {t(`messenger.tabs.${tab}`)}
            <span className={`${s.clTabCount} ${filter === tab ? s.clTabCountActive : ''}`}>{counts[tab]}</span>
          </button>
        ))}
      </div>

      <div className={s.clList}>
        {showError ? (
          <div className={s.clError}>
            <p>{t('messenger.loadChatsFailed')}</p>
            <button className={s.clRetryBtn} onClick={onRetry}>{t('common.retry')}</button>
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
          <div className={s.clEmpty}>{t('messenger.emptySearch')}</div>
        ) : (
          visible.map(chat => {
            const online = chat.otherUserId ? (onlineStatuses[chat.otherUserId] ?? false) : chat.online
            return (
              <div
                key={chat.id}
                className={`${s.clRow} ${activeId === String(chat.id) ? s.clRowActive : ''}`}
                onClick={() => onSelect(String(chat.id))}
              >
                <div className={`${s.clAvatar} ${chat.group ? s.clAvatarGroup : ''}`} style={{ background: chat.color }}>
                  {chat.initials}
                  {online && <span className={s.clOnlineDot} />}
                </div>
                <div className={s.clInfo}>
                  <div className={s.clNameRow}>
                    <span className={s.clName}>{chat.name}</span>
                    {chat.group && <span className={s.clGroupBadge}>{t('messenger.groupBadge')}</span>}
                  </div>
                  <div className={s.clPreview}>
                    {chat.preview || <span className={s.clPreviewEmpty}>{t('messenger.noMessages')}</span>}
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
