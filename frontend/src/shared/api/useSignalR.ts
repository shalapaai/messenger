import { useEffect, useLayoutEffect, useRef } from 'react'
import { signalR, type IncomingMessage, type MessageEdited, type TypingEvent, type UserOnlineEvent } from './signalrClient'
import { useConnectionStore, type ConnectionStatus } from './connectionStore'

export type { ConnectionStatus }

interface UseSignalROptions {
  chatId?: string
  onMessage?: (msg: IncomingMessage) => void
  onMessageEdited?: (event: MessageEdited) => void
  onTyping?: (event: TypingEvent) => void
  onStoppedTyping?: (event: TypingEvent) => void
  onUserOnline?: (event: UserOnlineEvent) => void
}

export function useSignalR(options: UseSignalROptions = {}) {
  const status = useConnectionStore((s) => s.status)
  const optionsRef = useRef(options)
  useLayoutEffect(() => { optionsRef.current = options })

  // ── Подписка на чат при смене chatId ─────────────────────────────────────
  useEffect(() => {
    const { chatId } = optionsRef.current
    if (!chatId || !signalR.isConnected) return

    signalR.joinChat(chatId).catch(() => {})
    return () => { signalR.leaveChat(chatId).catch(() => {}) }
  }, [options.chatId, status])

  // ── Подписки на события ───────────────────────────────────────────────────
  useEffect(() => {
    const off = [
      options.onMessage       && signalR.onReceiveMessage(options.onMessage),
      options.onMessageEdited && signalR.onMessageEdited(options.onMessageEdited),
      options.onTyping        && signalR.onUserTyping(options.onTyping),
      options.onStoppedTyping && signalR.onUserStoppedTyping(options.onStoppedTyping),
      options.onUserOnline    && signalR.onUserOnline(options.onUserOnline),
    ].filter(Boolean) as Array<() => void>

    return () => off.forEach(fn => fn())
  }, [options.onMessage, options.onMessageEdited, options.onTyping, options.onStoppedTyping, options.onUserOnline])

  return {
    status,
    sendMessage:  (content: string, replyToMessageId?: string) =>
      options.chatId ? signalR.sendMessage(options.chatId, content, replyToMessageId) : Promise.reject(),
    startTyping:  () => options.chatId && signalR.startTyping(options.chatId),
    stopTyping:   () => options.chatId && signalR.stopTyping(options.chatId),
  }
}
