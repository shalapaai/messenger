import axios from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { refreshAuthTokens } from './refreshAuthTokens'

vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
  },
}))

describe('refreshAuthTokens', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('refreshes auth tokens with HttpOnly cookie credentials', async () => {
    const tokens = {
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    }

    vi.mocked(axios.post).mockResolvedValue({ data: tokens })

    await expect(refreshAuthTokens()).resolves.toEqual(tokens)

    expect(axios.post).toHaveBeenCalledWith(
      '/api/auth/refresh',
      undefined,
      { withCredentials: true },
    )
  })
})
