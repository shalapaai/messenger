import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getCroppedImage } from '../../../shared/lib/image'
import ProfileSetupForm from './ProfileSetupForm'

const createObjectURL = vi.fn()
const revokeObjectURL = vi.fn()
const userProfileMock = vi.hoisted(() => ({
  setProfile: vi.fn(),
}))

vi.mock('../../../shared/lib/image', () => ({
  getCroppedImage: vi.fn(),
}))

vi.mock('../../../shared/context/UserProfileContext', () => ({
  useUserProfile: () => ({
    setProfile: userProfileMock.setProfile,
  }),
}))

vi.mock('../AvatarCropModal', () => ({
  AvatarCropModal: ({
    imageSrc,
    onCancel,
    onConfirm,
  }: {
    imageSrc: string
    onCancel: () => void
    onConfirm: (area: { x: number; y: number; width: number; height: number }) => void
  }) => (
    <div role="dialog" aria-label="Обрезать фото">
      <span>{imageSrc}</span>
      <button type="button" onClick={onCancel}>
        Отмена
      </button>
      <button
        type="button"
        onClick={() => onConfirm({ x: 1, y: 2, width: 120, height: 120 })}
      >
        Сохранить фото
      </button>
    </div>
  ),
}))

function renderProfileSetupForm() {
  return render(
    <MemoryRouter>
      <ProfileSetupForm />
    </MemoryRouter>,
  )
}

describe('ProfileSetupForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    userProfileMock.setProfile.mockReset()
    createObjectURL.mockReset()
    revokeObjectURL.mockReset()
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

  it('does not show validation error when display name is filled', async () => {
    const user = userEvent.setup()

    renderProfileSetupForm()

    await user.type(screen.getByLabelText(/Имя пользователя/), '  Николай  ')
    await user.type(screen.getByLabelText('Статус'), '  на связи  ')
    await user.click(screen.getByRole('button', { name: 'Продолжить' }))

    await waitFor(() => {
      expect(screen.queryByText('Введите имя пользователя')).not.toBeInTheDocument()
    })
  })

  it('opens crop modal and creates cropped avatar preview after confirmation', async () => {
    const user = userEvent.setup()
    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' })
    const croppedFile = new File(['cropped-avatar'], 'avatar.png', {
      type: 'image/png',
    })

    createObjectURL.mockImplementation((value) => {
      if (value === croppedFile) {
        return 'blob:cropped-avatar'
      }

      return 'blob:original-avatar'
    })

    vi.mocked(getCroppedImage).mockResolvedValue(croppedFile)

    const { unmount } = renderProfileSetupForm()

    await user.type(screen.getByLabelText(/Имя пользователя/), 'Николай')
    await user.upload(screen.getByLabelText('Выбрать фото'), file)

    expect(createObjectURL).toHaveBeenCalledWith(file)
    expect(screen.getByRole('dialog', { name: 'Обрезать фото' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Сохранить фото' }))

    await waitFor(() => {
      expect(getCroppedImage).toHaveBeenCalledWith(
        'blob:original-avatar',
        { x: 1, y: 2, width: 120, height: 120 },
        'avatar.png',
        'image/png',
      )
    })

    expect(createObjectURL).toHaveBeenCalledWith(croppedFile)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:original-avatar')
    expect(screen.getByLabelText('Заменить фото')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByRole('img', { name: 'Николай' })).toHaveAttribute(
        'src',
        'blob:cropped-avatar',
      )
    })

    unmount()

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:cropped-avatar')
  })
})
