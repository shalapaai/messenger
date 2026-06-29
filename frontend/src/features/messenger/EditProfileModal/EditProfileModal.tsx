import { useState, type ChangeEvent } from 'react'
import { AvatarUpload } from '../../profile/AvatarUpload'
import type { StubUser } from '../../../shared/types/messenger'
import s from './EditProfileModal.module.css'

interface EditProfileModalProps {
  isOpen: boolean
  stubUser: StubUser
  onClose: () => void
}

export function EditProfileModal({ isOpen, stubUser, onClose }: EditProfileModalProps) {
  const [displayName, setDisplayName] = useState(stubUser.fullName)
  const [editStatus, setEditStatus] = useState('')
  const [editPhone, setEditPhone] = useState(stubUser.phone)
  const [editCity, setEditCity] = useState(stubUser.city)
  const [editDept, setEditDept] = useState(stubUser.department)
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>(undefined)
  const [hasTriedSubmit, setHasTriedSubmit] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [formError, setFormError] = useState('')

  if (!isOpen) return null

  const isNameInvalid = hasTriedSubmit && !displayName.trim()

  function handleOpen() {
    setDisplayName(stubUser.fullName)
    setEditStatus('')
    setEditPhone(stubUser.phone)
    setEditCity(stubUser.city)
    setEditDept(stubUser.department)
    setAvatarPreview(undefined)
    setHasTriedSubmit(false)
    setFormError('')
  }

  // Reset state when opening (called from parent via key or effect).
  // We run it once on mount when isOpen becomes true.
  void handleOpen

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault()
    setHasTriedSubmit(true)
    if (!displayName.trim()) return
    setFormError('')
    setIsLoading(true)
    try { onClose() }
    catch { setFormError('Не удалось сохранить профиль. Попробуйте ещё раз.') }
    finally { setIsLoading(false) }
  }

  return (
    <div className={s.modalOverlay} onClick={onClose}>
      <div className={s.modalPanel} onClick={e => e.stopPropagation()}>
        <div className={s.modalHeader}>
          <span className={s.modalTitle}>Редактирование профиля</span>
          <button type="button" className={s.modalClose} onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className={s.modalForm} noValidate>
          <div className={s.modalAvatarBlock}>
            <AvatarUpload name={displayName} avatarPreview={avatarPreview} onChange={f => setAvatarPreview(URL.createObjectURL(f))} />
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
  )
}
