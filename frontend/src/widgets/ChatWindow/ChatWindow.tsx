import {
  useEffect,
  useLayoutEffect,
  useState,
  type RefObject,
  type KeyboardEvent,
  type ChangeEvent,
  type MouseEvent,
} from 'react'
import { useTranslation } from 'react-i18next'
import { EmojiPicker } from '../../shared/ui/EmojiPicker'
import { AvatarImage } from '../../shared/ui/AvatarImage'
import { MessagesSkeleton } from './MessagesSkeleton'
import { MessageList } from './MessageList'
import { FilePreviewBar } from './FilePreviewBar'
import { ContextMenu, type ContextMenuState } from './ContextMenu'
import { ForwardIcon, TrashIcon } from './icons'
import { useAttachmentQueue } from './hooks/useAttachmentQueue'
import { useMobileInputLayer } from './hooks/useMobileInputLayer'
import { useErrorModalStore } from '../../shared/api/errorModalStore'
import type { ChatMeta, Message, ModalUser, Sender } from '../../shared/types/messenger'
import s from './ChatWindow.module.css'

// должно совпадать с лимитом на бэкенде (Message.Create / Message.Edit) — проверяем длину
// на клиенте до отправки, чтобы слишком длинное сообщение не превращалось молча в "не отправлено"
const MESSAGE_MAX_LENGTH = 4096

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
  onSendFiles: (files: File[], caption: string | undefined, onUploadProgress?: (percent: number) => void) => Promise<void>
  onRetry: (msg: Message) => void
  onDelete: (msg: Message) => void
  onEdit: (msg: Message, newText: string) => void
  onBulkDelete: (msgs: Message[]) => void
  onForward: (msgs: Message[]) => void
  onTyping: () => void
  onHeaderClick: () => void
  onAvatarClick: (msg: Message) => void
  onForwardedUserClick?: (userId: string, name: string) => void
  shouldAutoFocus?: boolean
  canDeleteMessages?: boolean
}

