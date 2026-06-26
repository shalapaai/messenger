import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { AvatarUpload } from '../AvatarUpload'
import styles from './ProfileSetupForm.module.css'

function ProfileSetupForm() {
  const [displayName, setDisplayName] = useState('')
  const [status, setStatus] = useState('')
  const [avatar, setAvatar] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string>()
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [hasTriedSubmit, setHasTriedSubmit] = useState(false)

  const isDisplayNameInvalid = hasTriedSubmit && !displayName.trim()

  useEffect(() => {
    return () => {
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview)
      }
    }
  }, [avatarPreview])

  function handleAvatarChange(file: File) {
    setAvatar(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setHasTriedSubmit(true)

    if (!displayName.trim()) {
      setError('')
      return
    }

    setError('')
    setIsLoading(true)

    try {
      console.log({
        displayName: displayName.trim(),
        status: status.trim(),
        avatar,
      })
    } catch {
      setError('Не удалось сохранить профиль. Попробуйте еще раз.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
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
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Например, Николай"
            required
            aria-invalid={isDisplayNameInvalid}
            aria-describedby={
              isDisplayNameInvalid ? 'display-name-error' : undefined
            }
          />

          {isDisplayNameInvalid && (
            <span id="display-name-error" className={styles.fieldError}>
              Введите имя пользователя
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
            onChange={(event) => setStatus(event.target.value)}
            placeholder="Например, на связи"
          />
        </label>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <button
        className={styles.submitButton}
        type="submit"
        disabled={isLoading}
      >
        {isLoading ? 'Сохраняем...' : 'Продолжить'}
      </button>
    </form>
  )
}

export default ProfileSetupForm
