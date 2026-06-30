import { useState, useRef, useEffect, useMemo, useLayoutEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Filter, Message, ModalUser } from '../../shared/types/messenger'
import {
  CHAT_META, GROUP_MEMBERS, USER_PROFILES, STUB_USER,
  getInitialMessages, makeOlderBatch, getModalUserFromMsg,
} from '../../shared/lib/messenger/stubData'
import { useSignalR } from '../../shared/api/useSignalR'
import { useChatsStore } from '../../shared/api/chatsStore'
import { useIsOnline } from '../../shared/api/onlineStore'
import { fetchMessages } from '../../shared/api/chatsApi'
import { getMyUserId } from '../../shared/lib/auth/authTokens'
import type { IncomingMessage, TypingEvent } from '../../shared/api/signalrClient'
import { IconNav }          from '../../widgets/IconNav'
import { ChatListPanel }    from '../../widgets/ChatListPanel'
import { ChatWindow }       from '../../widgets/ChatWindow'
import { ProfilePanel }     from '../../widgets/ProfilePanel'
import { EditProfileModal } from '../../features/messenger/EditProfileModal'
import { UserProfileModal } from '../../features/messenger/UserProfileModal'
import { GroupModal }       from '../../features/messenger/GroupModal'
import s from './MessengerPage.module.css'

const ME_SENDER = { own: true, senderId: 'me', senderName: 'Анна', senderInitials: 'АС', senderColor: '#2C5BF0' }

