import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useCallback, useEffect, useRef, type ReactNode } from 'react'
import { LoginPage } from '../../pages/LoginPage'
import { RegisterPage } from '../../pages/RegisterPage'
import { ForgotPasswordPage } from '../../pages/ForgotPasswordPage'
import { useFeatures } from '../../shared/context/useFeatures'
import { MessengerPage } from '../../pages/MessengerPage'
import { ProfileSetupPage } from '../../pages/ProfileSetupPage'
import { hasAuthTokens, getMyUserId } from '../../shared/lib/auth/authTokens'
import { useUserProfile } from '../../shared/context/useUserProfile'
import { useSignalRConnection } from '../../shared/api/useSignalRConnection'
import { useSignalR } from '../../shared/api/useSignalR'
import { useChatsStore } from '../../shared/api/chatsStore'
import { useOnlineStore } from '../../shared/api/onlineStore'
import { useConnectionStore } from '../../shared/api/connectionStore'
import { signalR } from '../../shared/api/signalrClient'
import {
  getActiveChatIdFromPathname,
  getDraftDirectUserIdFromPathname,
  isSameNotificationId,
  showIncomingMessageNotification,
  syncActiveNotificationRoute,
  syncPushSubscription,
} from '../../shared/lib/notifications'
import { ConnectionBanner } from '../../shared/ui/ConnectionBanner/ConnectionBanner'
import type { IncomingMessage, UserOnlineEvent } from '../../shared/api/signalrClient'
import { AppLoadingSkeleton } from './AppLoadingSkeleton'

function ForgotPasswordRoute() {
  const { passwordResetEnabled } = useFeatures()
  if (!passwordResetEnabled) return <Navigate to="/login" replace />
  return <ForgotPasswordPage />
}

// SignalR-соединение живёт только когда пользователь полностью авторизован
// (есть токены И заполненный профиль) — т.е. внутри финальной "разрешённой" зоны
// GuardedLayout, а не на /login, /register, /profile/setup.
function ConnectedLayout({ children }: { children: ReactNode }) {
  useSignalRConnection()

  const navigate = useNavigate()
  const { pathname } = useLocation()
  const handleNewMessage = useChatsStore((s) => s.handleNewMessage)
  const setOnline        = useOnlineStore((s) => s.setOnline)
  const chats            = useChatsStore((s) => s.chats)
  const chatsLoaded      = useChatsStore((s) => s.chatsLoaded)
  const status           = useConnectionStore((s) => s.status)
  const chatIdsKey       = chats.map((c) => c.id).join(',')
  const joinedChatIdsRef = useRef<Set<string>>(new Set())
  const activeChatId = getActiveChatIdFromPathname(pathname)
  const activeDirectUserId = chats.find(chat => isSameNotificationId(chat.id, activeChatId))?.otherUserId
    ?? getDraftDirectUserIdFromPathname(pathname)

  // Вступаем во все чаты пользователя при подключении / изменении НАБОРА чатов.
  // chatsLoaded ждём, чтобы не слать joinChat с моковыми (не-Guid) ID до загрузки API.
  useEffect(() => {
    if (status !== 'connected') {
      joinedChatIdsRef.current.clear()
      return
    }

    if (!chatsLoaded) return

    const actualChatIds = new Set(chats.map(chat => chat.id))
    const joinedChatIds = joinedChatIdsRef.current

    joinedChatIds.forEach(chatId => {
      if (actualChatIds.has(chatId)) return
      signalR.leaveChat(chatId).catch(() => {})
      joinedChatIds.delete(chatId)
    })

    actualChatIds.forEach(chatId => {
      if (joinedChatIds.has(chatId)) return
      signalR.joinChat(chatId)
        .then(() => joinedChatIds.add(chatId))
        .catch(() => {})
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, chatsLoaded, chatIdsKey])

  useEffect(() => {
    if (status !== 'connected') return
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    syncPushSubscription().catch(() => {})
  }, [status])

  useEffect(() => {
    syncActiveNotificationRoute(pathname, activeDirectUserId)
  }, [pathname, activeDirectUserId])

  const onMessage = useCallback((msg: IncomingMessage) => {
    handleNewMessage(msg, activeChatId)

    if (msg.senderId !== getMyUserId()) {
      showIncomingMessageNotification({
        title: msg.senderName,
        body: msg.content,
        chatId: msg.chatId,
        notificationId: msg.messageId,
        icon: msg.senderAvatarUrl,
        onClick: () => navigate(`/chats/${msg.chatId}`),
      })
    }
  }, [activeChatId, handleNewMessage, navigate])

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

function GuardedLayout() {
  const { profile, isLoading } = useUserProfile()
  const { pathname } = useLocation()

  if (isLoading) return <AppLoadingSkeleton />

  const hasTokens = hasAuthTokens()

  if (!hasTokens) {
    if (pathname !== '/login' && pathname !== '/register' && pathname !== '/forgot-password') {
      return <Navigate to="/login" replace />
    }
    return <Outlet />
  }

  if (!profile) {
    if (pathname !== '/profile/setup') {
      return <Navigate to="/profile/setup" replace />
    }
    return <Outlet />
  }

  if (pathname === '/login' || pathname === '/register' || pathname === '/profile/setup') {
    return <Navigate to="/chats" replace />
  }

  return (
    <ConnectedLayout>
      <Outlet />
    </ConnectedLayout>
  )
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<GuardedLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordRoute />} />
          <Route path="/profile/setup" element={<ProfileSetupPage />} />
          <Route path="/chats" element={<MessengerPage />} />
          <Route path="/chats/new/:newUserId" element={<MessengerPage />} />
          <Route path="/chats/:id" element={<MessengerPage />} />
          <Route path="*" element={<Navigate to="/chats" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
