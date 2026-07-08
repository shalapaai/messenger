import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ReplyIcon, EditIcon, ForwardIcon, TrashIcon, SelectIcon } from './icons'
import { AvatarImage } from '../../shared/ui/AvatarImage'
import type { Message, Sender } from '../../shared/types/messenger'
import s from './ChatWindow.module.css'

/** selection: true — открыто правым кликом по уже выделенным сообщениям (режим множественного
 *  выделения), тогда меню показывает только массовые действия над всем выделением. */
export interface ContextMenuState { x: number; y: number; msg: Message; selection?: boolean }

interface ContextMenuProps {
  state: ContextMenuState
  canDeleteMessages: boolean
  currentUser: Sender
  onReply: (msg: Message) => void
  onEdit: (msg: Message) => void
  onForward: (msg: Message) => void
  onDelete: (msg: Message) => void
  onSelect: (msg: Message) => void
  onReact: (msg: Message, emoji: string) => void
  onOpenReactions: (msg: Message, anchor: DOMRect) => void
  onPreviewReactions: (msg: Message, anchor: DOMRect) => void
  onCloseReactionPreview: () => void
  quickReactions: string[]
  isGroup: boolean
  onBulkForward: () => void
  onBulkDelete: () => void
}

export function ContextMenu({
  state, canDeleteMessages, currentUser, onReply, onEdit, onForward, onDelete, onSelect, onReact,
  onOpenReactions, onPreviewReactions, onCloseReactionPreview, quickReactions, isGroup, onBulkForward, onBulkDelete,
}: ContextMenuProps) {
  const { t } = useTranslation()
  const { msg, selection } = state
  const reactionRowRef = useRef<HTMLDivElement>(null)
  const [reactionScroll, setReactionScroll] = useState({ left: 0, max: 0, viewport: 1, content: 1 })
  // Сообщение без messageId ещё не долетело до сервера — доступно только удаление черновика,
  // не через canDeleteMessages (то право на чужие/групповые сообщения, а тут свой неотправленный).
  const isLocalOnly = !msg.messageId
  const reactions = (msg.reactions ?? []).map((reaction) =>
    reaction.userId === currentUser.senderId
      ? {
          ...reaction,
          userName: currentUser.senderName,
          userInitials: currentUser.senderInitials,
          userAvatarUrl: currentUser.senderAvatarUrl ?? null,
          userAvatarColor: currentUser.senderColor,
        }
      : reaction,
  )
  const showReactionDetails = isGroup && reactions.length > 0 && !selection && !isLocalOnly
  const menuHeight = selection
    ? 88
    : isLocalOnly
      ? 56
      : (msg.own ? 246 : 210) + (showReactionDetails ? 46 : 0)
  const menuMaxWidth = window.innerWidth <= 480 ? 200 : 240
  const menuWidth = Math.min(menuMaxWidth, window.innerWidth - 16)
  const left = Math.max(8, Math.min(state.x, window.innerWidth - menuWidth - 8))
  const top = Math.max(8, Math.min(state.y, window.innerHeight - menuHeight - 8))

  const updateReactionScroll = useCallback(() => {
    const row = reactionRowRef.current
    if (!row) return
    setReactionScroll({
      left: row.scrollLeft,
      max: Math.max(0, row.scrollWidth - row.clientWidth),
      viewport: row.clientWidth,
      content: row.scrollWidth,
    })
  }, [])

  useLayoutEffect(() => {
    updateReactionScroll()
    window.addEventListener('resize', updateReactionScroll)
    return () => window.removeEventListener('resize', updateReactionScroll)
  }, [quickReactions.length, selection, isLocalOnly, updateReactionScroll])

  const hasReactionScroll = reactionScroll.max > 1
  const reactionThumbWidth = Math.max(28, (reactionScroll.viewport / reactionScroll.content) * reactionScroll.viewport)
  const reactionThumbLeft = hasReactionScroll
    ? (reactionScroll.left / reactionScroll.max) * (reactionScroll.viewport - reactionThumbWidth)
    : 0

  return (
    <div
      className={s.contextMenu}
      onClick={(event) => event.stopPropagation()}
      style={{
        left,
        top,
      }}
    >
      {selection ? (
        <>
          <button type="button" className={s.contextMenuItem} onClick={onBulkForward}>
            <ForwardIcon />{t('messenger.forwardMessage')}
          </button>
          {canDeleteMessages && (
            <button type="button" className={`${s.contextMenuItem} ${s.contextMenuItemDanger}`} onClick={onBulkDelete}>
              <TrashIcon />{t('messenger.deleteMessage')}
            </button>
          )}
        </>
      ) : isLocalOnly ? (
        <button type="button" className={`${s.contextMenuItem} ${s.contextMenuItemDanger}`} onClick={() => onDelete(msg)}>
          <TrashIcon />{t('messenger.deleteMessage')}
        </button>
      ) : (
        <>
          <div className={s.contextReactionScroller}>
            <div ref={reactionRowRef} className={s.contextReactionRow} role="group" aria-label={t('reactions.quick')} onScroll={updateReactionScroll}>
              {quickReactions.map((emoji) => {
                const selected = msg.reactions?.some((reaction) => reaction.userId === currentUser.senderId && reaction.emoji === emoji)
                return (
                  <button
                    key={emoji}
                    type="button"
                    className={`${s.contextReactionBtn} ${selected ? s.contextReactionBtnActive : ''}`}
                    onClick={() => onReact(msg, emoji)}
                    aria-label={t('reactions.set', { emoji })}
                  >
                    {emoji}
                  </button>
                )
              })}
            </div>
            {hasReactionScroll && (
              <div className={s.contextReactionScrollbar} aria-hidden="true">
                <span
                  className={s.contextReactionScrollbarThumb}
                  style={{
                    width: `${reactionThumbWidth}px`,
                    transform: `translateX(${reactionThumbLeft}px)`,
                  }}
                />
              </div>
            )}
          </div>
          <button type="button" className={s.contextMenuItem} onClick={() => onReply(msg)}>
            <ReplyIcon />{t('messenger.replyMessage')}
          </button>
          {msg.own && (
            <button type="button" className={s.contextMenuItem} onClick={() => onEdit(msg)}>
              <EditIcon />{t('messenger.editMessage')}
            </button>
          )}
          <button type="button" className={s.contextMenuItem} onClick={() => onForward(msg)}>
            <ForwardIcon />{t('messenger.forwardMessage')}
          </button>
          <button type="button" className={s.contextMenuItem} onClick={() => onSelect(msg)}>
            <SelectIcon />{t('messenger.selectMessage')}
          </button>
          {showReactionDetails && (
            <button
              type="button"
              className={`${s.contextMenuItem} ${s.contextReactionSummary}`}
              onClick={(event) => {
                event.stopPropagation()
                onOpenReactions(msg, event.currentTarget.getBoundingClientRect())
              }}
              onMouseEnter={(event) => {
                if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
                  onPreviewReactions(msg, event.currentTarget.getBoundingClientRect())
                }
              }}
              onMouseLeave={onCloseReactionPreview}
            >
              <span className={s.contextReactionSummaryIcon}>✺</span>
              <span className={s.contextReactionSummaryText}>{t('reactions.count', { count: reactions.length })}</span>
              <span className={s.contextReactionSummaryAvatars}>
                {reactions.slice(0, 3).map((reaction) => (
                  <span
                    key={reaction.userId}
                    className={s.contextReactionSummaryAvatar}
                    style={reaction.userAvatarUrl ? undefined : { background: reaction.userAvatarColor }}
                  >
                    {reaction.userAvatarUrl
                      ? <AvatarImage src={reaction.userAvatarUrl} alt={reaction.userName} className={s.contextReactionSummaryAvatarImg} />
                      : reaction.userInitials ?? reaction.userName.slice(0, 2).toUpperCase()
                    }
                  </span>
                ))}
              </span>
              <span className={s.contextReactionSummaryArrow}>›</span>
            </button>
          )}
          {canDeleteMessages && (
            <button type="button" className={`${s.contextMenuItem} ${s.contextMenuItemDanger}`} onClick={() => onDelete(msg)}>
              <TrashIcon />{t('messenger.deleteMessage')}
            </button>
          )}
        </>
      )}
    </div>
  )
}
