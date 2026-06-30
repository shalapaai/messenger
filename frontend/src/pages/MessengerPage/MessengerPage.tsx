import { useState, useRef, useEffect, useMemo, useLayoutEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Filter, Message, ModalUser } from '../../shared/types/messenger'
import {
  CHATS, CHAT_META, GROUP_MEMBERS, USER_PROFILES,
  getInitialMessages, makeOlderBatch, getModalUserFromMsg,
} from '../../shared/lib/messenger/stubData'
import { useUserProfile } from '../../shared/context/useUserProfile'
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

  const [filter, setFilter]   = useState<Filter>('all')
  const [query, setQuery]     = useState('')

  const [chatMessages, setChatMessages] = useState<Record<string, Message[]>>(() =>
    Object.fromEntries(Object.keys(CHAT_META).map(cid => [cid, getInitialMessages(cid)]))
  )
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

  const scrollToBottom   = useRef(true)
  const smoothScroll     = useRef(false)
  const savedScrollHeight = useRef(0)
  const savedScrollTop    = useRef(0)
  const typingTimers     = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    scrollToBottom.current = true
    smoothScroll.current   = false
  }, [id])

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
    Object.values(typingTimers.current).forEach(clearTimeout)
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
    senderId:       profile?.userId    ?? 'me',
    senderName:     profile?.displayName ?? '',
    senderInitials: profileInitials,
    senderColor:    '#2C5BF0',
  }

  function triggerTypingIndicator(chatId: string) {
    clearTimeout(typingTimers.current[`${chatId}:on`])
    clearTimeout(typingTimers.current[`${chatId}:off`])
    typingTimers.current[`${chatId}:on`] = setTimeout(() => {
      setTypingChats(prev => ({ ...prev, [chatId]: true }))
      typingTimers.current[`${chatId}:off`] = setTimeout(() => {
        setTypingChats(prev => ({ ...prev, [chatId]: false }))
      }, 2200)
    }, 900)
  }

  function handleSend(text: string) {
    if (!id) return
    const newMsg: Message = {
      ...meSender, id: Date.now(), text,
      time: new Date().toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }),
      date: 'Сегодня',
    }
    scrollToBottom.current = true
    smoothScroll.current   = true
    setChatMessages(prev => ({ ...prev, [id]: [...(prev[id] ?? []), newMsg] }))
    if (!CHAT_META[id]?.group) triggerTypingIndicator(id)
  }

  const meta = id ? (CHAT_META[id] ?? CHAT_META['1']) : null

  return (
    <div className={s.root}>
      {/* Mobile top bar */}
      <header className={s.topBar}>
        {id
          ? <button className={s.topBarBack} onClick={() => navigate('/chats')}>‹</button>
          : <div className={s.topBarLogo}>TL:MESSENGER</div>
        }
        <button className={s.topBarUserBtn} onClick={() => setProfileOpen(true)}>
    {profile?.avatarUrl
      ? <img src={profile.avatarUrl} alt={profileInitials} className={s.topBarUserImg} />
      : profileInitials
    }
  </button>
      </header>

      <div className={s.body}>
        <IconNav
          onProfileOpen={() => setProfileOpen(true)}
          userInitials={profileInitials}
          userAvatarUrl={profile?.avatarUrl}
        />

        <ChatListPanel
          chats={CHATS}
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
          <span className={s.bnGlyph}>💬<span className={s.bnBadge}>12</span></span>
          <span>Чаты</span>
        </button>
        <button className={s.bnItem} onClick={() => setProfileOpen(true)}>
          <span className={s.bnAvatarMini}>
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
