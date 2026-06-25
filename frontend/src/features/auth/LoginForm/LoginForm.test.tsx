import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { login } from '../api/authApi'
import { saveAuthTokens } from '../../../shared/lib/auth/authTokens'
import LoginForm from './LoginForm'

vi.mock('../api/authApi', () => ({
  login: vi.fn(),
}))

vi.mock('../../../shared/lib/auth/authTokens', () => ({
  saveAuthTokens: vi.fn(),
}))

function renderLoginForm() {
  return render(
    <MemoryRouter>
      <LoginForm />
    </MemoryRouter>,
  )
}

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders email and password fields', () => {
    renderLoginForm()

    expect(screen.getByLabelText('Электронная почта')).toBeInTheDocument()
    expect(screen.getByLabelText('Пароль')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Войти' })).toBeInTheDocument()
  })

  it('shows error when fields are empty', async () => {
    const user = userEvent.setup()

    renderLoginForm()

    await user.click(screen.getByRole('button', { name: 'Войти' }))

    expect(screen.getByText('Заполните электронную почту и пароль')).toBeInTheDocument()
    expect(login).not.toHaveBeenCalled()
  })

  it('shows error when email is invalid', async () => {
    const user = userEvent.setup()

    renderLoginForm()

    await user.type(screen.getByLabelText('Электронная почта'), 'wrong-email')
    await user.type(screen.getByLabelText('Пароль'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Войти' }))

    expect(screen.getByText('Введите электронную почту в правильном формате')).toBeInTheDocument()
    expect(login).not.toHaveBeenCalled()
  })

  it('submits form when email and password are valid', async () => {
    const user = userEvent.setup()

    vi.mocked(login).mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    })

    renderLoginForm()

    await user.type(screen.getByLabelText('Электронная почта'), 'test@mail.ru')
    await user.type(screen.getByLabelText('Пароль'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Войти' }))

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith({
        email: 'test@mail.ru',
        password: 'password123',
      })
    })

    expect(saveAuthTokens).toHaveBeenCalledWith({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    })
  })

  it('shows error when login request fails', async () => {
    const user = userEvent.setup()

    vi.mocked(login).mockRejectedValue(new Error('Login failed'))

    renderLoginForm()

    await user.type(screen.getByLabelText('Электронная почта'), 'test@mail.ru')
    await user.type(screen.getByLabelText('Пароль'), 'wrong-password')
    await user.click(screen.getByRole('button', { name: 'Войти' }))

    expect(
      await screen.findByText('Не удалось войти. Проверьте почту и пароль'),
    ).toBeInTheDocument()

    expect(saveAuthTokens).not.toHaveBeenCalled()
  })
})