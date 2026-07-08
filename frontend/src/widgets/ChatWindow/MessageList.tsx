import { memo, useEffect, useState, type MouseEvent } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { AvatarImage } from '../../shared/ui/AvatarImage'
import { MessageAttachments } from './MessageAttachment'
import { CheckIcon } from './icons'
import { dateKey, formatDateLabel } from '../../shared/lib/formatDateTime'
import type { ChatMeta, Message, Sender } from '../../shared/types/messenger'
import s from './ChatWindow.module.css'

interface ReactionGroup {
  emoji: string
  count: number
  users: NonNullable<Message['reactions']>
  reactedByMe: boolean
}

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
    // Группируем по языконезависимому ключу дня, не по переведённой метке — иначе смена языка
    // интерфейса развела бы сообщения одного дня по разным группам ("Сегодня" vs "Today").
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

function groupReactions(msg: Message, meSender: Sender): ReactionGroup[] {
  const reactions = msg.reactions ?? []
  const byEmoji = new Map<string, ReactionGroup>()

  reactions.forEach((reaction) => {
    const group = byEmoji.get(reaction.emoji)
    if (group) {
      group.count += 1
      group.users.push(reaction)
      group.reactedByMe ||= reaction.userId === meSender.senderId
      return
    }

    byEmoji.set(reaction.emoji, {
      emoji: reaction.emoji,
      count: 1,
      users: [reaction],
      reactedByMe: reaction.userId === meSender.senderId,
    })
  })

  return [...byEmoji.values()]
}

function getReactionsPerRow() {
  if (window.innerWidth < 820) return 3
  if (window.innerWidth <= 1024) return 4
  return 5
}

function chunkReactions(groups: ReactionGroup[], perRow: number): ReactionGroup[][] {
  const rows: ReactionGroup[][] = []

  for (let i = 0; i < groups.length; i += perRow) {
    rows.push(groups.slice(i, i + perRow))
  }

  return rows
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
  onReact: (msg: Message, emoji: string) => void
  onForwardedUserClick?: (userId: string, name: string) => void
}

// Мемоизирован: text-состояние поля ввода живёт в ChatWindow и меняется на каждое нажатие
// клавиши — без memo это перестраивало бы весь список сообщений при вводе текста.
export const MessageList = memo(function MessageList({
  messages, meta, meSender, otherReadAt, selectMode, selectedIds, highlightedMsgId,
  onToggleSelect, onAvatarClick, onContextMenu, onRetry, onScrollToMessage, onReact, onForwardedUserClick,
}: MessageListProps) {
  const { t } = useTranslation()
  const [reactionsPerRow, setReactionsPerRow] = useState(getReactionsPerRow)
  const rendered = buildRenderedItems(messages, meta)

  useEffect(() => {
    const handleResize = () => setReactionsPerRow(getReactionsPerRow())

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

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
          // Если сообщение обо мне самом — берём живое имя (meSender), а не замороженное
          // targetUserName: иначе переименование не отразилось бы в уже показанных событиях.
          const targetName = item.msg.targetUserId === meSender.senderId
            ? meSender.senderName
            : (item.msg.targetUserName ?? '')
          return (
            <div key={`system-${i}`} className={s.dateSep}>
              <span className={s.dateSepLabel}>
                <Trans
                  i18nKey={i18nKey}
                  values={{ name: targetName }}
                  components={{
                    user: item.msg.targetUserId ? (
                      <span
                        className={s.systemMsgName}
                        onClick={() => onAvatarClick({
                          ...item.msg,
                          senderId:   item.msg.targetUserId!,
                          senderName: targetName,
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
          const reactionGroups = groupReactions(item.msg, meSender)
          const reactionRows = chunkReactions(reactionGroups, reactionsPerRow)
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
              <div className={`${s.messageStack} ${item.msg.own ? s.messageStackOwn : ''}`}>
                <div
                  className={[
                    s.bubble,
                    item.msg.own ? s.bubbleOwn : s.bubbleOther,
                    item.showAvatar ? s.bubbleTail : '',
                    item.msg.status === 'pending' ? s.bubblePending : '',
                    item.msg.status === 'failed'  ? s.bubbleFailed  : '',
                  ].join(' ')}
                >
                  <div className={s.messageTextContent}>
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

                  {reactionGroups.length > 0 && (
                    <div className={s.reactionBar}>
                      {reactionRows.map((row) => (
                        <div className={s.reactionRow} key={row.map((group) => group.emoji).join('-')}>
                          {row.map((group) => (
                            <button
                              key={group.emoji}
                              type="button"
                              className={`${s.reactionPill} ${group.reactedByMe ? s.reactionPillOwn : ''}`}
                              onClick={(e) => { e.stopPropagation(); onReact(item.msg, group.emoji) }}
                              title={group.reactedByMe ? t('reactions.remove', { emoji: group.emoji }) : t('reactions.set', { emoji: group.emoji })}
                            >
                              <span className={s.reactionEmoji}>{group.emoji}</span>
                              {group.count >= 4 ? (
                                <span className={s.reactionCount}>{group.count}</span>
                              ) : (
                                <span className={s.reactionAvatars}>
                                  {group.users.slice(0, 3).map((reaction) => (
                                    <span
                                      key={reaction.userId}
                                      className={s.reactionAvatar}
                                      style={reaction.userAvatarUrl ? undefined : { background: reaction.userAvatarColor }}
                                    >
                                      {reaction.userAvatarUrl
                                        ? <AvatarImage src={reaction.userAvatarUrl} alt={reaction.userName} className={s.reactionAvatarImg} />
                                        : reaction.userName.slice(0, 2).toUpperCase()
                                      }
                                    </span>
                                  ))}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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
})
