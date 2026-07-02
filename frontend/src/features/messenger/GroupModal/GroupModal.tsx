import { useTranslation } from 'react-i18next'
import type { ChatMeta, GroupMember, ModalUser } from '../../../shared/types/messenger'
import s from './GroupModal.module.css'

interface GroupModalProps {
  isOpen: boolean
  chatId: string
  meta: ChatMeta
  members: GroupMember[]
  membersLoading: boolean
  currentUserId: string | undefined
  onClose: () => void
  onMemberClick: (user: ModalUser) => void
  onLeave: () => void
  onAddMember: () => void
  onEditGroup: () => void
  onRemoveMember: (userId: string, name: string) => void
}

export function GroupModal({ isOpen, chatId, meta, members, membersLoading, currentUserId, onClose, onMemberClick, onLeave, onAddMember, onEditGroup, onRemoveMember }: GroupModalProps) {
  const { t } = useTranslation()

  if (!isOpen) return null
  void chatId

  // источник правды — роль текущего пользователя в уже загруженном списке участников;
  // считается на месте, а не приходит отдельным пропом, чтобы не дублировать это правило
  // ещё в одном месте (см. member.role !== 'owner' ниже — та же роль из того же массива)
  const canManage = members.some(m => m.userId === currentUserId && m.role !== 'member')

  return (
    <div className={s.modalOverlay} onClick={onClose}>
      <div className={s.modalPanel} onClick={e => e.stopPropagation()}>
        <button type="button" className={s.modalClose} onClick={onClose}>✕</button>
        <div className={s.umAvatar} style={meta.avatarUrl ? undefined : { background: meta.color }}>
          {meta.avatarUrl ? <img src={meta.avatarUrl} alt={meta.name} className={s.umAvatarImg} /> : meta.initials}
        </div>
        <div className={s.umName}>{meta.name}</div>
        <div className={s.umStatus}>{t('group.memberCount', { count: members.length })}</div>
        <div className={s.umDivider} />
        <div className={s.umSectionRow}>
          <span className={s.umSection}>{t('group.members', { count: members.length })}</span>
          {canManage && (
            <button type="button" className={s.umAddMemberBtn} onClick={onAddMember} title={t('group.addMember')}>+</button>
          )}
        </div>
        <div className={s.umMemberList}>
          {membersLoading ? (
            <div className={s.umStatus}>{t('common.loading')}</div>
          ) : (
            members.map(member => (
              <div
                key={member.userId}
                className={`${s.umMemberRow} ${s.umMemberRowClickable}`}
                onClick={() => onMemberClick({ userId: member.userId, name: member.name, initials: member.initials, color: member.color, avatarUrl: member.avatarUrl, online: member.online })}
              >
                <div className={s.umMemberAvatarWrap}>
                  {member.avatarUrl
                    ? <img src={member.avatarUrl} alt={member.name} className={s.umMemberAvatarImg} />
                    : <div className={s.umMemberAvatar} style={{ background: member.color }}>{member.initials}</div>
                  }
                  {member.online && <span className={s.umMemberOnlineDot} />}
                </div>
                <span className={s.umMemberName}>{member.name}</span>
                <span className={`${s.umRoleBadge} ${member.role !== 'member' ? s.umRoleBadgeAdmin : ''}`}>
                  {t(`group.roles.${member.role}`)}
                </span>
                {canManage && member.role !== 'owner' && member.userId !== currentUserId && (
                  <button
                    type="button"
                    className={s.umRemoveMemberBtn}
                    title={t('group.removeMember')}
                    onClick={e => {
                      e.stopPropagation()
                      if (window.confirm(t('group.removeMemberConfirm', { name: member.name }))) onRemoveMember(member.userId, member.name)
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))
          )}
        </div>
        <div className={s.umGroupActions}>
          {canManage && (
            <button type="button" className={s.umEditGroupBtn} onClick={onEditGroup}>{t('group.editGroup')}</button>
          )}
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
