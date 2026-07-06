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

/** Кросс-вкладочный логаут: 'storage' — событие DOM, которое браузер шлёт во ВСЕ ДРУГИЕ
 *  вкладки того же origin при изменении localStorage (в той вкладке, где вызван
 *  clearAuthTokens(), событие не всплывает — она обновляет свой стейт напрямую).
 *  Так логаут в одной вкладке (кнопкой или по неудачному refresh в apiClient) сразу
 *  разлогинивает и остальные открытые вкладки, а не оставляет их с мёртвым токеном. */
export function onAuthTokensCleared(callback: () => void): () => void {
  function handleStorage(e: StorageEvent) {
    if (e.key === ACCESS_TOKEN_KEY && e.newValue === null) callback()
  }
  window.addEventListener('storage', handleStorage)
  return () => window.removeEventListener('storage', handleStorage)
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
