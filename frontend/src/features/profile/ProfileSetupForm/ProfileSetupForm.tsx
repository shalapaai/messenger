import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { getCroppedImage } from '../../../shared/lib/image'
import type { CroppedAreaPixels } from '../../../shared/lib/image'
import { isAllowedAvatarImage, MAX_AVATAR_SIZE_BYTES } from '../../../shared/lib/fileType'
import { profileApi } from '../../../shared/api/profileApi'
import { useUserProfile } from '../../../shared/context/useUserProfile'
import { AvatarCropModal } from '../AvatarCropModal'
import { AvatarUpload } from '../AvatarUpload'
import { AvatarColorPicker } from '../../../shared/ui/AvatarColorPicker'
import { randomAvatarColor } from '../../../shared/lib/avatarColors'
import styles from './ProfileSetupForm.module.css'

const LOGIN_REGEX = /^[a-zA-Z0-9_]{3,30}$/
// должно совпадать с лимитами на бэкенде (CreateUserProfileCommandValidator)
const DISPLAY_NAME_MAX_LENGTH = 100
const STATUS_MAX_LENGTH = 200
const PHONE_MAX_LENGTH = 20
const CITY_MAX_LENGTH = 100
const DEPARTMENT_MAX_LENGTH = 100

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
  const isDisplayNameEmpty     = hasTriedSubmit && !displayName.trim()
  const isDisplayNameTooLong   = displayName.trim().length > DISPLAY_NAME_MAX_LENGTH
  const isDisplayNameInvalid   = isDisplayNameEmpty || isDisplayNameTooLong
  const isLoginEmpty   = hasTriedSubmit && !trimmedLogin
  const isLoginBadFmt  = hasTriedSubmit && !!trimmedLogin && !LOGIN_REGEX.test(trimmedLogin)
  const isLoginInvalid = isLoginEmpty || isLoginBadFmt || !!loginError
  const isStatusTooLong     = status.trim().length     > STATUS_MAX_LENGTH
  const isPhoneTooLong      = phone.trim().length      > PHONE_MAX_LENGTH
  const isCityTooLong       = city.trim().length       > CITY_MAX_LENGTH
  const isDepartmentTooLong = department.trim().length > DEPARTMENT_MAX_LENGTH
  const hasOptionalFieldError = isStatusTooLong || isPhoneTooLong || isCityTooLong || isDepartmentTooLong

  useEffect(() => {
    return () => { if (avatarPreview) URL.revokeObjectURL(avatarPreview) }
  }, [avatarPreview])

  useEffect(() => {
    return () => { if (cropImageSrc) URL.revokeObjectURL(cropImageSrc) }
  }, [cropImageSrc])

  function handleAvatarChange(file: File) {
    if (!isAllowedAvatarImage(file)) {
      setError(t('profileSetup.errors.avatarInvalidType'))
      return
    }
    // Проверяем исходный файл, не дожидаясь обрезки: сама обрезка пересжимает и обычно
    // уменьшает размер (canvas.toBlob), так что проверка только итогового файла легко
    // пропустила бы изначально огромный файл, если кроп-область оказалась небольшой.
    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      setError(t('profileSetup.errors.avatarTooLarge'))
      return
    }
    setError('')
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

    // Ни один запрос не уходит, пока хоть одно поле (даже необязательное) невалидно —
    // иначе бэкенд может успеть сохранить часть полей до того, как найдёт невалидное
    if (!displayName.trim() || isDisplayNameTooLong || !LOGIN_REGEX.test(trimmedLogin) || hasOptionalFieldError) return

    if (croppedAvatarFile && croppedAvatarFile.size > MAX_AVATAR_SIZE_BYTES) {
      setError(t('profileSetup.errors.avatarTooLarge'))
      return
    }

    setError('')
    setLoginError('')
    setIsLoading(true)

    try {
      // Создаём профиль одним атомарным запросом (все поля сразу, включая необязательные) —
      // 409 ProfileAlreadyExists означает, что он уже был создан в прошлой успешной попытке
      try {
        await profileApi.create({
          displayName: displayName.trim(),
          login: trimmedLogin,
          avatarColor,
          status:     status.trim()     || undefined,
          phone:      phone.trim()      || undefined,
          city:       city.trim()       || undefined,
          department: department.trim() || undefined,
        })
      } catch (createErr) {
        if (!axios.isAxiosError(createErr) || createErr.response?.status !== 409) {
          throw createErr
        }
        if (createErr.response?.data?.code !== 'Users.ProfileAlreadyExists') {
          setLoginError(t('profileSetup.errors.loginTaken'))
          return
        }
      }

      if (croppedAvatarFile) {
        await profileApi.uploadAvatar(croppedAvatarFile)
      }

      const profile = await profileApi.getMe()
      setProfile(profile)
      navigate('/chats')
    } catch {
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
            {isDisplayNameEmpty && (
              <span id="display-name-error" className={styles.fieldError}>
                {t('profileSetup.errors.displayNameRequired')}
              </span>
            )}
            {isDisplayNameTooLong && (
              <span id="display-name-error" className={styles.fieldError}>
                {t('profileSetup.errors.displayNameTooLong', { max: DISPLAY_NAME_MAX_LENGTH })}
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
              className={`${styles.input} ${isStatusTooLong ? styles.inputError : ''}`}
              type="text"
              name="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              placeholder={t('profileSetup.statusPlaceholder')}
              aria-invalid={isStatusTooLong}
              aria-describedby={isStatusTooLong ? 'status-error' : undefined}
            />
            {isStatusTooLong && (
              <span id="status-error" className={styles.fieldError}>
                {t('profileSetup.errors.statusTooLong', { max: STATUS_MAX_LENGTH })}
              </span>
            )}
          </label>

          <label className={styles.field}>
            <span className={styles.label}>{t('common.phone')}</span>
            <input
              className={`${styles.input} ${isPhoneTooLong ? styles.inputError : ''}`}
              type="text"
              name="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+7 000 000-00-00"
              aria-invalid={isPhoneTooLong}
              aria-describedby={isPhoneTooLong ? 'phone-error' : undefined}
            />
            {isPhoneTooLong && (
              <span id="phone-error" className={styles.fieldError}>
                {t('profileSetup.errors.phoneTooLong', { max: PHONE_MAX_LENGTH })}
              </span>
            )}
          </label>

          <label className={styles.field}>
            <span className={styles.label}>{t('common.city')}</span>
            <input
              className={`${styles.input} ${isCityTooLong ? styles.inputError : ''}`}
              type="text"
              name="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder={t('profileSetup.cityPlaceholder')}
              aria-invalid={isCityTooLong}
              aria-describedby={isCityTooLong ? 'city-error' : undefined}
            />
            {isCityTooLong && (
              <span id="city-error" className={styles.fieldError}>
                {t('profileSetup.errors.cityTooLong', { max: CITY_MAX_LENGTH })}
              </span>
            )}
          </label>

          <label className={styles.field}>
            <span className={styles.label}>{t('common.department')}</span>
            <input
              className={`${styles.input} ${isDepartmentTooLong ? styles.inputError : ''}`}
              type="text"
              name="department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder={t('profileSetup.departmentPlaceholder')}
              aria-invalid={isDepartmentTooLong}
              aria-describedby={isDepartmentTooLong ? 'department-error' : undefined}
            />
            {isDepartmentTooLong && (
              <span id="department-error" className={styles.fieldError}>
                {t('profileSetup.errors.departmentTooLong', { max: DEPARTMENT_MAX_LENGTH })}
              </span>
            )}
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
