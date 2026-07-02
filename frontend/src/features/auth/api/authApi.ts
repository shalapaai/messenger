import { apiClient } from '../../../shared/api/apiClient'
import type { AuthTokens } from '../../../shared/lib/auth/authTokens'

type AuthRequest = {
  email: string
  password: string
}

export type LoginResult = {
  requiresOtp: boolean
  email?: string
  accessToken?: string
  refreshToken?: string
  accessTokenExpiresAt?: string
}

export async function login(data: AuthRequest): Promise<LoginResult> {
  const response = await apiClient.post<LoginResult>('/auth/login', data)
  return response.data
}

export async function verifyOtp(email: string, code: string): Promise<AuthTokens> {
  const response = await apiClient.post<AuthTokens>('/auth/verify-otp', { email, code })
  return response.data
}

export async function register(data: AuthRequest): Promise<LoginResult> {
  const response = await apiClient.post<LoginResult>('/auth/register', data)
  return response.data
}

export async function forgotPassword(email: string): Promise<void> {
  await apiClient.post('/auth/forgot-password', { email })
}

export async function resetPassword(email: string, code: string, newPassword: string): Promise<void> {
  await apiClient.post('/auth/reset-password', { email, code, newPassword })
}

export async function logout() {
  await apiClient.post('/auth/logout')
}
