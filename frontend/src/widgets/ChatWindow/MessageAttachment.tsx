import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthedFileUrl, downloadAuthedFile } from '../../shared/hooks/useAuthedFileUrl'
import { FileTypeIcon } from '../../shared/ui/FileTypeIcon'
import { useErrorModalStore } from '../../shared/api/errorModalStore'
import s from './ChatWindow.module.css'

interface MessageAttachmentProps {
  fileUrl: string
  fileName: string | null | undefined
  contentType: string | null | undefined
  fileSizeBytes: number | null | undefined
}

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function MessageAttachment({ fileUrl, fileName, contentType, fileSizeBytes }: MessageAttachmentProps) {
  const { t } = useTranslation()
  const showError = useErrorModalStore(st => st.showError)
  const isImage = !!contentType?.startsWith('image/')
  const { blobUrl, error } = useAuthedFileUrl(fileUrl, isImage)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)

  async function handleDownload() {
    if (downloading) return
    setDownloading(true)
    try {
      await downloadAuthedFile(fileUrl, fileName ?? 'file')
    } catch {
      showError(t('messenger.attachmentDownloadFailed'))
    } finally {
      setDownloading(false)
    }
  }

  if (isImage) {
    if (error) {
      return <div className={s.attachmentError}>{t('messenger.attachmentLoadFailed')}</div>
    }
    return (
      <>
        <div className={s.attachmentImageWrap} onClick={() => blobUrl && setLightboxOpen(true)}>
          {blobUrl
            ? <img src={blobUrl} alt={fileName ?? ''} className={s.attachmentImage} />
            : <div className={s.attachmentImageLoading} />
          }
        </div>
        {lightboxOpen && blobUrl && (
          <div className={s.lightboxOverlay} onClick={() => setLightboxOpen(false)}>
            <img src={blobUrl} alt={fileName ?? ''} className={s.lightboxImage} />
            <button type="button" className={s.lightboxClose} onClick={() => setLightboxOpen(false)}>✕</button>
          </div>
        )}
      </>
    )
  }

  return (
    <button type="button" className={s.attachmentFileCard} onClick={handleDownload} disabled={downloading}>
      <FileTypeIcon fileName={fileName} contentType={contentType} size={40} />
      <span className={s.attachmentFileInfo}>
        <span className={s.attachmentFileName}>{fileName ?? t('messenger.attachmentFile')}</span>
        <span className={s.attachmentFileSize}>{downloading ? t('messenger.attachmentDownloading') : formatFileSize(fileSizeBytes)}</span>
      </span>
    </button>
  )
}
