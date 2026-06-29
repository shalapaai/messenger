import { useState, useEffect, type ReactNode } from 'react'
import { profileApi } from '../api/profileApi'
import { hasAuthTokens } from '../lib/auth/authTokens'
import type { UserProfile } from '../types/user'
import { UserProfileContext } from './userProfileContextValue'

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(() => hasAuthTokens())

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
    if (!hasAuthTokens()) return

    let isActive = true
    queueMicrotask(() => {
      if (isActive) void fetchProfile()
    })

    return () => {
      isActive = false
    }
  }, [])

  return (
    <UserProfileContext.Provider
      value={{ profile, isLoading, setProfile, refetchProfile: fetchProfile }}
    >
      {children}
    </UserProfileContext.Provider>
  )
}
