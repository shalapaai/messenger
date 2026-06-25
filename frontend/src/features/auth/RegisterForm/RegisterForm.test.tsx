import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import RegisterForm from './RegisterForm'

function renderRegisterForm() {
  return render(
    <MemoryRouter>
      <RegisterForm />
    </MemoryRouter>,
  )
}

describe('RegisterForm', () => {
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
  })

  it('shows error when email is invalid', async () => {
    const user = userEvent.setup()

    renderRegisterForm()

    await user.type(screen.getByLabelText('Электронная почта'), 'wrong-email')
    await user.type(screen.getByLabelText('Пароль'), 'password123')
    await user.type(screen.getByLabelText('Повторите пароль'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Зарегистрироваться' }))

    expect(screen.getByText('Введите электронную почту в правильном формате')).toBeInTheDocument()
  })

  it('shows error when password is too short', async () => {
    const user = userEvent.setup()

    renderRegisterForm()

    await user.type(screen.getByLabelText('Электронная почта'), 'test@mail.ru')
    await user.type(screen.getByLabelText('Пароль'), '123')
    await user.type(screen.getByLabelText('Повторите пароль'), '123')
    await user.click(screen.getByRole('button', { name: 'Зарегистрироваться' }))

    expect(screen.getByText('Пароль должен быть не короче 6 символов')).toBeInTheDocument()
  })

  it('shows error when passwords do not match', async () => {
    const user = userEvent.setup()

    renderRegisterForm()

    await user.type(screen.getByLabelText('Электронная почта'), 'test@mail.ru')
    await user.type(screen.getByLabelText('Пароль'), 'password123')
    await user.type(screen.getByLabelText('Повторите пароль'), 'password456')
    await user.click(screen.getByRole('button', { name: 'Зарегистрироваться' }))

    expect(screen.getByText('Пароли не совпадают')).toBeInTheDocument()
  })

  it('submits form when data is valid', async () => {
    const user = userEvent.setup()
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    renderRegisterForm()

    await user.type(screen.getByLabelText('Электронная почта'), 'test@mail.ru')
    await user.type(screen.getByLabelText('Пароль'), 'password123')
    await user.type(screen.getByLabelText('Повторите пароль'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Зарегистрироваться' }))

    expect(consoleSpy).toHaveBeenCalledWith('Register form submitted:', {
      email: 'test@mail.ru',
      password: 'password123',
    })

    consoleSpy.mockRestore()
  })
})