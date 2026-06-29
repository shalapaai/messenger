import { useState, useEffect, type ChangeEvent } from 'react'
import axios from 'axios'
import { AvatarUpload } from '../../profile/AvatarUpload'
import { AvatarCropModal } from '../../profile/AvatarCropModal'
import { getCroppedImage, type CroppedAreaPixels } from '../../../shared/lib/image'
import { profileApi } from '../../../shared/api/profileApi'
import type { UserProfile } from '../../../shared/types/user'
import s from './EditProfileModal.module.css'

const LOGIN_REGEX = /^[a-zA-Z0-9_]{3,30}$/

interface EditProfileModalProps {
  isOpen: boolean
  profile: UserProfile
  onClose: () => void
  onSave: (updated: UserProfile) => void
}

export function EditProfileModal({ isOpen, profile, onClose, onSave }: EditProfileModalProps) {
  const [displayName, setDisplayName] = useState(profile.displayName)
  const [editLogin,   setEditLogin]   = useState(profile.login?.replace(/^@/, '') ?? '')
  const [editStatus,  setEditStatus]  = useState(profile.status ?? '')
  const [editPhone,   setEditPhone]   = useState(profile.phone ?? '')
  const [editCity,    setEditCity]    = useState(profile.city ?? '')
  const [editDept,    setEditDept]    = useState(profile.department ?? '')
  const [avatarPreview,      setAvatarPreview]      = useState<string | undefined>(undefined)
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null)
  const [croppedAvatarFile,  setCroppedAvatarFile]  = useState<File | null>(null)
  const [cropImageSrc,       setCropImageSrc]       = useState<string | undefined>(undefined)
  const [hasTriedSubmit, setHasTriedSubmit] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [formError, setFormError] = useState('')
  const [loginError, setLoginError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setDisplayName(profile.displayName)
      setEditLogin(profile.login?.replace(/^@/, '') ?? '')
      setEditStatus(profile.status ?? '')
      setEditPhone(profile.phone ?? '')
      setEditCity(profile.city ?? '')
      setEditDept(profile.department ?? '')
      setAvatarPreview(undefined)
      setCroppedAvatarFile(null)
      setHasTriedSubmit(false)
      setFormError('')
      setLoginError('')
    }
  }, [isOpen, profile])

  if (!isOpen) return null

  const trimmedLogin    = editLogin.trim()
  const isNameInvalid   = hasTriedSubmit && !displayName.trim()
  const isLoginEmpty    = hasTriedSubmit && !trimmedLogin
  const isLoginBadFmt   = hasTriedSubmit && !!trimmedLogin && !LOGIN_REGEX.test(trimmedLogin)
  const isLoginInvalid  = isLoginEmpty || isLoginBadFmt || !!loginError

  function handleAvatarChange(file: File) {
    setSelectedAvatarFile(file)
    setCropImageSrc(URL.createObjectURL(file))
  }

  function handleCropCancel() {
    setCropImageSrc(undefined)
    setSelectedAvatarFile(null)
  }

  async function handleCropConfirm(croppedAreaPixels: CroppedAreaPixels) {
    if (!selectedAvatarFile || !cropImageSrc) return
    const croppedFile = await getCroppedImage(cropImageSrc, croppedAreaPixels, selectedAvatarFile.name, selectedAvatarFile.type)
    setCroppedAvatarFile(croppedFile)
    setAvatarPreview(URL.createObjectURL(croppedFile))
    setCropImageSrc(undefined)
    setSelectedAvatarFile(null)
  }

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault()
    setHasTriedSubmit(true)
    if (!displayName.trim() || !trimmedLogin || isLoginBadFmt) return
    setFormError('')
    setLoginError('')
    setIsLoading(true)
    try {
      await profileApi.update({
        displayName: displayName.trim(),
        login:       trimmedLogin,
        status:      editStatus.trim(),
        phone:       editPhone.trim(),
        city:        editCity.trim(),
        department:  editDept.trim(),
      })

      if (croppedAvatarFile) {
        await profileApi.uploadAvatar(croppedAvatarFile)
      }

      const updated = await profileApi.getMe()
      onSave(updated)
      onClose()
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        setLoginError('Логин уже занят')
      } else {
        console.error('Profile update error:', err)
        setFormError('Не удалось сохранить профиль. Попробуйте ещё раз.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <div className={s.modalOverlay} onClick={onClose}>
        <div className={s.modalPanel} onClick={e => e.stopPropagation()}>
          <div className={s.modalHeader}>
            <span className={s.modalTitle}>Редактирование профиля</span>
            <button type="button" className={s.modalClose} onClick={onClose}>✕</button>
          </div>
          <form onSubmit={handleSubmit} className={s.modalForm} noValidate>
            <div className={s.modalAvatarBlock}>
              <AvatarUpload
                name={displayName}
                avatarPreview={avatarPreview ?? profile.avatarUrl ?? undefined}
                onChange={handleAvatarChange}
              />
            </div>
            <div className={s.modalFields}>
              <label className={s.modalField}>
                <span className={s.modalFieldLabel}>Имя пользователя <span className={s.required}>*</span></span>
                <input
                  className={`${s.modalFieldInput} ${isNameInvalid ? s.modalFieldInputError : ''}`}
                  type="text" value={displayName}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setDisplayName(e.target.value)}
                  placeholder="Например, Николай"
                />
                {isNameInvalid && <span className={s.modalFieldError}>Введите имя пользователя</span>}
              </label>
              <label className={s.modalField}>
                <span className={s.modalFieldLabel}>Логин <span className={s.required}>*</span></span>
                <div className={`${s.loginInputWrapper} ${isLoginInvalid ? s.loginInputWrapperError : ''}`}>
                  <span className={s.loginPrefix}>@</span>
                  <input
                    className={s.loginInput}
                    type="text"
                    value={editLogin}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => { setEditLogin(e.target.value.replace(/^@+/, '')); setLoginError('') }}
                    placeholder="например, nikolay"
                    aria-invalid={isLoginInvalid}
                  />
                </div>
                {isLoginEmpty && <span className={s.modalFieldError}>Введите логин</span>}
                {isLoginBadFmt && <span className={s.modalFieldError}>3–30 символов: буквы, цифры и _</span>}
                {loginError && <span className={s.modalFieldError}>{loginError}</span>}
              </label>
              <label className={s.modalField}>
                <span className={s.modalFieldLabel}>Статус</span>
                <input className={s.modalFieldInput} type="text" value={editStatus} onChange={(e: ChangeEvent<HTMLInputElement>) => setEditStatus(e.target.value)} placeholder="Например, на связи" />
              </label>
              <label className={s.modalField}>
                <span className={s.modalFieldLabel}>Телефон</span>
                <input className={s.modalFieldInput} type="text" value={editPhone} onChange={(e: ChangeEvent<HTMLInputElement>) => setEditPhone(e.target.value)} placeholder="+7 000 000-00-00" />
              </label>
              <label className={s.modalField}>
                <span className={s.modalFieldLabel}>Город</span>
                <input className={s.modalFieldInput} type="text" value={editCity} onChange={(e: ChangeEvent<HTMLInputElement>) => setEditCity(e.target.value)} placeholder="Например, Москва" />
              </label>
              <label className={s.modalField}>
                <span className={s.modalFieldLabel}>Отдел</span>
                <input className={s.modalFieldInput} type="text" value={editDept} onChange={(e: ChangeEvent<HTMLInputElement>) => setEditDept(e.target.value)} placeholder="Например, Разработка" />
              </label>
            </div>
            {formError && <p className={s.modalFormError}>{formError}</p>}
            <div className={s.modalActions}>
              <button type="button" className={s.modalCancelBtn} onClick={onClose}>Отмена</button>
              <button type="submit" className={s.modalSaveBtn} disabled={isLoading}>{isLoading ? 'Сохраняем...' : 'Сохранить'}</button>
            </div>
          </form>
        </div>
      </div>

      {cropImageSrc && (
        <AvatarCropModal
          imageSrc={cropImageSrc}
          onCancel={handleCropCancel}
          onConfirm={handleCropConfirm}
        />
      )}
    </>
  )
}
