import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { logout } from '../../features/auth/api/authApi'
import { clearAuthTokens } from '../../shared/lib/auth/authTokens'
import { useUserProfile } from '../../shared/context/useUserProfile'
import s from './IconNav.module.css'

interface IconNavProps {
  onProfileOpen: () => void
  userInitials: string
  userAvatarUrl?: string | null
}

export function IconNav({ onProfileOpen, userInitials, userAvatarUrl }: IconNavProps) {
  const navigate = useNavigate()
  const { clearProfile } = useUserProfile()
  const [menuOpen, setMenuOpen] = useState(false)

  async function handleLogout() {
    try {
      await logout()
    } finally {
      clearAuthTokens()
      clearProfile()
      navigate('/login')
    }
  }

  return (
    <nav className={s.iconNav}>
      <div className={s.iconNavLogo}>TL</div>
      <div className={s.iconNavBottom}>
        <div className={s.avatarMenuWrap}>
          {menuOpen && (
            <div className={s.avatarMenu}>
              <button className={s.avatarMenuItem} onClick={() => { setMenuOpen(false); onProfileOpen() }}>Открыть профиль</button>
              <button className={`${s.avatarMenuItem} ${s.avatarMenuItemDanger}`} onClick={() => { setMenuOpen(false); handleLogout() }}>Выйти</button>
            </div>
          )}
          <button className={s.userAvatarBtn} onClick={() => setMenuOpen(v => !v)}>
            {userAvatarUrl
              ? <img src={userAvatarUrl} alt={userInitials} className={s.userAvatarImg} />
              : userInitials
            }
          </button>
        </div>
      </div>
      {menuOpen && <div className={s.avatarMenuBg} onClick={() => setMenuOpen(false)} />}
    </nav>
  )
}
