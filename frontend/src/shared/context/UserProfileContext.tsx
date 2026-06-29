import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { profileApi } from '../api/profileApi'
import { hasAuthTokens } from '../lib/auth/authTokens'
import type { UserProfile } from '../types/user'

interface UserProfileContextValue {
  profile: UserProfile | null
  isLoading: boolean
  setProfile: (profile: UserProfile | null) => void
  refetchProfile: () => Promise<UserProfile | null>
}

const UserProfileContext = createContext<UserProfileContextValue | null>(null)

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  async function fetchProfile(): Promise<UserProfile | null> {
    try {
      const data = await profileApi.getMe()
      console.log('[UserProfileContext] profile fetched:', data)
      setProfile(data)
      return data
    } catch (err) {
      console.warn('[UserProfileContext] profile fetch failed:', err)
      setProfile(null)
      return null
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!hasAuthTokens()) {
      setIsLoading(false)
      return
    }
    void fetchProfile()
  }, [])

  return (
    <UserProfileContext.Provider
      value={{ profile, isLoading, setProfile, refetchProfile: fetchProfile }}
    >
      {children}
    </UserProfileContext.Provider>
  )
}

export function useUserProfile() {
  const ctx = useContext(UserProfileContext)
  if (!ctx) throw new Error('useUserProfile must be used within UserProfileProvider')
  return ctx
}
