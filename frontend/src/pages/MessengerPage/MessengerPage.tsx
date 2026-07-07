import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import type { Filter, Message } from '../../shared/types/messenger'
import { colorFromId, initials as getInitials, createDirectChat, deleteChat, leaveGroupChat, sendMessageRest, markChatRead, createGroupChat, addChatMember, updateChat, uploadChatAvatar, setMemberRole } from '../../shared/api/chatsApi'
import { forwardMessages as forwardMessagesApi } from '../../shared/api/messagesApi'
import { useUserProfile } from '../../shared/context/useUserProfile'
import { useSignalR } from '../../shared/api/useSignalR'
import { useChatsStore } from '../../shared/api/chatsStore'
import { useIsOnline, useOnlineStore } from '../../shared/api/onlineStore'
import { showToast } from '../../shared/api/toastStore'
import type { UserSearchResult } from '../../shared/api/usersApi'
import { useScrollRestore } from './hooks/useScrollRestore'
import { useTypingIndicator } from './hooks/useTypingIndicator'
import { useChatMessages } from './hooks/useChatMessages'
import { useGroupMembers } from './hooks/useGroupMembers'
import { useMessengerModals } from './hooks/useMessengerModals'
import { IconNav }          from '../../widgets/IconNav'
import { ChatListPanel }    from '../../widgets/ChatListPanel'
import { ChatWindow }       from '../../widgets/ChatWindow'
import { ProfilePanel }     from '../../widgets/ProfilePanel'
import { EditProfileModal } from '../../features/messenger/EditProfileModal'
import { UserProfileModal } from '../../features/messenger/UserProfileModal'
import { GroupModal }       from '../../features/messenger/GroupModal'
import { NewGroupModal }    from '../../features/messenger/NewGroupModal'
import { EditGroupModal }   from '../../features/messenger/EditGroupModal'
import { AddMemberModal }   from '../../features/messenger/AddMemberModal'
import { ForwardModal }     from '../../features/messenger/ForwardModal'
import { ThemeModeToggle }  from '../../shared/ui/ThemeModeToggle'
import { AvatarImage }      from '../../shared/ui/AvatarImage'
import s from './MessengerPage.module.css'

interface DraftUserState {
  displayName: string
  avatarUrl: string | null
  avatarColor: string | null
  login: string | null
}

