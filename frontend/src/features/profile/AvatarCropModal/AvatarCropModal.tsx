import { useState } from 'react'
import Cropper from 'react-easy-crop'
import type { Area, Point } from 'react-easy-crop'
import type { CroppedAreaPixels } from '../../../shared/lib/image'
import styles from './AvatarCropModal.module.css'

type AvatarCropModalProps = {
  imageSrc: string
  onCancel: () => void
  onConfirm: (croppedAreaPixels: CroppedAreaPixels) => void
}

export function AvatarCropModal({
  imageSrc,
  onCancel,
  onConfirm,
}: AvatarCropModalProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] =
    useState<CroppedAreaPixels | null>(null)

  function handleConfirm() {
    if (!croppedAreaPixels) {
      return
    }

    onConfirm(croppedAreaPixels)
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.panel}>
        <div className={styles.header}>
          <h2 className={styles.title}>Обрезать фото</h2>
        </div>

        <div className={styles.cropArea}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_: Area, croppedArea: Area) => {
              setCroppedAreaPixels(croppedArea)
            }}
          />
        </div>

        <label className={styles.zoomControl}>
          <span>Масштаб</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.1}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
          />
        </label>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={onCancel}
          >
            Отмена
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={handleConfirm}
            disabled={!croppedAreaPixels}
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  )
}
