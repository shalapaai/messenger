import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import s from './ProfilePage.module.css'

const STUB_USER = {
  initials: 'АС',
  fullName: 'Анна Соколова',
  username: '@anna.sokolova',
  bio: 'Продакт-дизайнер в команде TravelLine. Веду проекты интерфейсов и обожаю осмысленные диалоги. Пишите — отвечаю быстро ☺',
  city: 'Москва',
  since: 'С марта 2023',
  email: 'anna.sokolova@travelline.tech',
  phone: '+7 905 •• •• 12',
}

const STATUS_OPTIONS = [
  { id: 'online',  label: 'В сети',           dot: '#22b07d' },
  { id: 'busy',    label: 'Занята',            dot: '#ef4444' },
  { id: 'dnd',     label: 'Не беспокоить',     dot: '#8b5cf6' },
  { id: 'away',    label: 'Нет на месте',      dot: '#f59e0b' },
]

const NAV_ITEMS = [
  { id: 'chats',   label: 'Чаты',    glyph: '💬', badge: '12', path: '/chats'   },
  { id: 'profile', label: 'Профиль', glyph: '👤', badge: '',   path: '/profile' },
]

function StatusPicker() {
  const [statusId, setStatusId] = useState('online')
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const current = STATUS_OPTIONS.find(o => o.id === statusId)!

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className={s.statusWrapper} ref={wrapRef}>
      <button className={s.statusBadge} onClick={() => setOpen(v => !v)}>
        <span className={s.statusDot} style={{ background: current.dot }} />
        {current.label}
        <span className={`${s.statusChevron} ${open ? s.statusChevronOpen : ''}`}>›</span>
      </button>

      {open && (
        <div className={s.statusDropdown}>
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt.id}
              className={`${s.statusOption} ${opt.id === statusId ? s.statusOptionActive : ''}`}
              onClick={() => { setStatusId(opt.id); setOpen(false) }}
            >
              <span className={s.statusDot} style={{ background: opt.dot }} />
              {opt.label}
              {opt.id === statusId && <span className={s.statusCheck}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function ProfilePage() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const user = STUB_USER

  return (
    <div className={s.root}>
      {/* Mobile top bar */}
      <header className={s.topBar}>
        <div className={s.topBarLogo}>TL:MESSENGER</div>
        <div className={s.topBarAvatar}>{user.initials}</div>
      </header>

      <div className={s.body}>
        {/* Desktop sidebar */}
        <aside className={s.sidebar}>
          <div className={s.sidebarLogo}>TL:MESSENGER</div>
          <nav className={s.nav}>
            {NAV_ITEMS.map(item => (
              <button
                key={item.id}
                className={`${s.navItem} ${pathname === item.path ? s.navItemActive : ''}`}
                onClick={() => navigate(item.path)}
              >
                <span className={s.navGlyph}>{item.glyph}</span>
                <span>{item.label}</span>
                {item.badge && <span className={s.navBadge}>{item.badge}</span>}
              </button>
            ))}
          </nav>
          <div className={s.sidebarUser}>
            <div className={s.sidebarUserAvatar}>{user.initials}</div>
            <div style={{ minWidth: 0 }}>
              <div className={s.sidebarUserName}>{user.fullName}</div>
              <div className={s.sidebarUserStatus}>
                <span className={s.onlineDot} />
                в сети
              </div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className={s.main}>
          <div className={s.content}>
            {/* Header */}
            <div className={s.pageHeader}>
              <div>
                <div className={s.pageLabel}>ПРОФИЛЬ</div>
                <h1 className={s.pageTitle}>Мой аккаунт</h1>
              </div>
              <button className={s.editBtn} onClick={() => alert('Редактирование профиля')}>
                <span>✎</span> Изменить профиль
              </button>
            </div>

            {/* Profile card */}
            <div className={s.profileCard}>
              <div className={s.cover} />
              <div className={s.cardBody}>
                <StatusPicker />
                <div className={s.avatar}>{user.initials}</div>
                <div className={s.nameSection}>
                  <h2 className={s.fullName}>{user.fullName}</h2>
                </div>
                <p className={s.bio}>{user.bio}</p>
                <div className={s.tags}>
                  <span className={s.tag}>📍 {user.city}</span>
                  <span className={s.tag}>📅 {user.since}</span>
                </div>
              </div>
            </div>

            {/* Details */}
            <div className={s.details}>
              <div className={s.detailRow}>
                <span className={s.detailLabel}>Эл. почта</span>
                <span className={s.detailValue}>{user.email}</span>
              </div>
              <div className={s.detailRow}>
                <span className={s.detailLabel}>Телефон</span>
                <span className={s.detailValue}>{user.phone}</span>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className={s.bottomNav}>
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            className={`${s.bottomNavItem} ${pathname === item.path ? s.bottomNavItemActive : ''}`}
            onClick={() => navigate(item.path)}
          >
            <span className={s.bottomGlyph}>
              {item.glyph}
              {item.badge && <span className={s.bottomBadge}>{item.badge}</span>}
            </span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

export default ProfilePage
