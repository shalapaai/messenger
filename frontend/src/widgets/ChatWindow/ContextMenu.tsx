import { useTranslation } from 'react-i18next'
import { ReplyIcon, EditIcon, ForwardIcon, TrashIcon, SelectIcon } from './icons'
import type { Message } from '../../shared/types/messenger'
import s from './ChatWindow.module.css'

/** selection: true — открыто правым кликом по уже выделенным сообщениям (режим множественного
 *  выделения), тогда меню показывает только массовые действия над всем выделением. */
export interface ContextMenuState { x: number; y: number; msg: Message; selection?: boolean }

interface ContextMenuProps {
  state: ContextMenuState
  canDeleteMessages: boolean
  onReply: (msg: Message) => void
  onEdit: (msg: Message) => void
  onForward: (msg: Message) => void
  onDelete: (msg: Message) => void
  onSelect: (msg: Message) => void
  onBulkForward: () => void
  onBulkDelete: () => void
}

export function ContextMenu({
  state, canDeleteMessages, onReply, onEdit, onForward, onDelete, onSelect, onBulkForward, onBulkDelete,
}: ContextMenuProps) {
  const { t } = useTranslation()
  const { msg, selection } = state
  // Сообщение без messageId ещё отправляется или не отправилось — на сервере его нет, поэтому
  // ответить/переслать/выделить/редактировать нечего, доступно только удаление черновика
  // (и оно не завязано на canDeleteMessages — это право удалять чужие/групповые сообщения,
  // а тут пользователь убирает свой же неотправленный черновик, который никто больше не видел)
  const isLocalOnly = !msg.messageId

  return (
    <div
      className={s.contextMenu}
      style={{
        left: Math.min(state.x, window.innerWidth - 190),
        top:  Math.min(state.y, window.innerHeight - (selection ? 88 : isLocalOnly ? 56 : msg.own ? 192 : 156)),
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
