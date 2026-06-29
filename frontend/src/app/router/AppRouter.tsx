import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { LoginPage } from '../../pages/LoginPage'
import { RegisterPage } from '../../pages/RegisterPage'
import { MessengerPage } from '../../pages/MessengerPage'
import { ProfileSetupPage } from '../../pages/ProfileSetupPage'
import { hasAuthTokens } from '../../shared/lib/auth/authTokens'
import { useUserProfile } from '../../shared/context/UserProfileContext'

function GuardedLayout() {
  const { profile, isLoading } = useUserProfile()
  const { pathname } = useLocation()

  if (isLoading) return null

  const hasTokens = hasAuthTokens()

  if (!hasTokens) {
    if (pathname !== '/login' && pathname !== '/register') {
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

  return <Outlet />
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<GuardedLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/profile/setup" element={<ProfileSetupPage />} />
          <Route path="/chats" element={<MessengerPage />} />
          <Route path="/chats/:id" element={<MessengerPage />} />
          <Route path="*" element={<Navigate to="/chats" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
