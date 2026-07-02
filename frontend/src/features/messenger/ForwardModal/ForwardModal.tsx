import { useTranslation } from 'react-i18next'
import { useChatsStore } from '../../../shared/api/chatsStore'
import type { Message } from '../../../shared/types/messenger'
import s from './ForwardModal.module.css'

interface ForwardModalProps {
  messages: Message[] | null
  onClose: () => void
  onConfirm: (targetChatId: string) => void
}

export function ForwardModal({ messages, onClose, onConfirm }: ForwardModalProps) {
  const { t } = useTranslation()
  const chats = useChatsStore((s) => s.chats)

  if (!messages) return null

  return (
    <div className={s.modalOverlay} onClick={onClose}>
      <div className={s.modalPanel} onClick={e => e.stopPropagation()}>
        <button type="button" className={s.modalClose} onClick={onClose}>✕</button>
        <div className={s.title}>{t('messenger.forwardTo')}</div>
        <div className={s.results}>
          {chats.length === 0 ? (
            <div className={s.hint}>{t('messenger.loadChatsFailed')}</div>
          ) : (
            chats.map(chat => (
              <div
                key={chat.id}
                className={`${s.row} ${s.rowClickable}`}
                onClick={() => onConfirm(chat.id)}
              >
                {chat.avatarUrl
                  ? <img src={chat.avatarUrl} alt={chat.initials} className={s.avatarImg} />
                  : <div className={s.avatar} style={{ background: chat.color }}>{chat.initials}</div>
                }
                <div className={s.info}>
                  <span className={s.name}>{chat.name}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
