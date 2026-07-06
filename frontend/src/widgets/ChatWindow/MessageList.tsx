import { type MouseEvent } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { AvatarImage } from '../../shared/ui/AvatarImage'
import { MessageAttachments } from './MessageAttachment'
import { CheckIcon } from './icons'
import { dateKey, formatDateLabel } from '../../shared/lib/formatDateTime'
import type { ChatMeta, Message, Sender } from '../../shared/types/messenger'
import s from './ChatWindow.module.css'

type RenderedItem =
  | { type: 'sep'; label: string }
  | { type: 'system'; msg: Message }
  | { type: 'msg'; msg: Message; showAvatar: boolean; showName: boolean; senderSwitch: boolean }

function systemMessageKey(eventType: Message['systemEventType']): string | null {
  switch (eventType) {
    case 'MemberAdded':   return 'messenger.systemMemberAdded'
    case 'MemberLeft':    return 'messenger.systemMemberLeft'
    case 'MemberRemoved': return 'messenger.systemMemberRemoved'
    default: return null
  }
}

function buildRenderedItems(messages: Message[], meta: ChatMeta): RenderedItem[] {
  const rendered: RenderedItem[] = []
  let lastDateKey = ''
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    // Группируем по стабильному, не зависящему от языка ключу календарного дня (а не по
    // готовой переведённой метке) — иначе сообщения, загруженные до и после смены языка
    // интерфейса, оказались бы в разных группах на один и тот же день (ровно тот баг:
    // "Сегодня" и "Today" одновременно). Саму метку считаем заново при каждом рендере.
    const key = dateKey(msg.sentAt)
    if (key !== lastDateKey) { rendered.push({ type: 'sep', label: formatDateLabel(msg.sentAt) }); lastDateKey = key }

    if (msg.kind === 'System') {
      rendered.push({ type: 'system', msg })
      continue
    }

    // Системные сообщения не должны считаться "соседями" для группировки аватарок/имени —
    // ищем ближайшее НЕ системное сообщение по обе стороны, а не просто messages[i ± 1]
    let prev: Message | undefined
    for (let j = i - 1; j >= 0; j--) { if (messages[j].kind !== 'System') { prev = messages[j]; break } }
    let next: Message | undefined
    for (let j = i + 1; j < messages.length; j++) { if (messages[j].kind !== 'System') { next = messages[j]; break } }

    rendered.push({
      type: 'msg', msg,
      showAvatar: !next || next.senderId !== msg.senderId,
      showName: !msg.own && meta.group && (!prev || prev.senderId !== msg.senderId),
      senderSwitch: !!prev && prev.senderId !== msg.senderId,
    })
  }
  return rendered
}

interface MessageListProps {
  messages: Message[]
  meta: ChatMeta
  meSender: Sender
  /** момент, до которого собеседник прочитал переписку — null, если ещё не прочитал ничего */
  otherReadAt: string | null
  selectMode: boolean
  selectedIds: Set<number>
  /** messageId сообщения, которое сейчас подсвечивается (после перехода по цитате-ответу) */
  highlightedMsgId: string | null
  onToggleSelect: (msg: Message) => void
  onAvatarClick: (msg: Message) => void
  onContextMenu: (e: MouseEvent, msg: Message) => void
  onRetry: (msg: Message) => void
  onScrollToMessage: (msgId: string) => void
  onForwardedUserClick?: (userId: string, name: string) => void
}