export function MessengerPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [filter, setFilter]   = useState<Filter>('all')
  const [query, setQuery]     = useState('')

  const [chatMessages, setChatMessages] = useState<Record<string, Message[]>>({})
  const messages = useMemo(() => id ? (chatMessages[id] ?? []) : [], [chatMessages, id])

  const [typingChats,   setTypingChats]   = useState<Record<string, boolean>>({})
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [historyLoaded,  setHistoryLoaded]  = useState<Record<string, boolean>>({ '8': true })
  const [restoreSignal,  setRestoreSignal]  = useState(0)

  const [profileOpen,    setProfileOpen]    = useState(false)
  const [editOpen,       setEditOpen]       = useState(false)
  const [modalUser,      setModalUser]      = useState<ModalUser | null>(null)
  const [groupModalOpen, setGroupModalOpen] = useState(false)

  const bottomRef      = useRef<HTMLDivElement>(null)
  const messagesRef    = useRef<HTMLDivElement>(null)
  const topSentinelRef = useRef<HTMLDivElement>(null)
  // ── Zustand чаты ─────────────────────────────────────────────────────────
  const chats       = useChatsStore((s) => s.chats)
  const chatsLoaded = useChatsStore((s) => s.chatsLoaded)
  const loadChats   = useChatsStore((s) => s.loadChats)
  const resetUnread = useChatsStore((s) => s.resetUnread)

  // загружаем чаты из API при монтировании
  useEffect(() => { loadChats().catch(console.error) }, [loadChats])

  // ── SignalR: входящие сообщения (для любого присоединённого чата) ─────────
  const handleIncomingMessage = useCallback((msg: IncomingMessage) => {
    if (msg.senderId === getMyUserId()) return

    setChatMessages(prev => {
      // если чат ещё не открывали — его историю подтянет fetchMessages при открытии,
      // дублировать здесь не нужно
      if (!prev[msg.chatId]) return prev
      return {
        ...prev,
        [msg.chatId]: [...prev[msg.chatId], {
          id: Date.now(),
          text: msg.content,
          own: false,
          senderId: msg.senderId,
          senderName: msg.senderName,
          senderInitials: msg.senderName.slice(0, 2).toUpperCase(),
          senderColor: '#888888',
          time: new Date(msg.sentAt).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }),
          date: 'Сегодня',
        }],
      }
    })

    if (msg.chatId === id) {
      scrollToBottom.current = true
      smoothScroll.current   = true
    }
  }, [id])

  // ── SignalR: реальный индикатор печати собеседника ─────────────────────────
  const typingClearTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const handleUserTyping = useCallback((event: TypingEvent) => {
    setTypingChats(prev => ({ ...prev, [event.chatId]: true }))
    clearTimeout(typingClearTimers.current[event.chatId])
    // подстраховка на случай если StopTyping не придёт (обрыв связи и т.п.)
    typingClearTimers.current[event.chatId] = setTimeout(() => {
      setTypingChats(prev => ({ ...prev, [event.chatId]: false }))
    }, 3000)
  }, [])

  const handleUserStoppedTyping = useCallback((event: TypingEvent) => {
    clearTimeout(typingClearTimers.current[event.chatId])
    setTypingChats(prev => ({ ...prev, [event.chatId]: false }))
  }, [])

  const { sendMessage: signalRSend, startTyping, stopTyping } = useSignalR({
    chatId: id,
    onMessage: handleIncomingMessage,
    onTyping: handleUserTyping,
    onStoppedTyping: handleUserStoppedTyping,
  })

  // ── Собственная печать: дебаунс StartTyping/StopTyping ─────────────────────
  const ownTypingDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleOwnTyping = useCallback(() => {
    if (!ownTypingDebounce.current) startTyping()
    else clearTimeout(ownTypingDebounce.current)
    ownTypingDebounce.current = setTimeout(() => {
      stopTyping()
      ownTypingDebounce.current = null
    }, 2000)
  }, [startTyping, stopTyping])

  const scrollToBottom   = useRef(true)
  const smoothScroll     = useRef(false)
  const savedScrollHeight = useRef(0)
  const savedScrollTop    = useRef(0)

  useEffect(() => {
    scrollToBottom.current = true
    smoothScroll.current   = false
    if (!id) return
    resetUnread(id)
    // загружаем сообщения из API если ещё не загружены
    if (!chatMessages[id]) {
      fetchMessages(id).then(({ messages }) => {
        setChatMessages(prev => ({ ...prev, [id]: messages }))
      }).catch(() => {
        // fallback на моковые данные если API недоступен
        setChatMessages(prev => ({ ...prev, [id]: getInitialMessages(id) }))
      })
    }
  }, [id, resetUnread])

  useEffect(() => {
    if (!scrollToBottom.current) return
    bottomRef.current?.scrollIntoView({ behavior: smoothScroll.current ? 'smooth' : 'instant' })
    scrollToBottom.current = false
  }, [messages])

  useLayoutEffect(() => {
    if (restoreSignal === 0 || !messagesRef.current) return
    messagesRef.current.scrollTop =
      savedScrollTop.current + (messagesRef.current.scrollHeight - savedScrollHeight.current)
  }, [restoreSignal])

  const loadMoreHistory = useCallback(() => {
    if (!id || loadingHistory || historyLoaded[id]) return
    setLoadingHistory(true)
    setTimeout(() => {
      const batch = makeOlderBatch(id)
      if (batch.length > 0 && messagesRef.current) {
        savedScrollHeight.current = messagesRef.current.scrollHeight
        savedScrollTop.current    = messagesRef.current.scrollTop
        setChatMessages(prev => ({ ...prev, [id]: [...batch, ...(prev[id] ?? [])] }))
        setRestoreSignal(s => s + 1)
      }
      setHistoryLoaded(prev => ({ ...prev, [id]: true }))
      setLoadingHistory(false)
    }, 700)
  }, [id, loadingHistory, historyLoaded])

  useEffect(() => {
    const el       = messagesRef.current
    const sentinel = topSentinelRef.current
    if (!el || !sentinel || !id || messages.length === 0 || historyLoaded[id]) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMoreHistory() },
      { root: el, threshold: 0 }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [id, messages.length, historyLoaded, loadMoreHistory])

  useEffect(() => () => {
    Object.values(typingClearTimers.current).forEach(clearTimeout)
    if (ownTypingDebounce.current) clearTimeout(ownTypingDebounce.current)
  }, [])

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

  async function doSend(chatId: string, text: string, tempId: number) {
    try {
      const { messageId } = await signalRSend(text)
      setChatMessages(prev => ({
        ...prev,
        [chatId]: (prev[chatId] ?? []).map(m =>
          m.id === tempId ? { ...m, status: 'sent' as const, messageId } : m
        ),
      }))
    } catch {
      setChatMessages(prev => ({
        ...prev,
        [chatId]: (prev[chatId] ?? []).map(m =>
          m.id === tempId ? { ...m, status: 'failed' as const } : m
        ),
      }))
    }
  }

  function handleSend(text: string) {
    if (!id) return
    const tempId = Date.now()
    const newMsg: Message = {
      ...ME_SENDER, id: tempId, text,
      time: new Date().toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }),
      date: 'Сегодня',
      status: 'pending',
    }
    scrollToBottom.current = true
    smoothScroll.current   = true
    setChatMessages(prev => ({ ...prev, [id]: [...(prev[id] ?? []), newMsg] }))
    if (ownTypingDebounce.current) {
      clearTimeout(ownTypingDebounce.current)
      ownTypingDebounce.current = null
    }
    stopTyping()
    doSend(id, text, tempId)
  }

  function handleRetry(msg: Message) {
    if (!id) return
    setChatMessages(prev => ({
      ...prev,
      [id]: (prev[id] ?? []).map(m =>
        m.id === msg.id ? { ...m, status: 'pending' as const } : m
      ),
    }))
    doSend(id, msg.text, msg.id)
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
        <button className={s.topBarUserBtn} onClick={() => setProfileOpen(true)}>АС</button>
      </header>

      <div className={s.body}>
        <IconNav onProfileOpen={() => setProfileOpen(true)} />

        <ChatListPanel
          chats={chats}
          loading={!chatsLoaded}
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
              typingChats={typingChats}
              loadingHistory={loadingHistory}
              historyLoaded={!!historyLoaded[id]}
              messagesRef={messagesRef}
              topSentinelRef={topSentinelRef}
              bottomRef={bottomRef}
              onSend={handleSend}
              onRetry={handleRetry}
              onTyping={handleOwnTyping}
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
          <span className={s.bnAvatarMini}>АС</span>
          <span>Профиль</span>
        </button>
      </nav>

      <ProfilePanel
        isOpen={profileOpen}
        stubUser={STUB_USER}
        onClose={() => setProfileOpen(false)}
        onEdit={() => { setProfileOpen(false); setEditOpen(true) }}
        onChats={() => navigate('/chats')}
      />

      <EditProfileModal
        isOpen={editOpen}
        stubUser={STUB_USER}
        onClose={() => setEditOpen(false)}
      />

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
