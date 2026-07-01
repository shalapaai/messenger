import { useState, useRef, type RefObject, type KeyboardEvent, type ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { ChatMeta, Message, ModalUser, Sender } from '../../shared/types/messenger'
import s from './ChatWindow.module.css'

type RenderedItem =
  | { type: 'sep'; label: string }
  | { type: 'msg'; msg: Message; showAvatar: boolean; showName: boolean; senderSwitch: boolean }

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
  onSend: (text: string) => void
  onRetry: (msg: Message) => void
  onDelete: (msg: Message) => void
  onTyping: () => void
  onHeaderClick: () => void
  onAvatarClick: (msg: Message) => void
}

export function ChatWindow({
  chatId, meta, messages, otherReadAt, meSender, typingChats, loadingHistory, historyLoaded,
  loadingInitial, loadError, onRetryLoad,
  messagesRef, topSentinelRef, bottomRef,
  onSend, onRetry, onDelete, onTyping, onHeaderClick, onAvatarClick,
}: ChatWindowProps) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isReadByOther = (msg: Message) =>
    !!otherReadAt && new Date(msg.sentAt).getTime() <= new Date(otherReadAt).getTime()

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
    onSend(trimmed)
    setText('')
    textareaRef.current?.focus()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const isTyping = typingChats[chatId] && !meta.group

  return (
    <>
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
                    onClick={() => onAvatarClick(item.msg)}
                  >
                    {displaySender.senderName}
                  </div>
                )}
                <div className={`${s.msgRow} ${item.senderSwitch && !item.showName ? s.senderSwitch : ''}`}>
                  <div
                    className={`${s.msgAvatar} ${item.showAvatar ? s.msgAvatarClickable : s.msgAvatarHidden}`}
                    style={displaySender.senderAvatarUrl ? undefined : { background: displaySender.senderColor }}
                    onClick={() => item.showAvatar ? onAvatarClick(item.msg) : undefined}
                  >
                    {displaySender.senderAvatarUrl
                      ? <img src={displaySender.senderAvatarUrl} alt={displaySender.senderInitials} className={s.msgAvatarImg} />
                      : displaySender.senderInitials
                    }
                  </div>
                  <div className={[
                    s.bubble,
                    item.msg.own ? s.bubbleOwn : s.bubbleOther,
                    item.showAvatar ? s.bubbleTail : '',
                    item.msg.status === 'pending' ? s.bubblePending : '',
                    item.msg.status === 'failed'  ? s.bubbleFailed  : '',
                  ].join(' ')}>
                    {item.msg.text}
                  </div>
                  {item.msg.own && item.msg.status !== 'pending' && item.msg.status !== 'failed' && (
                    <button
                      type="button"
                      className={s.msgDeleteBtn}
                      title={t('messenger.deleteMessage')}
                      onClick={() => { if (window.confirm(t('messenger.confirmDeleteMessage'))) onDelete(item.msg) }}
                    >
                      <TrashIcon className={s.msgDeleteIcon} />
                    </button>
                  )}
                </div>
                <span className={s.msgTime}>
                  {item.msg.own && item.msg.status === 'pending' && <span className={`${s.msgStatusIcon} ${s.msgStatusPending}`}>●</span>}
                  {item.msg.own && item.msg.status === 'sent' && (
                    isReadByOther(item.msg)
                      ? <span className={`${s.msgStatusIcon} ${s.msgStatusRead}`}>✓✓</span>
                      : <span className={`${s.msgStatusIcon} ${s.msgStatusSent}`}>✓</span>
                  )}
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
    </>
  )
}

export type { ModalUser }
