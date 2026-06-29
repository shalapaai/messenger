import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { getCroppedImage } from '../../../shared/lib/image'
import type { CroppedAreaPixels } from '../../../shared/lib/image'
import { profileApi } from '../../../shared/api/profileApi'
import { useUserProfile } from '../../../shared/context/useUserProfile'
import { AvatarCropModal } from '../AvatarCropModal'
import { AvatarUpload } from '../AvatarUpload'
import styles from './ProfileSetupForm.module.css'

const LOGIN_REGEX = /^[a-zA-Z0-9_]{3,30}$/

function ProfileSetupForm() {
  const navigate = useNavigate()
  const { setProfile } = useUserProfile()

  const [displayName, setDisplayName] = useState('')
  const [login, setLogin]             = useState('')
  const [status, setStatus]           = useState('')
  const [phone, setPhone]             = useState('')
  const [city, setCity]               = useState('')
  const [department, setDepartment]   = useState('')
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

    setError('')
    setLoginError('')
    setIsLoading(true)

    try {
      // Создаём профиль; 409 ProfileAlreadyExists — игнорируем и продолжаем
      try {
        await profileApi.create({ displayName: displayName.trim(), login: trimmedLogin })
      } catch (createErr) {
        if (!axios.isAxiosError(createErr) || createErr.response?.status !== 409) {
          throw createErr
        }
        if (createErr.response?.data?.code !== 'Users.ProfileAlreadyExists') {
          setLoginError('Логин уже занят')
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
      setError('Не удалось сохранить профиль. Попробуйте еще раз.')
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
            onChange={handleAvatarChange}
          />
        </div>

        <div className={styles.fields}>
          <label className={styles.field}>
            <span className={styles.label}>
              Имя пользователя
              <span className={styles.required}>*</span>
            </span>
            <input
              className={`${styles.input} ${isDisplayNameInvalid ? styles.inputError : ''}`}
              type="text"
              name="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Например, Николай"
              aria-invalid={isDisplayNameInvalid}
              aria-describedby={isDisplayNameInvalid ? 'display-name-error' : undefined}
            />
            {isDisplayNameInvalid && (
              <span id="display-name-error" className={styles.fieldError}>
                Введите имя пользователя
              </span>
            )}
          </label>

          <label className={styles.field}>
            <span className={styles.label}>
              Логин
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
                placeholder="например, nikolay"
                aria-invalid={isLoginInvalid}
                aria-describedby={isLoginInvalid ? 'login-error' : undefined}
              />
            </div>
            {isLoginEmpty && (
              <span id="login-error" className={styles.fieldError}>
                Введите логин
              </span>
            )}
            {isLoginBadFmt && (
              <span id="login-error" className={styles.fieldError}>
                3–30 символов: буквы, цифры и _
              </span>
            )}
            {loginError && (
              <span id="login-error" className={styles.fieldError}>
                {loginError}
              </span>
            )}
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Статус</span>
            <input
              className={styles.input}
              type="text"
              name="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              placeholder="Например, на связи"
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Телефон</span>
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
            <span className={styles.label}>Город</span>
            <input
              className={styles.input}
              type="text"
              name="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Например, Москва"
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Отдел</span>
            <input
              className={styles.input}
              type="text"
              name="department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="Например, Разработка"
            />
          </label>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <button className={styles.submitButton} type="submit" disabled={isLoading}>
          {isLoading ? 'Сохраняем...' : 'Продолжить'}
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
