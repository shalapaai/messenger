import { useTranslation } from 'react-i18next'
import { FileTypeIcon } from '../../shared/ui/FileTypeIcon'
import type { QueuedFile } from './hooks/useAttachmentQueue'
import s from './ChatWindow.module.css'

interface FilePreviewBarProps {
  queuedFiles: QueuedFile[]
  fileUploading: boolean
  uploadProgress: number
  onRemove: (key: number) => void
  onClearAll: () => void
}

/** Плашка над строкой ввода с превью файлов, ожидающих отправки — один файл показывает
 *  детальную карточку, несколько — прокручиваемый список с именами. Все файлы уходят одним
 *  HTTP-запросом (одно сообщение с несколькими вложениями), поэтому прогресс — один общий
 *  процент на весь запрос, а не по файлу. */
export function FilePreviewBar({
  queuedFiles, fileUploading, uploadProgress, onRemove, onClearAll,
}: FilePreviewBarProps) {
  const { t } = useTranslation()

  if (queuedFiles.length === 0) return null

  if (queuedFiles.length === 1) {
    const only = queuedFiles[0]
    return (
      <div className={s.filePreviewBar}>
        {only.previewUrl
          ? <img src={only.previewUrl} alt={only.file.name} className={s.filePreviewThumb} />
          : <FileTypeIcon fileName={only.file.name} contentType={only.file.type} size={36} />
        }
        <div className={s.filePreviewInfo}>
          <span className={s.filePreviewName}>{only.file.name}</span>
          {fileUploading ? (
            <div className={s.filePreviewProgressRow}>
              <div className={s.filePreviewProgressTrack}>
                <div className={s.filePreviewProgressFill} style={{ width: `${uploadProgress}%` }} />
              </div>
              <span className={s.filePreviewProgressPct}>{uploadProgress}%</span>
            </div>
          ) : (
            <span className={s.filePreviewSize}>{`${(only.file.size / 1024).toFixed(0)} KB`}</span>
          )}
        </div>
        {!fileUploading && (
          <button type="button" className={`${s.editingBarCancel} ${s.filePreviewRemove}`} onClick={() => onRemove(only.key)}>✕</button>
        )}
      </div>
    )
  }

  return (
    <div className={`${s.filePreviewBar} ${s.filePreviewBarMulti}`}>
      <div className={s.filePreviewList}>
        {queuedFiles.map(item => (
          <div key={item.key} className={s.filePreviewListRow}>
            {item.previewUrl
              ? <img src={item.previewUrl} alt={item.file.name} className={s.filePreviewThumb} />
              : <FileTypeIcon fileName={item.file.name} contentType={item.file.type} size={36} />
            }
            <div className={s.filePreviewInfo}>
              <span className={s.filePreviewName}>{item.file.name}</span>
              <span className={s.filePreviewSize}>{`${(item.file.size / 1024).toFixed(0)} KB`}</span>
            </div>
            {!fileUploading && (
              <button type="button" className={`${s.editingBarCancel} ${s.filePreviewRemove}`} onClick={() => onRemove(item.key)}>✕</button>
            )}
          </div>
        ))}
      </div>
      <div className={s.filePreviewSummary}>
        {fileUploading ? (
          <div className={s.filePreviewProgressRow}>
            <div className={s.filePreviewProgressTrack}>
              <div className={s.filePreviewProgressFill} style={{ width: `${uploadProgress}%` }} />
            </div>
            <span className={s.filePreviewProgressPct}>{uploadProgress}%</span>
          </div>
        ) : (
          <span className={s.filePreviewSize}>{t('messenger.attachmentQueuedCount', { count: queuedFiles.length })}</span>
        )}
        {!fileUploading && (
          <button type="button" className={s.editingBarCancel} onClick={onClearAll}>✕</button>
        )}
      </div>
    </div>
  )
}
