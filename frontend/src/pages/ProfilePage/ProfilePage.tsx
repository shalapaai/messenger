import { useState, useEffect, type FormEvent, type ChangeEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { AvatarCropModal } from '../../features/profile/AvatarCropModal'
import { AvatarUpload } from '../../features/profile/AvatarUpload'
import { getCroppedImage } from '../../shared/lib/image'
import type { CroppedAreaPixels } from '../../shared/lib/image'
import s from './ProfilePage.module.css'

const STUB_USER = {
  initials: 'АС',
  fullName: 'Анна Соколова',
  username: '@anna.sokolova',
  bio: 'Продакт-дизайнер в команде TravelLine. Веду проекты интерфейсов и обожаю осмысленные диалоги. Пишите — отвечаю быстро ☺',
  city: 'Москва',
  since: 'С марта 2023',
  email: 'anna.sokolova@travelline.tech',
  phone: '+7 905 •• •• 12',
}

const NAV_ITEMS = [
  { id: 'chats',   label: 'Чаты',    glyph: '💬', badge: '12', path: '/chats'   },
  { id: 'profile', label: 'Профиль', glyph: '👤', badge: '',   path: '/profile' },
]

export function ProfilePage() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const user = STUB_USER

  const [editOpen, setEditOpen] = useState(false)
  const [displayName, setDisplayName] = useState(user.fullName)
  const [status, setStatus] = useState('')
  const [avatar, setAvatar] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>(undefined)
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null)
  const [cropImageSrc, setCropImageSrc] = useState<string | undefined>(undefined)
  const [hasTriedSubmit, setHasTriedSubmit] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const isNameInvalid = hasTriedSubmit && !displayName.trim()

  useEffect(() => {
    if (!editOpen) return
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') closeModal() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [editOpen])

  useEffect(() => {
    return () => { if (avatarPreview) URL.revokeObjectURL(avatarPreview) }
  }, [avatarPreview])

  useEffect(() => {
    return () => { if (cropImageSrc) URL.revokeObjectURL(cropImageSrc) }
  }, [cropImageSrc])

  function openModal() {
    setDisplayName(user.fullName)
    setStatus('')
    setAvatar(null)
    setAvatarPreview(undefined)
    setSelectedAvatarFile(null)
    setCropImageSrc(undefined)
    setHasTriedSubmit(false)
    setError('')
    setEditOpen(true)
  }

  function closeModal() {
    setCropImageSrc(undefined)
    setSelectedAvatarFile(null)
    setEditOpen(false)
  }

  function handleAvatarChange(file: File) {
    setSelectedAvatarFile(file)
    setCropImageSrc(URL.createObjectURL(file))
  }

  function handleCropCancel() {
    setCropImageSrc(undefined)
    setSelectedAvatarFile(null)
  }

  async function handleCropConfirm(croppedAreaPixels: CroppedAreaPixels) {
    if (!selectedAvatarFile || !cropImageSrc) {
      return
    }

    const croppedFile = await getCroppedImage(
      cropImageSrc,
      croppedAreaPixels,
      selectedAvatarFile.name,
      selectedAvatarFile.type,
    )

    setAvatar(croppedFile)
    setAvatarPreview(URL.createObjectURL(croppedFile))

    setCropImageSrc(undefined)
    setSelectedAvatarFile(null)
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setHasTriedSubmit(true)
    if (!displayName.trim()) return
    setError('')
    setIsLoading(true)
    try {
      console.log({ displayName: displayName.trim(), status: status.trim(), avatar })
      closeModal()
    } catch {
      setError('Не удалось сохранить профиль. Попробуйте ещё раз.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={s.root}>
      {/* Mobile top bar */}
      <header className={s.topBar}>
        <div className={s.topBarLogo}>TL:MESSENGER</div>
        <div className={s.topBarAvatar}>{user.initials}</div>
      </header>

      <div className={s.body}>
        {/* Desktop sidebar */}
        <aside className={s.sidebar}>
          <div className={s.sidebarLogo}>TL:MESSENGER</div>
          <nav className={s.nav}>
            {NAV_ITEMS.map(item => (
              <button
                key={item.id}
                className={`${s.navItem} ${pathname === item.path ? s.navItemActive : ''}`}
                onClick={() => navigate(item.path)}
              >
                <span className={s.navGlyph}>{item.glyph}</span>
                <span>{item.label}</span>
                {item.badge && <span className={s.navBadge}>{item.badge}</span>}
              </button>
            ))}
          </nav>
          <div className={s.sidebarUser}>
            <div className={s.sidebarUserAvatar}>{user.initials}</div>
            <div style={{ minWidth: 0 }}>
              <div className={s.sidebarUserName}>{user.fullName}</div>
              <div className={s.sidebarUserStatus}>
                <span className={s.onlineDot} />
                в сети
              </div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className={s.main}>
          <div className={s.content}>
            {/* Header */}
            <div className={s.pageHeader}>
              <div>
                <div className={s.pageLabel}>ПРОФИЛЬ</div>
                <h1 className={s.pageTitle}>Мой аккаунт</h1>
              </div>
              <button className={s.editBtn} onClick={openModal}>
                <span>✎</span> Изменить профиль
              </button>
            </div>

            {/* Profile card */}
            <div className={s.profileCard}>
              <div className={s.cover} />
              <div className={s.cardBody}>
                <div className={s.statusBadge}>
                  <span className={s.statusDot} />
                  В сети
                </div>
                <div className={s.avatar}>{user.initials}</div>
                <div className={s.nameSection}>
                  <h2 className={s.fullName}>{user.fullName}</h2>
                </div>
                <p className={s.bio}>{user.bio}</p>
                <div className={s.tags}>
                  <span className={s.tag}>📍 {user.city}</span>
                  <span className={s.tag}>📅 {user.since}</span>
                </div>
              </div>
            </div>

            {/* Details */}
            <div className={s.details}>
              <div className={s.detailRow}>
                <span className={s.detailLabel}>Эл. почта</span>
                <span className={s.detailValue}>{user.email}</span>
              </div>
              <div className={s.detailRow}>
                <span className={s.detailLabel}>Телефон</span>
                <span className={s.detailValue}>{user.phone}</span>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className={s.bottomNav}>
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            className={`${s.bottomNavItem} ${pathname === item.path ? s.bottomNavItemActive : ''}`}
            onClick={() => navigate(item.path)}
          >
            <span className={s.bottomGlyph}>
              {item.glyph}
              {item.badge && <span className={s.bottomBadge}>{item.badge}</span>}
            </span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Edit profile modal */}
      {editOpen && (
        <div className={s.modalOverlay} onClick={closeModal}>
          <div className={s.modalPanel} onClick={e => e.stopPropagation()}>
            <div className={s.modalHeader}>
              <span className={s.modalTitle}>Редактирование профиля</span>
              <button type="button" className={s.modalClose} onClick={closeModal}>✕</button>
            </div>

            <form onSubmit={handleSubmit} className={s.modalForm} noValidate>
              <div className={s.avatarBlock}>
                <AvatarUpload
                  name={displayName}
                  avatarPreview={avatarPreview}
                  onChange={handleAvatarChange}
                />
              </div>

              <div className={s.fields}>
                <label className={s.field}>
                  <span className={s.fieldLabel}>
                    Имя пользователя
                    <span className={s.required}>*</span>
                  </span>
                  <input
                    className={`${s.fieldInput} ${isNameInvalid ? s.fieldInputError : ''}`}
                    type="text"
                    value={displayName}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setDisplayName(e.target.value)}
                    placeholder="Например, Николай"
                    required
                  />
                  {isNameInvalid && (
                    <span className={s.fieldError}>Введите имя пользователя</span>
                  )}
                </label>

                <label className={s.field}>
                  <span className={s.fieldLabel}>Статус</span>
                  <input
                    className={s.fieldInput}
                    type="text"
                    value={status}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setStatus(e.target.value)}
                    placeholder="Например, на связи"
                  />
                </label>
              </div>

              {error && <p className={s.formError}>{error}</p>}

              <div className={s.modalActions}>
                <button type="button" className={s.cancelBtn} onClick={closeModal}>
                  Отмена
                </button>
                <button type="submit" className={s.saveBtn} disabled={isLoading}>
                  {isLoading ? 'Сохраняем...' : 'Сохранить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {cropImageSrc && (
        <AvatarCropModal
          imageSrc={cropImageSrc}
          onCancel={handleCropCancel}
          onConfirm={handleCropConfirm}
        />
      )}
    </div>
  )
}

export default ProfilePage
