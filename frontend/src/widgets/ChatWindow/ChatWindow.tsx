import {
  useCallback,
  useEffect,
  useState,
  useRef,
  type RefObject,
  type KeyboardEvent,
  type ChangeEvent,
} from 'react'
import { useTranslation } from 'react-i18next'
import { EmojiPicker } from '../../shared/ui/EmojiPicker'
import type {
  ChatMeta,
  Message,
  ModalUser,
  Sender,
} from '../../shared/types/messenger'
import s from './ChatWindow.module.css'

type RenderedItem =
  | { type: 'sep'; label: string }
  | {
      type: 'msg'
      msg: Message
      showAvatar: boolean
      showName: boolean
      senderSwitch: boolean
    }

function TrashIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  )
}

interface ChatWindowProps {
  chatId: string
  meta: ChatMeta
  messages: Message[]
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
  onSend: (text: string) => void
  onRetry: (msg: Message) => void
  onDelete: (msg: Message) => void
  onTyping: () => void
  onHeaderClick: () => void
  onAvatarClick: (msg: Message) => void
}

export function ChatWindow({
  chatId,
  meta,
  messages,
  meSender,
  typingChats,
  loadingHistory,
  historyLoaded,
  loadingInitial,
  loadError,
  onRetryLoad,
  messagesRef,
  topSentinelRef,
  bottomRef,
  onSend,
  onRetry,
  onDelete,
  onTyping,
  onHeaderClick,
  onAvatarClick,
}: ChatWindowProps) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false)
  const [isEmojiSpaceReserved, setIsEmojiSpaceReserved] = useState(false)
  const [isInputLayerActive, setIsInputLayerActive] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const emojiAreaRef = useRef<HTMLDivElement>(null)
  const keyboardCloseTimeoutRef = useRef<number | null>(null)
  const keyboardViewportCleanupRef = useRef<(() => void) | null>(null)
  const inputHistoryEntryRef = useRef(false)
  const keyboardClosedViewportHeightRef = useRef<number | null>(null)

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
    keyboardClosedViewportHeightRef.current =
      window.visualViewport?.height ?? window.innerHeight
  }

  function ensureInputHistoryEntry() {
    if (!isMobileInputMode() || inputHistoryEntryRef.current) return

    rememberKeyboardClosedViewportHeight()
    window.history.pushState(
      {
        ...(window.history.state ?? {}),
        messengerInputLayer: true,
      },
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
    if (!isEmojiPickerOpen) return

    function handlePointerDown(event: PointerEvent) {
      if (
        emojiAreaRef.current &&
        !emojiAreaRef.current.contains(event.target as Node)
      ) {
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
      const closedHeight =
        keyboardClosedViewportHeightRef.current ?? window.innerHeight
      const keyboardClosed = activeViewport.height >= closedHeight - 40

      if (!keyboardClosed) return

      closeInputLayer()
      removeSyntheticInputHistoryEntry()
    }

    activeViewport.addEventListener('resize', handleViewportResize)

    return () =>
      activeViewport.removeEventListener('resize', handleViewportResize)
  }, [
    closeInputLayer,
    isEmojiPickerOpen,
    isInputLayerActive,
    removeSyntheticInputHistoryEntry,
  ])

  useEffect(() => {
    window.addEventListener(
      'messenger:discard-input-history',
      discardInputHistoryLayer,
    )

    return () => {
      window.removeEventListener(
        'messenger:discard-input-history',
        discardInputHistoryLayer,
      )
    }
  }, [discardInputHistoryLayer])

  const rendered: RenderedItem[] = []
  let lastDate = ''
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i],
      prev = messages[i - 1],
      next = messages[i + 1]
    if (msg.date !== lastDate) {
      rendered.push({ type: 'sep', label: msg.date })
      lastDate = msg.date
    }
    rendered.push({
      type: 'msg',
      msg,
      showAvatar: !next || next.senderId !== msg.senderId,
      showName:
        !msg.own && meta.group && (!prev || prev.senderId !== msg.senderId),
      senderSwitch: !!prev && prev.senderId !== msg.senderId,
    })
  }

  function send() {
    const trimmed = text.trim()
    if (!trimmed) return
    onSend(trimmed)
    setText('')
    clearKeyboardCloseWait()
    setIsEmojiPickerOpen(false)
    setIsEmojiSpaceReserved(false)
    textareaRef.current?.focus()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
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

      if (!isMobile) {
        textarea.focus()
      }
    })
  }

  function openEmojiPicker() {
    clearKeyboardCloseWait()
    ensureInputHistoryEntry()
    rememberKeyboardClosedViewportHeight()
    textareaRef.current?.blur()
    setIsEmojiSpaceReserved(true)
    setIsEmojiPickerOpen(true)
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

    const viewport = window.visualViewport
    const initialViewportHeight = viewport?.height ?? window.innerHeight
    let resizeSettleTimeout: number | null = null

    function finishKeyboardSwitch() {
      clearKeyboardCloseWait()
      setIsEmojiPickerOpen(false)
      setIsEmojiSpaceReserved(true)
    }

    function handleViewportResize() {
      const nextViewportHeight = viewport?.height ?? window.innerHeight
      const keyboardProbablyOpened =
        nextViewportHeight < initialViewportHeight - 60

      if (!keyboardProbablyOpened) return

      if (resizeSettleTimeout !== null) {
        window.clearTimeout(resizeSettleTimeout)
      }

      resizeSettleTimeout = window.setTimeout(finishKeyboardSwitch, 180)
    }

    keyboardViewportCleanupRef.current = () => {
      viewport?.removeEventListener('resize', handleViewportResize)

      if (resizeSettleTimeout !== null) {
        window.clearTimeout(resizeSettleTimeout)
        resizeSettleTimeout = null
      }
    }

    viewport?.addEventListener('resize', handleViewportResize)

    keyboardCloseTimeoutRef.current = window.setTimeout(
      finishKeyboardSwitch,
      720,
    )

    textarea.focus()
    requestAnimationFrame(() => textarea.focus())
  }

  const isTyping = typingChats[chatId] && !meta.group

  return (
    <>
      <div className={s.chatHeader}>
        <button
          type="button"
          className={s.chatHeaderTrigger}
          onClick={onHeaderClick}
        >
          <div
            className={`${s.chatHeaderAvatar} ${meta.group ? s.chatHeaderAvatarGroup : ''}`}
            style={meta.avatarUrl ? undefined : { background: meta.color }}
          >
            {meta.avatarUrl ? (
              <img
                src={meta.avatarUrl}
                alt={meta.name}
                className={s.chatHeaderAvatarImg}
              />
            ) : (
              meta.initials
            )}
          </div>
          <div className={s.chatHeaderInfo}>
            <div className={s.chatHeaderName}>{meta.name}</div>
            <div className={s.chatHeaderSub}>
              {isTyping ? (
                <span className={s.typingText}>{t('messenger.typing')}</span>
              ) : meta.online ? (
                <>
                  <span className={s.chatHeaderOnlineDot} />
                  {t('common.online')}
                </>
              ) : meta.group ? (
                t('group.label')
              ) : (
                t('common.recently')
              )}
            </div>
          </div>
        </button>
      </div>

      {loadingInitial ? (
        <div className={s.emptyChat}>
          <div className={s.historySpinner} />
        </div>
      ) : loadError ? (
        <div className={s.emptyChat}>
          <div className={s.emptyChatIcon}>⚠️</div>
          <h3 className={s.emptyChatTitle}>
            {t('messenger.loadConversationFailed')}
          </h3>
          <button className={s.loadErrorRetryBtn} onClick={onRetryLoad}>
            {t('common.retry')}
          </button>
        </div>
      ) : messages.length === 0 ? (
        <div className={s.emptyChat}>
          <div className={s.emptyChatIcon}>💬</div>
          <h3 className={s.emptyChatTitle}>{t('messenger.startChat')}</h3>
          <p className={s.emptyChatSub}>
            {t('messenger.firstMessage', { name: meta.name.split(' ')[0] })}
          </p>
        </div>
      ) : (
        <div className={s.messages} ref={messagesRef}>
          <div ref={topSentinelRef} />

          {loadingHistory && (
            <div className={s.historyLoader}>
              <div className={s.historySpinner} />
            </div>
          )}

          {!loadingHistory && historyLoaded && (
            <div className={s.historyEnd}>{t('messenger.historyStart')}</div>
          )}

          {rendered.map((item, i) =>
            item.type === 'sep' ? (
              <div key={`sep-${i}`} className={s.dateSep}>
                <span className={s.dateSepLabel}>{item.label}</span>
              </div>
            ) : (
              (() => {
                const displaySender = item.msg.own
                  ? {
                      ...item.msg,
                      senderColor: meSender.senderColor,
                      senderAvatarUrl: meSender.senderAvatarUrl,
                      senderInitials: meSender.senderInitials,
                      senderName: meSender.senderName,
                    }
                  : item.msg
                return (
                  <div key={item.msg.id}>
                    {item.showName && (
                      <div
                        className={`${s.senderName} ${s.senderNameClickable}`}
                        style={{ color: displaySender.senderColor }}
                        onClick={() => onAvatarClick(item.msg)}
                      >
                        {displaySender.senderName}
                      </div>
                    )}
                    <div
                      className={`${s.msgRow} ${item.senderSwitch && !item.showName ? s.senderSwitch : ''}`}
                    >
                      <div
                        className={`${s.msgAvatar} ${item.showAvatar ? s.msgAvatarClickable : s.msgAvatarHidden}`}
                        style={
                          displaySender.senderAvatarUrl
                            ? undefined
                            : { background: displaySender.senderColor }
                        }
                        onClick={() =>
                          item.showAvatar ? onAvatarClick(item.msg) : undefined
                        }
                      >
                        {displaySender.senderAvatarUrl ? (
                          <img
                            src={displaySender.senderAvatarUrl}
                            alt={displaySender.senderInitials}
                            className={s.msgAvatarImg}
                          />
                        ) : (
                          displaySender.senderInitials
                        )}
                      </div>
                      <div
                        className={[
                          s.bubble,
                          item.msg.own ? s.bubbleOwn : s.bubbleOther,
                          item.showAvatar ? s.bubbleTail : '',
                          item.msg.status === 'pending' ? s.bubblePending : '',
                          item.msg.status === 'failed' ? s.bubbleFailed : '',
                          item.msg.deleted ? s.bubbleDeleted : '',
                        ].join(' ')}
                      >
                        {item.msg.deleted
                          ? t('messenger.deletedMessage')
                          : item.msg.text}
                      </div>
                      {item.msg.own &&
                        !item.msg.deleted &&
                        item.msg.status !== 'pending' &&
                        item.msg.status !== 'failed' && (
                          <button
                            type="button"
                            className={s.msgDeleteBtn}
                            title={t('messenger.deleteMessage')}
                            onClick={() => {
                              if (
                                window.confirm(
                                  t('messenger.confirmDeleteMessage'),
                                )
                              )
                                onDelete(item.msg)
                            }}
                          >
                            <TrashIcon className={s.msgDeleteIcon} />
                          </button>
                        )}
                    </div>
                    <span className={s.msgTime}>
                      {item.msg.own && item.msg.status === 'pending' && (
                        <span
                          className={`${s.msgStatusIcon} ${s.msgStatusPending}`}
                        >
                          ●
                        </span>
                      )}
                      {item.msg.own && item.msg.status === 'sent' && (
                        <span
                          className={`${s.msgStatusIcon} ${s.msgStatusSent}`}
                        >
                          ✓
                        </span>
                      )}
                      {item.msg.time}
                    </span>
                    {item.msg.status === 'failed' && (
                      <button
                        className={s.msgRetry}
                        onClick={() => onRetry(item.msg)}
                      >
                        {t('messenger.sendFailedRetry')}
                      </button>
                    )}
                  </div>
                )
              })()
            ),
          )}

          <div ref={bottomRef} />
        </div>
      )}

      <div
        className={`${s.inputArea} ${isEmojiSpaceReserved ? s.inputAreaEmojiOpen : ''}`}
        ref={emojiAreaRef}
      >
        <div className={s.inputBar}>
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
              aria-label={
                isEmojiPickerOpen ? t('emoji.keyboard') : t('emoji.open')
              }
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
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
                setText(e.target.value)
                onTyping()
              }}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                ensureInputHistoryEntry()
              }}
              onBlur={() => {
                if (!isEmojiPickerOpen) {
                  setIsEmojiSpaceReserved(false)
                }
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

          <button className={s.sendBtn} disabled={!text.trim()} onClick={send}>
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
          <EmojiPicker
            onSelect={handleEmojiSelect}
            disabled={!isEmojiPickerOpen}
          />
        </div>
      </div>
    </>
  )
}

export type { ModalUser }
