import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthedFileUrl, downloadAuthedFile } from '../../shared/hooks/useAuthedFileUrl'
import { FileTypeIcon } from '../../shared/ui/FileTypeIcon'
import { useToastStore } from '../../shared/api/toastStore'
import type { Attachment } from '../../shared/types/messenger'
import s from './ChatWindow.module.css'

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Одно вложение (файл или картинка) сообщения — сообщение может нести несколько,
 *  см. MessageAttachments. */
function MessageAttachment({ fileUrl, fileName, fileContentType, fileSizeBytes }: Attachment) {
  const { t } = useTranslation()
  const showSuccess = useToastStore(st => st.showSuccess)
  const showError = useToastStore(st => st.showError)
  const isImage = fileContentType.startsWith('image/')
  const { blobUrl, error } = useAuthedFileUrl(fileUrl, isImage)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)

  async function handleDownload() {
    if (downloading) return
    setDownloading(true)
    try {
      await downloadAuthedFile(fileUrl, fileName)
      showSuccess(t('toast.fileDownloaded'))
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
            ? <img src={blobUrl} alt={fileName} className={s.attachmentImage} />
            : <div className={s.attachmentImageLoading} />
          }
        </div>
        {lightboxOpen && blobUrl && (
          <div className={s.lightboxOverlay} onClick={() => setLightboxOpen(false)}>
            <img src={blobUrl} alt={fileName} className={s.lightboxImage} />
            <button
              type="button"
              className={`${s.lightboxClose} ${s.lightboxDownload}`}
              disabled={downloading}
              title={t('messenger.downloadFile')}
              onClick={(e) => { e.stopPropagation(); handleDownload() }}
            >
              ⬇
            </button>
            <button type="button" className={s.lightboxClose} onClick={() => setLightboxOpen(false)}>✕</button>
          </div>
        )}
      </>
    )
  }

  return (
    <button type="button" className={s.attachmentFileCard} onClick={handleDownload} disabled={downloading}>
      <FileTypeIcon fileName={fileName} contentType={fileContentType} size={40} />
      <span className={s.attachmentFileInfo}>
        <span className={s.attachmentFileName}>{fileName}</span>
        <span className={s.attachmentFileSize}>{downloading ? t('messenger.attachmentDownloading') : formatFileSize(fileSizeBytes)}</span>
      </span>
    </button>
  )
}

interface MessageAttachmentsProps {
  attachments: Attachment[]
}

/** Все вложения сообщения — одно сообщение может нести несколько файлов, отправленных разом. */
export function MessageAttachments({ attachments }: MessageAttachmentsProps) {
  if (attachments.length === 0) return null

  return (
    <div className={attachments.length > 1 ? s.attachmentsGroup : undefined}>
      {attachments.map((a, i) => (
        <MessageAttachment key={`${a.fileUrl}-${i}`} {...a} />
      ))}
    </div>
  )
}
