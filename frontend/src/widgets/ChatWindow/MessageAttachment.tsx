import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthedFileUrl, downloadAuthedFile } from '../../shared/hooks/useAuthedFileUrl'
import { FileTypeIcon } from '../../shared/ui/FileTypeIcon'
import type { Attachment } from '../../shared/types/messenger'
import s from './ChatWindow.module.css'

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function MessageAttachment({ fileUrl, fileName, fileContentType, fileSizeBytes }: Attachment) {
  const { t } = useTranslation()
  const isImage = fileContentType.startsWith('image/')
  const isVideo = fileContentType.startsWith('video/')
  const isPreviewableMedia = isImage || isVideo
  const { blobUrl, error, progress } = useAuthedFileUrl(fileUrl, isPreviewableMedia)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)

  async function handleDownload() {
    if (downloading) return
    setDownloading(true)
    try {
      await downloadAuthedFile(fileUrl, fileName)
    } catch { /* ignore */ } finally {
      setDownloading(false)
    }
  }

  if (isPreviewableMedia) {
    if (error) {
      return <div className={s.attachmentError}>{t('messenger.attachmentLoadFailed')}</div>
    }
    return (
      <>
        <div
          className={s.attachmentImageWrap}
          onClick={() => blobUrl && setLightboxOpen(true)}
        >
          {blobUrl
            ? (
              isVideo
                ? (
                  <div className={s.attachmentVideoPreview}>
                    <video
                      src={blobUrl}
                      className={s.attachmentVideo}
                      muted
                      playsInline
                      preload="metadata"
                    />
                    <span className={s.attachmentVideoBadge}>▶</span>
                  </div>
                )
                : <img src={blobUrl} alt={fileName} className={s.attachmentImage} />
            )
            : (
              <div className={s.attachmentImageLoading}>
                <div className={s.attachmentProgress}>
                  <div
                    className={progress === null ? `${s.attachmentProgressBar} ${s.attachmentProgressIndeterminate}` : s.attachmentProgressBar}
                    style={progress === null ? undefined : { width: `${progress}%` }}
                  />
                </div>
                {progress !== null && <span className={s.attachmentProgressLabel}>{progress}%</span>}
              </div>
            )
          }
        </div>
        {lightboxOpen && blobUrl && (
          <div className={s.lightboxOverlay} onClick={() => setLightboxOpen(false)}>
            {isVideo
              ? <video src={blobUrl} className={s.lightboxVideo} controls autoPlay onClick={(e) => e.stopPropagation()} />
              : <img src={blobUrl} alt={fileName} className={s.lightboxImage} />
            }
            <button
              type="button"
              className={`${s.lightboxClose} ${s.lightboxDownload}`}
              disabled={downloading}
              title={t('messenger.downloadFile')}
              onClick={(e) => { e.stopPropagation(); handleDownload() }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 3v12" />
                <path d="M7 10l5 5 5-5" />
                <path d="M5 21h14" />
              </svg>
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
