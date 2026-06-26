import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import s from './ChatsPage.module.css'
import { clearAuthTokens } from '../../shared/lib/auth/authTokens'

interface Chat {
  id: number
  name: string
  initials: string
  color: string
  preview: string
  time: string
  unread: string
  online: boolean
  group: boolean
}

const CHATS: Chat[] = [
  { id: 1, name: 'Михаил Орлов',       initials: 'МО', color: '#2C5BF0', preview: 'Отправил макеты, посмотри когда будет время',   time: '12:48', unread: '3', online: true,  group: false },
  { id: 2, name: 'Дизайн-команда',     initials: 'ДК', color: '#7A5BF0', preview: 'Катя: согласовали финальную палитру 🎨',         time: '12:31', unread: '8', online: false, group: true  },
  { id: 3, name: 'Елена Власова',      initials: 'ЕВ', color: '#22B07D', preview: 'Спасибо! Жду созвон в 15:00',                   time: '11:05', unread: '',  online: true,  group: false },
  { id: 4, name: 'TravelLine — Релизы',initials: 'TL', color: '#F0902C', preview: 'Денис: выкатили обновление 4.2 на прод',        time: '10:52', unread: '',  online: false, group: true  },
  { id: 5, name: 'Артём Кузнецов',     initials: 'АК', color: '#E0556E', preview: 'Ты: ок, договорились 👍',                       time: 'Вчера', unread: '',  online: false, group: false },
  { id: 6, name: 'Маркетинг',          initials: 'МР', color: '#2CA6C9', preview: 'Ольга: накидайте идей к понедельнику',           time: 'Вчера', unread: '',  online: false, group: true  },
  { id: 7, name: 'Софья Белова',       initials: 'СБ', color: '#9B59B6', preview: 'Голосовое сообщение · 0:42',                    time: 'Пн',    unread: '',  online: true,  group: false },
]

const NAV_ITEMS = [
  { id: 'chats',   label: 'Чаты',    glyph: '💬', badge: '12', path: '/chats'   },
  { id: 'profile', label: 'Профиль', glyph: '👤', badge: '',   path: '/profile' },
]

type Filter = 'all' | 'direct' | 'group'

export function ChatsPage() {
  const navigate  = useNavigate()
  const { pathname } = useLocation()
  const [filter, setFilter]   = useState<Filter>('all')
  const [query,  setQuery]    = useState('')

  function handleLogout() {
    clearAuthTokens()
    navigate('/login')
  }

  const counts = {
    all:    CHATS.length,
    direct: CHATS.filter(c => !c.group).length,
    group:  CHATS.filter(c =>  c.group).length,
  }

  const q = query.trim().toLowerCase()
  const visible = CHATS
    .filter(c => filter === 'all' ? true : filter === 'group' ? c.group : !c.group)
    .filter(c => !q || c.name.toLowerCase().includes(q) || c.preview.toLowerCase().includes(q))

  const TABS: { id: Filter; label: string }[] = [
    { id: 'all',    label: 'Все' },
    { id: 'direct', label: 'Личные' },
    { id: 'group',  label: 'Группы' },
  ]

  return (
    <div className={s.root}>
      {/* Mobile top bar */}
      <header className={s.topBar}>
        <div className={s.topBarLogo}>TL:MESSENGER</div>
        <div className={s.topBarAvatar}>АС</div>
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
          <button className={`${s.navItem} ${s.navItemLogout}`} onClick={handleLogout}>
              <span className={s.navGlyph}>↩</span>
              <span>Выйти</span>
            </button>
          <div className={s.sidebarUser}>
            <div className={s.sidebarUserAvatar}>АС</div>
            <div style={{ minWidth: 0 }}>
              <div className={s.sidebarUserName}>Анна Соколова</div>
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
                <div className={s.pageLabel}>ЧАТЫ</div>
                <h1 className={s.pageTitle}>Сообщения</h1>
              </div>
              <button className={s.newBtn} onClick={() => alert('Новый чат')}>
                <span>＋</span> Новый чат
              </button>
            </div>

            {/* Search */}
            <div className={s.searchWrap}>
              <span className={s.searchIcon}>🔍</span>
              <input
                className={s.searchInput}
                placeholder="Поиск по чатам и людям"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>

            {/* Tabs */}
            <div className={s.tabs}>
              {TABS.map(t => (
                <button
                  key={t.id}
                  className={`${s.tab} ${filter === t.id ? s.tabActive : ''}`}
                  onClick={() => setFilter(t.id)}
                >
                  {t.label}
                  <span className={`${s.tabCount} ${filter === t.id ? s.tabCountActive : ''}`}>
                    {counts[t.id]}
                  </span>
                </button>
              ))}
            </div>

            {/* Chat list */}
            <div className={s.chatList}>
              {visible.length === 0 ? (
                <div className={s.emptyState}>Ничего не найдено</div>
              ) : (
                visible.map(chat => (
                  <div key={chat.id} className={s.chatRow} onClick={() => navigate(`/chats/${chat.id}`)}>
                    <div
                      className={`${s.chatAvatar} ${chat.group ? s.chatAvatarGroup : ''}`}
                      style={{ background: chat.color }}
                    >
                      {chat.initials}
                      {chat.online && <span className={s.chatOnlineDot} />}
                    </div>

                    <div className={s.chatInfo}>
                      <div className={s.chatNameRow}>
                        <span className={s.chatName}>{chat.name}</span>
                        {chat.group && <span className={s.groupBadge}>ГРУППА</span>}
                      </div>
                      <div className={s.chatPreview}>{chat.preview}</div>
                    </div>

                    <div className={s.chatMeta}>
                      <span className={s.chatTime}>{chat.time}</span>
                      {chat.unread && <span className={s.chatUnread}>{chat.unread}</span>}
                    </div>
                  </div>
                ))
              )}
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
        <button className={`${s.bottomNavItem} ${s.bottomNavItemLogout}`} onClick={handleLogout}>
          <span className={s.bottomGlyph}>↩</span>
          <span>Выйти</span>
        </button>
      </nav>
    </div>
  )
}

export default ChatsPage
