import { AppRouter } from './app/router/AppRouter'
import { ThemeProvider } from './shared/context/ThemeContext'
import { UserProfileProvider } from './shared/context/UserProfileContext'
import { FeaturesProvider } from './shared/context/FeaturesContext'

function App() {
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
