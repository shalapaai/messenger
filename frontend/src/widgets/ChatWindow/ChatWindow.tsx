import { useState, useRef, useEffect, type RefObject, type KeyboardEvent, type ChangeEvent, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { ChatMeta, Message, ModalUser, Sender } from '../../shared/types/messenger'
import s from './ChatWindow.module.css'

type RenderedItem =
  | { type: 'sep'; label: string }
  | { type: 'msg'; msg: Message; showAvatar: boolean; showName: boolean; senderSwitch: boolean }

interface ContextMenuState { x: number; y: number; msg: Message }

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
  onSend, onRetry, onDelete, onEdit, onBulkDelete, onForward, onTyping, onHeaderClick, onAvatarClick,
}: ChatWindowProps) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [editingMsg, setEditingMsg] = useState<Message | null>(null)
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [composerChatId, setComposerChatId] = useState(chatId)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isReadByOther = (msg: Message) =>
    !!otherReadAt && new Date(msg.sentAt).getTime() <= new Date(otherReadAt).getTime()

  // при смене чата старое выделение/редактирование/ответ неактуальны — сбрасываем прямо во время
  // рендера (без useEffect, чтобы не ловить лишний кадр со старым состоянием поверх нового чата)
  if (chatId !== composerChatId) {
    setComposerChatId(chatId)
    setSelectMode(false)
    setSelectedIds(new Set())
    setEditingMsg(null)
    setReplyingTo(null)
    setText('')
  }

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

  function send() {
    const trimmed = text.trim()
    if (!trimmed) return
    if (editingMsg) {
      if (trimmed !== editingMsg.text) onEdit(editingMsg, trimmed)
      setEditingMsg(null)
    } else {
      onSend(trimmed, replyingTo ?? undefined)
      setReplyingTo(null)
    }
    setText('')
    textareaRef.current?.focus()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
    if (e.key === 'Escape') {
      if (editingMsg) cancelEdit()
      if (replyingTo) cancelReply()
    }
  }

  const isTyping = typingChats[chatId] && !meta.group

  return (
    <>
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
        <div className={s.messages} ref={messagesRef}>
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

      <div className={s.inputBar}>
        <textarea
          ref={textareaRef}
          className={s.textInput}
          placeholder={t('messenger.messagePlaceholder')}
          value={text}
          rows={1}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => { setText(e.target.value); onTyping() }}
          onKeyDown={handleKeyDown}
        />
        <button className={s.sendBtn} disabled={!text.trim()} onClick={send}>
          <svg className={s.sendIcon} viewBox="0 0 24 24">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
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
    </>
  )
}

export type { ModalUser }
