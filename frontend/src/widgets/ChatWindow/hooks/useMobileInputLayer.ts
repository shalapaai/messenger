import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'

const DEFAULT_MOBILE_INPUT_LAYER_HEIGHT = 340
// Оценка высоты .inputArea в её обычном состоянии (просто строка ввода) — используется
// как запасное значение, пока ResizeObserver ещё не сделал первый замер
const DEFAULT_MOBILE_INPUT_AREA_HEIGHT = 96

/**
 * Мобильная раскладка ввода: виртуальная клавиатура и собственный эмодзи-пикер живут в одном
 * "слое" поверх экрана, закрываемом аппаратной кнопкой "назад" — раскладка синхронизируется с
 * visualViewport, держит синтетическую запись в history и живой замер высоты .inputArea (см.
 * ResizeObserver ниже), чтобы список сообщений резервировал под неё ровно нужное место.
 */
export function useMobileInputLayer() {
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

  function openEmojiPicker() {
    clearKeyboardCloseWait()
    ensureInputHistoryEntry()
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

  const inputLayerStyle = {
    '--mobile-input-layer-height': `${mobileInputLayerHeight}px`,
    '--mobile-keyboard-offset': `${mobileKeyboardOffset}px`,
    '--mobile-input-area-height': `${mobileInputAreaHeight}px`,
  } as CSSProperties

  return {
    textareaRef,
    emojiAreaRef,
    isEmojiPickerOpen,
    setIsEmojiPickerOpen,
    isEmojiSpaceReserved,
    setIsEmojiSpaceReserved,
    inputLayerStyle,
    isMobileInputMode,
    ensureInputHistoryEntry,
    openEmojiPicker,
    switchFromEmojiToKeyboard,
    clearKeyboardCloseWait,
  }
}
