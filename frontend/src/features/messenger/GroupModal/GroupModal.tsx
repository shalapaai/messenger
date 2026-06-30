import { useTranslation } from 'react-i18next'
import type { ChatMeta, GroupMember, ModalUser } from '../../../shared/types/messenger'
import s from './GroupModal.module.css'

interface GroupModalProps {
  isOpen: boolean
  chatId: string
  meta: ChatMeta
  members: GroupMember[]
  onClose: () => void
  onMemberClick: (user: ModalUser) => void
  onLeave: () => void
}

export function GroupModal({ isOpen, chatId, meta, members, onClose, onMemberClick, onLeave }: GroupModalProps) {
  const { t } = useTranslation()

  if (!isOpen) return null
  void chatId

  return (
    <div className={s.modalOverlay} onClick={onClose}>
      <div className={s.modalPanel} onClick={e => e.stopPropagation()}>
        <button type="button" className={s.modalClose} onClick={onClose}>✕</button>
        <div className={s.umAvatar} style={{ background: meta.color }}>{meta.initials}</div>
        <div className={s.umName}>{meta.name}</div>
        <div className={s.umStatus}>{t('group.memberCount', { count: members.length })}</div>
        <div className={s.umDivider} />
        <div className={s.umSectionRow}>
          <span className={s.umSection}>{t('group.members', { count: members.length })}</span>
          <button type="button" className={s.umAddMemberBtn} onClick={() => alert(t('group.addMember'))} title={t('group.addMember')}>+</button>
        </div>
        <div className={s.umMemberList}>
          {members.map(member => (
            <div
              key={member.name}
              className={`${s.umMemberRow} ${s.umMemberRowClickable}`}
              onClick={() => onMemberClick({ name: member.name, initials: member.initials, color: member.color, online: member.online })}
            >
              <div className={s.umMemberAvatarWrap}>
                <div className={s.umMemberAvatar} style={{ background: member.color }}>{member.initials}</div>
                {member.online && <span className={s.umMemberOnlineDot} />}
              </div>
              <span className={s.umMemberName}>{member.name}</span>
              <span className={`${s.umRoleBadge} ${member.role === 'Администратор' ? s.umRoleBadgeAdmin : ''}`}>
                {member.role === 'Администратор' ? t('group.roles.admin') : t('group.roles.member')}
              </span>
            </div>
          ))}
        </div>
        <div className={s.umGroupActions}>
          <button type="button" className={s.umEditGroupBtn} onClick={() => alert(t('group.editGroup'))}>{t('group.editGroup')}</button>
          <button
            type="button"
            className={s.umLeaveGroupBtn}
            onClick={() => { if (window.confirm(t('group.leaveConfirm'))) onLeave() }}
          >
            {t('group.leaveGroup')}
          </button>
        </div>
      </div>
    </div>
  )
}
