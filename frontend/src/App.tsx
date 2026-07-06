import { AppRouter } from './app/router/AppRouter'
import { ThemeProvider } from './shared/context/ThemeContext'
import { UserProfileProvider } from './shared/context/UserProfileContext'
import { FeaturesProvider } from './shared/context/FeaturesContext'
import { ToastViewport } from './shared/ui/ToastViewport'

function App() {
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
