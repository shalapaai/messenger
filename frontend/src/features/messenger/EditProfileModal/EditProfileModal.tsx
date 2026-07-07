import { useState, type ChangeEvent } from 'react'
import axios from 'axios'
import { useTranslation } from 'react-i18next'
import { AvatarUpload } from '../../profile/AvatarUpload'
import { AvatarCropModal } from '../../profile/AvatarCropModal'
import { getCroppedImage, type CroppedAreaPixels } from '../../../shared/lib/image'
import { isAllowedAvatarImage } from '../../../shared/lib/fileType'
import { profileApi } from '../../../shared/api/profileApi'
import { AvatarColorPicker } from '../../../shared/ui/AvatarColorPicker'
import type { UserProfile } from '../../../shared/types/user'
import s from './EditProfileModal.module.css'

const LOGIN_REGEX = /^[a-zA-Z0-9_]{3,30}$/
const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024
// должно совпадать с лимитами на бэкенде (UpdateUserProfileCommandValidator)
const DISPLAY_NAME_MAX_LENGTH = 100
const STATUS_MAX_LENGTH = 200
const PHONE_MAX_LENGTH = 20
const CITY_MAX_LENGTH = 100
const DEPARTMENT_MAX_LENGTH = 100

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
  const isNameEmpty     = hasTriedSubmit && !displayName.trim()
  const isNameTooLong   = displayName.trim().length > DISPLAY_NAME_MAX_LENGTH
  const isNameInvalid   = isNameEmpty || isNameTooLong
  const isLoginEmpty    = hasTriedSubmit && !trimmedLogin
  const isLoginBadFmt   = hasTriedSubmit && !!trimmedLogin && !LOGIN_REGEX.test(trimmedLogin)
  const isLoginInvalid  = isLoginEmpty || isLoginBadFmt || !!loginError
  const isStatusTooLong = editStatus.trim().length > STATUS_MAX_LENGTH
  const isPhoneTooLong  = editPhone.trim().length  > PHONE_MAX_LENGTH
  const isCityTooLong   = editCity.trim().length   > CITY_MAX_LENGTH
  const isDeptTooLong   = editDept.trim().length   > DEPARTMENT_MAX_LENGTH
  const hasOptionalFieldError = isStatusTooLong || isPhoneTooLong || isCityTooLong || isDeptTooLong

  function handleAvatarChange(file: File) {
    if (!isAllowedAvatarImage(file)) {
      setFormError(t('profileSetup.errors.avatarInvalidType'))
      return
    }
    setFormError('')
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
    // Ни один запрос не уходит, пока хоть одно поле (даже необязательное) невалидно —
    // иначе бэкенд может успеть сохранить часть полей до того, как найдёт невалидное
    if (!displayName.trim() || isNameTooLong || !trimmedLogin || isLoginBadFmt || hasOptionalFieldError) return
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
                {isNameEmpty && <span className={s.modalFieldError}>{t('profileSetup.errors.displayNameRequired')}</span>}
                {isNameTooLong && <span className={s.modalFieldError}>{t('profileSetup.errors.displayNameTooLong', { max: DISPLAY_NAME_MAX_LENGTH })}</span>}
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
                <input className={`${s.modalFieldInput} ${isStatusTooLong ? s.modalFieldInputError : ''}`} type="text" value={editStatus} onChange={(e: ChangeEvent<HTMLInputElement>) => setEditStatus(e.target.value)} placeholder={t('profileSetup.statusPlaceholder')} />
                {isStatusTooLong && <span className={s.modalFieldError}>{t('profileSetup.errors.statusTooLong', { max: STATUS_MAX_LENGTH })}</span>}
              </label>
              <label className={s.modalField}>
                <span className={s.modalFieldLabel}>{t('common.phone')}</span>
                <input className={`${s.modalFieldInput} ${isPhoneTooLong ? s.modalFieldInputError : ''}`} type="text" value={editPhone} onChange={(e: ChangeEvent<HTMLInputElement>) => setEditPhone(e.target.value)} placeholder="+7 000 000-00-00" />
                {isPhoneTooLong && <span className={s.modalFieldError}>{t('profileSetup.errors.phoneTooLong', { max: PHONE_MAX_LENGTH })}</span>}
              </label>
              <label className={s.modalField}>
                <span className={s.modalFieldLabel}>{t('common.city')}</span>
                <input className={`${s.modalFieldInput} ${isCityTooLong ? s.modalFieldInputError : ''}`} type="text" value={editCity} onChange={(e: ChangeEvent<HTMLInputElement>) => setEditCity(e.target.value)} placeholder={t('profileSetup.cityPlaceholder')} />
                {isCityTooLong && <span className={s.modalFieldError}>{t('profileSetup.errors.cityTooLong', { max: CITY_MAX_LENGTH })}</span>}
              </label>
              <label className={s.modalField}>
                <span className={s.modalFieldLabel}>{t('common.department')}</span>
                <input className={`${s.modalFieldInput} ${isDeptTooLong ? s.modalFieldInputError : ''}`} type="text" value={editDept} onChange={(e: ChangeEvent<HTMLInputElement>) => setEditDept(e.target.value)} placeholder={t('profileSetup.departmentPlaceholder')} />
                {isDeptTooLong && <span className={s.modalFieldError}>{t('profileSetup.errors.departmentTooLong', { max: DEPARTMENT_MAX_LENGTH })}</span>}
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
