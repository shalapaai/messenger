import { useEffect } from 'react'
import { AppRouter } from './app/router/AppRouter'
import { ThemeProvider } from './shared/context/ThemeContext'
import { UserProfileProvider } from './shared/context/UserProfileContext'
import { FeaturesProvider } from './shared/context/FeaturesContext'
import { onAuthTokensCleared, onAuthTokensSaved } from './shared/lib/auth/authTokens'

function App() {
  useEffect(() => onAuthTokensCleared(() => { window.location.href = '/login' }), [])

  useEffect(() => onAuthTokensSaved(() => { window.location.reload() }), [])

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
