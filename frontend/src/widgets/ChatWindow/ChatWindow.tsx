import {
  useEffect,
  useState,
  type RefObject,
  type KeyboardEvent,
  type ChangeEvent,
  type MouseEvent,
} from 'react'
import { useTranslation } from 'react-i18next'
import { EmojiPicker } from '../../shared/ui/EmojiPicker'
import { MessageList } from './MessageList'
import { FilePreviewBar } from './FilePreviewBar'
import { ContextMenu, type ContextMenuState } from './ContextMenu'
import { ForwardIcon, TrashIcon } from './icons'
import { useAttachmentQueue } from './hooks/useAttachmentQueue'
import { useMobileInputLayer } from './hooks/useMobileInputLayer'
import { useErrorModalStore } from '../../shared/api/errorModalStore'
import type { ChatMeta, Message, ModalUser, Sender } from '../../shared/types/messenger'
import s from './ChatWindow.module.css'

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
}

export function ChatWindow({
  chatId, meta, messages, otherReadAt, meSender, typingChats, loadingHistory, historyLoaded,
  loadingInitial, loadError, onRetryLoad,
  messagesRef, topSentinelRef, bottomRef,
  onSend, onSendFiles, onRetry, onDelete, onEdit, onBulkDelete, onForward, onTyping, onHeaderClick, onAvatarClick,
}: ChatWindowProps) {
  const { t } = useTranslation()
  const showError = useErrorModalStore(st => st.showError)
  const [text, setText] = useState('')
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [editingMsg, setEditingMsg] = useState<Message | null>(null)
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  const attachments = useAttachmentQueue({ onSendFiles, showError })
  const mobileInput = useMobileInputLayer()

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

  async function send() {
    const trimmed = text.trim()

    if (attachments.queuedFiles.length > 0) {
      if (attachments.fileUploading) return
      const sent = await attachments.sendQueuedFiles(trimmed || undefined)
      if (sent) setText('')
      mobileInput.clearKeyboardCloseWait()
      mobileInput.setIsEmojiPickerOpen(false)
      mobileInput.setIsEmojiSpaceReserved(false)
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
    mobileInput.setIsEmojiSpaceReserved(false)
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
          className={`${s.messages} ${mobileInput.isEmojiSpaceReserved ? s.messagesInputLayerOpen : ''}`}
          ref={messagesRef}
          style={mobileInput.inputLayerStyle}
        >
          <div ref={topSentinelRef} />

          {loadingHistory && (
            <div className={s.historyLoader}><div className={s.historySpinner} /></div>
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
            onToggleSelect={toggleSelect}
            onAvatarClick={onAvatarClick}
            onContextMenu={openContextMenu}
            onRetry={onRetry}
          />

          <div ref={bottomRef} />
        </div>
      )}

      <div
        className={`${s.inputArea} ${mobileInput.isEmojiSpaceReserved ? s.inputAreaEmojiOpen : ''}`}
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
              onPointerDown={() => {
                if (mobileInput.isMobileInputMode() && mobileInput.isEmojiPickerOpen) mobileInput.switchFromEmojiToKeyboard()
              }}
              onFocus={() => mobileInput.ensureInputHistoryEntry()}
              onBlur={() => {
                if (!mobileInput.isEmojiPickerOpen) mobileInput.setIsEmojiSpaceReserved(false)
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

          <button className={s.sendBtn} disabled={(!text.trim() && attachments.queuedFiles.length === 0) || attachments.fileUploading} onClick={send}>
            <svg className={s.sendIcon} viewBox="0 0 24 24">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>

        <div
          className={`${s.emojiPanel} ${mobileInput.isEmojiPickerOpen ? s.emojiPanelOpen : ''}`}
          aria-hidden={!mobileInput.isEmojiPickerOpen}
        >
          <EmojiPicker onSelect={handleEmojiSelect} disabled={!mobileInput.isEmojiPickerOpen} />
        </div>
      </div>

      {contextMenu && (
        <ContextMenu
          state={contextMenu}
          onReply={startReply}
          onEdit={startEdit}
          onForward={(msg) => { onForward([msg]); setContextMenu(null) }}
          onDelete={requestDelete}
          onSelect={enterSelectMode}
        />
      )}
    </div>
  )
}

export type { ModalUser }
