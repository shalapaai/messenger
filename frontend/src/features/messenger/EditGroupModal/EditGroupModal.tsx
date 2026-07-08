import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AvatarUpload } from '../../profile/AvatarUpload'
import { AvatarCropModal } from '../../profile/AvatarCropModal'
import { useAvatarCrop } from '../../../shared/hooks/useAvatarCrop'
import { uploadChatAvatar, removeChatAvatar } from '../../../shared/api/chatsApi'
import { AvatarColorPicker } from '../../../shared/ui/AvatarColorPicker'
import { MAX_AVATAR_SIZE_BYTES } from '../../../shared/lib/fileType'
import s from './EditGroupModal.module.css'

interface EditGroupModalProps {
  isOpen: boolean
  chatId: string
  currentName: string
  currentAvatarUrl: string | null
  currentColor: string
  onClose: () => void
  onSave: (name: string, avatarColor: string) => Promise<void>
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

type SaveError = 'name' | 'size' | 'type' | 'avatarSavedNameFailed' | null

function EditGroupModalContent({ chatId, currentName, currentAvatarUrl, currentColor, onClose, onSave, onAvatarUploaded }: EditGroupModalContentProps) {
  const { t } = useTranslation()
  const [name, setName] = useState(currentName)
  const [avatarColor, setAvatarColor] = useState(currentColor)
  const [avatarRemoved, setAvatarRemoved] = useState(false)
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

    // Если аватарка уже сохранилась/удалилась, а переименование упадёт — очищаем черновик
    // файла сразу, чтобы повторное "Сохранить" не залило его снова.
    let avatarAlreadySaved = false
    try {
      if (avatarCrop.croppedAvatarFile) {
        await uploadChatAvatar(chatId, avatarCrop.croppedAvatarFile)
        avatarCrop.clearCroppedFile()
        avatarAlreadySaved = true
        onAvatarUploaded()
      } else if (avatarRemoved && currentAvatarUrl) {
        await removeChatAvatar(chatId)
        avatarAlreadySaved = true
        onAvatarUploaded()
      }
      if (trimmed !== currentName || avatarColor !== currentColor) await onSave(trimmed, avatarColor)
      onClose()
    } catch {
      const nextError = avatarAlreadySaved ? 'avatarSavedNameFailed' : 'name'
      setError(nextError)
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
              avatarPreview={avatarRemoved ? undefined : (avatarCrop.avatarPreview ?? currentAvatarUrl ?? undefined)}
              color={avatarColor}
              shape="square"
              onChange={(file) => {
                const result = avatarCrop.handleAvatarChange(file)
                if (result !== 'ok') { setError(result); return }
                setAvatarRemoved(false)
                setError(null)
              }}
              onRemove={() => { avatarCrop.removeAvatar(); setAvatarRemoved(true) }}
            />
            <div className={s.colorPickerWrap}>
              <span className={s.colorPickerLabel}>{t('avatar.color')}</span>
              <AvatarColorPicker value={avatarColor} onChange={setAvatarColor} />
            </div>
          </div>

          <input
            className={s.nameInput}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t('group.namePlaceholder')}
            maxLength={100}
          />
          {error === 'size' && <p className={s.error}>{t('profileSetup.errors.avatarTooLarge')}</p>}
          {error === 'type' && <p className={s.error}>{t('profileSetup.errors.avatarInvalidType')}</p>}
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
          shape="square"
          onCancel={avatarCrop.handleCropCancel}
          onConfirm={avatarCrop.handleCropConfirm}
        />
      )}
    </>
  )
}
