import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { hasAuthTokens } from '../../../shared/lib/auth/authTokens'

type ProtectedRouteProps = {
  children: ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  if (!hasAuthTokens()) {
    return <Navigate to="/login" replace />
  }
  return children
}
