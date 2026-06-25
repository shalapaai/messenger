import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { register } from '../api/authApi'
import { saveAuthTokens } from '../../../shared/lib/auth/authTokens'
import RegisterForm from './RegisterForm'

vi.mock('../api/authApi', () => ({
  register: vi.fn(),
}))

vi.mock('../../../shared/lib/auth/authTokens', () => ({
  saveAuthTokens: vi.fn(),
}))

function renderRegisterForm() {
  return render(
    <MemoryRouter>
      <RegisterForm />
    </MemoryRouter>,
  )
}

describe('RegisterForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders email and password fields', () => {
    renderRegisterForm()

    expect(screen.getByLabelText('Электронная почта')).toBeInTheDocument()
    expect(screen.getByLabelText('Пароль')).toBeInTheDocument()
    expect(screen.getByLabelText('Повторите пароль')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Зарегистрироваться' })).toBeInTheDocument()
  })

  it('shows error when fields are empty', async () => {
    const user = userEvent.setup()

    renderRegisterForm()

    await user.click(screen.getByRole('button', { name: 'Зарегистрироваться' }))

    expect(screen.getByText('Заполните все поля')).toBeInTheDocument()
    expect(register).not.toHaveBeenCalled()
  })

  it('shows error when email is invalid', async () => {
    const user = userEvent.setup()

    renderRegisterForm()

    await user.type(screen.getByLabelText('Электронная почта'), 'wrong-email')
    await user.type(screen.getByLabelText('Пароль'), 'password123')
    await user.type(screen.getByLabelText('Повторите пароль'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Зарегистрироваться' }))

    expect(screen.getByText('Введите электронную почту в правильном формате')).toBeInTheDocument()
    expect(register).not.toHaveBeenCalled()
  })

  it('shows error when password is too short', async () => {
    const user = userEvent.setup()

    renderRegisterForm()

    await user.type(screen.getByLabelText('Электронная почта'), 'test@mail.ru')
    await user.type(screen.getByLabelText('Пароль'), '1234567')
    await user.type(screen.getByLabelText('Повторите пароль'), '1234567')
    await user.click(screen.getByRole('button', { name: 'Зарегистрироваться' }))

    expect(screen.getByText('Пароль должен быть не короче 8 символов')).toBeInTheDocument()
    expect(register).not.toHaveBeenCalled()
  })

  it('shows error when passwords do not match', async () => {
    const user = userEvent.setup()

    renderRegisterForm()

    await user.type(screen.getByLabelText('Электронная почта'), 'test@mail.ru')
    await user.type(screen.getByLabelText('Пароль'), 'password123')
    await user.type(screen.getByLabelText('Повторите пароль'), 'password456')
    await user.click(screen.getByRole('button', { name: 'Зарегистрироваться' }))

    expect(screen.getByText('Пароли не совпадают')).toBeInTheDocument()
    expect(register).not.toHaveBeenCalled()
  })

  it('submits form when data is valid', async () => {
    const user = userEvent.setup()

    vi.mocked(register).mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    })

    renderRegisterForm()

    await user.type(screen.getByLabelText('Электронная почта'), 'test@mail.ru')
    await user.type(screen.getByLabelText('Пароль'), 'password123')
    await user.type(screen.getByLabelText('Повторите пароль'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Зарегистрироваться' }))

    await waitFor(() => {
      expect(register).toHaveBeenCalledWith({
        email: 'test@mail.ru',
        password: 'password123',
      })
    })

    expect(saveAuthTokens).toHaveBeenCalledWith({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    })
  })

  it('shows error when register request fails', async () => {
    const user = userEvent.setup()

    vi.mocked(register).mockRejectedValue(new Error('Register failed'))

    renderRegisterForm()

    await user.type(screen.getByLabelText('Электронная почта'), 'test@mail.ru')
    await user.type(screen.getByLabelText('Пароль'), 'password123')
    await user.type(screen.getByLabelText('Повторите пароль'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Зарегистрироваться' }))

    expect(
      await screen.findByText('Не удалось зарегистрироваться. Возможно, эта почта уже используется'),
    ).toBeInTheDocument()

    expect(saveAuthTokens).not.toHaveBeenCalled()
  })
})