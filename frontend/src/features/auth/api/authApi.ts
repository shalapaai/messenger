import { apiClient } from '../../../shared/api/apiClient'
import type { AuthTokens } from '../../../shared/lib/auth/authTokens'

type AuthRequest = {
  email: string
  password: string
}

export async function login(data: AuthRequest) {
  const response = await apiClient.post<AuthTokens>('/auth/login', data)

  return response.data
}

export async function register(data: AuthRequest) {
  await apiClient.post('/auth/register', data)
}
