import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AvatarUpload } from '../../profile/AvatarUpload'
import { AvatarCropModal } from '../../profile/AvatarCropModal'
import { useAvatarCrop } from '../../../shared/hooks/useAvatarCrop'
import { uploadChatAvatar } from '../../../shared/api/chatsApi'
import s from './EditGroupModal.module.css'

const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024

interface EditGroupModalProps {
  isOpen: boolean
  chatId: string
  currentName: string
  currentAvatarUrl: string | null
  currentColor: string
  onClose: () => void
  onSave: (name: string) => Promise<void>
  onAvatarUploaded: () => void
}

export function EditGroupModal({ isOpen, chatId, currentName, currentAvatarUrl, currentColor, onClose, onSave, onAvatarUploaded }: EditGroupModalProps) {
  if (!isOpen) return null

  return (
    <EditGroupModalContent
      chatId={chatId}
      currentName={currentName}
      currentAvatarUrl={currentAvatarUrl}
      currentColor={currentColor}
      onClose={onClose}
      onSave={onSave}
      onAvatarUploaded={onAvatarUploaded}
    />
  )
}

type EditGroupModalContentProps = Omit<EditGroupModalProps, 'isOpen'>

type SaveError = 'name' | 'size' | 'avatarSavedNameFailed' | null

function EditGroupModalContent({ chatId, currentName, currentAvatarUrl, currentColor, onClose, onSave, onAvatarUploaded }: EditGroupModalContentProps) {
  const { t } = useTranslation()
  const [name, setName] = useState(currentName)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<SaveError>(null)
  const avatarCrop = useAvatarCrop()

  async function handleSave() {
    const trimmed = name.trim()
    if (!trimmed || saving) return
    if (avatarCrop.croppedAvatarFile && avatarCrop.croppedAvatarFile.size > MAX_AVATAR_SIZE_BYTES) {
      setError('size')
      return
    }
    setSaving(true)
    setError(null)

    // если аватарка уже успешно сохранилась, а следующий шаг (переименование) упадёт —
    // очищаем черновик файла сразу, чтобы повторное "Сохранить" не перезалило его ещё раз
    let avatarAlreadySaved = false
    try {
      if (avatarCrop.croppedAvatarFile) {
        await uploadChatAvatar(chatId, avatarCrop.croppedAvatarFile)
        avatarCrop.clearCroppedFile()
        avatarAlreadySaved = true
        onAvatarUploaded()
      }
      if (trimmed !== currentName) await onSave(trimmed)
      onClose()
    } catch {
      setError(avatarAlreadySaved ? 'avatarSavedNameFailed' : 'name')
      setSaving(false)
    }
  }

  return (
    <>
      <div className={s.modalOverlay} onClick={onClose}>
        <div className={s.modalPanel} onClick={e => e.stopPropagation()}>
          <button type="button" className={s.modalClose} onClick={onClose}>✕</button>
          <div className={s.title}>{t('group.editGroup')}</div>

          <div className={s.avatarBlock}>
            <AvatarUpload
              name={name}
              avatarPreview={avatarCrop.avatarPreview ?? currentAvatarUrl ?? undefined}
              color={currentColor}
              onChange={avatarCrop.handleAvatarChange}
            />
          </div>

          <input
            className={s.nameInput}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t('group.namePlaceholder')}
            maxLength={100}
          />
          {error === 'size' && <p className={s.error}>{t('profileSetup.errors.avatarTooLarge')}</p>}
          {error === 'name' && <p className={s.error}>{t('messenger.updateGroupFailed')}</p>}
          {error === 'avatarSavedNameFailed' && <p className={s.error}>{t('group.avatarSavedNameFailed')}</p>}
          <div className={s.actions}>
            <button type="button" className={s.cancelBtn} onClick={onClose}>{t('common.cancel')}</button>
            <button type="button" className={s.saveBtn} disabled={!name.trim() || saving} onClick={handleSave}>
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </div>
      </div>

      {avatarCrop.cropImageSrc && (
        <AvatarCropModal
          imageSrc={avatarCrop.cropImageSrc}
          onCancel={avatarCrop.handleCropCancel}
          onConfirm={avatarCrop.handleCropConfirm}
        />
      )}
    </>
  )
}
