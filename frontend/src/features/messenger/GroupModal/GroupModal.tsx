import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ChatMeta, GroupMember, ModalUser } from '../../../shared/types/messenger'
import { AvatarImage } from '../../../shared/ui/AvatarImage'
import { UserListSkeleton } from '../UserListSkeleton'
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
  onSetMemberRole: (userId: string, role: 'admin' | 'member') => void
}

export function GroupModal({ isOpen, chatId, meta, members, membersLoading, currentUserId, onClose, onMemberClick, onLeave, onAddMember, onEditGroup, onRemoveMember, onSetMemberRole }: GroupModalProps) {
  const { t } = useTranslation()
  const [confirmRemove, setConfirmRemove] = useState<{ userId: string; name: string } | null>(null)
  const [confirmLeave, setConfirmLeave] = useState(false)

  if (!isOpen) return null
  void chatId

  const canManage = members.some(m => m.userId === currentUserId && m.role !== 'member')
  const isOwner   = members.some(m => m.userId === currentUserId && m.role === 'owner')

  return (
    <>
      <div className={s.modalOverlay} onClick={onClose}>
        <div className={s.modalPanel} onClick={e => e.stopPropagation()}>
          <button type="button" className={s.modalClose} onClick={onClose}>✕</button>
          <div className={s.umAvatar} style={meta.avatarUrl ? undefined : { background: meta.color }}>
            {meta.avatarUrl ? <AvatarImage src={meta.avatarUrl} alt={meta.name} className={s.umAvatarImg} /> : meta.initials}
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
            {membersLoading && members.length === 0 ? (
              <UserListSkeleton count={4} showMeta />
            ) : (
              members.map(member => (
                <div
                  key={member.userId}
                  className={`${s.umMemberRow} ${s.umMemberRowClickable}`}
                  onClick={() => onMemberClick({ userId: member.userId, name: member.name, initials: member.initials, color: member.color, avatarUrl: member.avatarUrl, online: member.online })}
                >
                  <div className={s.umMemberAvatarWrap}>
                    {member.avatarUrl
                      ? <AvatarImage src={member.avatarUrl} alt={member.name} className={s.umMemberAvatarImg} />
                      : <div className={s.umMemberAvatar} style={{ background: member.color }}>{member.initials}</div>
                    }
                    {member.online && <span className={s.umMemberOnlineDot} />}
                  </div>
                  <span className={s.umMemberName}>{member.name}</span>
                  <span className={`${s.umRoleBadge} ${member.role !== 'member' ? s.umRoleBadgeAdmin : ''}`}>
                    {t(`group.roles.${member.role}`)}
                  </span>
                  {isOwner && member.role !== 'owner' && member.userId !== currentUserId && (
                    <button
                      type="button"
                      className={`${s.umRoleToggleBtn} ${member.role === 'admin' ? s.umRoleToggleBtnDemote : s.umRoleToggleBtnPromote}`}
                      title={member.role === 'admin' ? t('group.demoteFromAdmin') : t('group.promoteToAdmin')}
                      onClick={e => { e.stopPropagation(); onSetMemberRole(member.userId, member.role === 'admin' ? 'member' : 'admin') }}
                    >
                      {member.role === 'admin' ? '−' : '+'}
                    </button>
                  )}
                  {canManage && member.role !== 'owner' && member.userId !== currentUserId && (isOwner || member.role === 'member') && (
                    <button
                      type="button"
                      className={s.umRemoveMemberBtn}
                      title={t('group.removeMember')}
                      onClick={e => { e.stopPropagation(); setConfirmRemove({ userId: member.userId, name: member.name }) }}
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
              onClick={() => setConfirmLeave(true)}
            >
              {t('group.leaveGroup')}
            </button>
          </div>
        </div>
      </div>

      {confirmRemove && (
        <div className={s.confirmOverlay} onClick={() => setConfirmRemove(null)}>
          <div className={s.confirmPanel} onClick={e => e.stopPropagation()}>
            <div className={s.confirmTitle}>{t('group.removeMemberTitle')}</div>
            <div className={s.confirmBody}>{t('group.removeMemberConfirm', { name: confirmRemove.name })}</div>
            <div className={s.confirmActions}>
              <button type="button" className={s.confirmCancel} onClick={() => setConfirmRemove(null)}>
                {t('common.cancel')}
              </button>
              <button type="button" className={s.confirmDeleteBtn} onClick={() => { onRemoveMember(confirmRemove.userId, confirmRemove.name); setConfirmRemove(null) }}>
                {t('group.removeMember')}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmLeave && (
        <div className={s.confirmOverlay} onClick={() => setConfirmLeave(false)}>
          <div className={s.confirmPanel} onClick={e => e.stopPropagation()}>
            <div className={s.confirmTitle}>{t('group.leaveGroupTitle')}</div>
            <div className={s.confirmBody}>{t('group.leaveConfirm')}</div>
            <div className={s.confirmActions}>
              <button type="button" className={s.confirmCancel} onClick={() => setConfirmLeave(false)}>
                {t('common.cancel')}
              </button>
              <button type="button" className={s.confirmDeleteBtn} onClick={() => { onLeave(); setConfirmLeave(false) }}>
                {t('group.leaveGroup')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
