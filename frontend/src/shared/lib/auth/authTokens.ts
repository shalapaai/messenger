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
