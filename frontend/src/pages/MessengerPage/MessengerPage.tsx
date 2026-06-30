import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Filter, ModalUser } from '../../shared/types/messenger'
import { CHAT_META, GROUP_MEMBERS, USER_PROFILES, getModalUserFromMsg } from '../../shared/lib/messenger/stubData'
import { useUserProfile } from '../../shared/context/useUserProfile'
import { useSignalR } from '../../shared/api/useSignalR'
import { useChatsStore } from '../../shared/api/chatsStore'
import { useIsOnline } from '../../shared/api/onlineStore'
import { useScrollRestore } from './hooks/useScrollRestore'
import { useTypingIndicator } from './hooks/useTypingIndicator'
import { useChatMessages } from './hooks/useChatMessages'
import { IconNav }          from '../../widgets/IconNav'
import { ChatListPanel }    from '../../widgets/ChatListPanel'
import { ChatWindow }       from '../../widgets/ChatWindow'
import { ProfilePanel }     from '../../widgets/ProfilePanel'
import { EditProfileModal } from '../../features/messenger/EditProfileModal'
import { UserProfileModal } from '../../features/messenger/UserProfileModal'
import { GroupModal }       from '../../features/messenger/GroupModal'
import s from './MessengerPage.module.css'

export function MessengerPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile, setProfile } = useUserProfile()

  const [filter, setFilter] = useState<Filter>('all')
  const [query,  setQuery]  = useState('')

  const [profileOpen,    setProfileOpen]    = useState(false)
  const [editOpen,       setEditOpen]       = useState(false)
  const [modalUser,      setModalUser]      = useState<ModalUser | null>(null)
  const [groupModalOpen, setGroupModalOpen] = useState(false)

  // ── Реальный профиль (вместо мок-"Анны Соколовой") ─────────────────────────
  const profileInitials = profile
    ? (() => {
        const parts = profile.displayName.trim().split(/\s+/)
        return parts.length >= 2
          ? (parts[0][0] + parts[1][0]).toUpperCase()
          : profile.displayName.slice(0, 2).toUpperCase()
      })()
    : '...'

  const meSender = {
    own:            true,
    senderId:       profile?.userId      ?? 'me',
    senderName:     profile?.displayName ?? '',
    senderInitials: profileInitials,
    senderColor:    '#2C5BF0',
  }

  // ── Zustand чаты ─────────────────────────────────────────────────────────
  const chats       = useChatsStore((s) => s.chats)
  const chatsLoaded = useChatsStore((s) => s.chatsLoaded)
  const chatsError  = useChatsStore((s) => s.chatsError)
  const loadChats   = useChatsStore((s) => s.loadChats)
  const resetUnread = useChatsStore((s) => s.resetUnread)

  useEffect(() => { loadChats() }, [loadChats])
  useEffect(() => { if (id) resetUnread(id) }, [id, resetUnread])

  // ── Сообщения текущего чата + realtime-приём ───────────────────────────────
  const {
    messages, loadingInitial, loadError, retryLoadInitial,
    handleIncomingMessage, loadMoreHistory, loadingHistory, historyLoaded,
    send, retry,
  } = useChatMessages(id, {
    onAppend: (smooth) => scroll.scrollToBottomNow(smooth),
  })

  const scroll = useScrollRestore(messages)

  // ── SignalR: чужая печать, своя печать (дебаунс), отправка ─────────────────
  const typingIndicator = useTypingIndicator(
    () => startTyping(),
    () => stopTyping(),
  )

  const { sendMessage: signalRSend, startTyping, stopTyping } = useSignalR({
    chatId: id,
    onMessage: handleIncomingMessage,
    onTyping: typingIndicator.handleUserTyping,
    onStoppedTyping: typingIndicator.handleUserStoppedTyping,
  })

  // ── Подгрузка истории вверх по скроллу ──────────────────────────────────────
  useEffect(() => {
    const el       = scroll.messagesRef.current
    const sentinel = scroll.topSentinelRef.current
    if (!el || !sentinel || !id || messages.length === 0 || historyLoaded) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          loadMoreHistory(scroll.prepareRestoreBeforePrepend, scroll.triggerRestore)
        }
      },
      { root: el, threshold: 0 }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, messages.length, historyLoaded])

  useEffect(() => {
    const anyOpen = !!modalUser || groupModalOpen || editOpen || profileOpen
    if (!anyOpen) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setModalUser(null); setGroupModalOpen(false); setEditOpen(false); setProfileOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [modalUser, groupModalOpen, editOpen, profileOpen])

  function handleSend(text: string) {
    if (!id) return
    typingIndicator.stopOwnTyping()
    send(id, text, signalRSend, meSender)
  }

  function handleRetrySend(msg: Parameters<typeof retry>[1]) {
    if (!id) return
    retry(id, msg, signalRSend)
  }

  const totalUnread = chats.reduce((sum, c) => sum + c.unread, 0)
  const activeChat = id ? chats.find(c => c.id === id) : undefined
  const activeChatOnline = useIsOnline(activeChat?.otherUserId)
  const meta = id
    ? (activeChat
        ? { name: activeChat.name, initials: activeChat.initials, color: activeChat.color, online: activeChatOnline, group: activeChat.group }
        : (CHAT_META[id] ?? CHAT_META['1']))
    : null

  return (
    <div className={s.root}>
      {/* Mobile top bar */}
      <header className={s.topBar}>
        {id
          ? <button className={s.topBarBack} onClick={() => navigate('/chats')}>‹</button>
          : <div className={s.topBarLogo}>TL:MESSENGER</div>
        }
        <button className={s.topBarUserBtn} onClick={() => setProfileOpen(true)}>{profileInitials}</button>
      </header>

      <div className={s.body}>
        <IconNav
          onProfileOpen={() => setProfileOpen(true)}
          userInitials={profileInitials}
          userAvatarUrl={profile?.avatarUrl}
        />

        <ChatListPanel
          chats={chats}
          loading={!chatsLoaded}
          error={chatsError}
          onRetry={loadChats}
          activeId={id}
          filter={filter}
          query={query}
          onFilterChange={setFilter}
          onQueryChange={setQuery}
          onSelect={cid => navigate(`/chats/${cid}`)}
        />

        <main className={`${s.content}${!id ? ` ${s.contentMobileHidden}` : ''}`}>
          {id && meta ? (
            <ChatWindow
              chatId={id}
              meta={meta}
              messages={messages}
              typingChats={typingIndicator.typingChats}
              loadingHistory={loadingHistory}
              historyLoaded={historyLoaded}
              loadingInitial={loadingInitial}
              loadError={loadError}
              onRetryLoad={retryLoadInitial}
              messagesRef={scroll.messagesRef}
              topSentinelRef={scroll.topSentinelRef}
              bottomRef={scroll.bottomRef}
              onSend={handleSend}
              onRetry={handleRetrySend}
              onTyping={typingIndicator.handleOwnTyping}
              onHeaderClick={() => meta.group
                ? setGroupModalOpen(true)
                : setModalUser({ name: meta.name, initials: meta.initials, color: meta.color, online: meta.online, ...USER_PROFILES[id] })
              }
              onAvatarClick={msg => setModalUser(getModalUserFromMsg(msg))}
            />
          ) : (
            <div className={s.placeholder}>
              <div className={s.placeholderIcon}>💬</div>
              <h3 className={s.placeholderTitle}>Выберите чат</h3>
              <p className={s.placeholderText}>Выберите чат из списка слева, чтобы начать общение</p>
            </div>
          )}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className={`${s.bottomNav}${id ? ` ${s.bottomNavHidden}` : ''}`}>
        <button className={`${s.bnItem} ${s.bnItemActive}`} onClick={() => navigate('/chats')}>
          <span className={s.bnGlyph}>💬{totalUnread > 0 && <span className={s.bnBadge}>{totalUnread}</span>}</span>
          <span>Чаты</span>
        </button>
        <button className={s.bnItem} onClick={() => setProfileOpen(true)}>
          <span className={s.bnAvatarMini}>{profileInitials}</span>
          <span>Профиль</span>
        </button>
      </nav>

      {profile && (
        <ProfilePanel
          isOpen={profileOpen}
          profile={profile}
          onClose={() => setProfileOpen(false)}
          onEdit={() => { setProfileOpen(false); setEditOpen(true) }}
          onChats={() => navigate('/chats')}
        />
      )}

      {profile && editOpen && (
        <EditProfileModal
          isOpen={editOpen}
          profile={profile}
          onClose={() => setEditOpen(false)}
          onSave={(updated) => { setProfile(updated); setEditOpen(false) }}
        />
      )}

      <UserProfileModal
        user={modalUser}
        onClose={() => setModalUser(null)}
      />

      {meta && (
        <GroupModal
          isOpen={groupModalOpen}
          chatId={id!}
          meta={meta}
          members={GROUP_MEMBERS[id!] ?? []}
          onClose={() => setGroupModalOpen(false)}
          onMemberClick={user => { setGroupModalOpen(false); setModalUser(user) }}
        />
      )}
    </div>
  )
}

export default MessengerPage
