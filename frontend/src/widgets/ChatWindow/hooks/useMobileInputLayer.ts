import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'

const DEFAULT_MOBILE_INPUT_LAYER_HEIGHT = 300
const MIN_MOBILE_INPUT_LAYER_HEIGHT = 180
const MAX_MOBILE_INPUT_LAYER_RATIO = 0.45

/**
 * Мобильная раскладка ввода: виртуальная клавиатура и собственный эмодзи-пикер живут в одном
 * "слое" поверх экрана, закрываемом аппаратной кнопкой "назад" — раскладка синхронизируется с
 * visualViewport и держит синтетическую запись в history. .inputArea в мобильной раскладке —
 * обычный flex-элемент (sticky, не fixed), поэтому месту под неё не нужна ручная резервация:
 * .messages сжимается сама через flexbox, включая случаи, когда сверху выросла плашка превью
 * файла/ответа/редактирования.
 */
export function useMobileInputLayer() {
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false)
  const [isInputLayerActive, setIsInputLayerActive] = useState(false)
  const [mobileInputLayerHeight, setMobileInputLayerHeight] = useState(DEFAULT_MOBILE_INPUT_LAYER_HEIGHT)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const emojiAreaRef = useRef<HTMLDivElement>(null)
  const keyboardCloseTimeoutRef = useRef<number | null>(null)
  const keyboardViewportCleanupRef = useRef<(() => void) | null>(null)
  const inputHistoryEntryRef = useRef(false)
  const isEmojiPickerOpenRef = useRef(false)
  const keyboardWasOpenRef = useRef(false)
  const openingEmojiPickerRef = useRef(false)
  const keyboardClosedViewportHeightRef = useRef<number | null>(null)
  const mobileInputLayerHeightRef = useRef(DEFAULT_MOBILE_INPUT_LAYER_HEIGHT)
  const textSelectionRef = useRef({ start: 0, end: 0 })

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
    const maxHeight = Math.round(
      (keyboardClosedViewportHeightRef.current ?? window.innerHeight) * MAX_MOBILE_INPUT_LAYER_RATIO,
    )
    const roundedHeight = Math.min(Math.round(nextHeight), maxHeight)

    if (roundedHeight < MIN_MOBILE_INPUT_LAYER_HEIGHT) return

    mobileInputLayerHeightRef.current = roundedHeight
    setMobileInputLayerHeight(roundedHeight)
  }

  function getMeasuredKeyboardHeight() {
    const viewport = window.visualViewport
    if (!viewport) return 0

    const closedHeight = keyboardClosedViewportHeightRef.current ?? window.innerHeight

    const measuredHeights = [
      closedHeight - viewport.height,
      window.innerHeight - viewport.height - viewport.offsetTop,
    ].filter((height) => height >= MIN_MOBILE_INPUT_LAYER_HEIGHT)

    return measuredHeights.length > 0 ? Math.min(...measuredHeights) : 0
  }

  function rememberTextSelection() {
    const textarea = textareaRef.current
    if (!textarea) return

    textSelectionRef.current = {
      start: textarea.selectionStart,
      end: textarea.selectionEnd,
    }
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
    setIsInputLayerActive(false)
    keyboardWasOpenRef.current = false
    openingEmojiPickerRef.current = false
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

  useEffect(() => {
    isEmojiPickerOpenRef.current = isEmojiPickerOpen
  }, [isEmojiPickerOpen])

  useEffect(() => {
    if (!isEmojiPickerOpen) return

    openingEmojiPickerRef.current = false

    function handlePointerDown(event: PointerEvent) {
      if (emojiAreaRef.current && !emojiAreaRef.current.contains(event.target as Node)) {
        clearKeyboardCloseWait()
        setIsEmojiPickerOpen(false)
      }
    }

    function handleDocumentKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        clearKeyboardCloseWait()
        setIsEmojiPickerOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleDocumentKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleDocumentKeyDown)
    }
  }, [clearKeyboardCloseWait, isEmojiPickerOpen])

  // Пока открыт эмодзи-пикер на мобильном — блокируем overscroll/скролл страницы под ним,
  // иначе жест внутри панели эмодзи мог утянуть за собой скролл всей страницы
  useEffect(() => {
    if (!isEmojiPickerOpen || !isMobileInputMode()) return

    const html = document.documentElement
    const body = document.body
    const previousHtmlOverscroll = html.style.overscrollBehavior
    const previousBodyOverscroll = body.style.overscrollBehavior
    const previousBodyOverflow = body.style.overflow

    html.style.overscrollBehavior = 'none'
    body.style.overscrollBehavior = 'none'
    body.style.overflow = 'hidden'

    return () => {
      html.style.overscrollBehavior = previousHtmlOverscroll
      body.style.overscrollBehavior = previousBodyOverscroll
      body.style.overflow = previousBodyOverflow
    }
  }, [isEmojiPickerOpen])

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
    if (!isInputLayerActive || !isMobileInputMode()) return

    const viewport = window.visualViewport
    if (!viewport) return
    const activeViewport = viewport

    function handleViewportResize() {
      const closedHeight = keyboardClosedViewportHeightRef.current ?? window.innerHeight
      const keyboardHeight = closedHeight - activeViewport.height
      const keyboardClosed = activeViewport.height >= closedHeight - 40

      if (keyboardHeight >= 180) {
        keyboardWasOpenRef.current = true
        updateMobileInputLayerHeight(keyboardHeight)

        if (!openingEmojiPickerRef.current) {
          clearKeyboardCloseWait()
          isEmojiPickerOpenRef.current = false
          setIsEmojiPickerOpen(false)
        }

        return
      }

      if (!keyboardClosed) return

      if (openingEmojiPickerRef.current && !isEmojiPickerOpenRef.current) {
        clearKeyboardCloseWait()
        isEmojiPickerOpenRef.current = true
        setIsEmojiPickerOpen(true)
        return
      }

      if (!keyboardWasOpenRef.current) return
      if (openingEmojiPickerRef.current || isEmojiPickerOpenRef.current) return

      closeInputLayer()
      removeSyntheticInputHistoryEntry()
    }

    activeViewport.addEventListener('resize', handleViewportResize)

    return () => activeViewport.removeEventListener('resize', handleViewportResize)
  }, [closeInputLayer, isInputLayerActive, removeSyntheticInputHistoryEntry, clearKeyboardCloseWait])

  useEffect(() => {
    window.addEventListener('messenger:discard-input-history', discardInputHistoryLayer)
    return () => window.removeEventListener('messenger:discard-input-history', discardInputHistoryLayer)
  }, [discardInputHistoryLayer])

  function openEmojiPicker() {
    clearKeyboardCloseWait()
    ensureInputHistoryEntry()
    openingEmojiPickerRef.current = true
    rememberTextSelection()

    const keyboardHeight = getMeasuredKeyboardHeight()

    updateMobileInputLayerHeight(keyboardHeight || mobileInputLayerHeightRef.current)

    if (isMobileInputMode() && keyboardHeight >= 180) {
      isEmojiPickerOpenRef.current = false
      setIsEmojiPickerOpen(false)
      textareaRef.current?.blur()

      keyboardCloseTimeoutRef.current = window.setTimeout(() => {
        keyboardCloseTimeoutRef.current = null

        if (!openingEmojiPickerRef.current || isEmojiPickerOpenRef.current) {
          return
        }

        isEmojiPickerOpenRef.current = true
        setIsEmojiPickerOpen(true)
      }, 220)

      return
    }

    isEmojiPickerOpenRef.current = true
    setIsEmojiPickerOpen(true)
    requestAnimationFrame(() => textareaRef.current?.blur())
  }

  function switchFromEmojiToKeyboard() {
    const textarea = textareaRef.current

    if (!textarea) {
      clearKeyboardCloseWait()
      setIsEmojiPickerOpen(false)
      return
    }

    clearKeyboardCloseWait()
    ensureInputHistoryEntry()
    rememberTextSelection()

    textarea.focus()
    requestAnimationFrame(() => textarea.focus())

    keyboardCloseTimeoutRef.current = window.setTimeout(() => {
      keyboardCloseTimeoutRef.current = null
      const keyboardHeight = getMeasuredKeyboardHeight()

      if (keyboardHeight < 180) {
        isEmojiPickerOpenRef.current = false
        setIsEmojiPickerOpen(false)
      }
    }, 150)
  }

  const inputLayerStyle = {
    '--mobile-input-layer-height': `${mobileInputLayerHeight}px`,
  } as CSSProperties

  return {
    textareaRef,
    emojiAreaRef,
    isEmojiPickerOpen,
    setIsEmojiPickerOpen,
    openingEmojiPickerRef,
    inputLayerStyle,
    isMobileInputMode,
    ensureInputHistoryEntry,
    rememberTextSelection,
    openEmojiPicker,
    switchFromEmojiToKeyboard,
    clearKeyboardCloseWait,
  }
}
