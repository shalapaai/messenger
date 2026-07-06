import { useEffect } from 'react'
import { AppRouter } from './app/router/AppRouter'
import { ThemeProvider } from './shared/context/ThemeContext'
import { UserProfileProvider } from './shared/context/UserProfileContext'
import { FeaturesProvider } from './shared/context/FeaturesContext'
import { onAuthTokensCleared, onAuthTokensSaved } from './shared/lib/auth/authTokens'
import { ToastViewport } from './shared/ui/ToastViewport'

function App() {
  // Логаут в одной вкладке (кнопка "Выйти" или неудачный refresh токена в apiClient) должен
  // сразу разлогинивать и все остальные открытые вкладки — полная перезагрузка на /login, а не
  // просто редирект внутри SPA, чтобы гарантированно сбросить весь стейт (SignalR-соединение,
  // закэшированные чаты/профиль и т.п.), а не только текущий маршрут.
  useEffect(() => onAuthTokensCleared(() => { window.location.href = '/login' }), [])

  // Симметрично для входа: логин в одной вкладке (после регистрации/входа/смены аккаунта)
  // должен обновить и остальные вкладки — обычная перезагрузка текущего адреса, а не жёсткий
  // редирект: GuardedLayout сам решит, куда вести (например, с /login на /chats), а вкладки,
  // уже открытые где-то внутри мессенджера, просто подхватят свежий токен/профиль.
  useEffect(() => onAuthTokensSaved(() => { window.location.reload() }), [])

  return (
    <ThemeProvider>
      <FeaturesProvider>
        <UserProfileProvider>
          <AppRouter />
          <ToastViewport />
        </UserProfileProvider>
      </FeaturesProvider>
    </ThemeProvider>
  )
}

export default App
