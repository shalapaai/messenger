import { useCallback, useEffect, useState } from 'react'
import type { Message, Sender } from '../../../shared/types/messenger'
import { fetchMessages, initials, nextMessageId } from '../../../shared/api/chatsApi'
import { getMyUserId } from '../../../shared/lib/auth/authTokens'
import type { IncomingMessage } from '../../../shared/api/signalrClient'

type SendFn = (content: string) => Promise<{ messageId: string }>

interface UseChatMessagesOptions {
  /** Новое сообщение добавлено в текущий открытый чат — повод проскроллить вниз */
  onAppend?: (smooth: boolean) => void
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

  const messages = id ? (chatMessages[id] ?? []) : []

  const loadInitial = useCallback((chatId: string) => {
    setLoadingInitial(prev => ({ ...prev, [chatId]: true }))
    setLoadError(prev => ({ ...prev, [chatId]: false }))

    fetchMessages(chatId).then(({ messages: loaded, nextCursor: cursor }) => {
      setChatMessages(prev => ({ ...prev, [chatId]: loaded }))
      setNextCursor(prev => ({ ...prev, [chatId]: cursor }))
      setHistoryLoaded(prev => ({ ...prev, [chatId]: cursor === null }))
      setLoadingInitial(prev => ({ ...prev, [chatId]: false }))
      opts.onAppend?.(false)
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
    if (msg.senderId === getMyUserId()) return

    setChatMessages(prev => {
      // если чат ещё не открывали — его историю подтянет fetchMessages при открытии
      if (!prev[msg.chatId]) return prev
      return {
        ...prev,
        [msg.chatId]: [...prev[msg.chatId], {
          id:              nextMessageId(),
          text:            msg.content,
          own:             false,
          senderId:        msg.senderId,
          senderName:      msg.senderName,
          senderInitials:  initials(msg.senderName),
          senderColor:     msg.senderAvatarColor,
          senderAvatarUrl: msg.senderAvatarUrl,
          time:            new Date(msg.sentAt).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }),
          date:            'Сегодня',
        }],
      }
    })

    if (msg.chatId === id) opts.onAppend?.(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const loadMoreHistory = useCallback((
    onBeforePrepend: () => void,
    onAfterPrepend: () => void,
  ) => {
    if (!id || loadingHistory || historyLoaded[id]) return
    setLoadingHistory(true)
    onBeforePrepend()

    fetchMessages(id, { before: nextCursor[id] }).then(({ messages: older, nextCursor: cursor }) => {
      if (older.length > 0) {
        setChatMessages(prev => ({ ...prev, [id]: [...older, ...(prev[id] ?? [])] }))
        onAfterPrepend()
      }
      setNextCursor(prev => ({ ...prev, [id]: cursor }))
      setHistoryLoaded(prev => ({ ...prev, [id]: cursor === null }))
    }).finally(() => setLoadingHistory(false))
  }, [id, loadingHistory, historyLoaded, nextCursor])

  const doSend = useCallback(async (chatId: string, text: string, tempId: number, signalRSend: SendFn) => {
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
  }, [])

  const send = useCallback((chatId: string, text: string, signalRSend: SendFn, meSender: Sender) => {
    const tempId = nextMessageId()
    const newMsg: Message = {
      ...meSender, id: tempId, text,
      time: new Date().toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }),
      date: 'Сегодня',
      status: 'pending',
    }
    setChatMessages(prev => ({ ...prev, [chatId]: [...(prev[chatId] ?? []), newMsg] }))
    opts.onAppend?.(true)
    doSend(chatId, text, tempId, signalRSend)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doSend])

  const retry = useCallback((chatId: string, msg: Message, signalRSend: SendFn) => {
    setChatMessages(prev => ({
      ...prev,
      [chatId]: (prev[chatId] ?? []).map(m =>
        m.id === msg.id ? { ...m, status: 'pending' as const } : m
      ),
    }))
    doSend(chatId, msg.text, msg.id, signalRSend)
  }, [doSend])

  return {
    messages,
    loadingInitial: id ? !!loadingInitial[id] : false,
    loadError:      id ? !!loadError[id] : false,
    retryLoadInitial: () => id && loadInitial(id),
    handleIncomingMessage,
    loadMoreHistory,
    loadingHistory,
    historyLoaded: id ? !!historyLoaded[id] : false,
    send,
    retry,
  }
}
