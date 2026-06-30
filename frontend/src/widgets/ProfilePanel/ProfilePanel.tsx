import { useNavigate } from 'react-router-dom'
import { logout } from '../../features/auth/api/authApi'
import { clearAuthTokens } from '../../shared/lib/auth/authTokens'
import { useUserProfile } from '../../shared/context/useUserProfile'
import type { UserProfile } from '../../shared/types/user'
import s from './ProfilePanel.module.css'

interface ProfilePanelProps {
  isOpen: boolean
  profile: UserProfile
  onClose: () => void
  onEdit: () => void
  onChats: () => void
}

function getInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return displayName.slice(0, 2).toUpperCase()
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('ru-RU', { year: 'numeric', month: 'long' })
}

export function ProfilePanel({ isOpen, profile, onClose, onEdit, onChats }: ProfilePanelProps) {
  const navigate = useNavigate()
  const { clearProfile } = useUserProfile()

  if (!isOpen) return null

  async function handleLogout() {
    try {
      await logout()
    } finally {
      clearAuthTokens()
      clearProfile()
      navigate('/login')
    }
  }

  const initials = getInitials(profile.displayName)

  return (
    <>
      <div className={s.panelBg} onClick={onClose} />
      <div className={s.profilePanel}>
        <div className={s.ppMobileBar}>
          <button type="button" className={s.backBtn} onClick={onClose}>‹</button>
        </div>
        <button type="button" className={s.ppClose} onClick={onClose}>✕</button>

        <div className={s.ppScrollArea}>
          <div className={s.ppCover} />
          <div className={s.ppBody}>
            {profile.avatarUrl ? (
              <img className={s.ppAvatar} src={profile.avatarUrl} alt={profile.displayName} />
            ) : (
              <div className={s.ppAvatar} style={{ background: profile.avatarColor, color: '#fff' }}>{initials}</div>
            )}
            <div className={s.ppStatusBadge}><span className={s.ppStatusDot} />В сети</div>
            <h2 className={s.ppName}>{profile.displayName}</h2>
            {profile.login && <div className={s.ppUsername}>{profile.login}</div>}
            {profile.status && <p className={s.ppBio}>{profile.status}</p>}
            <div className={s.ppTags}>
              {profile.city && <span className={s.ppTag}>📍 {profile.city}</span>}
              <span className={s.ppTag}>📅 {formatDate(profile.registeredAt)}</span>
            </div>
            <div className={s.ppDivider} />
            <div className={s.ppDetails}>
              <div className={s.ppDetailRow}><span className={s.ppDetailLabel}>Эл. почта</span><span className={s.ppDetailValue}>{profile.email}</span></div>
              {profile.phone && <div className={s.ppDetailRow}><span className={s.ppDetailLabel}>Телефон</span><span className={s.ppDetailValue}>{profile.phone}</span></div>}
              {profile.department && <div className={s.ppDetailRow}><span className={s.ppDetailLabel}>Отдел</span><span className={s.ppDetailValue}>{profile.department}</span></div>}
            </div>
            <button className={s.ppEditBtn} onClick={onEdit}>✎ Изменить профиль</button>
            <button className={s.ppLogoutBtn} onClick={handleLogout}>Выйти из аккаунта</button>
          </div>
        </div>

        <nav className={s.ppBottomNav}>
          <button className={s.bnItem} onClick={() => { onClose(); onChats() }}>
            <span className={s.bnGlyph}>💬</span>
            <span>Чаты</span>
          </button>
          <button className={`${s.bnItem} ${s.bnItemActive}`}>
            <span className={s.bnAvatarMini} style={{ background: profile.avatarColor }}>{initials}</span>
            <span>Профиль</span>
          </button>
        </nav>
      </div>
    </>
  )
}
