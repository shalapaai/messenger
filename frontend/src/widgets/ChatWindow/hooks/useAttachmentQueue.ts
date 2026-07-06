import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
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

/**
 * Очередь прикреплённых файлов, ожидающих отправки: выбор (клик или drag-and-drop), all-or-nothing
 * валидация типа/размера/количества, и отправка всей очереди одним запросом — одним сообщением
 * с несколькими вложениями, а не по файлу за раз (см. sendQueuedFiles).
 */
export function useAttachmentQueue({ onSendFiles }: UseAttachmentQueueOptions) {
  const [queuedFiles, setQueuedFiles] = useState<QueuedFile[]>([])
  const [fileUploading, setFileUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const nextFileKeyRef = useRef(0)

  // ChatWindow размонтируется целиком при смене чата (key={chatId}) — если пользователь выбрал
  // файлы, но не отправил и ушёл в другой чат, blob-URL превью иначе никогда не освободятся
  const queuedFilesRef = useRef(queuedFiles)
  useLayoutEffect(() => { queuedFilesRef.current = queuedFiles })
  useEffect(() => () => {
    queuedFilesRef.current.forEach(f => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl) })
  }, [])

  // Всё-или-ничего: если хоть один файл в новой пачке не проходит проверку, не добавляем
  // в очередь НИ ОДНОГО из них — иначе легко случайно отправить часть альбома, даже не
  // заметив, что один файл молча отсеялся
  function selectFiles(files: File[]) {
    if (queuedFiles.length + files.length > MAX_ATTACHMENT_COUNT) return

    const invalidFile = files.find(file => !isAllowedAttachment(file))
    if (invalidFile) return

    const tooLargeFile = files.find(file => file.size > MAX_ATTACHMENT_SIZE_BYTES)
    if (tooLargeFile) return

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

  // ── Drag-and-drop файлов из проводника поверх окна чата ─────────────────────
  // dragenter/dragleave всплывают с дочерних элементов — считаем "глубину" входов,
  // а не полагаемся на единичный dragleave, иначе оверлей будет мигать при
  // перемещении курсора над дочерними узлами внутри окна чата
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
    setQueuedFiles(prev => {
      const target = prev.find(f => f.key === key)
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl)
      return prev.filter(f => f.key !== key)
    })
  }

  function clearQueuedFiles() {
    queuedFiles.forEach(f => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl) })
    setQueuedFiles([])
  }

  /** Отправляет всю очередь одним HTTP-запросом — одно сообщение с несколькими вложениями,
   *  атомарно (или уходит вся пачка, или сервер отклоняет всё и очередь остаётся как была).
   *  Возвращает true при успехе — вызывающий может очистить текст сообщения. */
  async function sendQueuedFiles(caption: string | undefined): Promise<boolean> {
    const filesToSend = queuedFiles.map(f => f.file)
    setFileUploading(true)
    setUploadProgress(0)
    try {
      await onSendFiles(filesToSend, caption, setUploadProgress)
      clearQueuedFiles()
      return true
    } catch {
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