export function ChatWindow({
  chatId, meta, messages, otherReadAt, meSender, typingChats, loadingHistory, historyLoaded,
  loadingInitial, loadError, onRetryLoad,
  messagesRef, topSentinelRef, bottomRef,
  onSend, onSendFiles, onRetry, onDelete, onEdit, onBulkDelete, onForward, onTyping, onHeaderClick, onAvatarClick,
  onForwardedUserClick, shouldAutoFocus, canDeleteMessages = true,
}: ChatWindowProps) {
  const { t } = useTranslation()
  const showError = useErrorModalStore(st => st.showError)
  const [text, setText] = useState('')
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [editingMsg, setEditingMsg] = useState<Message | null>(null)
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null)
  const [confirmDeleteMsg, setConfirmDeleteMsg] = useState<Message | null>(null)
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)

  const attachments = useAttachmentQueue({ onSendFiles, showError })
  const mobileInput = useMobileInputLayer()

  const hasMessages = messages.length > 0
  const isOverLimit = text.length > MESSAGE_MAX_LENGTH

  useEffect(() => {
    if (shouldAutoFocus) mobileInput.textareaRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const el = messagesRef.current
    if (!el) return
    const onScroll = () => {
      setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [messagesRef, hasMessages])

  useLayoutEffect(() => {
    if (loadingInitial) return
    const el = messagesRef.current
    if (!el) return
    setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80)
  }, [loadingInitial, messagesRef, hasMessages])

  function scrollToBottom() {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  function scrollToMessage(msgId: string) {
    const el = messagesRef.current?.querySelector(`[data-message-id="${CSS.escape(msgId)}"]`) as HTMLElement | null
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setHighlightedMsgId(msgId)
    setTimeout(() => setHighlightedMsgId(null), 1200)
  }

  // per-chat состояние (выделение/редактирование/ответ/мобильная раскладка ввода/очередь файлов)
  // не нужно сбрасывать вручную при смене чата — MessengerPage.tsx монтирует ChatWindow с
  // key={chatId}, так что React сам полностью пересоздаёт компонент и весь его state при
  // переключении на другой чат

  useEffect(() => {
    if (!selectMode) return
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') exitSelectMode() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectMode])

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

  function openContextMenu(e: MouseEvent, msg: Message) {
    // Сообщение без messageId — ещё отправляется или не отправилось; меню для него имеет смысл
    // только чтобы удалить черновик (см. ContextMenu: остальные пункты требуют messageId)
    if (!msg.messageId && msg.status !== 'failed') return
    e.preventDefault()
    if (selectMode) {
      if (!msg.messageId) return
      if (!selectedIds.has(msg.id)) toggleSelect(msg)
      setContextMenu({ x: e.clientX, y: e.clientY, msg, selection: true })
      return
    }
    setContextMenu({ x: e.clientX, y: e.clientY, msg })
  }

  function startEdit(msg: Message) {
    cancelReply()
    setEditingMsg(msg)
    setText(msg.text)
    setContextMenu(null)
    mobileInput.setIsEmojiPickerOpen(false)
    mobileInput.textareaRef.current?.focus()
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
    mobileInput.setIsEmojiPickerOpen(false)
    mobileInput.textareaRef.current?.focus()
  }

  function cancelReply() {
    setReplyingTo(null)
  }

  function requestDelete(msg: Message) {
    setContextMenu(null)
    setConfirmDeleteMsg(msg)
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
    if (selectedIds.size === 0) return
    setConfirmBulkDelete(true)
  }

  function requestBulkForward() {
    const selected = messages.filter(m => selectedIds.has(m.id))
    if (selected.length === 0) return
    onForward(selected)
    exitSelectMode()
  }

  async function send() {
    const trimmed = text.trim()

    // Проверяем лимит ДО отправки — иначе сообщение уходит на сервер, откуда возвращается
    // отказом, и превращается в "не отправлено" вместо понятного предупреждения. Кнопка отправки
    // уже задизейблена в этом случае, так что сюда попасть можно только напрямую через Enter.
    if (trimmed.length > MESSAGE_MAX_LENGTH) {
      showError(t('messenger.messageTooLong', { max: MESSAGE_MAX_LENGTH }))
      return
    }

    if (attachments.queuedFiles.length > 0) {
      if (attachments.fileUploading) return
      const sent = await attachments.sendQueuedFiles(trimmed || undefined)
      if (sent) setText('')
      mobileInput.clearKeyboardCloseWait()
      mobileInput.setIsEmojiPickerOpen(false)
      mobileInput.textareaRef.current?.focus()
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
    mobileInput.clearKeyboardCloseWait()
    mobileInput.setIsEmojiPickerOpen(false)
    mobileInput.textareaRef.current?.focus()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
    if (e.key === 'Escape') {
      if (editingMsg) cancelEdit()
      if (replyingTo) cancelReply()
    }
  }

  function handleEmojiSelect(emoji: string) {
    const textarea = mobileInput.textareaRef.current
    const isMobile = mobileInput.isMobileInputMode()

    if (!textarea) {
      setText((prev) => prev + emoji)
      onTyping()
      return
    }

    const start = isMobile ? Math.min(textarea.selectionStart, text.length) : textarea.selectionStart
    const end = isMobile ? Math.min(textarea.selectionEnd, text.length) : textarea.selectionEnd
    const nextText = text.slice(0, start) + emoji + text.slice(end)
    const cursorPosition = start + emoji.length

    setText(nextText)
    onTyping()

    requestAnimationFrame(() => {
      textarea.setSelectionRange(cursorPosition, cursorPosition)
      if (!isMobile) textarea.focus()
    })
  }

  const isTyping = typingChats[chatId] && !meta.group

  return (
    <div
      className={s.chatWindowRoot}
      onDragEnter={attachments.handleDragEnter}
      onDragOver={attachments.handleDragOver}
      onDragLeave={attachments.handleDragLeave}
      onDrop={attachments.handleDrop}
    >
      {attachments.isDraggingFile && (
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
            {canDeleteMessages && (
              <button
                type="button"
                className={`${s.selectionBarBtn} ${s.selectionBarBtnDanger}`}
                disabled={selectedIds.size === 0}
                title={t('messenger.deleteMessage')}
                onClick={requestBulkDelete}
              >
                <TrashIcon />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className={s.chatHeader}>
          <button type="button" className={s.chatHeaderTrigger} onClick={onHeaderClick}>
            <div className={`${s.chatHeaderAvatar} ${meta.group ? s.chatHeaderAvatarGroup : ''}`} style={meta.avatarUrl ? undefined : { background: meta.color }}>
              {meta.avatarUrl
                ? <AvatarImage src={meta.avatarUrl} alt={meta.name} className={s.chatHeaderAvatarImg} />
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
        <MessagesSkeleton />
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
        <div className={s.messagesOuter}>
          <div className={s.messages} ref={messagesRef}>
            <div ref={topSentinelRef} />

            {loadingHistory && (
              <MessagesSkeleton compact />
            )}

            {!loadingHistory && historyLoaded && (
              <div className={s.historyEnd}>{t('messenger.historyStart')}</div>
            )}

            <MessageList
              messages={messages}
              meta={meta}
              meSender={meSender}
              otherReadAt={otherReadAt}
              selectMode={selectMode}
              selectedIds={selectedIds}
              highlightedMsgId={highlightedMsgId}
              onToggleSelect={toggleSelect}
              onAvatarClick={onAvatarClick}
              onContextMenu={openContextMenu}
              onRetry={onRetry}
              onScrollToMessage={scrollToMessage}
              onForwardedUserClick={onForwardedUserClick}
            />

            <div ref={bottomRef} />
          </div>
          {!isAtBottom && (
            <button className={s.scrollToBottomBtn} onClick={scrollToBottom} title="Вниз">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          )}
        </div>
      )}

      <div
        className={`${s.inputArea} ${mobileInput.isEmojiPickerOpen ? s.inputAreaEmojiOpen : ''}`}
        ref={mobileInput.emojiAreaRef}
        style={mobileInput.inputLayerStyle}
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

        {isOverLimit && (
          <div className={s.lengthWarningBar}>
            {t('messenger.messageTooLongInline', { length: text.length, max: MESSAGE_MAX_LENGTH })}
          </div>
        )}

        <FilePreviewBar
          queuedFiles={attachments.queuedFiles}
          fileUploading={attachments.fileUploading}
          uploadProgress={attachments.uploadProgress}
          onRemove={attachments.removeQueuedFile}
          onClearAll={attachments.clearQueuedFiles}
        />

        <div className={s.inputBar}>
          <input
            ref={attachments.fileInputRef}
            type="file"
            multiple
            className={s.hiddenFileInput}
            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z,audio/*,video/*"
            onChange={attachments.handleFileSelect}
          />
          <button
            type="button"
            className={`${s.emojiBtn} ${s.attachBtn}`}
            onClick={() => attachments.fileInputRef.current?.click()}
            aria-label={t('messenger.attachFile')}
            title={t('messenger.attachFile')}
          >
            📎
          </button>
          <div className={s.messageInputShell}>
            <button
              type="button"
              className={`${s.emojiBtn} ${s.mobileEmojiBtn} ${mobileInput.isEmojiPickerOpen ? s.emojiBtnActive : ''}`}
              onClick={() => {
                if (mobileInput.isEmojiPickerOpen) {
                  mobileInput.switchFromEmojiToKeyboard()
                } else {
                  setContextMenu(null)
                  mobileInput.openEmojiPicker()
                }
              }}
              aria-label={mobileInput.isEmojiPickerOpen ? t('emoji.keyboard') : t('emoji.open')}
              aria-expanded={mobileInput.isEmojiPickerOpen}
              aria-pressed={mobileInput.isEmojiPickerOpen}
            >
              {mobileInput.isEmojiPickerOpen ? '⌨' : '☺'}
            </button>

            <textarea
              ref={mobileInput.textareaRef}
              className={s.textInput}
              placeholder={t('messenger.messagePlaceholder')}
              value={text}
              rows={1}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => { setText(e.target.value); onTyping() }}
              onKeyDown={handleKeyDown}
              onSelect={mobileInput.rememberTextSelection}
              onPointerDown={() => {
                if (mobileInput.isMobileInputMode() && mobileInput.isEmojiPickerOpen) {
                  mobileInput.switchFromEmojiToKeyboard()
                }
              }}
              onFocus={() => {
                mobileInput.ensureInputHistoryEntry()
                mobileInput.rememberTextSelection()

                if (mobileInput.isMobileInputMode() && mobileInput.isEmojiPickerOpen) {
                  mobileInput.clearKeyboardCloseWait()
                }
              }}
              onBlur={() => {
                if (!mobileInput.isEmojiPickerOpen && !mobileInput.openingEmojiPickerRef.current) {
                  mobileInput.setIsEmojiPickerOpen(false)
                }
              }}
            />

            <div className={`${s.emojiWrap} ${s.desktopEmojiWrap}`}>
              <button
                type="button"
                className={`${s.emojiBtn} ${mobileInput.isEmojiPickerOpen ? s.emojiBtnActive : ''}`}
                onClick={() => mobileInput.setIsEmojiPickerOpen((value) => !value)}
                aria-label={t('emoji.open')}
                aria-expanded={mobileInput.isEmojiPickerOpen}
                aria-pressed={mobileInput.isEmojiPickerOpen}
              >
                ☺
              </button>
            </div>
          </div>

          <button
            className={s.sendBtn}
            disabled={(!text.trim() && attachments.queuedFiles.length === 0) || attachments.fileUploading || isOverLimit}
            onClick={send}
          >
            <svg className={s.sendIcon} viewBox="0 0 24 24">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>

        <div
          className={`${s.emojiPanel} ${mobileInput.isEmojiPickerOpen ? s.emojiPanelOpen : ''}`}
          aria-hidden={!mobileInput.isEmojiPickerOpen}
          onWheel={(event) => event.stopPropagation()}
          onTouchMove={(event) => event.stopPropagation()}
        >
          {mobileInput.isEmojiPickerOpen && (
            <EmojiPicker onSelect={handleEmojiSelect} disabled={!mobileInput.isEmojiPickerOpen} />
          )}
        </div>
      </div>

      {contextMenu && (
        <ContextMenu
          state={contextMenu}
          canDeleteMessages={canDeleteMessages}
          onReply={startReply}
          onEdit={startEdit}
          onForward={(msg) => { onForward([msg]); setContextMenu(null) }}
          onDelete={requestDelete}
          onSelect={enterSelectMode}
          onBulkForward={() => { requestBulkForward(); setContextMenu(null) }}
          onBulkDelete={() => { requestBulkDelete(); setContextMenu(null) }}
        />
      )}

      {confirmDeleteMsg && (
        <div className={s.confirmOverlay} onClick={() => setConfirmDeleteMsg(null)}>
          <div className={s.confirmPanel} onClick={e => e.stopPropagation()}>
            <div className={s.confirmTitle}>{t('messenger.confirmDeleteMessage')}</div>
            <div className={s.confirmActions}>
              <button type="button" className={s.confirmCancel} onClick={() => setConfirmDeleteMsg(null)}>
                {t('common.cancel')}
              </button>
              <button type="button" className={s.confirmDeleteBtn} onClick={() => { onDelete(confirmDeleteMsg); setConfirmDeleteMsg(null) }}>
                {t('messenger.deleteMessage')}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmBulkDelete && (
        <div className={s.confirmOverlay} onClick={() => setConfirmBulkDelete(false)}>
          <div className={s.confirmPanel} onClick={e => e.stopPropagation()}>
            <div className={s.confirmTitle}>{t('messenger.confirmBulkDelete', { count: selectedIds.size })}</div>
            <div className={s.confirmActions}>
              <button type="button" className={s.confirmCancel} onClick={() => setConfirmBulkDelete(false)}>
                {t('common.cancel')}
              </button>
              <button type="button" className={s.confirmDeleteBtn} onClick={() => {
                const selected = messages.filter(m => selectedIds.has(m.id))
                onBulkDelete(selected)
                exitSelectMode()
                setConfirmBulkDelete(false)
              }}>
                {t('messenger.deleteMessage')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export type { ModalUser }
