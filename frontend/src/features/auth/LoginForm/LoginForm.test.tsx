import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import LoginForm from './LoginForm'

function renderLoginForm() {
  return render(
    <MemoryRouter>
      <LoginForm />
    </MemoryRouter>,
  )
}

describe('LoginForm', () => {
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
  })

  it('shows error when email is invalid', async () => {
    const user = userEvent.setup()

    renderLoginForm()

    await user.type(screen.getByLabelText('Электронная почта'), 'wrong-email')
    await user.type(screen.getByLabelText('Пароль'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Войти' }))

    expect(screen.getByText('Введите электронную почту в правильном формате')).toBeInTheDocument()
  })

  it('submits form when email and password are valid', async () => {
    const user = userEvent.setup()
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    renderLoginForm()

    await user.type(screen.getByLabelText('Электронная почта'), 'test@mail.ru')
    await user.type(screen.getByLabelText('Пароль'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Войти' }))

    expect(consoleSpy).toHaveBeenCalledWith('Email form submitted:', {
      email: 'test@mail.ru',
      password: 'password123',
    })

    consoleSpy.mockRestore()
  })
})