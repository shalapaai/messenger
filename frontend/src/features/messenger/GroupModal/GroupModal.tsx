import type { ChatMeta, GroupMember, ModalUser } from '../../../shared/types/messenger'
import s from './GroupModal.module.css'

interface GroupModalProps {
  isOpen: boolean
  chatId: string
  meta: ChatMeta
  members: GroupMember[]
  onClose: () => void
  onMemberClick: (user: ModalUser) => void
}

export function GroupModal({ isOpen, chatId, meta, members, onClose, onMemberClick }: GroupModalProps) {
  if (!isOpen) return null
  void chatId

  return (
    <div className={s.modalOverlay} onClick={onClose}>
      <div className={s.modalPanel} onClick={e => e.stopPropagation()}>
        <button type="button" className={s.modalClose} onClick={onClose}>✕</button>
        <div className={s.umAvatar} style={{ background: meta.color }}>{meta.initials}</div>
        <div className={s.umName}>{meta.name}</div>
        <div className={s.umStatus}>{members.length} участника</div>
        <div className={s.umDivider} />
        <div className={s.umSectionRow}>
          <span className={s.umSection}>Участники ({members.length})</span>
          <button type="button" className={s.umAddMemberBtn} onClick={() => alert('Добавить участника')} title="Добавить участника">+</button>
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
              <span className={`${s.umRoleBadge} ${member.role === 'Администратор' ? s.umRoleBadgeAdmin : ''}`}>{member.role}</span>
            </div>
          ))}
        </div>
        <div className={s.umGroupActions}>
          <button type="button" className={s.umEditGroupBtn} onClick={() => alert('Изменить группу')}>Изменить группу</button>
          <button type="button" className={s.umLeaveGroupBtn} onClick={() => alert('Выйти из группы')}>Выйти из группы</button>
        </div>
      </div>
    </div>
  )
}