export function MessengerPage() {
  const { t } = useTranslation()
  const { id, newUserId } = useParams<{ id?: string; newUserId?: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const { profile, setProfile } = useUserProfile()

  const [filter, setFilter] = useState<Filter>('all')
  const [query,  setQuery]  = useState('')

  const {
    profileOpen, setProfileOpen,
    editOpen, setEditOpen,
    modalUser, setModalUser,
    modalUserIsChatPartner, setModalUserIsChatPartner,
    groupModalOpen, setGroupModalOpen,
    newGroupModalOpen, setNewGroupModalOpen,
    editGroupModalOpen, setEditGroupModalOpen,
    addMemberModalOpen, setAddMemberModalOpen,
    forwardState, setForwardState,
  } = useMessengerModals()
  const startTypingRef = useRef<() => void>(() => undefined)
  const stopTypingRef = useRef<() => void>(() => undefined)

  const inChatView   = !!id || !!newUserId
  const chatId       = id ?? newUserId
  const draftUser    = newUserId ? (location.state as DraftUserState | null) : null
  const focusInput   = !!(location.state as { focusInput?: boolean } | null)?.focusInput

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

  const chats       = useChatsStore((s) => s.chats)
  const chatsLoaded = useChatsStore((s) => s.chatsLoaded)
  const chatsError  = useChatsStore((s) => s.chatsError)
  const loadChats   = useChatsStore((s) => s.loadChats)
  const resetUnread = useChatsStore((s) => s.resetUnread)
  const removeChat  = useChatsStore((s) => s.removeChat)
  const handleMessagesRead = useChatsStore((s) => s.handleMessagesRead)

  useEffect(() => { loadChats() }, [loadChats])
  useEffect(() => { if (id) resetUnread(id) }, [id, resetUnread])

  const isGroupChat = id ? (chats.find(c => c.id === id)?.group ?? false) : false
  const {
    groupMembers,
    groupMembersLoading,
    loadGroupMembers,
    updateMemberRoleLocally,
    patchMemberProfile,
    canDeleteMessages,
  } = useGroupMembers(id, isGroupChat, profile?.userId)

  const {
    messages, loadingInitial, loadError, retryLoadInitial,
    handleIncomingMessage, handleDeletedMessage, handleEditedMessage, handleUserProfileUpdated, handleReactionChanged,
    loadMoreHistory, loadingHistory, historyLoaded,
    send, sendFiles, retry, deleteMessage, removeLocalMessage, deleteMessages, editMessage, setMessageReaction,
  } = useChatMessages(id, {
    onAppend: (smooth) => scroll.scrollToBottomNow(smooth),
    onIncomingRead: (chatId) => markChatRead(chatId).catch(() => {}),
  })

  // Чат открыт/выбран (включая повторный заход в уже загруженный чат) — отмечаем прочитанным
  useEffect(() => {
    if (id) markChatRead(id).catch(() => {})
  }, [id])

  const scroll = useScrollRestore(messages)
  const {
    bottomRef,
    messagesRef,
    topSentinelRef,
    scrollToBottomNow,
    prepareRestoreBeforePrepend,
    triggerRestore,
  } = scroll
  const hasLoadedMessages = messages.length > 0

  useEffect(() => {
    if (!chatId || loadingInitial || !hasLoadedMessages) return
    scrollToBottomNow(false)
  }, [chatId, loadingInitial, hasLoadedMessages, scrollToBottomNow])

  const typingIndicator = useTypingIndicator(
    () => startTypingRef.current(),
    () => stopTypingRef.current(),
  )

  const { sendMessage: signalRSend, startTyping, stopTyping } = useSignalR({
    chatId: id,
    onMessage: handleIncomingMessage,
    onMessageDeleted: handleDeletedMessage,
    onMessageEdited: handleEditedMessage,
    onMessageReactionChanged: handleReactionChanged,
    onMessagesRead: (event) => handleMessagesRead(event.chatId, event.readerId, event.readAt),
    onTyping: typingIndicator.handleUserTyping,
    onStoppedTyping: typingIndicator.handleUserStoppedTyping,
    onChatUpdated: (event) => {
      loadChats()
      if (event.chatId === id && isGroupChat) loadGroupMembers(id)
    },
    onUserProfileUpdated: (event) => {
      handleUserProfileUpdated(event)
      // Карточка группы могла уже подгрузить участников — обновляем и её, иначе
      // открытая сейчас карточка так и покажет старые имя/аватар до повторного открытия.
      patchMemberProfile(event.userId, {
        name: event.displayName,
        initials: getInitials(event.displayName),
        avatarUrl: event.avatarUrl,
        color: event.avatarColor,
      })
    },
  })

  useEffect(() => {
    startTypingRef.current = startTyping
    stopTypingRef.current = stopTyping
  }, [startTyping, stopTyping])

  // Ref нужен, чтобы IntersectionObserver всегда вызывал актуальную версию
  // loadMoreHistory. Без него колбэк захватывает устаревший экземпляр функции,
  // где loadingHistory === true, и повторные скроллы вверх молча игнорируются.
  const loadMoreHistoryRef = useRef(loadMoreHistory)
  useEffect(() => {
    loadMoreHistoryRef.current = loadMoreHistory
  }, [loadMoreHistory])

  useEffect(() => {
    const el       = messagesRef.current
    const sentinel = topSentinelRef.current
    if (!el || !sentinel || !id || messages.length === 0 || historyLoaded) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          loadMoreHistoryRef.current(prepareRestoreBeforePrepend, triggerRestore)
        }
      },
      { root: el, threshold: 0 }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [id, messages.length, historyLoaded, messagesRef, prepareRestoreBeforePrepend, topSentinelRef, triggerRestore])

  async function handleSend(text: string, replyTo?: Message) {
    typingIndicator.stopOwnTyping()

    // Черновик (чат с этим пользователем ещё не создан) — создаём чат и шлём
    // первое сообщение через REST, затем переходим на его реальный URL.
    if (newUserId) {
      try {
        const newChatId = await createDirectChat(newUserId)
        await sendMessageRest(newChatId, text)
        await loadChats()
        navigate(`/chats/${newChatId}`, { replace: true, state: { focusInput: true } })
      } catch {
        showToast(t('messenger.sendFailed'))
      }
      return
    }

    if (!id) return
    send(id, text, signalRSend, meSender, replyTo)
  }

  async function handleSendFiles(files: File[], caption: string | undefined, onUploadProgress?: (percent: number) => void) {
    // Черновик — как и в handleSend, сначала создаём чат (один раз, а не по разу на файл —
    // все файлы уходят одним запросом, поэтому гонки параллельных createDirectChat здесь нет);
    // ошибки здесь и ниже ловит сам ChatWindow (см. send() там) и показывает модалку ошибки
    if (newUserId) {
      const newChatId = await createDirectChat(newUserId)
      await sendFiles(newChatId, files, caption, meSender, onUploadProgress)
      await loadChats()
      navigate(`/chats/${newChatId}`, { replace: true })
      return
    }

    if (!id) return
    await sendFiles(id, files, caption, meSender, onUploadProgress)
  }

  function handleRetrySend(msg: Parameters<typeof retry>[1]) {
    if (!id) return
    retry(id, msg, signalRSend)
  }

  async function handleDeleteMessage(msg: Message) {
    if (!id) return
    // Сообщение без messageId (не отправилось / ещё отправляется) не существует на сервере —
    // удаляем локально, без запроса
    if (!msg.messageId) { removeLocalMessage(id, msg); return }
    try {
      await deleteMessage(id, msg)
    } catch {
      showToast(t('messenger.deleteMessageFailed'))
    }
  }

  async function handleEditMessage(msg: Message, newText: string) {
    if (!id) return
    try {
      await editMessage(id, msg, newText)
    } catch {
      showToast(t('messenger.editMessageFailed'))
    }
  }

  async function handleBulkDeleteMessages(msgs: Message[]) {
    if (!id) return
    try {
      await deleteMessages(id, msgs)
    } catch {
      showToast(t('messenger.deleteMessageFailed'))
    }
  }

  async function handleForwardConfirm(targetChatId: string) {
    if (!forwardState) return
    const { sourceChatId, messages: msgs } = forwardState
    const messageIds = msgs.map(m => m.messageId).filter((mid): mid is string => !!mid)
    setForwardState(null)
    try {
      await forwardMessagesApi(targetChatId, sourceChatId, messageIds)
    } catch {
      showToast(t('messenger.forwardMessageFailed'))
    }
  }

  async function handleDeleteChat() {
    if (!id) return
    try {
      await deleteChat(id)
      removeChat(id)
      navigate('/chats')
    } catch {
      showToast(t('messenger.deleteChatFailed'))
    }
  }

  // createDirectChat идемпотентен — если чат с этим пользователем уже есть, просто вернёт его id
  async function handleOpenDirectChat(userId: string) {
    setModalUser(null)
    try {
      const chatId = await createDirectChat(userId)
      await loadChats()
      navigate(`/chats/${chatId}`)
    } catch {
      showToast(t('messenger.openChatFailed'))
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
      showToast(t('messenger.leaveGroupFailed'))
    }
  }

  async function handleCreateGroup(name: string, memberIds: string[], avatarColor: string, avatarFile?: File) {
    const newChatId = await createGroupChat(name, memberIds, avatarColor)
    if (avatarFile) await uploadChatAvatar(newChatId, avatarFile).catch(() => {})
    await loadChats()
    setNewGroupModalOpen(false)
    navigate(`/chats/${newChatId}`)
  }

  async function handleAddMemberSelect(user: UserSearchResult) {
    if (!id) return
    try {
      await addChatMember(id, user.userId)
      setAddMemberModalOpen(false)
      await loadGroupMembers(id)
    } catch {
      showToast(t('messenger.addMemberFailed'))
    }
  }

  async function handleEditGroupSave(name: string, avatarColor: string) {
    if (!id) return
    await updateChat(id, { name, avatarColor })
    await loadChats()
    setEditGroupModalOpen(false)
  }

  async function handleRemoveMember(userId: string) {
    if (!id) return
    try {
      await leaveGroupChat(id, userId)
      await loadGroupMembers(id)
    } catch {
      showToast(t('messenger.removeMemberFailed'))
    }
  }

  async function handleSetMemberRole(userId: string, role: 'admin' | 'member') {
    if (!id) return
    try {
      await setMemberRole(id, userId, role)
      updateMemberRoleLocally(userId, role)
    } catch {
      showToast(t('messenger.setMemberRoleFailed'))
    }
  }

  function discardInputHistoryLayer() {
    window.dispatchEvent(new Event('messenger:discard-input-history'))
  }

  function navigateToUserChat(user: UserSearchResult) {
    discardInputHistoryLayer()

    const existing = chats.find(c => c.otherUserId === user.userId)
    if (existing) {
      navigate(`/chats/${existing.id}`)
    } else {
      navigate(`/chats/new/${user.userId}`, {
        state: { displayName: user.displayName, avatarUrl: user.avatarUrl, avatarColor: user.avatarColor, login: user.login } satisfies DraftUserState,
      })
    }
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
          name: draftUser?.displayName ?? t('messenger.newChatDraftName'),
          initials: getInitials(draftUser?.displayName ?? null),
          color: draftUser?.avatarColor ?? colorFromId(newUserId),
          avatarUrl: draftUser?.avatarUrl ?? null,
          online: draftOnline,
          group: false,
          otherUserId: newUserId,
        }
      : null

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
              ? <AvatarImage src={profile.avatarUrl} alt={profileInitials} className={s.topBarUserImg} />
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
          activeId={chatId}
          filter={filter}
          query={query}
          onFilterChange={setFilter}
          onQueryChange={setQuery}
          onSelect={cid => {
            discardInputHistoryLayer()
            navigate(`/chats/${cid}`)
          }}
          onNewChat={() => setNewGroupModalOpen(true)}
          onUserClick={userId => {
            const chat = chats.find(c => c.otherUserId === userId)
            openUserModal(userId, chat?.name ?? '', onlineStatuses[userId] ?? false)
          }}
          onUserSelect={user => { setQuery(''); navigateToUserChat(user) }}
        />

        <main className={`${s.content}${!inChatView ? ` ${s.contentMobileHidden}` : ''}`}>
          {chatId && meta ? (
            <ChatWindow
              key={chatId}
              chatId={chatId}
              meta={meta}
              messages={messages}
              otherReadAt={activeChat?.otherReadAt ?? null}
              meSender={meSender}
              typingChats={typingIndicator.typingChats}
              loadingHistory={loadingHistory}
              historyLoaded={historyLoaded}
              loadingInitial={loadingInitial}
              loadError={loadError}
              onRetryLoad={retryLoadInitial}
              messagesRef={messagesRef}
              topSentinelRef={topSentinelRef}
              bottomRef={bottomRef}
              onSend={handleSend}
              onSendFiles={handleSendFiles}
              onRetry={handleRetrySend}
              onDelete={handleDeleteMessage}
              onEdit={handleEditMessage}
              onReact={(msg, emoji) => { if (id) void setMessageReaction(id, msg, emoji) }}
              onBulkDelete={handleBulkDeleteMessages}
              onForward={msgs => { if (id) setForwardState({ sourceChatId: id, messages: msgs }) }}
              onTyping={typingIndicator.handleOwnTyping}
              onBack={() => { discardInputHistoryLayer(); navigate('/chats') }}
              onHeaderClick={() => {
                // Открытие карточки группы — повод перезапросить участников заново, а не
                // показывать закэшированный groupMembers: он не обновляется сам по себе, если
                // кто-то (в т.ч. я сам) поменял имя/аватар/цвет, не меняя при этом состав чата
                if (meta.group) { setGroupModalOpen(true); if (id) loadGroupMembers(id); return }
                if (meta.otherUserId) { setModalUserIsChatPartner(true); openUserModal(meta.otherUserId, meta.name, meta.online) }
              }}
              onAvatarClick={msg => { setModalUserIsChatPartner(false); openUserModal(msg.senderId, msg.senderName, onlineStatuses[msg.senderId] ?? false) }}
              onForwardedUserClick={(userId, name) => { setModalUserIsChatPartner(false); openUserModal(userId, name, onlineStatuses[userId] ?? false) }}
              shouldAutoFocus={focusInput}
              canDeleteMessages={canDeleteMessages}
            />
          ) : (
            <div className={s.placeholder}>
              <div className={s.placeholderIcon}>💬</div>
              <h3 className={s.placeholderTitle}>{t('messenger.selectChatTitle')}</h3>
              <p className={s.placeholderText}>{t('messenger.selectChatText')}</p>
            </div>
          )}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className={`${s.bottomNav}${inChatView ? ` ${s.bottomNavHidden}` : ''}`}>
        <button className={`${s.bnItem} ${s.bnItemActive}`} onClick={() => navigate('/chats')}>
          <span className={s.bnGlyph}>💬{totalUnread > 0 && <span className={s.bnBadge}>{totalUnread}</span>}</span>
          <span>{t('profile.chats')}</span>
        </button>
        <button className={s.bnItem} onClick={() => setProfileOpen(true)}>
          <span
            className={s.bnAvatarMini}
            style={profile?.avatarUrl ? undefined : { background: profile?.avatarColor }}
          >
            {profile?.avatarUrl
              ? <AvatarImage src={profile.avatarUrl} alt={profileInitials} className={s.bnAvatarMiniImg} />
              : profileInitials
            }
          </span>
          <span>{t('profile.profile')}</span>
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
        onMessage={modalUser?.userId && modalUser.userId !== profile?.userId
          ? () => handleOpenDirectChat(modalUser.userId!)
          : undefined}
      />

      {id && meta && (
        <GroupModal
          isOpen={groupModalOpen}
          chatId={id}
          meta={meta}
          members={groupMembers}
          membersLoading={groupMembersLoading}
          currentUserId={profile?.userId}
          onClose={() => setGroupModalOpen(false)}
          onMemberClick={user => { setGroupModalOpen(false); setModalUserIsChatPartner(false); setModalUser(user) }}
          onLeave={handleLeaveGroup}
          onAddMember={() => setAddMemberModalOpen(true)}
          onEditGroup={() => setEditGroupModalOpen(true)}
          onRemoveMember={handleRemoveMember}
          onSetMemberRole={handleSetMemberRole}
        />
      )}

      <NewGroupModal
        isOpen={newGroupModalOpen}
        onClose={() => setNewGroupModalOpen(false)}
        onCreate={handleCreateGroup}
      />

      {id && meta && (
        <EditGroupModal
          isOpen={editGroupModalOpen}
          chatId={id}
          currentName={meta.name}
          currentAvatarUrl={meta.avatarUrl}
          currentColor={meta.color}
          onClose={() => setEditGroupModalOpen(false)}
          onSave={handleEditGroupSave}
          onAvatarUploaded={() => loadChats()}
        />
      )}

      <AddMemberModal
        isOpen={addMemberModalOpen}
        excludeUserIds={groupMembers.map(m => m.userId)}
        onClose={() => setAddMemberModalOpen(false)}
        onSelect={handleAddMemberSelect}
      />

      <ForwardModal
        messages={forwardState?.messages ?? null}
        onClose={() => setForwardState(null)}
        onConfirm={handleForwardConfirm}
      />

    </div>
  )
}

export default MessengerPage
