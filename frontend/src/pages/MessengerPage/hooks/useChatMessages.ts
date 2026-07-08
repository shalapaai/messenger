import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Message, Sender } from '../../../shared/types/messenger'
import { fetchMessages, initials, nextMessageId } from '../../../shared/api/chatsApi'
import { deleteMessage as deleteMessageApi, deleteMessages as deleteMessagesApi, editMessage as editMessageApi, setMessageReaction as setMessageReactionApi, uploadChatMessageFiles } from '../../../shared/api/messagesApi'
import { getMyUserId } from '../../../shared/lib/auth/authTokens'
import type { IncomingMessage, MessageDeleted, MessageEdited, MessageReactionChanged, UserProfileUpdatedEvent } from '../../../shared/api/signalrClient'
import { formatMessageTime } from '../../../shared/lib/formatDateTime'

type SendFn = (content: string, replyToMessageId?: string) => Promise<{ messageId: string }>

// должно совпадать с MessagePreview.MaxLength на бэкенде (GetMessagesQueryHandler/MessageSentEventHandler) —
// цитата в ответе живая: показывает текущий текст оригинала, обрезанный так же, как при отправке/загрузке истории
const REPLY_PREVIEW_MAX_LENGTH = 120

function truncateReplyPreview(content: string): string {
  return content.length <= REPLY_PREVIEW_MAX_LENGTH ? content : content.slice(0, REPLY_PREVIEW_MAX_LENGTH) + '…'
}

interface UseChatMessagesOptions {
  /** Новое сообщение добавлено в текущий открытый чат — повод проскроллить вниз */
  onAppend?: (smooth: boolean) => void
  /** Пришло чужое realtime-сообщение в чат, который открыт прямо сейчас — повод отметить чат прочитанным */
  onIncomingRead?: (chatId: string) => void
}

