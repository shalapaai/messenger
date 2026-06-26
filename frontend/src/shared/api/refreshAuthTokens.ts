import axios from 'axios'
import type { AuthTokens } from '../lib/auth/authTokens'

export async function refreshAuthTokens(
  refreshToken: string,
): Promise<AuthTokens> {
  const response = await axios.post<AuthTokens>('/api/auth/refresh', {
    token: refreshToken,
  })

  return response.data
}
