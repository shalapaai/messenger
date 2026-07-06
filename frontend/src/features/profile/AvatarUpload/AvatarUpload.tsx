import { useId } from 'react'
import type { ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Avatar } from '../../../shared/ui/Avatar'
import styles from './AvatarUpload.module.css'

type AvatarUploadProps = {
  name: string
  avatarPreview?: string
  color?: string
  shape?: 'circle' | 'square'
  onChange: (file: File) => void
  onRemove?: () => void
}

function AvatarUpload({ name, avatarPreview, color, shape, onChange, onRemove }: AvatarUploadProps) {
  const { t } = useTranslation()
  const inputId = useId()

  function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    onChange(file)
    event.target.value = ''
  }

  return (
    <div className={styles.upload}>
      <Avatar src={avatarPreview} name={name} size="large" color={color} shape={shape} />

      <div className={styles.actions}>
        <div className={styles.buttonsRow}>
          <label className={styles.uploadButton} htmlFor={inputId}>
            {avatarPreview ? t('avatar.replace') : t('avatar.choose')}
          </label>

          {avatarPreview && onRemove && (
            <button
              type="button"
              className={styles.removeButton}
              onClick={onRemove}
              aria-label={t('avatar.remove')}
            >
              ✕
            </button>
          )}
        </div>

        <p className={styles.hint}>{t('avatar.hint')}</p>
      </div>

      <input
        id={inputId}
        className={styles.input}
        type="file"
        accept="image/*"
        onChange={handleAvatarChange}
      />
    </div>
  )
}

export default AvatarUpload
