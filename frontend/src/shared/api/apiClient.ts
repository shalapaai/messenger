import axios, { type InternalAxiosRequestConfig } from 'axios'
import {
  type AuthTokens,
  clearAuthTokens,
  getAccessToken,
  saveAuthTokens,
} from '../lib/auth/authTokens'
import { refreshAuthTokens } from './refreshAuthTokens'

type RetryRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean
}

let refreshPromise: Promise<AuthTokens> | null = null

export const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
})

function redirectToLogin() {
  window.location.href = '/login'
}

function getRefreshPromise() {
  if (!refreshPromise) {
    refreshPromise = refreshAuthTokens().finally(() => {
      refreshPromise = null
    })
  }

  return refreshPromise
}

apiClient.interceptors.request.use((config) => {
  const accessToken = getAccessToken()

  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }

  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as RetryRequestConfig | undefined

    if (error.response?.status !== 401 || !originalRequest) {
      return Promise.reject(error)
    }

    if (originalRequest._retry) {
      clearAuthTokens()
      redirectToLogin()

      return Promise.reject(error)
    }

    originalRequest._retry = true

    try {
      const newTokens = await getRefreshPromise()

      saveAuthTokens(newTokens)

      originalRequest.headers.Authorization = `Bearer ${newTokens.accessToken}`

      return apiClient(originalRequest)
    } catch (refreshError) {
      clearAuthTokens()
      redirectToLogin()

      return Promise.reject(refreshError)
    }
  },
)
