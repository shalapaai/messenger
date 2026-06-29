import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { AxiosError } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { saveAuthTokens } from '../lib/auth/authTokens'
import { apiClient } from './apiClient'
import { refreshAuthTokens } from './refreshAuthTokens'

vi.mock('./refreshAuthTokens', () => ({
  refreshAuthTokens: vi.fn(),
}))

type TestRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean
}

function createLocalStorageMock() {
  const storage = new Map<string, string>()

  return {
    getItem: vi.fn((key: string) => storage.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      storage.set(key, value)
    }),
    removeItem: vi.fn((key: string) => {
      storage.delete(key)
    }),
    clear: vi.fn(() => {
      storage.clear()
    }),
  }
}

function createResponse(
  config: InternalAxiosRequestConfig,
  status = 200,
): AxiosResponse {
  return {
    data: { ok: true },
    status,
    statusText: status === 200 ? 'OK' : 'Unauthorized',
    headers: {},
    config,
  }
}

function createUnauthorizedError(config: InternalAxiosRequestConfig) {
  return new AxiosError(
    'Unauthorized',
    'ERR_BAD_REQUEST',
    config,
    undefined,
    createResponse(config, 401),
  )
}

describe('apiClient', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock())
    localStorage.clear()
    vi.clearAllMocks()
    apiClient.defaults.adapter = undefined
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('adds bearer token to requests when access token exists', async () => {
    saveAuthTokens({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    })

    const adapter = vi.fn<AxiosAdapter>((config) =>
      Promise.resolve(createResponse(config)),
    )

    apiClient.defaults.adapter = adapter

    await apiClient.get('/users/me')

    expect(adapter).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer access-token',
        }),
      }),
    )
  })

  it('refreshes tokens and retries original request after unauthorized response', async () => {
    saveAuthTokens({
      accessToken: 'old-access-token',
      refreshToken: 'old-refresh-token',
    })

    vi.mocked(refreshAuthTokens).mockResolvedValue({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    })

    const adapter = vi.fn<AxiosAdapter>((config) => {
      if ((config as TestRequestConfig)._retry) {
        return Promise.resolve(createResponse(config))
      }

      return Promise.reject(createUnauthorizedError(config))
    })

    apiClient.defaults.adapter = adapter

    await apiClient.get('/users/me')

    expect(refreshAuthTokens).toHaveBeenCalledWith()
    expect(localStorage.getItem('messenger_access_token')).toBe('new-access-token')
    expect(localStorage.getItem('messenger_refresh_token')).toBeNull()
    expect(adapter).toHaveBeenLastCalledWith(
      expect.objectContaining({
        _retry: true,
        headers: expect.objectContaining({
          Authorization: 'Bearer new-access-token',
        }),
      }),
    )
  })

  it('uses one refresh request for parallel unauthorized responses', async () => {
    saveAuthTokens({
      accessToken: 'old-access-token',
      refreshToken: 'old-refresh-token',
    })

    vi.mocked(refreshAuthTokens).mockResolvedValue({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    })

    const adapter = vi.fn<AxiosAdapter>((config) => {
      if ((config as TestRequestConfig)._retry) {
        return Promise.resolve(createResponse(config))
      }

      return Promise.reject(createUnauthorizedError(config))
    })

    apiClient.defaults.adapter = adapter

    await Promise.all([apiClient.get('/users/me'), apiClient.get('/messages')])

    expect(refreshAuthTokens).toHaveBeenCalledTimes(1)
    expect(adapter).toHaveBeenCalledTimes(4)
  })
})
