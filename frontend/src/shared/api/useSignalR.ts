import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { signalR, type IncomingMessage, type MessageEdited, type MessageDeleted, type MessagesReadEvent, type TypingEvent, type UserOnlineEvent, type ChatUpdatedEvent, type UserProfileUpdatedEvent } from './signalrClient'
import { useConnectionStore, type ConnectionStatus } from './connectionStore'

export type { ConnectionStatus }

interface UseSignalROptions {
  chatId?: string
  onMessage?: (msg: IncomingMessage) => void
  onMessageEdited?: (event: MessageEdited) => void
  onMessageDeleted?: (event: MessageDeleted) => void
  onMessagesRead?: (event: MessagesReadEvent) => void
  onTyping?: (event: TypingEvent) => void
  onStoppedTyping?: (event: TypingEvent) => void
  onUserOnline?: (event: UserOnlineEvent) => void
  onChatUpdated?: (event: ChatUpdatedEvent) => void
  onUserProfileUpdated?: (event: UserProfileUpdatedEvent) => void
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
  // Подписываемся ОДИН раз (пустой deps) через стабильные trampoline-колбэки, которые на
  // каждый вызов читают actuals из optionsRef — иначе, поскольку вызывающий код (MessengerPage)
  // передаёт options как новый объект с новыми инлайн-функциями на каждый рендер, эффект
  // пересоздавал бы ВСЕ 8 подписок при каждом ре-рендере страницы (а не только изменившуюся),
  // с окном рассинхронизации между off() и повторным on(), где событие могло бы потеряться
  useEffect(() => {
    const off = [
      signalR.onReceiveMessage(msg => optionsRef.current.onMessage?.(msg)),
      signalR.onMessageEdited(event => optionsRef.current.onMessageEdited?.(event)),
      signalR.onMessageDeleted(event => optionsRef.current.onMessageDeleted?.(event)),
      signalR.onMessagesRead(event => optionsRef.current.onMessagesRead?.(event)),
      signalR.onUserTyping(event => optionsRef.current.onTyping?.(event)),
      signalR.onUserStoppedTyping(event => optionsRef.current.onStoppedTyping?.(event)),
      signalR.onUserOnline(event => optionsRef.current.onUserOnline?.(event)),
      signalR.onChatUpdated(event => optionsRef.current.onChatUpdated?.(event)),
      signalR.onUserProfileUpdated(event => optionsRef.current.onUserProfileUpdated?.(event)),
    ]

    return () => off.forEach(fn => fn())
  }, [])

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
