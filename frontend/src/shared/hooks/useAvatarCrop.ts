import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { getCroppedImage, type CroppedAreaPixels } from '../lib/image'
import { isAllowedAvatarImage, MAX_AVATAR_SIZE_BYTES } from '../lib/fileType'

/** Выбор + обрезка аватарки — загрузка на сервер остаётся на вызывающей стороне, здесь только локальный черновик. */
export function useAvatarCrop() {
  const [avatarPreview,      setAvatarPreview]      = useState<string | undefined>(undefined)
  const [selectedAvatarFile, setSelectedAvatarFile]  = useState<File | null>(null)
  const [croppedAvatarFile,  setCroppedAvatarFile]   = useState<File | null>(null)
  const [cropImageSrc,       setCropImageSrc]        = useState<string | undefined>(undefined)

  // ref'ы нужны в cleanup-эффекте на размонтирование, где замыкание из пустого deps
  // видело бы только значения первого рендера
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

  /** Возвращает причину отказа, если файл отклонён. Размер проверяем до обрезки: она обычно
   *  уменьшает файл, так что проверка только итога пропустила бы изначально огромный файл. */
  function handleAvatarChange(file: File): 'ok' | 'type' | 'size' {
    if (!isAllowedAvatarImage(file)) return 'type'
    if (file.size > MAX_AVATAR_SIZE_BYTES) return 'size'
    setSelectedAvatarFile(file)
    setCropImageSrc(URL.createObjectURL(file))
    return 'ok'
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

  /** Сбросить выбранный файл после успешной загрузки — иначе повторное нажатие "Сохранить"
   *  заново перезалило бы тот же файл. */
  function clearCroppedFile() {
    setCroppedAvatarFile(null)
  }

  /** Полностью сбросить черновик аватарки — иначе при повторном открытии показывался бы
   *  старый превью, хотя croppedAvatarFile из прошлой сессии уже потерян. */
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