export function useChatMessages(id: string | undefined, opts: UseChatMessagesOptions = {}) {
  const [chatMessages,   setChatMessages]   = useState<Record<string, Message[]>>({})
  const [loadingInitial, setLoadingInitial] = useState<Record<string, boolean>>({})
  const [loadError,      setLoadError]      = useState<Record<string, boolean>>({})
  const [nextCursor,     setNextCursor]     = useState<Record<string, string | null>>({})
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [historyLoaded,  setHistoryLoaded]  = useState<Record<string, boolean>>({})

  const rawMessages = id ? chatMessages[id] : undefined
  // Финальный предохранитель от дублей: гонка между optimistic-вставкой, историей и повторной
  // realtime-доставкой может дать два сообщения с одним messageId — оставляем первое.
  const messages = useMemo(() => {
    if (!rawMessages) return []
    const seenMessageIds = new Set<string>()
    return rawMessages.filter(m => {
      if (!m.messageId) return true
      if (seenMessageIds.has(m.messageId)) return false
      seenMessageIds.add(m.messageId)
      return true
    })
  }, [rawMessages])

  const loadInitial = useCallback((chatId: string) => {
    setLoadingInitial(prev => ({ ...prev, [chatId]: true }))
    setLoadError(prev => ({ ...prev, [chatId]: false }))

    fetchMessages(chatId).then(({ messages: loaded, nextCursor: cursor }) => {
      setChatMessages(prev => ({ ...prev, [chatId]: loaded }))
      setNextCursor(prev => ({ ...prev, [chatId]: cursor }))
      setHistoryLoaded(prev => ({ ...prev, [chatId]: cursor === null }))
      setLoadingInitial(prev => ({ ...prev, [chatId]: false }))
    }).catch(() => {
      setLoadError(prev => ({ ...prev, [chatId]: true }))
      setLoadingInitial(prev => ({ ...prev, [chatId]: false }))
    })
  }, [])

  useEffect(() => {
    if (!id) return
    if (chatMessages[id] || loadingInitial[id]) return

    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) loadInitial(id)
    })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const handleIncomingMessage = useCallback((msg: IncomingMessage) => {
    // Обычное свое сообщение уже показал optimistic-UI в send() — этот echo игнорируем.
    // Исключение — пересылка и системные события: у них нет локального оптимистичного добавления.
    if (msg.senderId === getMyUserId() && !msg.forwardedFromUserId && msg.kind !== 'System') return

    setChatMessages(prev => {
      // если чат ещё не открывали — его историю подтянет fetchMessages при открытии
      const chatMsgs = prev[msg.chatId]
      if (!chatMsgs) return prev
      // сервер шлёт ReceiveMessage и в группу чата, и в личную группу участника —
      // если получатель уже состоит в обеих (обычное дело), событие приходит дважды
      if (chatMsgs.some(m => m.messageId === msg.messageId)) return prev

      const own = msg.senderId === getMyUserId()
      return {
        ...prev,
        [msg.chatId]: [...chatMsgs, {
          id:              nextMessageId(),
          messageId:       msg.messageId,
          text:            msg.content,
          own,
          senderId:        msg.senderId,
          senderName:      msg.senderName,
          senderInitials:  initials(msg.senderName),
          senderColor:     msg.senderAvatarColor,
          senderAvatarUrl: msg.senderAvatarUrl,
          time:            formatMessageTime(msg.sentAt),
          sentAt:          msg.sentAt,
          // Свои сообщения сюда попадают только пересланными — сервер уже подтвердил отправку, значит статус сразу 'sent'.
          status:          own ? 'sent' as const : undefined,
          attachments:     msg.attachments,
          forwardedFromUserId:   msg.forwardedFromUserId ?? undefined,
          forwardedFromUserName: msg.forwardedFromUserName ?? undefined,
          replyToMessageId:   msg.replyToMessageId ?? undefined,
          replyToSenderName:  msg.replyToSenderName ?? undefined,
          replyToContent:     msg.replyToContent,
          kind:            msg.kind,
          systemEventType: msg.systemEventType ?? undefined,
          targetUserId:    msg.targetUserId ?? undefined,
          targetUserName:  msg.targetUserName ?? undefined,
          reactions:       [],
        }],
      }
    })

    if (msg.chatId === id) {
      opts.onAppend?.(true)
      opts.onIncomingRead?.(msg.chatId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const handleDeletedMessage = useCallback((event: MessageDeleted) => {
    setChatMessages(prev => {
      const chatMsgs = prev[event.chatId]
      if (!chatMsgs) return prev
      return {
        ...prev,
        // цитата — живая ссылка на оригинал: если он удалён, ответы на него сразу показывают
        // плейсхолдер "Исходное сообщение удалено" вместо застрявшего старого текста
        [event.chatId]: chatMsgs
          .filter(m => m.messageId !== event.messageId)
          .map(m => m.replyToMessageId === event.messageId ? { ...m, replyToContent: null } : m),
      }
    })
  }, [])

  const deleteMessage = useCallback(async (chatId: string, msg: Message) => {
    if (!msg.messageId) return
    await deleteMessageApi(chatId, msg.messageId)
    setChatMessages(prev => ({
      ...prev,
      [chatId]: (prev[chatId] ?? []).filter(m => m.id !== msg.id),
    }))
  }, [])

  // Сообщение без messageId (ещё не подтверждено сервером — pending/failed) никогда там не
  // существовало, удалять его через API нечего: просто убираем локальный черновик из состояния
  const removeLocalMessage = useCallback((chatId: string, msg: Message) => {
    setChatMessages(prev => ({
      ...prev,
      [chatId]: (prev[chatId] ?? []).filter(m => m.id !== msg.id),
    }))
  }, [])

  const deleteMessages = useCallback(async (chatId: string, msgs: Message[]) => {
    const messageIds = msgs.map(m => m.messageId).filter((mid): mid is string => !!mid)
    if (messageIds.length === 0) return
    await deleteMessagesApi(chatId, messageIds)
    const localIds = new Set(msgs.map(m => m.id))
    setChatMessages(prev => ({
      ...prev,
      [chatId]: (prev[chatId] ?? []).filter(m => !localIds.has(m.id)),
    }))
  }, [])

  const handleEditedMessage = useCallback((event: MessageEdited) => {
    setChatMessages(prev => {
      const chatMsgs = prev[event.chatId]
      if (!chatMsgs) return prev
      const replyPreview = truncateReplyPreview(event.newContent)
      return {
        ...prev,
        // Цитата — живая ссылка на оригинал: правим и текст, и превью у всех ответов на него.
        [event.chatId]: chatMsgs.map(m => {
          if (m.messageId === event.messageId) return { ...m, text: event.newContent, edited: true }
          if (m.replyToMessageId === event.messageId) return { ...m, replyToContent: replyPreview }
          return m
        }),
      }
    })
  }, [])

  // Имя/аватар/цвет денормализованы в каждое сообщение — патчим все закэшированные чаты, не
  // только открытый, иначе сообщения так и останутся со старыми данными.
  const handleUserProfileUpdated = useCallback((event: UserProfileUpdatedEvent) => {
    setChatMessages(prev => {
      let changed = false
      const next: typeof prev = {}
      for (const [chatId, msgs] of Object.entries(prev)) {
        next[chatId] = msgs.map(m => {
          if (m.senderId === event.userId) {
            changed = true
            return {
              ...m,
              senderName:      event.displayName,
              senderInitials:  initials(event.displayName),
              senderColor:     event.avatarColor,
              senderAvatarUrl: event.avatarUrl,
            }
          }
          if (m.forwardedFromUserId === event.userId) {
            changed = true
            return { ...m, forwardedFromUserName: event.displayName }
          }
          return m
        })
      }
      return changed ? next : prev
    })
  }, [])

  const handleReactionChanged = useCallback((event: MessageReactionChanged) => {
    setChatMessages(prev => {
      const chatMsgs = prev[event.chatId]
      if (!chatMsgs) return prev

      return {
        ...prev,
        [event.chatId]: chatMsgs.map(m => {
          if (m.messageId !== event.messageId) return m

          const currentReactions = m.reactions ?? []
          const withoutUserReaction = currentReactions.filter(r => r.userId !== event.userId)

          return {
            ...m,
            reactions: event.emoji
              ? [
                  ...withoutUserReaction,
                  {
                    userId: event.userId,
                    userName: event.userName,
                    userAvatarUrl: event.userAvatarUrl,
                    userAvatarColor: event.userAvatarColor,
                    emoji: event.emoji,
                  },
                ]
              : withoutUserReaction,
          }
        }),
      }
    })
  }, [])

  const setMessageReaction = useCallback(async (chatId: string, msg: Message, emoji: string | null) => {
    if (!msg.messageId) return
    await setMessageReactionApi(chatId, msg.messageId, emoji)
  }, [])

  const editMessage = useCallback(async (chatId: string, msg: Message, newText: string) => {
    if (!msg.messageId) return
    await editMessageApi(chatId, msg.messageId, newText)
    setChatMessages(prev => ({
      ...prev,
      [chatId]: (prev[chatId] ?? []).map(m =>
        m.id === msg.id ? { ...m, text: newText, edited: true } : m
      ),
    }))
  }, [])

  const loadMoreHistory = useCallback((
    onBeforePrepend: () => void,
    onAfterPrepend: () => void,
  ) => {
    if (!id || loadingHistory || historyLoaded[id]) return
    setLoadingHistory(true)
    onBeforePrepend()

    // Страница целиком из удалённых даёт messages.length === 0 при непустом nextCursor, и
    // IntersectionObserver больше не сработает — тянем страницы подряд, пока не найдём видимое.
    async function fetchUntilVisible(before: string | null) {
      const { messages: older, nextCursor: cursor } = await fetchMessages(id!, { before })
      setNextCursor(prev => ({ ...prev, [id!]: cursor }))

      if (older.length > 0) {
        setChatMessages(prev => ({ ...prev, [id!]: [...older, ...(prev[id!] ?? [])] }))
        onAfterPrepend()
        setHistoryLoaded(prev => ({ ...prev, [id!]: cursor === null }))
        return
      }

      if (cursor === null) {
        setHistoryLoaded(prev => ({ ...prev, [id!]: true }))
        return
      }

      await fetchUntilVisible(cursor)
    }

    fetchUntilVisible(nextCursor[id]).finally(() => setLoadingHistory(false))
  }, [id, loadingHistory, historyLoaded, nextCursor])

  const doSend = useCallback(async (chatId: string, text: string, tempId: number, signalRSend: SendFn, replyToMessageId?: string) => {
    try {
      const { messageId } = await signalRSend(text, replyToMessageId)
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
  }, [])

  const send = useCallback((chatId: string, text: string, signalRSend: SendFn, meSender: Sender, replyTo?: Message) => {
    const tempId = nextMessageId()
    const now = new Date()
    const newMsg: Message = {
      ...meSender, id: tempId, text,
      time: formatMessageTime(now.toISOString()),
      sentAt: now.toISOString(),
      status: 'pending',
      replyToMessageId:  replyTo?.messageId,
      replyToSenderName: replyTo?.senderName,
      replyToContent:    replyTo?.text,
      reactions: [],
    }
    setChatMessages(prev => ({ ...prev, [chatId]: [...(prev[chatId] ?? []), newMsg] }))
    opts.onAppend?.(true)
    doSend(chatId, text, tempId, signalRSend, replyTo?.messageId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doSend])

  // Файлы шлём через REST (SignalR не годится для бинарных данных) — без pending→sent, bubble
  // сразу с готовым результатом. SignalR-эхо дедуплицируется по messageId в handleIncomingMessage.
  const sendFiles = useCallback(async (
    chatId: string, files: File[], caption: string | undefined, meSender: Sender,
    onUploadProgress?: (percent: number) => void,
  ) => {
    const result = await uploadChatMessageFiles(chatId, files, caption, onUploadProgress)
    const newMsg: Message = {
      ...meSender,
      id:          nextMessageId(),
      messageId:   result.messageId,
      text:        result.content,
      time:        formatMessageTime(result.sentAt),
      sentAt:      result.sentAt,
      status:      'sent',
      attachments: result.attachments.map(a => ({
        fileUrl:         a.fileUrl,
        fileName:        a.fileName,
        fileContentType: a.contentType,
        fileSizeBytes:   a.fileSizeBytes,
      })),
      reactions: [],
    }
    setChatMessages(prev => {
      const chatMsgs = prev[chatId] ?? []
      // На черновом чате история могла уже подгрузиться (с этим же сообщением) раньше этого
      // колбэка — порядок между async-цепочками не гарантирован, дедуплицируем по messageId.
      if (chatMsgs.some(m => m.messageId === newMsg.messageId)) return prev
      return { ...prev, [chatId]: [...chatMsgs, newMsg] }
    })
    opts.onAppend?.(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const retry = useCallback((chatId: string, msg: Message, signalRSend: SendFn) => {
    setChatMessages(prev => ({
      ...prev,
      [chatId]: (prev[chatId] ?? []).map(m =>
        m.id === msg.id ? { ...m, status: 'pending' as const } : m
      ),
    }))
    doSend(chatId, msg.text, msg.id, signalRSend, msg.replyToMessageId)
  }, [doSend])

  return {
    messages,
    // Пока chatMessages[id] не задан и не было ошибки — считаем это загрузкой, не "сообщений нет":
    // иначе на первом рендере после смены id мелькает пустая заглушка вместо скелетона.
    loadingInitial: id ? (chatMessages[id] === undefined ? !loadError[id] : !!loadingInitial[id]) : false,
    loadError:      id ? !!loadError[id] : false,
    retryLoadInitial: () => id && loadInitial(id),
    handleIncomingMessage,
    handleDeletedMessage,
    handleEditedMessage,
    handleUserProfileUpdated,
    handleReactionChanged,
    loadMoreHistory,
    loadingHistory,
    historyLoaded: id ? !!historyLoaded[id] : false,
    send,
    sendFiles,
    retry,
    deleteMessage,
    removeLocalMessage,
    deleteMessages,
    editMessage,
    setMessageReaction,
  }
}
