import { useEffect } from 'react'
import { AppRouter } from './app/router/AppRouter'
import { ThemeProvider } from './shared/context/ThemeContext'
import { UserProfileProvider } from './shared/context/UserProfileContext'
import { FeaturesProvider } from './shared/context/FeaturesContext'
import { onAuthTokensCleared } from './shared/lib/auth/authTokens'

function App() {
  // Логаут в одной вкладке (кнопка "Выйти" или неудачный refresh токена в apiClient) должен
  // сразу разлогинивать и все остальные открытые вкладки — полная перезагрузка на /login, а не
  // просто редирект внутри SPA, чтобы гарантированно сбросить весь стейт (SignalR-соединение,
  // закэшированные чаты/профиль и т.п.), а не только текущий маршрут.
  useEffect(() => onAuthTokensCleared(() => { window.location.href = '/login' }), [])

  return (
    <ThemeProvider>
      <FeaturesProvider>
        <UserProfileProvider>
          <AppRouter />
        </UserProfileProvider>
      </FeaturesProvider>
    </ThemeProvider>
  )
}

export default App
