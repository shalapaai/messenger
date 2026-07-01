import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { useCallback, useEffect, type ReactNode } from 'react'
import { LoginPage } from '../../pages/LoginPage'
import { RegisterPage } from '../../pages/RegisterPage'
import { ForgotPasswordPage } from '../../pages/ForgotPasswordPage'
import { MessengerPage } from '../../pages/MessengerPage'
import { ProfileSetupPage } from '../../pages/ProfileSetupPage'
import { hasAuthTokens } from '../../shared/lib/auth/authTokens'
import { useUserProfile } from '../../shared/context/useUserProfile'
import { useSignalRConnection } from '../../shared/api/useSignalRConnection'
import { useSignalR } from '../../shared/api/useSignalR'
import { useChatsStore } from '../../shared/api/chatsStore'
import { useOnlineStore } from '../../shared/api/onlineStore'
import { useConnectionStore } from '../../shared/api/connectionStore'
import { signalR } from '../../shared/api/signalrClient'
import { ConnectionBanner } from '../../shared/ui/ConnectionBanner/ConnectionBanner'
import type { IncomingMessage, UserOnlineEvent } from '../../shared/api/signalrClient'

// SignalR-соединение живёт только когда пользователь полностью авторизован
// (есть токены И заполненный профиль) — т.е. внутри финальной "разрешённой" зоны
// GuardedLayout, а не на /login, /register, /profile/setup.
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
  // chatsLoaded ждём, чтобы не слать joinChat с моковыми (не-Guid) ID до загрузки API.
  useEffect(() => {
    if (status !== 'connected' || !chatsLoaded) return
    chats.forEach(chat => signalR.joinChat(chat.id).catch(() => {}))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, chatsLoaded, chatIdsKey])

  const onMessage = useCallback((msg: IncomingMessage) => {
    // строго GUID — чтобы не зацепить /chats/new/:userId (черновик ещё не существующего чата)
    const activeChatId = pathname.match(/^\/chats\/([0-9a-f-]{36})$/i)?.[1] ?? null
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

function GuardedLayout() {
  const { profile, isLoading } = useUserProfile()
  const { pathname } = useLocation()

  if (isLoading) return null

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
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
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
