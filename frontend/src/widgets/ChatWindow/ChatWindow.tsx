import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
  useRef,
  type RefObject,
  type KeyboardEvent,
  type ChangeEvent,
  type MouseEvent,
  type DragEvent,
  type CSSProperties,
} from 'react'
import { useTranslation } from 'react-i18next'
import axios from 'axios'
import { EmojiPicker } from '../../shared/ui/EmojiPicker'
import { FileTypeIcon } from '../../shared/ui/FileTypeIcon'
import { MessageAttachment } from './MessageAttachment'
import { useErrorModalStore } from '../../shared/api/errorModalStore'
import { isAllowedAttachment, MAX_ATTACHMENT_SIZE_BYTES } from '../../shared/lib/fileType'
import type { ChatMeta, Message, ModalUser, Sender } from '../../shared/types/messenger'
import s from './ChatWindow.module.css'

const DEFAULT_MOBILE_INPUT_LAYER_HEIGHT = 340
// Оценка высоты .inputArea в её обычном состоянии (просто строка ввода) — используется
// как запасное значение, пока ResizeObserver ещё не сделал первый замер
const DEFAULT_MOBILE_INPUT_AREA_HEIGHT = 96

type RenderedItem =
  | { type: 'sep'; label: string }
  | { type: 'msg'; msg: Message; showAvatar: boolean; showName: boolean; senderSwitch: boolean }

interface ContextMenuState { x: number; y: number; msg: Message }

interface QueuedFile {
  /** стабильный локальный ключ — очередь "тает" по мере отправки, индексы съезжают, ключ нет */
  key: number
  file: File
  previewUrl: string | null
}

function ReplyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 17 4 12 9 7" />
      <path d="M4 12h11a5 5 0 0 1 5 5v2" />
    </svg>
  )
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

function ForwardIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 17 20 12 15 7" />
      <path d="M20 12H9a5 5 0 0 0-5 5v2" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  )
}

function SelectIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

interface ChatWindowProps {
  chatId: string
  meta: ChatMeta
  messages: Message[]
  /** момент, до которого собеседник прочитал переписку — null, если ещё не прочитал ничего */
  otherReadAt: string | null
  meSender: Sender
  typingChats: Record<string, boolean>
  loadingHistory: boolean
  historyLoaded: boolean
  loadingInitial: boolean
  loadError: boolean
  onRetryLoad: () => void
  messagesRef: RefObject<HTMLDivElement | null>
  topSentinelRef: RefObject<HTMLDivElement | null>
  bottomRef: RefObject<HTMLDivElement | null>
  onSend: (text: string, replyTo?: Message) => void
  onSendFile: (file: File, caption: string | undefined, onUploadProgress?: (percent: number) => void) => Promise<void>
  onRetry: (msg: Message) => void
  onDelete: (msg: Message) => void
  onEdit: (msg: Message, newText: string) => void
  onBulkDelete: (msgs: Message[]) => void
  onForward: (msgs: Message[]) => void
  onTyping: () => void
  onHeaderClick: () => void
  onAvatarClick: (msg: Message) => void
}

