import { AppRouter } from './app/router/AppRouter'
import { ThemeProvider } from './shared/context/ThemeContext'
import { UserProfileProvider } from './shared/context/UserProfileContext'

function App() {
  return (
    <ThemeProvider>
      <UserProfileProvider>
        <AppRouter />
      </UserProfileProvider>
    </ThemeProvider>
  )
}

export default App
