export type AuthTokens = {
  accessToken: string
  refreshToken: string
}

const ACCESS_TOKEN_KEY = 'messenger_access_token'
const REFRESH_TOKEN_KEY = 'messenger_refresh_token'

export function saveAuthTokens(tokens: AuthTokens) {
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken)
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken)
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function clearAuthTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

export function hasAuthTokens() {
  return Boolean(getAccessToken() || getRefreshToken())
}

export function getMyUserId(): string | null {
  const token = getAccessToken()
  if (!token) return null
  try {
    // JWT использует base64url: заменяем - → + и _ → / перед atob
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(b64))
    // .NET ClaimTypes.NameIdentifier → "nameid" в JWT (или полный URI)
    return payload.nameid
      ?? payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier']
      ?? payload.sub
      ?? null
  } catch {
    return null
  }
}
