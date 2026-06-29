import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../../../shared/api/apiClient'
import { login, logout, register } from './authApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiClient: {
    post: vi.fn(),
  },
}))

describe('authApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends login request and returns auth tokens', async () => {
    const tokens = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    }

    vi.mocked(apiClient.post).mockResolvedValue({ data: tokens })

    await expect(
      login({ email: 'user@example.com', password: 'SecurePass1!' }),
    ).resolves.toEqual(tokens)

    expect(apiClient.post).toHaveBeenCalledWith('/auth/login', {
      email: 'user@example.com',
      password: 'SecurePass1!',
    })
  })

  it('sends register request and returns auth tokens', async () => {
    const tokens = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    }

    vi.mocked(apiClient.post).mockResolvedValue({ data: tokens })

    await expect(
      register({ email: 'user@example.com', password: 'SecurePass1!' }),
    ).resolves.toEqual(tokens)

    expect(apiClient.post).toHaveBeenCalledWith('/auth/register', {
      email: 'user@example.com',
      password: 'SecurePass1!',
    })
  })

  it('sends logout request so backend can delete refresh cookie', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: undefined })

    await logout()

    expect(apiClient.post).toHaveBeenCalledWith('/auth/logout')
  })
})
