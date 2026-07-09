export type AuthTokens = {
  accessToken: string
  refreshToken?: string
}

const ACCESS_TOKEN_KEY = 'messenger_access_token'
const REFRESH_TOKEN_KEY = 'messenger_refresh_token'

export function saveAuthTokens(tokens: AuthTokens) {
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function clearAuthTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

export function hasAuthTokens() {
  return Boolean(getAccessToken())
}

export function onAuthTokensCleared(callback: () => void): () => void {
  function handleStorage(e: StorageEvent) {
    if (e.key === ACCESS_TOKEN_KEY && e.newValue === null) callback()
  }
  window.addEventListener('storage', handleStorage)
  return () => window.removeEventListener('storage', handleStorage)
}

export function onAuthTokensSaved(callback: () => void): () => void {
  function handleStorage(e: StorageEvent) {
    if (e.key === ACCESS_TOKEN_KEY && e.newValue !== null) callback()
  }
  window.addEventListener('storage', handleStorage)
  return () => window.removeEventListener('storage', handleStorage)
}

export function getMyUserId(): string | null {
  const token = getAccessToken()
  if (!token) return null
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(b64))
    return payload.nameid
      ?? payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier']
      ?? payload.sub
      ?? null
  } catch {
    return null
  }
}
