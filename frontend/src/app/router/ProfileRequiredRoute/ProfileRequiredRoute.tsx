import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { hasAuthTokens } from '../../../shared/lib/auth/authTokens'
import { useUserProfile } from '../../../shared/context/UserProfileContext'

type ProfileRequiredRouteProps = {
  children: ReactNode
}

export function ProfileRequiredRoute({ children }: ProfileRequiredRouteProps) {
  const { profile, isLoading } = useUserProfile()

  if (!hasAuthTokens()) {
    return <Navigate to="/login" replace />
  }

  if (isLoading) {
    return null
  }

  if (!profile) {
    return <Navigate to="/profile/setup" replace />
  }

  return children
}
