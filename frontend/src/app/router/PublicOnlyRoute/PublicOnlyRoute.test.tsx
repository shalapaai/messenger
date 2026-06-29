import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PublicOnlyRoute } from './PublicOnlyRoute'

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

function renderPublicOnlyRoute() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicOnlyRoute>
              <div>Login page</div>
            </PublicOnlyRoute>
          }
        />
        <Route path="/chats" element={<div>Chats page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PublicOnlyRoute', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock())
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders children when auth tokens are missing', () => {
    renderPublicOnlyRoute()

    expect(screen.getByText('Login page')).toBeInTheDocument()
    expect(screen.queryByText('Chats page')).not.toBeInTheDocument()
  })

  it('redirects to chats when access token exists', () => {
    localStorage.setItem('messenger_access_token', 'access-token')

    renderPublicOnlyRoute()

    expect(screen.getByText('Chats page')).toBeInTheDocument()
    expect(screen.queryByText('Login page')).not.toBeInTheDocument()
  })

  it('renders children when only legacy refresh token exists', () => {
    localStorage.setItem('messenger_refresh_token', 'refresh-token')

    renderPublicOnlyRoute()

    expect(screen.getByText('Login page')).toBeInTheDocument()
    expect(screen.queryByText('Chats page')).not.toBeInTheDocument()
  })
})
