import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ProfileSetupForm from './ProfileSetupForm'

const createObjectURL = vi.fn()
const revokeObjectURL = vi.fn()

function renderProfileSetupForm() {
  return render(<ProfileSetupForm />)
}

describe('ProfileSetupForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('URL', {
      createObjectURL,
      revokeObjectURL,
    })

    createObjectURL.mockReturnValue('blob:avatar-preview')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renders profile fields and avatar upload', () => {
    renderProfileSetupForm()

    expect(screen.getByLabelText(/Имя пользователя/)).toBeInTheDocument()
    expect(screen.getByLabelText('Статус')).toBeInTheDocument()
    expect(screen.getByLabelText('Выбрать фото')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Продолжить' })).toBeInTheDocument()
  })

  it('shows error when display name is empty', async () => {
    const user = userEvent.setup()
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    renderProfileSetupForm()

    await user.click(screen.getByRole('button', { name: 'Продолжить' }))

    expect(screen.getByText('Введите имя пользователя')).toBeInTheDocument()
    expect(screen.getByLabelText(/Имя пользователя/)).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    expect(consoleLog).not.toHaveBeenCalled()
  })

  it('submits trimmed profile data when display name is filled', async () => {
    const user = userEvent.setup()
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    renderProfileSetupForm()

    await user.type(screen.getByLabelText(/Имя пользователя/), '  Николай  ')
    await user.type(screen.getByLabelText('Статус'), '  на связи  ')
    await user.click(screen.getByRole('button', { name: 'Продолжить' }))

    await waitFor(() => {
      expect(consoleLog).toHaveBeenCalledWith({
        displayName: 'Николай',
        status: 'на связи',
        avatar: null,
      })
    })
  })

  it('creates avatar preview when image is uploaded and revokes it on unmount', async () => {
    const user = userEvent.setup()
    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' })

    const { unmount } = renderProfileSetupForm()

    await user.type(screen.getByLabelText(/Имя пользователя/), 'Николай')
    await user.upload(screen.getByLabelText('Выбрать фото'), file)

    expect(createObjectURL).toHaveBeenCalledWith(file)
    expect(screen.getByLabelText('Заменить фото')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Николай' })).toHaveAttribute(
      'src',
      'blob:avatar-preview',
    )

    unmount()

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:avatar-preview')
  })
})