export function MessageList({
  messages, meta, meSender, otherReadAt, selectMode, selectedIds, highlightedMsgId,
  onToggleSelect, onAvatarClick, onContextMenu, onRetry, onScrollToMessage, onForwardedUserClick,
}: MessageListProps) {
  const { t } = useTranslation()
  const rendered = buildRenderedItems(messages, meta)

  const isReadByOther = (msg: Message) =>
    !!otherReadAt && new Date(msg.sentAt).getTime() <= new Date(otherReadAt).getTime()

  return (
    <>
      {rendered.map((item, i) =>
        item.type === 'sep' ? (
          <div key={`sep-${i}`} className={s.dateSep}>
            <span className={s.dateSepLabel}>{item.label}</span>
          </div>
        ) : item.type === 'system' ? (() => {
          const i18nKey = systemMessageKey(item.msg.systemEventType)
          if (!i18nKey) return null
          return (
            <div key={`system-${i}`} className={s.dateSep}>
              <span className={s.dateSepLabel}>
                <Trans
                  i18nKey={i18nKey}
                  values={{ name: item.msg.targetUserName ?? '' }}
                  components={{
                    user: item.msg.targetUserId ? (
                      <span
                        className={s.systemMsgName}
                        onClick={() => onAvatarClick({
                          ...item.msg,
                          senderId:   item.msg.targetUserId!,
                          senderName: item.msg.targetUserName ?? '',
                        })}
                      />
                    ) : <span />,
                  }}
                />
              </span>
            </div>
          )
        })() : (() => {
          const displaySender = item.msg.own
            ? { ...item.msg, senderColor: meSender.senderColor, senderAvatarUrl: meSender.senderAvatarUrl, senderInitials: meSender.senderInitials, senderName: meSender.senderName }
            : item.msg
          return (
          <div
            key={item.msg.id}
            data-message-id={item.msg.messageId ?? ''}
            className={[
              item.msg.messageId && highlightedMsgId === item.msg.messageId ? s.msgHighlighted : '',
              selectMode && item.msg.messageId ? s.msgRowSelectable : '',
              selectMode && selectedIds.has(item.msg.id) ? s.msgRowSelected : '',
            ].join(' ')}
            onClick={() => selectMode && onToggleSelect(item.msg)}
            onContextMenu={(e) => onContextMenu(e, item.msg)}
          >
            {item.showName && (
              <div
                className={`${s.senderName} ${s.senderNameClickable}`}
                style={{ color: displaySender.senderColor }}
                onClick={(e) => { if (selectMode) return; e.stopPropagation(); onAvatarClick(item.msg) }}
              >
                {displaySender.senderName}
              </div>
            )}
            <div
              className={[
                s.msgRow,
                item.senderSwitch && !item.showName ? s.senderSwitch : '',
              ].join(' ')}
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
                  ? <AvatarImage src={displaySender.senderAvatarUrl} alt={displaySender.senderInitials} className={s.msgAvatarImg} />
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
              >
                {item.msg.forwardedFromUserName && (
                  <div
                    className={`${s.forwardedLabel} ${item.msg.forwardedFromUserId && onForwardedUserClick ? s.forwardedLabelClickable : ''}`}
                    onClick={item.msg.forwardedFromUserId && onForwardedUserClick
                      ? (e) => { e.stopPropagation(); onForwardedUserClick(item.msg.forwardedFromUserId!, item.msg.forwardedFromUserName!) }
                      : undefined}
                  >
                    {t('messenger.forwardedFrom', { name: item.msg.forwardedFromUserName })}
                  </div>
                )}
                {item.msg.replyToMessageId && (
                  <div
                    className={`${s.replyQuote} ${s.replyQuoteClickable}`}
                    onClick={(e) => { e.stopPropagation(); onScrollToMessage(item.msg.replyToMessageId!) }}
                  >
                    <div className={s.replyQuoteSender}>{item.msg.replyToSenderName}</div>
                    <div className={s.replyQuoteText}>
                      {item.msg.replyToContent ?? t('messenger.originalMessageDeleted')}
                    </div>
                  </div>
                )}
                {item.msg.attachments && item.msg.attachments.length > 0 && (
                  <MessageAttachments attachments={item.msg.attachments} />
                )}
                {item.msg.text}
              </div>
            </div>
            <span className={s.msgTime}>
              {item.msg.time}
              {item.msg.own && item.msg.status === 'pending' && <span className={`${s.msgStatusIcon} ${s.msgStatusPending}`}>●</span>}
              {item.msg.own && item.msg.status === 'sent' && (
                isReadByOther(item.msg)
                  ? <span className={`${s.msgStatusIcon} ${s.msgStatusRead}`}>✓✓</span>
                  : <span className={`${s.msgStatusIcon} ${s.msgStatusSent}`}>✓</span>
              )}
              {item.msg.edited && <span className={s.msgEdited}>{t('messenger.edited')}</span>}
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
    </>
  )
}
