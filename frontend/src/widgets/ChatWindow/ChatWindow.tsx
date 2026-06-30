import { useState, useRef, type RefObject, type KeyboardEvent, type ChangeEvent } from 'react'
import type { ChatMeta, Message, ModalUser } from '../../shared/types/messenger'
import s from './ChatWindow.module.css'

type RenderedItem =
  | { type: 'sep'; label: string }
  | { type: 'msg'; msg: Message; showAvatar: boolean; showName: boolean; senderSwitch: boolean }

interface ChatWindowProps {
  chatId: string
  meta: ChatMeta
  messages: Message[]
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
  onTyping: () => void
  onHeaderClick: () => void
  onAvatarClick: (msg: Message) => void
}

export function ChatWindow({
  chatId, meta, messages, typingChats, loadingHistory, historyLoaded,
  loadingInitial, loadError, onRetryLoad,
  messagesRef, topSentinelRef, bottomRef,
  onSend, onRetry, onTyping, onHeaderClick, onAvatarClick,
}: ChatWindowProps) {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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
                ? <span className={s.typingText}>печатает...</span>
                : meta.online
                  ? <><span className={s.chatHeaderOnlineDot} />в сети</>
                  : meta.group
                    ? 'группа'
                    : 'был(а) недавно'
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
          <h3 className={s.emptyChatTitle}>Не удалось загрузить переписку</h3>
          <button className={s.loadErrorRetryBtn} onClick={onRetryLoad}>Повторить</button>
        </div>
      ) : messages.length === 0 ? (
        <div className={s.emptyChat}>
          <div className={s.emptyChatIcon}>💬</div>
          <h3 className={s.emptyChatTitle}>Начните общение</h3>
          <p className={s.emptyChatSub}>Напишите первое сообщение {meta.name.split(' ')[0]} 👋</p>
        </div>
      ) : (
        <div className={s.messages} ref={messagesRef}>
          <div ref={topSentinelRef} />

          {loadingHistory && (
            <div className={s.historyLoader}><div className={s.historySpinner} /></div>
          )}

          {!loadingHistory && historyLoaded && (
            <div className={s.historyEnd}>Начало переписки</div>
          )}

          {rendered.map((item, i) =>
            item.type === 'sep' ? (
              <div key={`sep-${i}`} className={s.dateSep}>
                <span className={s.dateSepLabel}>{item.label}</span>
              </div>
            ) : (
              <div key={item.msg.id}>
                {item.showName && (
                  <div
                    className={`${s.senderName} ${s.senderNameClickable}`}
                    style={{ color: item.msg.senderColor }}
                    onClick={() => onAvatarClick(item.msg)}
                  >
                    {item.msg.senderName}
                  </div>
                )}
                <div className={`${s.msgRow} ${item.senderSwitch && !item.showName ? s.senderSwitch : ''}`}>
                  <div
                    className={`${s.msgAvatar} ${item.showAvatar ? s.msgAvatarClickable : s.msgAvatarHidden}`}
                    style={item.msg.senderAvatarUrl ? undefined : { background: item.msg.senderColor }}
                    onClick={() => item.showAvatar ? onAvatarClick(item.msg) : undefined}
                  >
                    {item.msg.senderAvatarUrl
                      ? <img src={item.msg.senderAvatarUrl} alt={item.msg.senderInitials} className={s.msgAvatarImg} />
                      : item.msg.senderInitials
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
                </div>
                <span className={s.msgTime}>
                  {item.msg.own && item.msg.status === 'pending' && <span className={`${s.msgStatusIcon} ${s.msgStatusPending}`}>●</span>}
                  {item.msg.own && item.msg.status === 'sent'    && <span className={`${s.msgStatusIcon} ${s.msgStatusSent}`}>✓</span>}
                  {item.msg.time}
                </span>
                {item.msg.status === 'failed' && (
                  <button className={s.msgRetry} onClick={() => onRetry(item.msg)}>
                    ⚠ Не отправлено · Повторить
                  </button>
                )}
              </div>
            )
          )}

          <div ref={bottomRef} />
        </div>
      )}

      <div className={s.inputBar}>
        <textarea
          ref={textareaRef}
          className={s.textInput}
          placeholder="Написать сообщение…"
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
