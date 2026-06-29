import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { hasAuthTokens } from '../../../shared/lib/auth/authTokens'
import { useUserProfile } from '../../../shared/context/UserProfileContext'

type ProfileSetupRouteProps = {
  children: ReactNode
}

export function ProfileSetupRoute({ children }: ProfileSetupRouteProps) {
  const { profile, isLoading } = useUserProfile()

  if (!hasAuthTokens()) {
    return <Navigate to="/login" replace />
  }

  if (isLoading) {
    return null
  }

  if (profile) {
    return <Navigate to="/chats" replace />
  }

  return children
}
