import { AppRouter } from './app/router/AppRouter'
import { UserProfileProvider } from './shared/context/UserProfileContext'

function App() {
  return (
    <UserProfileProvider>
      <AppRouter />
    </UserProfileProvider>
  )
}

export default App
