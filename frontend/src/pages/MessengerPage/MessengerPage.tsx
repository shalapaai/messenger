import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import type { Filter, ModalUser, Message } from '../../shared/types/messenger'
import { colorFromId, initials as getInitials, createDirectChat, deleteChat, leaveGroupChat, sendMessageRest } from '../../shared/api/chatsApi'
import { useUserProfile } from '../../shared/context/useUserProfile'
import { useSignalR } from '../../shared/api/useSignalR'
import { useChatsStore } from '../../shared/api/chatsStore'
import { useIsOnline, useOnlineStore } from '../../shared/api/onlineStore'
import type { UserSearchResult } from '../../shared/api/usersApi'
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
import { ThemeModeToggle }  from '../../shared/ui/ThemeModeToggle'
import { NewChatModal }     from '../../features/messenger/NewChatModal'
import s from './MessengerPage.module.css'

interface DraftUserState {
  displayName: string
  avatarUrl: string | null
  login: string | null
}

export function MessengerPage() {
  const { id, newUserId } = useParams<{ id?: string; newUserId?: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const { profile, setProfile } = useUserProfile()

  const [filter, setFilter] = useState<Filter>('all')
  const [query,  setQuery]  = useState('')

  const [profileOpen,    setProfileOpen]    = useState(false)
  const [editOpen,       setEditOpen]       = useState(false)
  const [modalUser,      setModalUser]      = useState<ModalUser | null>(null)
  const [modalUserIsChatPartner, setModalUserIsChatPartner] = useState(false)
  const [groupModalOpen, setGroupModalOpen] = useState(false)
  const [newChatOpen,    setNewChatOpen]    = useState(false)
  const startTypingRef = useRef<() => void>(() => undefined)
  const stopTypingRef = useRef<() => void>(() => undefined)

  const inChatView = !!id || !!newUserId
  const draftUser  = newUserId ? (location.state as DraftUserState | null) : null

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
    own:             true,
    senderId:        profile?.userId      ?? 'me',
    senderName:      profile?.displayName ?? '',
    senderInitials:  profileInitials,
    senderColor:     profile?.avatarColor ?? 'var(--color-primary)',
    senderAvatarUrl: profile?.avatarUrl ?? null,
  }

  // ── Zustand чаты ─────────────────────────────────────────────────────────
  const chats       = useChatsStore((s) => s.chats)
  const chatsLoaded = useChatsStore((s) => s.chatsLoaded)
  const chatsError  = useChatsStore((s) => s.chatsError)
  const loadChats   = useChatsStore((s) => s.loadChats)
  const resetUnread = useChatsStore((s) => s.resetUnread)
  const removeChat  = useChatsStore((s) => s.removeChat)

  useEffect(() => { loadChats() }, [loadChats])
  useEffect(() => { if (id) resetUnread(id) }, [id, resetUnread])

  // ── Сообщения текущего чата + realtime-приём ───────────────────────────────
  const {
    messages, loadingInitial, loadError, retryLoadInitial,
    handleIncomingMessage, handleDeletedMessage, loadMoreHistory, loadingHistory, historyLoaded,
    send, retry, deleteMessage,
  } = useChatMessages(id, {
    onAppend: (smooth) => scroll.scrollToBottomNow(smooth),
  })

  const scroll = useScrollRestore(messages)

  // ── SignalR: чужая печать, своя печать (дебаунс), отправка ─────────────────
  const typingIndicator = useTypingIndicator(
    () => startTypingRef.current(),
    () => stopTypingRef.current(),
  )

  const { sendMessage: signalRSend, startTyping, stopTyping } = useSignalR({
    chatId: id,
    onMessage: handleIncomingMessage,
    onMessageDeleted: handleDeletedMessage,
    onTyping: typingIndicator.handleUserTyping,
    onStoppedTyping: typingIndicator.handleUserStoppedTyping,
  })

  useEffect(() => {
    startTypingRef.current = startTyping
    stopTypingRef.current = stopTyping
  }, [startTyping, stopTyping])

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

  async function handleSend(text: string) {
    typingIndicator.stopOwnTyping()

    // Черновик (чат с этим пользователем ещё не создан) — создаём чат и шлём
    // первое сообщение через REST, затем переходим на его реальный URL.
    if (newUserId) {
      try {
        const newChatId = await createDirectChat(newUserId)
        await sendMessageRest(newChatId, text)
        await loadChats()
        navigate(`/chats/${newChatId}`, { replace: true })
      } catch {
        window.alert('Не удалось отправить сообщение. Попробуйте ещё раз.')
      }
      return
    }

    if (!id) return
    send(id, text, signalRSend, meSender)
  }

  function handleRetrySend(msg: Parameters<typeof retry>[1]) {
    if (!id) return
    retry(id, msg, signalRSend)
  }

  async function handleDeleteMessage(msg: Message) {
    if (!id) return
    try {
      await deleteMessage(id, msg)
    } catch {
      window.alert('Не удалось удалить сообщение.')
    }
  }

  async function handleDeleteChat() {
    if (!id) return
    try {
      await deleteChat(id)
      removeChat(id)
      navigate('/chats')
    } catch {
      window.alert('Не удалось удалить чат.')
    }
  }

  async function handleLeaveGroup() {
    if (!id || !profile) return
    try {
      await leaveGroupChat(id, profile.userId)
      removeChat(id)
      setGroupModalOpen(false)
      navigate('/chats')
    } catch {
      window.alert('Не удалось выйти из группы.')
    }
  }

  function navigateToUserChat(user: UserSearchResult) {
    const existing = chats.find(c => c.otherUserId === user.userId)
    if (existing) {
      navigate(`/chats/${existing.id}`)
    } else {
      navigate(`/chats/new/${user.userId}`, {
        state: { displayName: user.displayName, avatarUrl: user.avatarUrl, login: user.login } satisfies DraftUserState,
      })
    }
  }

  function handleSelectSearchUser(user: UserSearchResult) {
    setNewChatOpen(false)
    navigateToUserChat(user)
  }

  const onlineStatuses = useOnlineStore(s => s.statuses)

  const totalUnread = chats.reduce((sum, c) => sum + c.unread, 0)
  const activeChat = id ? chats.find(c => c.id === id) : undefined
  const activeChatOnline = useIsOnline(activeChat?.otherUserId)
  const draftOnline = useIsOnline(newUserId)
  const meta = id
    ? (activeChat
        ? { name: activeChat.name, initials: activeChat.initials, color: activeChat.color, avatarUrl: activeChat.avatarUrl, online: activeChatOnline, group: activeChat.group, otherUserId: activeChat.otherUserId }
        : null)
    : newUserId
      ? {
          name: draftUser?.displayName ?? 'Новый чат',
          initials: getInitials(draftUser?.displayName ?? null),
          color: colorFromId(newUserId),
          avatarUrl: draftUser?.avatarUrl ?? null,
          online: draftOnline,
          group: false,
          otherUserId: newUserId,
        }
      : null
  const chatId = id ?? newUserId

  function openUserModal(userId: string, name: string, online: boolean) {
    setModalUser({ userId, name, initials: getInitials(name), color: colorFromId(userId), online })
  }

  return (
    <div className={s.root}>
      {/* Mobile top bar */}
      <header className={s.topBar}>
        {inChatView
          ? <button className={s.topBarBack} onClick={() => navigate('/chats')}>‹</button>
          : <div className={s.topBarLogo}>TL:MESSENGER</div>
        }
        <div className={s.topBarActions}>
          <ThemeModeToggle />
          <button
            className={s.topBarUserBtn}
            style={profile?.avatarUrl ? undefined : { background: profile?.avatarColor }}
            onClick={() => setProfileOpen(true)}
          >
            {profile?.avatarUrl
              ? <img src={profile.avatarUrl} alt={profileInitials} className={s.topBarUserImg} />
              : profileInitials
            }
          </button>
        </div>
      </header>

      <div className={s.body}>
        <IconNav
          onProfileOpen={() => setProfileOpen(true)}
          userInitials={profileInitials}
          userAvatarUrl={profile?.avatarUrl}
          userAvatarColor={profile?.avatarColor}
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
          onNewChat={() => setNewChatOpen(true)}
          onUserClick={userId => {
            const chat = chats.find(c => c.otherUserId === userId)
            openUserModal(userId, chat?.name ?? '', onlineStatuses[userId] ?? false)
          }}
          onUserSelect={user => { setQuery(''); navigateToUserChat(user) }}
        />

        <main className={`${s.content}${!inChatView ? ` ${s.contentMobileHidden}` : ''}`}>
          {chatId && meta ? (
            <ChatWindow
              chatId={chatId}
              meta={meta}
              messages={messages}
              meSender={meSender}
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
              onDelete={handleDeleteMessage}
              onTyping={typingIndicator.handleOwnTyping}
              onHeaderClick={() => {
                if (meta.group) { setGroupModalOpen(true); return }
                if (meta.otherUserId) { setModalUserIsChatPartner(true); openUserModal(meta.otherUserId, meta.name, meta.online) }
              }}
              onAvatarClick={msg => { setModalUserIsChatPartner(false); openUserModal(msg.senderId, msg.senderName, onlineStatuses[msg.senderId] ?? false) }}
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
      <nav className={`${s.bottomNav}${inChatView ? ` ${s.bottomNavHidden}` : ''}`}>
        <button className={`${s.bnItem} ${s.bnItemActive}`} onClick={() => navigate('/chats')}>
          <span className={s.bnGlyph}>💬{totalUnread > 0 && <span className={s.bnBadge}>{totalUnread}</span>}</span>
          <span>Чаты</span>
        </button>
        <button className={s.bnItem} onClick={() => setProfileOpen(true)}>
          <span
            className={s.bnAvatarMini}
            style={profile?.avatarUrl ? undefined : { background: profile?.avatarColor }}
          >
            {profile?.avatarUrl
              ? <img src={profile.avatarUrl} alt={profileInitials} className={s.bnAvatarMiniImg} />
              : profileInitials
            }
          </span>
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
        onDeleteChat={id && modalUserIsChatPartner ? handleDeleteChat : undefined}
      />

      {id && meta && (
        <GroupModal
          isOpen={groupModalOpen}
          chatId={id}
          meta={meta}
          members={[]}
          onClose={() => setGroupModalOpen(false)}
          onMemberClick={user => { setGroupModalOpen(false); setModalUserIsChatPartner(false); setModalUser(user) }}
          onLeave={handleLeaveGroup}
        />
      )}

      <NewChatModal
        isOpen={newChatOpen}
        onClose={() => setNewChatOpen(false)}
        onSelect={handleSelectSearchUser}
      />
    </div>
  )
}

export default MessengerPage
