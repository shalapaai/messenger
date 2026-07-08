import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { useTranslation } from 'react-i18next'
import axios from 'axios'
import { isAllowedAttachment, MAX_ATTACHMENT_SIZE_BYTES } from '../../../shared/lib/fileType'

const MAX_ATTACHMENT_COUNT = 10

export interface QueuedFile {
  /** стабильный локальный ключ — для React-списка и удаления конкретного файла из очереди */
  key: number
  file: File
  previewUrl: string | null
}

interface UseAttachmentQueueOptions {
  onSendFiles: (files: File[], caption: string | undefined, onUploadProgress?: (percent: number) => void) => Promise<void>
}

/** Отправка всей очереди уходит одним запросом — одно сообщение с несколькими вложениями, а не по файлу за раз. */
export function useAttachmentQueue({ onSendFiles }: UseAttachmentQueueOptions) {
  const { t } = useTranslation()
  const [queuedFiles, setQueuedFiles] = useState<QueuedFile[]>([])
  const [fileUploading, setFileUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [attachmentError, setAttachmentError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const nextFileKeyRef = useRef(0)

  // ChatWindow размонтируется целиком при смене чата (key={chatId}) — если пользователь выбрал
  // файлы, но не отправил и ушёл в другой чат, blob-URL превью иначе никогда не освободятся
  const queuedFilesRef = useRef(queuedFiles)
  useLayoutEffect(() => { queuedFilesRef.current = queuedFiles })
  useEffect(() => () => {
    queuedFilesRef.current.forEach(f => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl) })
  }, [])

  // Всё-или-ничего: если хоть один файл не проходит проверку, не добавляем в очередь ни одного —
  // иначе можно случайно отправить часть альбома, не заметив, что один файл отсеялся.
  function selectFiles(files: File[]) {
    setAttachmentError(null)

    if (queuedFiles.length + files.length > MAX_ATTACHMENT_COUNT) {
      setAttachmentError(t('messenger.attachmentTooMany', { count: MAX_ATTACHMENT_COUNT }))
      return
    }

    const invalidFile = files.find(file => !isAllowedAttachment(file))
    if (invalidFile) {
      setAttachmentError(t('messenger.attachmentTypeNotSupportedNamed', { name: invalidFile.name }))
      return
    }

    const tooLargeFile = files.find(file => file.size > MAX_ATTACHMENT_SIZE_BYTES)
    if (tooLargeFile) {
      setAttachmentError(t('messenger.attachmentTooLargeNamed', { name: tooLargeFile.name }))
      return
    }

    const newItems: QueuedFile[] = files.map(file => ({
      key: nextFileKeyRef.current++,
      file,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
    }))
    setQueuedFiles(prev => [...prev, ...newItems])
  }

  function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length > 0) selectFiles(files)
  }

  // dragenter/dragleave всплывают с дочерних элементов — считаем "глубину" входов, иначе
  // оверлей мигал бы от dragleave при движении над дочерними узлами.
  const [isDraggingFile, setIsDraggingFile] = useState(false)
  const dragCounterRef = useRef(0)

  function hasFilesInDrag(e: { dataTransfer: DataTransfer }) {
    return Array.from(e.dataTransfer.types).includes('Files')
  }

  function handleDragEnter(e: DragEvent<HTMLDivElement>) {
    if (!hasFilesInDrag(e)) return
    e.preventDefault()
    dragCounterRef.current += 1
    setIsDraggingFile(true)
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    if (!hasFilesInDrag(e)) return
    e.preventDefault()
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    if (!hasFilesInDrag(e)) return
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1)
    if (dragCounterRef.current === 0) setIsDraggingFile(false)
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    dragCounterRef.current = 0
    setIsDraggingFile(false)
    const files = Array.from(e.dataTransfer.files ?? [])
    if (files.length > 0) selectFiles(files)
  }

  function removeQueuedFile(key: number) {
    setAttachmentError(null)
    setQueuedFiles(prev => {
      const target = prev.find(f => f.key === key)
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl)
      return prev.filter(f => f.key !== key)
    })
  }

  function clearQueuedFiles() {
    queuedFiles.forEach(f => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl) })
    setQueuedFiles([])
    setAttachmentError(null)
  }

  /** Атомарно: либо уходит вся очередь, либо сервер отклоняет всё. Возвращает true при успехе,
   *  чтобы вызывающий мог очистить текст сообщения. */
  async function sendQueuedFiles(caption: string | undefined): Promise<boolean> {
    const filesToSend = queuedFiles.map(f => f.file)
    setFileUploading(true)
    setUploadProgress(0)
    setAttachmentError(null)
    try {
      await onSendFiles(filesToSend, caption, setUploadProgress)
      clearQueuedFiles()
      return true
    } catch (err) {
      const code = axios.isAxiosError(err)
        ? (err.response?.data as { code?: string } | undefined)?.code
        : undefined
      if (code === 'Validation.ContentType') setAttachmentError(t('messenger.attachmentTypeNotSupported'))
      else if (code === 'Validation.FileSize') setAttachmentError(t('messenger.attachmentTooLarge'))
      else setAttachmentError(t('messenger.attachmentSendFailed'))
      return false
    } finally {
      setFileUploading(false)
      setUploadProgress(0)
    }
  }

  return {
    queuedFiles,
    fileUploading,
    uploadProgress,
    attachmentError,
    clearAttachmentError: () => setAttachmentError(null),
    fileInputRef,
    isDraggingFile,
    selectFiles,
    handleFileSelect,
    removeQueuedFile,
    clearQueuedFiles,
    sendQueuedFiles,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  }
}
