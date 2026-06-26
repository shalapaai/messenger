import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { hasAuthTokens } from '../../../shared/lib/auth/authTokens'

type PublicOnlyRouteProps = {
  children: ReactNode
}

export function PublicOnlyRoute({ children }: PublicOnlyRouteProps) {
  if (hasAuthTokens()) {
    return <Navigate to="/chats" replace />
  }

  return <>{children}</>
}
