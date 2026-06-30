import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { getCroppedImage } from '../../../shared/lib/image'
import type { CroppedAreaPixels } from '../../../shared/lib/image'
import { profileApi } from '../../../shared/api/profileApi'
import { useUserProfile } from '../../../shared/context/useUserProfile'
import { AvatarCropModal } from '../AvatarCropModal'
import { AvatarUpload } from '../AvatarUpload'
import { AvatarColorPicker } from '../../../shared/ui/AvatarColorPicker'
import { randomAvatarColor } from '../../../shared/lib/avatarColors'
import styles from './ProfileSetupForm.module.css'

const LOGIN_REGEX = /^[a-zA-Z0-9_]{3,30}$/
const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024

function ProfileSetupForm() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { setProfile } = useUserProfile()

  const [displayName, setDisplayName] = useState('')
  const [login, setLogin]             = useState('')
  const [status, setStatus]           = useState('')
  const [phone, setPhone]             = useState('')
  const [city, setCity]               = useState('')
  const [department, setDepartment]   = useState('')
  const [avatarColor, setAvatarColor]     = useState(() => randomAvatarColor())
  const [avatarPreview, setAvatarPreview] = useState<string>()
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null)
  const [croppedAvatarFile, setCroppedAvatarFile]   = useState<File | null>(null)
  const [cropImageSrc, setCropImageSrc] = useState<string>()
  const [error, setError] = useState('')
  const [loginError, setLoginError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [hasTriedSubmit, setHasTriedSubmit] = useState(false)

  const trimmedLogin = login.trim()
  const isDisplayNameInvalid = hasTriedSubmit && !displayName.trim()
  const isLoginEmpty   = hasTriedSubmit && !trimmedLogin
  const isLoginBadFmt  = hasTriedSubmit && !!trimmedLogin && !LOGIN_REGEX.test(trimmedLogin)
  const isLoginInvalid = isLoginEmpty || isLoginBadFmt || !!loginError

  useEffect(() => {
    return () => { if (avatarPreview) URL.revokeObjectURL(avatarPreview) }
  }, [avatarPreview])

  useEffect(() => {
    return () => { if (cropImageSrc) URL.revokeObjectURL(cropImageSrc) }
  }, [cropImageSrc])

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
    const croppedFile = await getCroppedImage(
      cropImageSrc, croppedAreaPixels,
      selectedAvatarFile.name, selectedAvatarFile.type,
    )
    setCroppedAvatarFile(croppedFile)
    setAvatarPreview(URL.createObjectURL(croppedFile))
    setCropImageSrc(undefined)
    setSelectedAvatarFile(null)
  }

  async function handleSubmit(event: { preventDefault(): void }) {
    event.preventDefault()
    setHasTriedSubmit(true)

    if (!displayName.trim() || !LOGIN_REGEX.test(trimmedLogin)) return

    if (croppedAvatarFile && croppedAvatarFile.size > MAX_AVATAR_SIZE_BYTES) {
      setError(t('profileSetup.errors.avatarTooLarge'))
      return
    }

    setError('')
    setLoginError('')
    setIsLoading(true)

    try {
      // Создаём профиль; 409 ProfileAlreadyExists — игнорируем и продолжаем
      try {
        await profileApi.create({ displayName: displayName.trim(), login: trimmedLogin, avatarColor })
      } catch (createErr) {
        if (!axios.isAxiosError(createErr) || createErr.response?.status !== 409) {
          throw createErr
        }
        if (createErr.response?.data?.code !== 'Users.ProfileAlreadyExists') {
          setLoginError(t('profileSetup.errors.loginTaken'))
          return
        }
      }

      // Обновляем опциональные поля (только непустые)
      const optionalFields = {
        status:     status.trim()     || undefined,
        phone:      phone.trim()      || undefined,
        city:       city.trim()       || undefined,
        department: department.trim() || undefined,
      }
      if (Object.values(optionalFields).some(Boolean)) {
        await profileApi.update(optionalFields)
      }

      if (croppedAvatarFile) {
        await profileApi.uploadAvatar(croppedAvatarFile)
      }

      const profile = await profileApi.getMe()
      setProfile(profile)
      navigate('/chats')
    } catch (err) {
      console.error('Profile setup error:', err)
      setError(t('profileSetup.errors.saveFailed'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        <div className={styles.avatarBlock}>
          <AvatarUpload
            name={displayName}
            avatarPreview={avatarPreview}
            color={avatarColor}
            onChange={handleAvatarChange}
            onRemove={() => { setAvatarPreview(undefined); setCroppedAvatarFile(null) }}
          />
          <div className={styles.colorPickerWrap}>
            <span className={styles.colorPickerLabel}>{t('avatar.color')}</span>
            <AvatarColorPicker value={avatarColor} onChange={setAvatarColor} />
          </div>
        </div>

        <div className={styles.fields}>
          <label className={styles.field}>
            <span className={styles.label}>
              {t('common.displayName')}
              <span className={styles.required}>*</span>
            </span>
            <input
              className={`${styles.input} ${isDisplayNameInvalid ? styles.inputError : ''}`}
              type="text"
              name="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t('profileSetup.displayNamePlaceholder')}
              aria-invalid={isDisplayNameInvalid}
              aria-describedby={isDisplayNameInvalid ? 'display-name-error' : undefined}
            />
            {isDisplayNameInvalid && (
              <span id="display-name-error" className={styles.fieldError}>
                {t('profileSetup.errors.displayNameRequired')}
              </span>
            )}
          </label>

          <label className={styles.field}>
            <span className={styles.label}>
              {t('common.login')}
              <span className={styles.required}>*</span>
            </span>
            <div className={`${styles.loginInputWrapper} ${isLoginInvalid ? styles.loginInputWrapperError : ''}`}>
              <span className={styles.loginPrefix}>@</span>
              <input
                className={styles.loginInput}
                type="text"
                name="login"
                value={login}
                onChange={(e) => { setLogin(e.target.value.replace(/^@+/, '')); setLoginError('') }}
                placeholder={t('profileSetup.loginPlaceholder')}
                aria-invalid={isLoginInvalid}
                aria-describedby={isLoginInvalid ? 'login-error' : undefined}
              />
            </div>
            {isLoginEmpty && (
              <span id="login-error" className={styles.fieldError}>
                {t('profileSetup.errors.loginRequired')}
              </span>
            )}
            {isLoginBadFmt && (
              <span id="login-error" className={styles.fieldError}>
                {t('profileSetup.errors.loginFormat')}
              </span>
            )}
            {loginError && (
              <span id="login-error" className={styles.fieldError}>
                {loginError}
              </span>
            )}
          </label>

          <label className={styles.field}>
            <span className={styles.label}>{t('common.status')}</span>
            <input
              className={styles.input}
              type="text"
              name="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              placeholder={t('profileSetup.statusPlaceholder')}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>{t('common.phone')}</span>
            <input
              className={styles.input}
              type="text"
              name="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+7 000 000-00-00"
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>{t('common.city')}</span>
            <input
              className={styles.input}
              type="text"
              name="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder={t('profileSetup.cityPlaceholder')}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>{t('common.department')}</span>
            <input
              className={styles.input}
              type="text"
              name="department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder={t('profileSetup.departmentPlaceholder')}
            />
          </label>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <button className={styles.submitButton} type="submit" disabled={isLoading}>
          {isLoading ? t('common.saving') : t('common.continue')}
        </button>
      </form>

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

export default ProfileSetupForm
