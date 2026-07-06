import { useState, type ChangeEvent } from 'react'
import axios from 'axios'
import { useTranslation } from 'react-i18next'
import { AvatarUpload } from '../../profile/AvatarUpload'
import { AvatarCropModal } from '../../profile/AvatarCropModal'
import { getCroppedImage, type CroppedAreaPixels } from '../../../shared/lib/image'
import { profileApi } from '../../../shared/api/profileApi'
import { AvatarColorPicker } from '../../../shared/ui/AvatarColorPicker'
import type { UserProfile } from '../../../shared/types/user'
import s from './EditProfileModal.module.css'

const LOGIN_REGEX = /^[a-zA-Z0-9_]{3,30}$/
const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024

interface EditProfileModalProps {
  isOpen: boolean
  profile: UserProfile
  onClose: () => void
  onSave: (updated: UserProfile) => void
}

export function EditProfileModal(props: EditProfileModalProps) {
  if (!props.isOpen) return null

  return <EditProfileModalContent {...props} />
}

function EditProfileModalContent({ profile, onClose, onSave }: EditProfileModalProps) {
  const { t } = useTranslation()
  const [displayName,  setDisplayName]  = useState(profile.displayName)
  const [avatarColor,  setAvatarColor]  = useState(profile.avatarColor)
  const [editLogin,    setEditLogin]    = useState(profile.login?.replace(/^@/, '') ?? '')
  const [editStatus,  setEditStatus]  = useState(profile.status ?? '')
  const [editPhone,   setEditPhone]   = useState(profile.phone ?? '')
  const [editCity,    setEditCity]    = useState(profile.city ?? '')
  const [editDept,    setEditDept]    = useState(profile.department ?? '')
  const [avatarPreview,      setAvatarPreview]      = useState<string | undefined>(undefined)
  const [avatarRemoved,      setAvatarRemoved]      = useState(false)
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null)
  const [croppedAvatarFile,  setCroppedAvatarFile]  = useState<File | null>(null)
  const [cropImageSrc,       setCropImageSrc]       = useState<string | undefined>(undefined)
  const [hasTriedSubmit, setHasTriedSubmit] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [formError, setFormError] = useState('')
  const [loginError, setLoginError] = useState('')

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
    if (croppedAvatarFile && croppedAvatarFile.size > MAX_AVATAR_SIZE_BYTES) {
      setFormError(t('profileSetup.errors.avatarTooLarge'))
      return
    }
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
        avatarColor,
      })

      if (avatarRemoved && !croppedAvatarFile) {
        await profileApi.removeAvatar()
      } else if (croppedAvatarFile) {
        await profileApi.uploadAvatar(croppedAvatarFile)
      }

      const updated = await profileApi.getMe()
      onSave(updated)
      onClose()
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        setLoginError(t('profileSetup.errors.loginTaken'))
      } else {
        setFormError(t('profile.saveFailed'))
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
            <span className={s.modalTitle}>{t('profile.editTitle')}</span>
            <button type="button" className={s.modalClose} onClick={onClose}>✕</button>
          </div>
          <form onSubmit={handleSubmit} className={s.modalForm} noValidate>
            <div className={s.modalAvatarBlock}>
              <AvatarUpload
                name={displayName}
                avatarPreview={avatarRemoved ? undefined : (avatarPreview ?? profile.avatarUrl ?? undefined)}
                color={avatarColor}
                onChange={(file) => { setAvatarRemoved(false); handleAvatarChange(file) }}
                onRemove={() => { setAvatarPreview(undefined); setAvatarRemoved(true); setCroppedAvatarFile(null) }}
              />
              <div className={s.colorPickerWrap}>
                <span className={s.colorPickerLabel}>{t('avatar.color')}</span>
                <AvatarColorPicker value={avatarColor} onChange={setAvatarColor} />
              </div>
            </div>
            <div className={s.modalFields}>
              <label className={s.modalField}>
                <span className={s.modalFieldLabel}>{t('common.displayName')} <span className={s.required}>*</span></span>
                <input
                  className={`${s.modalFieldInput} ${isNameInvalid ? s.modalFieldInputError : ''}`}
                  type="text" value={displayName}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setDisplayName(e.target.value)}
                  placeholder={t('profileSetup.displayNamePlaceholder')}
                />
                {isNameInvalid && <span className={s.modalFieldError}>{t('profileSetup.errors.displayNameRequired')}</span>}
              </label>
              <label className={s.modalField}>
                <span className={s.modalFieldLabel}>{t('common.login')} <span className={s.required}>*</span></span>
                <div className={`${s.loginInputWrapper} ${isLoginInvalid ? s.loginInputWrapperError : ''}`}>
                  <span className={s.loginPrefix}>@</span>
                  <input
                    className={s.loginInput}
                    type="text"
                    value={editLogin}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => { setEditLogin(e.target.value.replace(/^@+/, '')); setLoginError('') }}
                    placeholder={t('profileSetup.loginPlaceholder')}
                    aria-invalid={isLoginInvalid}
                  />
                </div>
                {isLoginEmpty && <span className={s.modalFieldError}>{t('profileSetup.errors.loginRequired')}</span>}
                {isLoginBadFmt && <span className={s.modalFieldError}>{t('profileSetup.errors.loginFormat')}</span>}
                {loginError && <span className={s.modalFieldError}>{loginError}</span>}
              </label>
              <label className={s.modalField}>
                <span className={s.modalFieldLabel}>{t('common.status')}</span>
                <input className={s.modalFieldInput} type="text" value={editStatus} onChange={(e: ChangeEvent<HTMLInputElement>) => setEditStatus(e.target.value)} placeholder={t('profileSetup.statusPlaceholder')} />
              </label>
              <label className={s.modalField}>
                <span className={s.modalFieldLabel}>{t('common.phone')}</span>
                <input className={s.modalFieldInput} type="text" value={editPhone} onChange={(e: ChangeEvent<HTMLInputElement>) => setEditPhone(e.target.value)} placeholder="+7 000 000-00-00" />
              </label>
              <label className={s.modalField}>
                <span className={s.modalFieldLabel}>{t('common.city')}</span>
                <input className={s.modalFieldInput} type="text" value={editCity} onChange={(e: ChangeEvent<HTMLInputElement>) => setEditCity(e.target.value)} placeholder={t('profileSetup.cityPlaceholder')} />
              </label>
              <label className={s.modalField}>
                <span className={s.modalFieldLabel}>{t('common.department')}</span>
                <input className={s.modalFieldInput} type="text" value={editDept} onChange={(e: ChangeEvent<HTMLInputElement>) => setEditDept(e.target.value)} placeholder={t('profileSetup.departmentPlaceholder')} />
              </label>
            </div>
            {formError && <p className={s.modalFormError}>{formError}</p>}
            <div className={s.modalActions}>
              <button type="button" className={s.modalCancelBtn} onClick={onClose}>{t('common.cancel')}</button>
              <button type="submit" className={s.modalSaveBtn} disabled={isLoading}>{isLoading ? t('common.saving') : t('common.save')}</button>
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
