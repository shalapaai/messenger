import { useTranslation } from 'react-i18next'
import { ReplyIcon, EditIcon, ForwardIcon, TrashIcon, SelectIcon } from './icons'
import type { Message } from '../../shared/types/messenger'
import s from './ChatWindow.module.css'

export interface ContextMenuState { x: number; y: number; msg: Message }

interface ContextMenuProps {
  state: ContextMenuState
  onReply: (msg: Message) => void
  onEdit: (msg: Message) => void
  onForward: (msg: Message) => void
  onDelete: (msg: Message) => void
  onSelect: (msg: Message) => void
}

export function ContextMenu({ state, onReply, onEdit, onForward, onDelete, onSelect }: ContextMenuProps) {
  const { t } = useTranslation()
  const { msg } = state

  return (
    <div
      className={s.contextMenu}
      style={{
        left: Math.min(state.x, window.innerWidth - 190),
        top:  Math.min(state.y, window.innerHeight - (msg.own ? 192 : 156)),
      }}
    >
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
      <button type="button" className={`${s.contextMenuItem} ${s.contextMenuItemDanger}`} onClick={() => onDelete(msg)}>
        <TrashIcon />{t('messenger.deleteMessage')}
      </button>
      <button type="button" className={s.contextMenuItem} onClick={() => onSelect(msg)}>
        <SelectIcon />{t('messenger.selectMessage')}
      </button>
    </div>
  )
}
