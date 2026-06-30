import { useCallback, useEffect, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { hasAuthTokens, getMyUserId } from '../../../shared/lib/auth/authTokens'
import { useSignalRConnection } from '../../../shared/api/useSignalRConnection'
import { useSignalR } from '../../../shared/api/useSignalR'
import { useChatsStore } from '../../../shared/api/chatsStore'
import { useOnlineStore } from '../../../shared/api/onlineStore'
import { useConnectionStore } from '../../../shared/api/connectionStore'
import { signalR } from '../../../shared/api/signalrClient'
import { ConnectionBanner } from '../../../shared/ui/ConnectionBanner/ConnectionBanner'
import type { IncomingMessage, UserOnlineEvent } from '../../../shared/api/signalrClient'

type ProtectedRouteProps = {
  children: ReactNode
}

function ConnectedLayout({ children }: { children: ReactNode }) {
  useSignalRConnection()

  const { pathname } = useLocation()
  const handleNewMessage = useChatsStore((s) => s.handleNewMessage)
  const setOnline        = useOnlineStore((s) => s.setOnline)
  const chats            = useChatsStore((s) => s.chats)
  const chatsLoaded      = useChatsStore((s) => s.chatsLoaded)
  const status           = useConnectionStore((s) => s.status)
  const chatIdsKey       = chats.map((c) => c.id).join(',')

  // Вступаем во все чаты пользователя при подключении / изменении НАБОРА чатов.
  // chatIdsKey стабилен между рендерами в отличие от ссылки на массив chats,
  // которая меняется при каждом новом сообщении (handleNewMessage пересоздаёт массив).
  // chatsLoaded ждём, чтобы не слать joinChat с моковыми (не-Guid) ID до загрузки API.
  useEffect(() => {
    if (status !== 'connected' || !chatsLoaded) return
    chats.forEach(chat => signalR.joinChat(chat.id).catch(() => {}))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, chatsLoaded, chatIdsKey])

  const onMessage = useCallback((msg: IncomingMessage) => {
    if (msg.senderId === getMyUserId()) return
    const activeChatId = pathname.match(/\/chats\/(.+)/)?.[1] ?? null
    handleNewMessage(msg, activeChatId)
  }, [pathname, handleNewMessage])

  const onUserOnline = useCallback((event: UserOnlineEvent) => {
    setOnline(event.userId, event.isOnline)
  }, [setOnline])

  useSignalR({ onMessage, onUserOnline })

  return (
    <>
      {children}
      <ConnectionBanner />
    </>
  )
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  if (!hasAuthTokens()) {
    return <Navigate to="/login" replace />
  }
  return <ConnectedLayout>{children}</ConnectedLayout>
}
