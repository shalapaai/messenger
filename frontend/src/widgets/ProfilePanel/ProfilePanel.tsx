import { useNavigate } from 'react-router-dom'
import { logout } from '../../features/auth/api/authApi'
import { clearAuthTokens } from '../../shared/lib/auth/authTokens'
import type { StubUser } from '../../shared/types/messenger'
import s from './ProfilePanel.module.css'

interface ProfilePanelProps {
  isOpen: boolean
  stubUser: StubUser
  onClose: () => void
  onEdit: () => void
  onChats: () => void
}

export function ProfilePanel({ isOpen, stubUser, onClose, onEdit, onChats }: ProfilePanelProps) {
  const navigate = useNavigate()

  if (!isOpen) return null

  async function handleLogout() {
    try {
      await logout()
    } finally {
      clearAuthTokens()
      navigate('/login')
    }
  }

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
            <div className={s.ppAvatar}>{stubUser.initials}</div>
            <div className={s.ppStatusBadge}><span className={s.ppStatusDot} />В сети</div>
            <h2 className={s.ppName}>{stubUser.fullName}</h2>
            <div className={s.ppUsername}>{stubUser.username}</div>
            <p className={s.ppBio}>{stubUser.bio}</p>
            <div className={s.ppTags}>
              <span className={s.ppTag}>📍 {stubUser.city}</span>
              <span className={s.ppTag}>📅 {stubUser.since}</span>
            </div>
            <div className={s.ppDivider} />
            <div className={s.ppDetails}>
              <div className={s.ppDetailRow}><span className={s.ppDetailLabel}>Эл. почта</span><span className={s.ppDetailValue}>{stubUser.email}</span></div>
              <div className={s.ppDetailRow}><span className={s.ppDetailLabel}>Телефон</span><span className={s.ppDetailValue}>{stubUser.phone}</span></div>
              <div className={s.ppDetailRow}><span className={s.ppDetailLabel}>Отдел</span><span className={s.ppDetailValue}>{stubUser.department}</span></div>
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
            <span className={s.bnAvatarMini}>АС</span>
            <span>Профиль</span>
          </button>
        </nav>
      </div>
    </>
  )
}
