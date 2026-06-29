import axios from 'axios'
import type { AuthTokens } from '../lib/auth/authTokens'

export async function refreshAuthTokens(): Promise<AuthTokens> {
  const response = await axios.post<AuthTokens>(
    '/api/auth/refresh',
    undefined,
    { withCredentials: true },
  )

  return response.data
}