export function ChatWindow({
  chatId, meta, messages, otherReadAt, meSender, typingChats, loadingHistory, historyLoaded,
  loadingInitial, loadError, onRetryLoad,
  messagesRef, topSentinelRef, bottomRef,
  onSend, onSendFile, onRetry, onDelete, onEdit, onBulkDelete, onForward, onTyping, onHeaderClick, onAvatarClick,
}: ChatWindowProps) {
  const { t } = useTranslation()
  const showError = useErrorModalStore(st => st.showError)
  const [text, setText] = useState('')
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [editingMsg, setEditingMsg] = useState<Message | null>(null)
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  // ── Прикреплённые файлы, ожидающие отправки (можно выбрать/перетащить несколько,
  // отправляются разом — параллельно, поэтому прогресс отслеживаем по ключу файла,
  // а не одним общим числом) ────────────────────────────────────────────────────
  const [queuedFiles, setQueuedFiles] = useState<QueuedFile[]>([])
  const [fileUploading, setFileUploading] = useState(false)
  const [uploadProgressByKey, setUploadProgressByKey] = useState<Record<number, number>>({})
  const [sentCount, setSentCount] = useState(0)
  const [totalToSend, setTotalToSend] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const nextFileKeyRef = useRef(0)

  // ── Мобильная раскладка ввода: эмодзи-пикер и виртуальная клавиатура ────────
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false)
  const [isEmojiSpaceReserved, setIsEmojiSpaceReserved] = useState(false)
  const [isInputLayerActive, setIsInputLayerActive] = useState(false)
  const [mobileInputLayerHeight, setMobileInputLayerHeight] = useState(DEFAULT_MOBILE_INPUT_LAYER_HEIGHT)
  const [mobileKeyboardOffset, setMobileKeyboardOffset] = useState(0)
  // Реальная высота .inputArea (строка ввода + превью файла/ответа/редактирования, если открыты).
  // .inputArea в мобильной раскладке position:fixed и не выталкивает контент — .messages резервирует
  // место под неё через padding-bottom. Без живого замера этот отступ был жёстко зашит под высоту
  // "просто строки ввода" и не учитывал выросшую от плашки превью файла высоту — сообщения оказывались
  // под ней внахлёст.
  const [mobileInputAreaHeight, setMobileInputAreaHeight] = useState(DEFAULT_MOBILE_INPUT_AREA_HEIGHT)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const emojiAreaRef = useRef<HTMLDivElement>(null)
  const keyboardCloseTimeoutRef = useRef<number | null>(null)
  const keyboardViewportCleanupRef = useRef<(() => void) | null>(null)
  const inputHistoryEntryRef = useRef(false)
  const keyboardOpenedFromEmojiRef = useRef(false)
  const keyboardClosedViewportHeightRef = useRef<number | null>(null)
  const mobileInputLayerHeightRef = useRef(DEFAULT_MOBILE_INPUT_LAYER_HEIGHT)

  const clearKeyboardCloseWait = useCallback(() => {
    if (keyboardCloseTimeoutRef.current !== null) {
      window.clearTimeout(keyboardCloseTimeoutRef.current)
      keyboardCloseTimeoutRef.current = null
    }

    keyboardViewportCleanupRef.current?.()
    keyboardViewportCleanupRef.current = null
  }, [])

  function isMobileInputMode() {
    return window.matchMedia('(max-width: 1024px)').matches
  }

  function rememberKeyboardClosedViewportHeight() {
    keyboardClosedViewportHeightRef.current = window.visualViewport?.height ?? window.innerHeight
  }

  function updateMobileInputLayerHeight(nextHeight: number) {
    const roundedHeight = Math.round(nextHeight)
    if (roundedHeight < 180) return
    mobileInputLayerHeightRef.current = roundedHeight
    setMobileInputLayerHeight(roundedHeight)
  }

  function updateMobileKeyboardOffset(nextOffset: number) {
    setMobileKeyboardOffset(Math.max(0, Math.round(nextOffset)))
  }

  function getMeasuredKeyboardHeight() {
    const viewport = window.visualViewport
    if (!viewport) return 0
    const closedHeight = keyboardClosedViewportHeightRef.current ?? window.innerHeight
    return closedHeight - viewport.height
  }

  function ensureInputHistoryEntry() {
    if (!isMobileInputMode() || inputHistoryEntryRef.current) return

    rememberKeyboardClosedViewportHeight()
    window.history.pushState(
      { ...(window.history.state ?? {}), messengerInputLayer: true },
      '',
      window.location.href,
    )
    inputHistoryEntryRef.current = true
    setIsInputLayerActive(true)
  }

  const closeInputLayer = useCallback(() => {
    clearKeyboardCloseWait()
    textareaRef.current?.blur()
    setIsEmojiPickerOpen(false)
    setIsEmojiSpaceReserved(false)
    setIsInputLayerActive(false)
    keyboardOpenedFromEmojiRef.current = false
    setMobileKeyboardOffset(0)
  }, [clearKeyboardCloseWait])

  const removeSyntheticInputHistoryEntry = useCallback(() => {
    if (!inputHistoryEntryRef.current) return

    inputHistoryEntryRef.current = false
    setIsInputLayerActive(false)

    if (window.history.state?.messengerInputLayer) {
      window.history.back()
    }
  }, [])

  const discardInputHistoryLayer = useCallback(() => {
    inputHistoryEntryRef.current = false
    setIsInputLayerActive(false)
    closeInputLayer()

    if (window.history.state?.messengerInputLayer) {
      const state = { ...window.history.state }
      delete state.messengerInputLayer
      window.history.replaceState(state, '', window.location.href)
    }
  }, [closeInputLayer])

  const isReadByOther = (msg: Message) =>
    !!otherReadAt && new Date(msg.sentAt).getTime() <= new Date(otherReadAt).getTime()

  // ChatWindow размонтируется целиком при смене чата (key={chatId}) — если пользователь выбрал
  // файлы, но не отправил и ушёл в другой чат, blob-URL превью иначе никогда не освободятся
  const queuedFilesRef = useRef(queuedFiles)
  useLayoutEffect(() => { queuedFilesRef.current = queuedFiles })
  useEffect(() => () => {
    queuedFilesRef.current.forEach(f => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl) })
  }, [])

  // per-chat состояние (выделение/редактирование/ответ/мобильная раскладка ввода) не нужно сбрасывать
  // вручную при смене чата — MessengerPage.tsx монтирует ChatWindow с key={chatId}, так что React сам
  // полностью пересоздаёт компонент и весь его state при переключении на другой чат

  useEffect(() => {
    if (!selectMode) return
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') exitSelectMode() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectMode])

  // Следим за реальной высотой .inputArea, чтобы .messages резервировал ровно столько места,
  // сколько нужно — включая случаи, когда сверху выросла плашка превью файла/ответа/редактирования
  useEffect(() => {
    const el = emojiAreaRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setMobileInputAreaHeight(Math.round(entry.contentRect.height))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') close() }
    const messagesEl = messagesRef.current
    window.addEventListener('click', close)
    window.addEventListener('keydown', onKey)
    messagesEl?.addEventListener('scroll', close)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('keydown', onKey)
      messagesEl?.removeEventListener('scroll', close)
    }
  }, [contextMenu, messagesRef])

  useEffect(() => {
    if (!isEmojiPickerOpen) return

    function handlePointerDown(event: PointerEvent) {
      if (emojiAreaRef.current && !emojiAreaRef.current.contains(event.target as Node)) {
        clearKeyboardCloseWait()
        setIsEmojiPickerOpen(false)
        setIsEmojiSpaceReserved(false)
      }
    }

    function handleDocumentKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        clearKeyboardCloseWait()
        setIsEmojiPickerOpen(false)
        setIsEmojiSpaceReserved(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleDocumentKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleDocumentKeyDown)
    }
  }, [clearKeyboardCloseWait, isEmojiPickerOpen])

  useEffect(
    () => () => {
      if (keyboardCloseTimeoutRef.current !== null) {
        window.clearTimeout(keyboardCloseTimeoutRef.current)
      }
      keyboardViewportCleanupRef.current?.()
    },
    [],
  )

  useEffect(() => {
    function handleBackButton() {
      if (!inputHistoryEntryRef.current) return

      inputHistoryEntryRef.current = false
      setIsInputLayerActive(false)
      closeInputLayer()
    }

    window.addEventListener('popstate', handleBackButton)
    return () => window.removeEventListener('popstate', handleBackButton)
  }, [closeInputLayer])

  useEffect(() => {
    if (!isInputLayerActive || isEmojiPickerOpen || !isMobileInputMode()) return

    const viewport = window.visualViewport
    if (!viewport) return
    const activeViewport = viewport

    function handleViewportResize() {
      const closedHeight = keyboardClosedViewportHeightRef.current ?? window.innerHeight
      const keyboardHeight = closedHeight - activeViewport.height
      const keyboardClosed = activeViewport.height >= closedHeight - 40

      if (keyboardHeight >= 180) {
        updateMobileInputLayerHeight(keyboardHeight)
        updateMobileKeyboardOffset(0)
        setIsEmojiSpaceReserved(keyboardOpenedFromEmojiRef.current)
        return
      }

      if (!keyboardClosed) return

      closeInputLayer()
      removeSyntheticInputHistoryEntry()
    }

    activeViewport.addEventListener('resize', handleViewportResize)
    return () => activeViewport.removeEventListener('resize', handleViewportResize)
  }, [closeInputLayer, isEmojiPickerOpen, isInputLayerActive, removeSyntheticInputHistoryEntry])

  useEffect(() => {
    window.addEventListener('messenger:discard-input-history', discardInputHistoryLayer)
    return () => window.removeEventListener('messenger:discard-input-history', discardInputHistoryLayer)
  }, [discardInputHistoryLayer])

  function openContextMenu(e: MouseEvent, msg: Message) {
    // в режиме выделения правый клик не нужен — клик по сообщению уже переключает чекбокс
    if (selectMode) return
    // действия доступны только для сообщений, уже подтверждённых сервером
    if (!msg.messageId) return
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, msg })
  }

  function startEdit(msg: Message) {
    cancelReply()
    setEditingMsg(msg)
    setText(msg.text)
    setContextMenu(null)
    setIsEmojiPickerOpen(false)
    textareaRef.current?.focus()
  }

  function cancelEdit() {
    setEditingMsg(null)
    setText('')
  }

  function startReply(msg: Message) {
    if (!msg.messageId) return
    cancelEdit()
    setReplyingTo(msg)
    setContextMenu(null)
    setIsEmojiPickerOpen(false)
    textareaRef.current?.focus()
  }

  function cancelReply() {
    setReplyingTo(null)
  }

  function requestDelete(msg: Message) {
    setContextMenu(null)
    if (window.confirm(t('messenger.confirmDeleteMessage'))) onDelete(msg)
  }

  function enterSelectMode(msg: Message) {
    if (!msg.messageId) return
    cancelEdit()
    cancelReply()
    setContextMenu(null)
    setSelectMode(true)
    setSelectedIds(new Set([msg.id]))
  }

  function exitSelectMode() {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  function toggleSelect(msg: Message) {
    if (!msg.messageId) return
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(msg.id)) next.delete(msg.id); else next.add(msg.id)
      return next
    })
  }

  function requestBulkDelete() {
    const selected = messages.filter(m => selectedIds.has(m.id))
    if (selected.length === 0) return
    if (!window.confirm(t('messenger.confirmBulkDelete', { count: selected.length }))) return
    onBulkDelete(selected)
    exitSelectMode()
  }

  function requestBulkForward() {
    const selected = messages.filter(m => selectedIds.has(m.id))
    if (selected.length === 0) return
    onForward(selected)
    exitSelectMode()
  }

  const rendered: RenderedItem[] = []
  let lastDate = ''
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i], prev = messages[i - 1], next = messages[i + 1]
    if (msg.date !== lastDate) { rendered.push({ type: 'sep', label: msg.date }); lastDate = msg.date }
    rendered.push({
      type: 'msg', msg,
      showAvatar: !next || next.senderId !== msg.senderId,
      showName: !msg.own && meta.group && (!prev || prev.senderId !== msg.senderId),
      senderSwitch: !!prev && prev.senderId !== msg.senderId,
    })
  }

  const MAX_ATTACHMENT_COUNT = 10

  // Всё-или-ничего: если хоть один файл в новой пачке не проходит проверку, не добавляем
  // в очередь НИ ОДНОГО из них — иначе легко случайно отправить часть альбома, даже не
  // заметив, что один файл молча отсеялся
  function selectFiles(files: File[]) {
    if (queuedFiles.length + files.length > MAX_ATTACHMENT_COUNT) {
      showError(t('messenger.attachmentTooMany', { count: MAX_ATTACHMENT_COUNT }))
      return
    }

    const invalidFile = files.find(file => !isAllowedAttachment(file))
    if (invalidFile) {
      showError(t('messenger.attachmentTypeNotSupportedNamed', { name: invalidFile.name }))
      return
    }

    const tooLargeFile = files.find(file => file.size > MAX_ATTACHMENT_SIZE_BYTES)
    if (tooLargeFile) {
      showError(t('messenger.attachmentTooLargeNamed', { name: tooLargeFile.name }))
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

  async function send() {
    const trimmed = text.trim()

    if (queuedFiles.length > 0) {
      if (fileUploading) return
      const filesToSend = [...queuedFiles]
      setFileUploading(true)
      setTotalToSend(filesToSend.length)
      setSentCount(0)
      setUploadProgressByKey(Object.fromEntries(filesToSend.map(f => [f.key, 0])))
      try {
        // отправляем разом — параллельно, а не по одной; подпись достаётся только первому
        // файлу пачки (у параллельной отправки нет чёткого понятия "последний")
        const results = await Promise.allSettled(filesToSend.map(async (item, i) => {
          const isFirst = i === 0
          await onSendFile(item.file, isFirst ? (trimmed || undefined) : undefined, pct => {
            setUploadProgressByKey(prev => ({ ...prev, [item.key]: pct }))
          })
          removeQueuedFile(item.key)
          setSentCount(c => c + 1)
        }))

        const firstFailure = results.find((r): r is PromiseRejectedResult => r.status === 'rejected')
        if (firstFailure) {
          const code = axios.isAxiosError(firstFailure.reason)
            ? (firstFailure.reason.response?.data as { code?: string } | undefined)?.code
            : undefined
          if (code === 'Validation.ContentType') showError(t('messenger.attachmentTypeNotSupported'))
          else if (code === 'Validation.FileSize') showError(t('messenger.attachmentTooLarge'))
          else showError(t('messenger.attachmentSendFailed'))
        } else {
          setText('')
        }
      } finally {
        setFileUploading(false)
        setUploadProgressByKey({})
      }
      clearKeyboardCloseWait()
      setIsEmojiPickerOpen(false)
      setIsEmojiSpaceReserved(false)
      textareaRef.current?.focus()
      return
    }

    if (!trimmed) return

    if (editingMsg) {
      if (trimmed !== editingMsg.text) onEdit(editingMsg, trimmed)
      setEditingMsg(null)
    } else {
      onSend(trimmed, replyingTo ?? undefined)
      setReplyingTo(null)
    }

    setText('')
    clearKeyboardCloseWait()
    setIsEmojiPickerOpen(false)
    setIsEmojiSpaceReserved(false)
    textareaRef.current?.focus()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
    if (e.key === 'Escape') {
      if (editingMsg) cancelEdit()
      if (replyingTo) cancelReply()
    }
  }

  function handleEmojiSelect(emoji: string) {
    const textarea = textareaRef.current
    const isMobile = isMobileInputMode()

    if (!textarea) {
      setText((prev) => prev + emoji)
      onTyping()
      return
    }

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const nextText = text.slice(0, start) + emoji + text.slice(end)

    setText(nextText)
    onTyping()

    requestAnimationFrame(() => {
      const cursorPosition = start + emoji.length
      textarea.setSelectionRange(cursorPosition, cursorPosition)
      if (!isMobile) textarea.focus()
    })
  }

  function openEmojiPicker() {
    clearKeyboardCloseWait()
    ensureInputHistoryEntry()
    setContextMenu(null)
    updateMobileInputLayerHeight(getMeasuredKeyboardHeight() || mobileInputLayerHeightRef.current)
    updateMobileKeyboardOffset(0)
    setIsEmojiSpaceReserved(true)
    setIsEmojiPickerOpen(true)
    textareaRef.current?.blur()
  }

  function switchFromEmojiToKeyboard() {
    const textarea = textareaRef.current

    if (!textarea) {
      clearKeyboardCloseWait()
      setIsEmojiPickerOpen(false)
      setIsEmojiSpaceReserved(false)
      return
    }

    clearKeyboardCloseWait()
    ensureInputHistoryEntry()
    keyboardOpenedFromEmojiRef.current = true

    const viewport = window.visualViewport
    const initialViewportHeight = viewport?.height ?? window.innerHeight
    let resizeSettleTimeout: number | null = null

    // Резервируем место под клавиатуру только если реально дождались подтверждения через
    // изменение высоты viewport. Если его нет (например, тестируем в десктопном браузере
    // в узком окне — там фокус textarea не открывает настоящую виртуальную клавиатуру и
    // resize не приходит), запасной таймаут ниже завершает переключение БЕЗ резервации —
    // иначе макет застревал бы с "пустым" зарезервированным местом до следующего blur.
    function finishKeyboardSwitch(keyboardConfirmed: boolean) {
      clearKeyboardCloseWait()
      updateMobileKeyboardOffset(0)
      setIsEmojiPickerOpen(false)
      setIsEmojiSpaceReserved(keyboardConfirmed)
    }

    function handleViewportResize() {
      const nextViewportHeight = viewport?.height ?? window.innerHeight
      const keyboardHeight = initialViewportHeight - nextViewportHeight
      const keyboardProbablyOpened = nextViewportHeight < initialViewportHeight - 60

      if (!keyboardProbablyOpened) return

      updateMobileInputLayerHeight(keyboardHeight)

      if (resizeSettleTimeout !== null) window.clearTimeout(resizeSettleTimeout)
      resizeSettleTimeout = window.setTimeout(() => finishKeyboardSwitch(true), 180)
    }

    keyboardViewportCleanupRef.current = () => {
      viewport?.removeEventListener('resize', handleViewportResize)
      if (resizeSettleTimeout !== null) {
        window.clearTimeout(resizeSettleTimeout)
        resizeSettleTimeout = null
      }
    }

    viewport?.addEventListener('resize', handleViewportResize)
    keyboardCloseTimeoutRef.current = window.setTimeout(() => finishKeyboardSwitch(false), 720)

    textarea.focus()
    requestAnimationFrame(() => textarea.focus())
  }

  const isTyping = typingChats[chatId] && !meta.group
  const inputLayerStyle = {
    '--mobile-input-layer-height': `${mobileInputLayerHeight}px`,
    '--mobile-keyboard-offset': `${mobileKeyboardOffset}px`,
    '--mobile-input-area-height': `${mobileInputAreaHeight}px`,
  } as CSSProperties

  return (
    <div
      className={s.chatWindowRoot}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDraggingFile && (
        <div className={s.dropOverlay}>
          <div className={s.dropOverlayIcon}>📎</div>
          <div className={s.dropOverlayTitle}>{t('messenger.dropFilesTitle')}</div>
          <div className={s.dropOverlaySubtitle}>{t('messenger.dropFilesSubtitle')}</div>
        </div>
      )}

      {selectMode ? (
        <div className={s.selectionBar}>
          <button type="button" className={s.selectionBarCancel} onClick={exitSelectMode}>✕</button>
          <span className={s.selectionBarCount}>{t('messenger.selectedCount', { count: selectedIds.size })}</span>
          <div className={s.selectionBarActions}>
            <button
              type="button"
              className={s.selectionBarBtn}
              disabled={selectedIds.size === 0}
              title={t('messenger.forwardMessage')}
              onClick={requestBulkForward}
            >
              <ForwardIcon />
            </button>
            <button
              type="button"
              className={`${s.selectionBarBtn} ${s.selectionBarBtnDanger}`}
              disabled={selectedIds.size === 0}
              title={t('messenger.deleteMessage')}
              onClick={requestBulkDelete}
            >
              <TrashIcon />
            </button>
          </div>
        </div>
      ) : (
        <div className={s.chatHeader}>
          <button type="button" className={s.chatHeaderTrigger} onClick={onHeaderClick}>
            <div className={`${s.chatHeaderAvatar} ${meta.group ? s.chatHeaderAvatarGroup : ''}`} style={meta.avatarUrl ? undefined : { background: meta.color }}>
              {meta.avatarUrl
                ? <img src={meta.avatarUrl} alt={meta.name} className={s.chatHeaderAvatarImg} />
                : meta.initials
              }
            </div>
            <div className={s.chatHeaderInfo}>
              <div className={s.chatHeaderName}>{meta.name}</div>
              <div className={s.chatHeaderSub}>
                {isTyping
                  ? <span className={s.typingText}>{t('messenger.typing')}</span>
                  : meta.online
                    ? <><span className={s.chatHeaderOnlineDot} />{t('common.online')}</>
                    : meta.group
                      ? t('group.label')
                      : t('common.recently')
                }
              </div>
            </div>
          </button>
        </div>
      )}

      {loadingInitial ? (
        <div className={s.emptyChat}>
          <div className={s.historySpinner} />
        </div>
      ) : loadError ? (
        <div className={s.emptyChat}>
          <div className={s.emptyChatIcon}>⚠️</div>
          <h3 className={s.emptyChatTitle}>{t('messenger.loadConversationFailed')}</h3>
          <button className={s.loadErrorRetryBtn} onClick={onRetryLoad}>{t('common.retry')}</button>
        </div>
      ) : messages.length === 0 ? (
        <div className={s.emptyChat}>
          <div className={s.emptyChatIcon}>💬</div>
          <h3 className={s.emptyChatTitle}>{t('messenger.startChat')}</h3>
          <p className={s.emptyChatSub}>{t('messenger.firstMessage', { name: meta.name.split(' ')[0] })}</p>
        </div>
      ) : (
        <div
          className={`${s.messages} ${isEmojiSpaceReserved ? s.messagesInputLayerOpen : ''}`}
          ref={messagesRef}
          style={inputLayerStyle}
        >
          <div ref={topSentinelRef} />

          {loadingHistory && (
            <div className={s.historyLoader}><div className={s.historySpinner} /></div>
          )}

          {!loadingHistory && historyLoaded && (
            <div className={s.historyEnd}>{t('messenger.historyStart')}</div>
          )}

          {rendered.map((item, i) =>
            item.type === 'sep' ? (
              <div key={`sep-${i}`} className={s.dateSep}>
                <span className={s.dateSepLabel}>{item.label}</span>
              </div>
            ) : (() => {
              const displaySender = item.msg.own
                ? { ...item.msg, senderColor: meSender.senderColor, senderAvatarUrl: meSender.senderAvatarUrl, senderInitials: meSender.senderInitials, senderName: meSender.senderName }
                : item.msg
              return (
              <div key={item.msg.id}>
                {item.showName && (
                  <div
                    className={`${s.senderName} ${s.senderNameClickable}`}
                    style={{ color: displaySender.senderColor }}
                    onClick={() => selectMode ? toggleSelect(item.msg) : onAvatarClick(item.msg)}
                  >
                    {displaySender.senderName}
                  </div>
                )}
                <div
                  className={[
                    s.msgRow,
                    item.senderSwitch && !item.showName ? s.senderSwitch : '',
                    selectMode && item.msg.messageId ? s.msgRowSelectable : '',
                    selectMode && selectedIds.has(item.msg.id) ? s.msgRowSelected : '',
                  ].join(' ')}
                  onClick={() => selectMode && toggleSelect(item.msg)}
                >
                  {selectMode && (
                    <div className={`${s.msgCheckbox} ${selectedIds.has(item.msg.id) ? s.msgCheckboxChecked : ''} ${!item.msg.messageId ? s.msgCheckboxDisabled : ''}`}>
                      {selectedIds.has(item.msg.id) && <CheckIcon />}
                    </div>
                  )}
                  <div
                    className={`${s.msgAvatar} ${item.showAvatar ? s.msgAvatarClickable : s.msgAvatarHidden}`}
                    style={displaySender.senderAvatarUrl ? undefined : { background: displaySender.senderColor }}
                    onClick={(e) => { if (selectMode) return; e.stopPropagation(); if (item.showAvatar) onAvatarClick(item.msg) }}
                  >
                    {displaySender.senderAvatarUrl
                      ? <img src={displaySender.senderAvatarUrl} alt={displaySender.senderInitials} className={s.msgAvatarImg} />
                      : displaySender.senderInitials
                    }
                  </div>
                  <div
                    className={[
                      s.bubble,
                      item.msg.own ? s.bubbleOwn : s.bubbleOther,
                      item.showAvatar ? s.bubbleTail : '',
                      item.msg.status === 'pending' ? s.bubblePending : '',
                      item.msg.status === 'failed'  ? s.bubbleFailed  : '',
                    ].join(' ')}
                    onContextMenu={(e) => openContextMenu(e, item.msg)}
                  >
                    {item.msg.forwardedFromUserName && (
                      <div className={s.forwardedLabel}>{t('messenger.forwardedFrom', { name: item.msg.forwardedFromUserName })}</div>
                    )}
                    {item.msg.replyToMessageId && (
                      <div className={s.replyQuote}>
                        <div className={s.replyQuoteSender}>{item.msg.replyToSenderName}</div>
                        <div className={s.replyQuoteText}>
                          {item.msg.replyToContent ?? t('messenger.originalMessageDeleted')}
                        </div>
                      </div>
                    )}
                    {item.msg.fileUrl && (
                      <MessageAttachment
                        fileUrl={item.msg.fileUrl}
                        fileName={item.msg.fileName}
                        contentType={item.msg.fileContentType}
                        fileSizeBytes={item.msg.fileSizeBytes}
                      />
                    )}
                    {item.msg.text}
                  </div>
                </div>
                <span className={s.msgTime}>
                  {item.msg.own && item.msg.status === 'pending' && <span className={`${s.msgStatusIcon} ${s.msgStatusPending}`}>●</span>}
                  {item.msg.own && item.msg.status === 'sent' && (
                    isReadByOther(item.msg)
                      ? <span className={`${s.msgStatusIcon} ${s.msgStatusRead}`}>✓✓</span>
                      : <span className={`${s.msgStatusIcon} ${s.msgStatusSent}`}>✓</span>
                  )}
                  {item.msg.edited && <span className={s.msgEdited}>{t('messenger.edited')}</span>}
                  {item.msg.time}
                </span>
                {item.msg.status === 'failed' && (
                  <button className={s.msgRetry} onClick={() => onRetry(item.msg)}>
                    {t('messenger.sendFailedRetry')}
                  </button>
                )}
              </div>
              )
            })()
          )}

          <div ref={bottomRef} />
        </div>
      )}

      <div
        className={`${s.inputArea} ${isEmojiSpaceReserved ? s.inputAreaEmojiOpen : ''}`}
        ref={emojiAreaRef}
        style={inputLayerStyle}
      >
        {editingMsg && (
          <div className={s.editingBar}>
            <span>{t('messenger.editingMessage')}</span>
            <button type="button" className={s.editingBarCancel} onClick={cancelEdit}>✕</button>
          </div>
        )}

        {replyingTo && (
          <div className={s.replyingBar}>
            <div className={s.replyingBarInfo}>
              <div className={s.replyingBarSender}>{t('messenger.replyingTo', { name: replyingTo.senderName })}</div>
              <div className={s.replyingBarText}>{replyingTo.text}</div>
            </div>
            <button type="button" className={s.editingBarCancel} onClick={cancelReply}>✕</button>
          </div>
        )}

        {queuedFiles.length === 1 && (() => {
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
                      <div className={s.filePreviewProgressFill} style={{ width: `${uploadProgressByKey[only.key] ?? 0}%` }} />
                    </div>
                    <span className={s.filePreviewProgressPct}>{uploadProgressByKey[only.key] ?? 0}%</span>
                  </div>
                ) : (
                  <span className={s.filePreviewSize}>{`${(only.file.size / 1024).toFixed(0)} KB`}</span>
                )}
              </div>
              {!fileUploading && (
                <button type="button" className={`${s.editingBarCancel} ${s.filePreviewRemove}`} onClick={() => removeQueuedFile(only.key)}>✕</button>
              )}
            </div>
          )
        })()}

        {queuedFiles.length > 1 && (
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
                    {item.key in uploadProgressByKey ? (
                      <div className={s.filePreviewProgressRow}>
                        <div className={s.filePreviewProgressTrack}>
                          <div className={s.filePreviewProgressFill} style={{ width: `${uploadProgressByKey[item.key]}%` }} />
                        </div>
                        <span className={s.filePreviewProgressPct}>{uploadProgressByKey[item.key]}%</span>
                      </div>
                    ) : (
                      <span className={s.filePreviewSize}>{`${(item.file.size / 1024).toFixed(0)} KB`}</span>
                    )}
                  </div>
                  {!fileUploading && (
                    <button type="button" className={`${s.editingBarCancel} ${s.filePreviewRemove}`} onClick={() => removeQueuedFile(item.key)}>✕</button>
                  )}
                </div>
              ))}
            </div>
            <div className={s.filePreviewSummary}>
              <span className={s.filePreviewSize}>
                {fileUploading
                  ? t('messenger.attachmentUploadingCount', { current: sentCount + 1, total: totalToSend })
                  : t('messenger.attachmentQueuedCount', { count: queuedFiles.length })
                }
              </span>
              {!fileUploading && (
                <button type="button" className={s.editingBarCancel} onClick={clearQueuedFiles}>✕</button>
              )}
            </div>
          </div>
        )}

        <div className={s.inputBar}>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className={s.hiddenFileInput}
            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z,audio/*,video/*"
            onChange={handleFileSelect}
          />
          <button
            type="button"
            className={`${s.emojiBtn} ${s.attachBtn}`}
            onClick={() => fileInputRef.current?.click()}
            aria-label={t('messenger.attachFile')}
            title={t('messenger.attachFile')}
          >
            📎
          </button>
          <div className={s.messageInputShell}>
            <button
              type="button"
              className={`${s.emojiBtn} ${s.mobileEmojiBtn} ${isEmojiPickerOpen ? s.emojiBtnActive : ''}`}
              onClick={() => {
                if (isEmojiPickerOpen) {
                  switchFromEmojiToKeyboard()
                } else {
                  openEmojiPicker()
                }
              }}
              aria-label={isEmojiPickerOpen ? t('emoji.keyboard') : t('emoji.open')}
              aria-expanded={isEmojiPickerOpen}
              aria-pressed={isEmojiPickerOpen}
            >
              {isEmojiPickerOpen ? '⌨' : '☺'}
            </button>

            <textarea
              ref={textareaRef}
              className={s.textInput}
              placeholder={t('messenger.messagePlaceholder')}
              value={text}
              rows={1}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => { setText(e.target.value); onTyping() }}
              onKeyDown={handleKeyDown}
              onPointerDown={() => {
                if (isMobileInputMode() && isEmojiPickerOpen) switchFromEmojiToKeyboard()
              }}
              onFocus={() => ensureInputHistoryEntry()}
              onBlur={() => {
                if (!isEmojiPickerOpen) setIsEmojiSpaceReserved(false)
              }}
            />

            <div className={`${s.emojiWrap} ${s.desktopEmojiWrap}`}>
              <button
                type="button"
                className={`${s.emojiBtn} ${isEmojiPickerOpen ? s.emojiBtnActive : ''}`}
                onClick={() => setIsEmojiPickerOpen((value) => !value)}
                aria-label={t('emoji.open')}
                aria-expanded={isEmojiPickerOpen}
                aria-pressed={isEmojiPickerOpen}
              >
                ☺
              </button>
            </div>
          </div>

          <button className={s.sendBtn} disabled={(!text.trim() && queuedFiles.length === 0) || fileUploading} onClick={send}>
            <svg className={s.sendIcon} viewBox="0 0 24 24">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>

        <div
          className={`${s.emojiPanel} ${isEmojiPickerOpen ? s.emojiPanelOpen : ''}`}
          aria-hidden={!isEmojiPickerOpen}
        >
          <EmojiPicker onSelect={handleEmojiSelect} disabled={!isEmojiPickerOpen} />
        </div>
      </div>

      {contextMenu && (
        <div
          className={s.contextMenu}
          style={{
            left: Math.min(contextMenu.x, window.innerWidth - 190),
            top:  Math.min(contextMenu.y, window.innerHeight - (contextMenu.msg.own ? 192 : 156)),
          }}
        >
          <button type="button" className={s.contextMenuItem} onClick={() => startReply(contextMenu.msg)}>
            <ReplyIcon />{t('messenger.replyMessage')}
          </button>
          {contextMenu.msg.own && (
            <button type="button" className={s.contextMenuItem} onClick={() => startEdit(contextMenu.msg)}>
              <EditIcon />{t('messenger.editMessage')}
            </button>
          )}
          <button type="button" className={s.contextMenuItem} onClick={() => { onForward([contextMenu.msg]); setContextMenu(null) }}>
            <ForwardIcon />{t('messenger.forwardMessage')}
          </button>
          <button type="button" className={`${s.contextMenuItem} ${s.contextMenuItemDanger}`} onClick={() => requestDelete(contextMenu.msg)}>
            <TrashIcon />{t('messenger.deleteMessage')}
          </button>
          <button type="button" className={s.contextMenuItem} onClick={() => enterSelectMode(contextMenu.msg)}>
            <SelectIcon />{t('messenger.selectMessage')}
          </button>
        </div>
      )}
    </div>
  )
}

export type { ModalUser }
