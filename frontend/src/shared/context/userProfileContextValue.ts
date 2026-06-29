import { createContext } from 'react'
import type { UserProfile } from '../types/user'

export interface UserProfileContextValue {
  profile: UserProfile | null
  isLoading: boolean
  setProfile: (profile: UserProfile | null) => void
  refetchProfile: () => Promise<UserProfile | null>
}

export const UserProfileContext = createContext<UserProfileContextValue | null>(null)
