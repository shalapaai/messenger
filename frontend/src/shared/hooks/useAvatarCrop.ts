import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { getCroppedImage, type CroppedAreaPixels } from '../lib/image'
import { isAllowedAvatarImage } from '../lib/fileType'

/** Выбор + обрезка аватарки (общий поток для EditGroupModal и EditProfileModal) —
 *  сама загрузка на сервер остаётся на вызывающей стороне, здесь только локальный черновик. */
export function useAvatarCrop() {
  const [avatarPreview,      setAvatarPreview]      = useState<string | undefined>(undefined)
  const [selectedAvatarFile, setSelectedAvatarFile]  = useState<File | null>(null)
  const [croppedAvatarFile,  setCroppedAvatarFile]   = useState<File | null>(null)
  const [cropImageSrc,       setCropImageSrc]        = useState<string | undefined>(undefined)

  // ref'ы всегда указывают на актуальные blob URL — нужны в cleanup-эффекте на размонтирование,
  // где обычное замыкание из пустого deps-массива видело бы только значения первого рендера
  const avatarPreviewRef = useRef(avatarPreview)
  const cropImageSrcRef = useRef(cropImageSrc)
  useLayoutEffect(() => {
    avatarPreviewRef.current = avatarPreview
    cropImageSrcRef.current = cropImageSrc
  })

  useEffect(() => () => {
    if (cropImageSrcRef.current) URL.revokeObjectURL(cropImageSrcRef.current)
    if (avatarPreviewRef.current) URL.revokeObjectURL(avatarPreviewRef.current)
  }, [])

  /** Возвращает false, если файл отклонён (не картинка) — черновик не открывается,
   *  вызывающая сторона сама решает, как показать ошибку. */
  function handleAvatarChange(file: File): boolean {
    if (!isAllowedAvatarImage(file)) return false
    setSelectedAvatarFile(file)
    setCropImageSrc(URL.createObjectURL(file))
    return true
  }

  function handleCropCancel() {
    if (cropImageSrc) URL.revokeObjectURL(cropImageSrc)
    setCropImageSrc(undefined)
    setSelectedAvatarFile(null)
  }

  async function handleCropConfirm(croppedAreaPixels: CroppedAreaPixels) {
    if (!selectedAvatarFile || !cropImageSrc) return
    const croppedFile = await getCroppedImage(cropImageSrc, croppedAreaPixels, selectedAvatarFile.name, selectedAvatarFile.type)
    URL.revokeObjectURL(cropImageSrc)
    if (avatarPreview) URL.revokeObjectURL(avatarPreview)
    setCroppedAvatarFile(croppedFile)
    setAvatarPreview(URL.createObjectURL(croppedFile))
    setCropImageSrc(undefined)
    setSelectedAvatarFile(null)
  }

  /** Сбросить выбранный файл после того, как он уже успешно загружен на сервер —
   *  иначе повторное нажатие "Сохранить" (например, после неудачи в ДРУГОЙ части формы)
   *  заново перезалило бы тот же файл. */
  function clearCroppedFile() {
    setCroppedAvatarFile(null)
  }

  /** Полностью сбросить черновик аватарки — по кнопке "убрать" и при закрытии модалки
   *  (иначе при повторном открытии всё ещё показывался бы старый превью, хотя он уже
   *  никуда не применится: croppedAvatarFile из предыдущей сессии редактирования потерян). */
  function removeAvatar() {
    if (cropImageSrc) URL.revokeObjectURL(cropImageSrc)
    if (avatarPreview) URL.revokeObjectURL(avatarPreview)
    setCropImageSrc(undefined)
    setSelectedAvatarFile(null)
    setCroppedAvatarFile(null)
    setAvatarPreview(undefined)
  }

  return {
    avatarPreview,
    croppedAvatarFile,
    clearCroppedFile,
    removeAvatar,
    cropImageSrc,
    handleAvatarChange,
    handleCropCancel,
    handleCropConfirm,
  }
}
