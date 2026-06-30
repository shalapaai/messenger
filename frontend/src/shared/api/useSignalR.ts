import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { signalR, type IncomingMessage, type MessageEdited, type MessageDeleted, type TypingEvent, type UserOnlineEvent } from './signalrClient'
import { useConnectionStore, type ConnectionStatus } from './connectionStore'

export type { ConnectionStatus }

interface UseSignalROptions {
  chatId?: string
  onMessage?: (msg: IncomingMessage) => void
  onMessageEdited?: (event: MessageEdited) => void
  onMessageDeleted?: (event: MessageDeleted) => void
  onTyping?: (event: TypingEvent) => void
  onStoppedTyping?: (event: TypingEvent) => void
  onUserOnline?: (event: UserOnlineEvent) => void
}

export function useSignalR(options: UseSignalROptions = {}) {
  const status = useConnectionStore((s) => s.status)
  const optionsRef = useRef(options)
  useLayoutEffect(() => { optionsRef.current = options })

  // ── Подписка на чат при смене chatId ─────────────────────────────────────
  // Группу НЕ покидаем при смене/размонтировании: ConnectedLayout держит
  // соединение во всех чатах пользователя постоянно (фоновые realtime-обновления
  // списка и кэша сообщений). joinChat здесь — подстраховка для чата, которого
  // ещё нет в сторе (например, только что созданного).
  useEffect(() => {
    const { chatId } = optionsRef.current
    if (!chatId || !signalR.isConnected) return

    signalR.joinChat(chatId).catch(() => {})
  }, [options.chatId, status])

  // ── Подписки на события ───────────────────────────────────────────────────
  useEffect(() => {
    const off = [
      options.onMessage       && signalR.onReceiveMessage(options.onMessage),
      options.onMessageEdited  && signalR.onMessageEdited(options.onMessageEdited),
      options.onMessageDeleted && signalR.onMessageDeleted(options.onMessageDeleted),
      options.onTyping        && signalR.onUserTyping(options.onTyping),
      options.onStoppedTyping && signalR.onUserStoppedTyping(options.onStoppedTyping),
      options.onUserOnline    && signalR.onUserOnline(options.onUserOnline),
    ].filter(Boolean) as Array<() => void>

    return () => off.forEach(fn => fn())
  }, [options.onMessage, options.onMessageEdited, options.onMessageDeleted, options.onTyping, options.onStoppedTyping, options.onUserOnline])

  const sendMessage = useCallback((content: string, replyToMessageId?: string) => {
    const { chatId } = optionsRef.current
    return chatId ? signalR.sendMessage(chatId, content, replyToMessageId) : Promise.reject()
  }, [])

  const startTyping = useCallback(() => {
    const { chatId } = optionsRef.current
    if (chatId) signalR.startTyping(chatId)
  }, [])

  const stopTyping = useCallback(() => {
    const { chatId } = optionsRef.current
    if (chatId) signalR.stopTyping(chatId)
  }, [])

  return { status, sendMessage, startTyping, stopTyping }
}
