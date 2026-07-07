import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Message, Sender } from '../../../shared/types/messenger'
import { fetchMessages, initials, nextMessageId } from '../../../shared/api/chatsApi'
import { deleteMessage as deleteMessageApi, deleteMessages as deleteMessagesApi, editMessage as editMessageApi, uploadChatMessageFiles } from '../../../shared/api/messagesApi'
import { getMyUserId } from '../../../shared/lib/auth/authTokens'
import type { IncomingMessage, MessageDeleted, MessageEdited, UserProfileUpdatedEvent } from '../../../shared/api/signalrClient'
import i18n, { getCurrentLocale } from '../../../shared/i18n'

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

/**
 * Владеет содержимым переписок: загрузка истории (с реальной cursor-пагинацией),
 * приём realtime-сообщений, отправка с оптимистичным UI и ретраем.
 *
 * Если чат не загрузился — отдаёт loadError; UI показывает ошибку с кнопкой «Повторить».
 */
export function useChatMessages(id: string | undefined, opts: UseChatMessagesOptions = {}) {
  const [chatMessages,   setChatMessages]   = useState<Record<string, Message[]>>({})
  const [loadingInitial, setLoadingInitial] = useState<Record<string, boolean>>({})
  const [loadError,      setLoadError]      = useState<Record<string, boolean>>({})
  const [nextCursor,     setNextCursor]     = useState<Record<string, string | null>>({})
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [historyLoaded,  setHistoryLoaded]  = useState<Record<string, boolean>>({})

  const rawMessages = id ? chatMessages[id] : undefined
  // Финальный предохранитель от дублей на рендере — независимо от того, ИЗ-ЗА ЧЕГО в массиве
  // оказались две записи с одним messageId (гонка между оптимистичной вставкой и подгрузкой
  // истории, повторная realtime-доставка и т.п.), на экране всегда будет только первая из них
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // Своё сообщение уже показал optimistic-UI в send() — этот echo игнорируем, кроме пересылки:
    // у неё нет локального добавления, свою же копию показываем именно по этому событию
    if (msg.senderId === getMyUserId() && !msg.forwardedFromUserId) return

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
          time:            new Date(msg.sentAt).toLocaleTimeString(getCurrentLocale(), { hour: '2-digit', minute: '2-digit' }),
          sentAt:          msg.sentAt,
          date:            i18n.t('common.today'),
          // свои сообщения сюда попадают только пересланными (см. guard выше) — сервер уже
          // подтвердил отправку, значит статус сразу 'sent', иначе галочка никогда бы не появилась
          status:          own ? 'sent' as const : undefined,
          attachments:     msg.attachments,
          forwardedFromUserId:   msg.forwardedFromUserId ?? undefined,
          forwardedFromUserName: msg.forwardedFromUserName ?? undefined,
          replyToMessageId:   msg.replyToMessageId ?? undefined,
          replyToSenderName:  msg.replyToSenderName ?? undefined,
          replyToContent:     msg.replyToContent,
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

  // Имя/аватарка/цвет отправителя денормализованы в каждое сообщение на момент его получения —
  // патчим уже загруженную историю по всем закэшированным чатам (не только открытому), иначе
  // сообщения от этого пользователя так и останутся со старыми данными до следующей загрузки истории.
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
      time: now.toLocaleTimeString(getCurrentLocale(), { hour: '2-digit', minute: '2-digit' }),
      sentAt: now.toISOString(),
      date: i18n.t('common.today'),
      status: 'pending',
      replyToMessageId:  replyTo?.messageId,
      replyToSenderName: replyTo?.senderName,
      replyToContent:    replyTo?.text,
    }
    setChatMessages(prev => ({ ...prev, [chatId]: [...(prev[chatId] ?? []), newMsg] }))
    opts.onAppend?.(true)
    doSend(chatId, text, tempId, signalRSend, replyTo?.messageId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doSend])

  // Файлы шлём через REST (SignalR не годится для бинарных данных), поэтому, в отличие от send(),
  // тут нет pending→sent: bubble добавляется сразу с готовым результатом. Эхо этого же сообщения
  // по SignalR дедуплицируется по messageId в handleIncomingMessage — двойного бабла не будет.
  const sendFiles = useCallback(async (
    chatId: string, files: File[], caption: string | undefined, meSender: Sender,
    onUploadProgress?: (percent: number) => void,
  ) => {
    const result = await uploadChatMessageFiles(chatId, files, caption, onUploadProgress)
    const sentDate = new Date(result.sentAt)
    const newMsg: Message = {
      ...meSender,
      id:          nextMessageId(),
      messageId:   result.messageId,
      text:        result.content,
      time:        sentDate.toLocaleTimeString(getCurrentLocale(), { hour: '2-digit', minute: '2-digit' }),
      sentAt:      result.sentAt,
      date:        i18n.t('common.today'),
      status:      'sent',
      attachments: result.attachments.map(a => ({
        fileUrl:         a.fileUrl,
        fileName:        a.fileName,
        fileContentType: a.contentType,
        fileSizeBytes:   a.fileSizeBytes,
      })),
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
    loadingInitial: id ? !!loadingInitial[id] : false,
    loadError:      id ? !!loadError[id] : false,
    retryLoadInitial: () => id && loadInitial(id),
    handleIncomingMessage,
    handleDeletedMessage,
    handleEditedMessage,
    handleUserProfileUpdated,
    loadMoreHistory,
    loadingHistory,
    historyLoaded: id ? !!historyLoaded[id] : false,
    send,
    sendFiles,
    retry,
    deleteMessage,
    deleteMessages,
    editMessage,
  }
}
