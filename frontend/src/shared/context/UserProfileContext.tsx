import { useState, useEffect, type ReactNode } from 'react'
import { profileApi } from '../api/profileApi'
import { hasAuthTokens } from '../lib/auth/authTokens'
import type { UserProfile } from '../types/user'
import { UserProfileContext } from './userProfileContextValue'

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(() => hasAuthTokens())

  function clearProfile() {
    setProfile(null)
    setIsLoading(false)
  }

  async function fetchProfile(): Promise<UserProfile | null> {
    try {
      const data = await profileApi.getMe()
      setProfile(data)
      return data
    } catch {
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
      value={{ profile, isLoading, setProfile, clearProfile, refetchProfile: fetchProfile }}
    >
      {children}
    </UserProfileContext.Provider>
  )
}
