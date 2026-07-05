import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Chat, Filter } from '../../shared/types/messenger'
import { useOnlineStore } from '../../shared/api/onlineStore'
import { searchUsers, type UserSearchResult } from '../../shared/api/usersApi'
import { initials, colorFromId } from '../../shared/api/chatsApi'
import { AvatarImage } from '../../shared/ui/AvatarImage'
import { ChatListSkeleton } from './ChatListSkeleton'
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

const TABS: Filter[] = ['all', 'direct', 'group']

export function ChatListPanel({
  chats,
  loading,
  error,
  onRetry,
  activeId,
  filter,
  query,
  onFilterChange,
  onQueryChange,
  onSelect,
  onNewChat,
  onUserClick,
  onUserSelect,
}: ChatListPanelProps) {
  const { t } = useTranslation()
  const onlineStatuses = useOnlineStore((s) => s.statuses)
  const [userResults, setUserResults] = useState<UserSearchResult[]>([])
  const [userSearchLoading, setUserSearchLoading] = useState(false)
  const searchRequestIdRef = useRef(0)

  const counts = {
    all: chats.length,
    direct: chats.filter((c) => !c.group).length,
    group: chats.filter((c) => c.group).length,
  }
  const q = query.trim().toLowerCase()
  const visible = chats
    .filter((c) =>
      filter === 'all' ? true : filter === 'group' ? c.group : !c.group,
    )
    .filter(
      (c) =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.preview.toLowerCase().includes(q),
    )

  useEffect(() => {
    const existingIds = new Set(
      chats.flatMap((c) => (c.otherUserId ? [c.otherUserId] : [])),
    )
    const timer = setTimeout(() => {
      if (!q) {
        setUserResults([])
        setUserSearchLoading(false)
        return
      }

      // Защита от гонки ответов: если более старый запрос (например "al") отвечает позже более
      // нового ("alex"), его результат не должен затереть уже показанный актуальный список —
      // тот же паттерн, что в shared/hooks/useUserSearch.ts, которым пользуются модалки.
      const requestId = ++searchRequestIdRef.current
      setUserSearchLoading(true)
      searchUsers(q)
        .then((res) => {
          if (requestId !== searchRequestIdRef.current) return
          setUserResults(res.filter((u) => !existingIds.has(u.userId)))
        })
        .catch(() => { if (requestId === searchRequestIdRef.current) setUserResults([]) })
        .finally(() => { if (requestId === searchRequestIdRef.current) setUserSearchLoading(false) })
    }, 300)
    return () => clearTimeout(timer)
  }, [q, chats])

  const showSkeleton = loading && chats.length === 0 && !error
  const showError = error && chats.length === 0
  const showEmpty =
    visible.length === 0 &&
    (!q || (!userSearchLoading && userResults.length === 0))

  return (
    <aside
      className={`${s.chatListPanel} ${activeId ? s.chatListPanelHidden : ''}`}
    >
      <div className={s.clHeader}>
        {/* <h2 className={s.clTitle}>{t('messenger.messages')}</h2> */}
      </div>

      <div className={s.clSearch}>
        <span className={s.clSearchIcon}>🔍</span>
        <input
          className={s.clSearchInput}
          placeholder={t('messenger.searchOrNewChat')}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
        <button
          className={s.clNewBtn}
          onClick={onNewChat}
          title={t('messenger.createGroup')}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </button>
      </div>

      <div className={s.clTabs}>
        {TABS.map((tab) => (
          <button
            key={tab}
            className={`${s.clTab} ${filter === tab ? s.clTabActive : ''}`}
            onClick={() => onFilterChange(tab)}
          >
            {t(`messenger.tabs.${tab}`)}
            <span
              className={`${s.clTabCount} ${filter === tab ? s.clTabCountActive : ''}`}
            >
              {counts[tab]}
            </span>
          </button>
        ))}
      </div>

      <div className={s.clList}>
        {showError ? (
          <div className={s.clError}>
            <p>{t('messenger.loadChatsFailed')}</p>
            <button className={s.clRetryBtn} onClick={onRetry}>
              {t('common.retry')}
            </button>
          </div>
        ) : showSkeleton ? (
          <ChatListSkeleton />
        ) : (
          <>
            {visible.map((chat) => {
              const online = chat.otherUserId
                ? (onlineStatuses[chat.otherUserId] ?? false)
                : chat.online
              return (
                <div
                  key={chat.id}
                  className={`${s.clRow} ${activeId === String(chat.id) ? s.clRowActive : ''}`}
                  onClick={() => onSelect(String(chat.id))}
                >
                  <button
                    type="button"
                    className={`${s.clAvatar} ${chat.group ? s.clAvatarGroup : ''}`}
                    style={
                      chat.avatarUrl ? undefined : { background: chat.color }
                    }
                    onClick={(e) => {
                      if (!chat.group && chat.otherUserId && onUserClick) {
                        e.stopPropagation()
                        onUserClick(chat.otherUserId)
                      }
                    }}
                  >
                    {chat.avatarUrl ? (
                      <AvatarImage
                        src={chat.avatarUrl}
                        alt={chat.name}
                        className={s.clAvatarImg}
                      />
                    ) : (
                      chat.initials
                    )}
                    {online && <span className={s.clOnlineDot} />}
                  </button>
                  <div className={s.clInfo}>
                    <div className={s.clNameRow}>
                      <span className={s.clName}>{chat.name}</span>
                      {chat.group && (
                        <span className={s.clGroupBadge}>
                          {t('messenger.groupBadge')}
                        </span>
                      )}
                    </div>
                    <div className={s.clPreview}>
                      {chat.preview || (
                        <span className={s.clPreviewEmpty}>
                          {t('messenger.noMessages')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={s.clMeta}>
                    <span className={s.clTime}>{chat.time}</span>
                    {chat.unread > 0 && (
                      <span className={s.clUnread}>{chat.unread}</span>
                    )}
                  </div>
                </div>
              )
            })}

            {q && (userSearchLoading || userResults.length > 0) && (
              <>
                <div className={s.clUserDivider}>{t('messenger.newUsers')}</div>
                {userSearchLoading ? (
                  <ChatListSkeleton count={3} />
                ) : (
                  userResults.map((user) => {
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
                          style={
                            user.avatarUrl
                              ? undefined
                              : {
                                  background:
                                    user.avatarColor ??
                                    colorFromId(user.userId),
                                }
                          }
                        >
                          {user.avatarUrl ? (
                            <AvatarImage
                              src={user.avatarUrl}
                              alt={init}
                              className={s.clAvatarImg}
                            />
                          ) : (
                            init
                          )}
                          {online && <span className={s.clOnlineDot} />}
                        </div>
                        <div className={s.clInfo}>
                          <div className={s.clNameRow}>
                            <span className={s.clName}>{user.displayName}</span>
                          </div>
                          <div className={s.clPreview}>
                            {user.login ?? user.email}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </>
            )}

            {showEmpty && (
              <div className={s.clEmpty}>{t('messenger.emptySearch')}</div>
            )}
          </>
        )}
      </div>
    </aside>
  )
}
