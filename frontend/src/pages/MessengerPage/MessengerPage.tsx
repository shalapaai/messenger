import { useState, useRef, useEffect, type KeyboardEvent, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import s from './MessengerPage.module.css'
import { clearAuthTokens } from '../../shared/lib/auth/authTokens'
import { AvatarUpload } from '../../features/profile/AvatarUpload'

/* ── Data ─────────────────────────────────────────────────────────────────── */

interface Chat {
  id: number; name: string; initials: string; color: string
  preview: string; time: string; unread: string; online: boolean; group: boolean
}

const CHATS: Chat[] = [
  { id: 1, name: 'Михаил Орлов',        initials: 'МО', color: '#2C5BF0', preview: 'Отправил макеты, посмотри когда будет время',  time: '12:48', unread: '3', online: true,  group: false },
  { id: 2, name: 'Дизайн-команда',      initials: 'ДК', color: '#7A5BF0', preview: 'Катя: согласовали финальную палитру 🎨',       time: '12:31', unread: '8', online: false, group: true  },
  { id: 3, name: 'Елена Власова',       initials: 'ЕВ', color: '#22B07D', preview: 'Спасибо! Жду созвон в 15:00',                  time: '11:05', unread: '',  online: true,  group: false },
  { id: 4, name: 'TravelLine — Релизы', initials: 'TL', color: '#F0902C', preview: 'Денис: выкатили обновление 4.2 на прод',       time: '10:52', unread: '',  online: false, group: true  },
  { id: 5, name: 'Артём Кузнецов',      initials: 'АК', color: '#E0556E', preview: 'Ты: ок, договорились 👍',                     time: 'Вчера', unread: '',  online: false, group: false },
  { id: 6, name: 'Маркетинг',           initials: 'МР', color: '#2CA6C9', preview: 'Ольга: накидайте идей к понедельнику',         time: 'Вчера', unread: '',  online: false, group: true  },
  { id: 7, name: 'Софья Белова',        initials: 'СБ', color: '#9B59B6', preview: 'Голосовое сообщение · 0:42',                  time: 'Пн',    unread: '',  online: true,  group: false },
]

interface Message {
  id: number; text: string; own: boolean; senderId: string
  senderName: string; senderInitials: string; senderColor: string; time: string; date: string
}
type Sender = Omit<Message, 'id' | 'text' | 'time' | 'date'>

const ME: Sender    = { own: true,  senderId: 'me',    senderName: 'Анна',   senderInitials: 'АС', senderColor: '#2C5BF0' }
const KATYA: Sender = { own: false, senderId: 'katya', senderName: 'Катя',   senderInitials: 'КА', senderColor: '#E0556E' }
const SLAVA: Sender = { own: false, senderId: 'slava', senderName: 'Слава',  senderInitials: 'СВ', senderColor: '#22B07D' }
const MISHA: Sender = { own: false, senderId: 'misha', senderName: 'Михаил', senderInitials: 'МИ', senderColor: '#F0902C' }

let _mid = 1
const m = (sender: Sender, text: string, time: string, date = 'Сегодня'): Message =>
  ({ id: _mid++, ...sender, text, time, date })

function directMessages(other: Sender): Message[] {
  return [
    m(other, 'Привет! Отправил макеты на почту, посмотри когда будет время',      '12:30'),
    m(ME,    'Привет! Гляну сегодня вечером',                                      '12:33'),
    m(other, 'Окей, там три варианта главного экрана. Жду фидбека',                '12:34'),
    m(other, 'Особенно посмотри второй — там новый подход к навигации',            '12:34'),
    m(ME,    'Договорились, напишу как просмотрю',                                 '12:40'),
    m(other, 'Кстати, встреча завтра в 10 всё ещё актуальна?',                     '12:41'),
    m(ME,    'Да, всё в силе',                                                     '12:42'),
    m(other, '👍',                                                                  '12:43'),
    m(ME,    'Посмотрел макеты — второй вариант интересный. Давай обсудим завтра', '18:02'),
    m(other, 'Отлично! До завтра 🙌',                                              '18:05'),
  ]
}

const GROUP_MESSAGES_2: Message[] = [
  m(KATYA, 'Всем привет! Нужно утвердить финальную палитру до конца дня 🎨',      '11:00'),
  m(KATYA, 'Скинула три варианта в общую папку, посмотрите',                      '11:01'),
  m(SLAVA, 'Видел, я за второй — он нейтральнее и лучше читается',                '11:08'),
  m(MISHA, 'Согласен со Славой. Второй вариант отлично под бренд ложится',        '11:09'),
  m(ME,    'Тоже второй. По-моему, там хорошо работает контраст',                 '11:14'),
  m(KATYA, 'Отлично, все за второй 👏',                                            '11:20'),
  m(KATYA, 'Тогда фиксируем, пришлю финальные файлы вечером',                     '11:20'),
  m(SLAVA, '👍',                                                                   '11:21'),
  m(MISHA, 'Ждём! И ещё — надо обсудить шрифты на следующей неделе',              '11:25'),
  m(ME,    'Договорились, создам встречу на понедельник',                          '11:30'),
  m(KATYA, 'Согласовали финальную палитру 🎉',                                     '12:31'),
]

const CHAT_META: Record<string, { name: string; initials: string; color: string; online: boolean; group: boolean }> = {
  '1': { name: 'Михаил Орлов',        initials: 'МО', color: '#2C5BF0', online: true,  group: false },
  '2': { name: 'Дизайн-команда',      initials: 'ДК', color: '#7A5BF0', online: false, group: true  },
  '3': { name: 'Елена Власова',       initials: 'ЕВ', color: '#22B07D', online: true,  group: false },
  '4': { name: 'TravelLine — Релизы', initials: 'TL', color: '#F0902C', online: false, group: true  },
  '5': { name: 'Артём Кузнецов',      initials: 'АК', color: '#E0556E', online: false, group: false },
  '6': { name: 'Маркетинг',           initials: 'МР', color: '#2CA6C9', online: false, group: true  },
  '7': { name: 'Софья Белова',        initials: 'СБ', color: '#9B59B6', online: true,  group: false },
}

interface GroupMember { name: string; initials: string; color: string; role: 'Администратор' | 'Участник'; online: boolean }

const GROUP_MEMBERS: Record<string, GroupMember[]> = {
  '2': [
    { name: 'Катя Андреева',    initials: 'КА', color: '#E0556E', role: 'Администратор', online: true  },
    { name: 'Слава Виноградов', initials: 'СВ', color: '#22B07D', role: 'Участник',       online: false },
    { name: 'Михаил Иванов',    initials: 'МИ', color: '#F0902C', role: 'Участник',       online: true  },
    { name: 'Анна Соколова',    initials: 'АС', color: '#2C5BF0', role: 'Участник',       online: true  },
  ],
  '4': [
    { name: 'Денис Петров',    initials: 'ДП', color: '#2C5BF0', role: 'Администратор', online: false },
    { name: 'Ирина Смирнова',  initials: 'ИС', color: '#7A5BF0', role: 'Участник',       online: true  },
    { name: 'Алексей Фёдоров', initials: 'АФ', color: '#22B07D', role: 'Участник',       online: false },
    { name: 'Анна Соколова',   initials: 'АС', color: '#2C5BF0', role: 'Участник',       online: true  },
  ],
  '6': [
    { name: 'Ольга Козлова',  initials: 'ОК', color: '#2CA6C9', role: 'Администратор', online: false },
    { name: 'Виктор Попов',   initials: 'ВП', color: '#E0556E', role: 'Участник',       online: false },
    { name: 'Настя Лебедева', initials: 'НЛ', color: '#F0902C', role: 'Участник',       online: true  },
    { name: 'Анна Соколова',  initials: 'АС', color: '#2C5BF0', role: 'Участник',       online: true  },
  ],
}

const USER_PROFILES: Record<string, { phone: string; email: string; department: string }> = {
  '1': { phone: '+7 912 345-67-89', email: 'mikhail.orlov@travelline.ru',   department: 'Дизайн'     },
  '3': { phone: '+7 916 234-56-78', email: 'elena.vlasova@travelline.ru',   department: 'Разработка' },
  '5': { phone: '+7 903 456-78-90', email: 'artem.kuznetsov@travelline.ru', department: 'Аналитика'  },
  '7': { phone: '+7 925 567-89-01', email: 'sofya.belova@travelline.ru',    department: 'Маркетинг'  },
}

interface ModalUser { name: string; initials: string; color: string; online: boolean; phone?: string; email?: string; department?: string }

const SENDER_DETAILS: Record<string, { phone: string; email: string; department: string; online: boolean }> = {
  'katya': { phone: '+7 495 123-45-67', email: 'katya.andreeva@travelline.ru',   department: 'Дизайн',     online: true  },
  'slava': { phone: '+7 499 234-56-78', email: 'slava.vinogradov@travelline.ru', department: 'Разработка', online: false },
  'misha': { phone: '+7 916 345-67-89', email: 'mikhail.ivanov@travelline.ru',   department: 'Дизайн',     online: true  },
}

const ME_PROFILE: ModalUser = { name: 'Анна Соколова', initials: 'АС', color: '#2C5BF0', online: true, phone: '+7 905 •• •• 12', email: 'anna.sokolova@travelline.tech', department: 'Дизайн' }

const STUB_USER = {
  initials: 'АС', fullName: 'Анна Соколова', username: '@anna.sokolova',
  bio: 'Продакт-дизайнер в команде TravelLine. Веду проекты интерфейсов и обожаю осмысленные диалоги.',
  city: 'Москва', since: 'С марта 2023',
  email: 'anna.sokolova@travelline.tech', phone: '+7 905 •• •• 12',
}

type Filter = 'all' | 'direct' | 'group'

function getInitialMessages(chatId: string): Message[] {
  if (chatId === '2') return GROUP_MESSAGES_2
  const meta = CHAT_META[chatId] ?? CHAT_META['1']
  const other: Sender = { own: false, senderId: `other-${chatId}`, senderName: meta.name.split(' ')[0], senderInitials: meta.initials, senderColor: meta.color }
  return directMessages(other)
}

function getModalUserFromMsg(msg: Message): ModalUser {
  if (msg.senderId === 'me') return ME_PROFILE
  if (msg.senderId.startsWith('other-')) {
    const cid = msg.senderId.replace('other-', '')
    const cm = CHAT_META[cid] ?? CHAT_META['1']
    return { name: cm.name, initials: cm.initials, color: cm.color, online: cm.online, ...USER_PROFILES[cid] }
  }
  const d = SENDER_DETAILS[msg.senderId]
  return { name: msg.senderName, initials: msg.senderInitials, color: msg.senderColor, online: d?.online ?? false, phone: d?.phone, email: d?.email, department: d?.department }
}

/* ── Component ────────────────────────────────────────────────────────────── */

export function MessengerPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')

  const [messages, setMessages] = useState<Message[]>(() => id ? getInitialMessages(id) : [])
  const [text, setText] = useState('')
  const [modalUser, setModalUser] = useState<ModalUser | null>(null)
  const [groupModalOpen, setGroupModalOpen] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [profileOpen, setProfileOpen] = useState(false)
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [displayName, setDisplayName] = useState(STUB_USER.fullName)
  const [editStatus, setEditStatus] = useState('')
  const [editAvatar, setEditAvatar] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>(undefined)
  const [hasTriedSubmit, setHasTriedSubmit] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [formError, setFormError] = useState('')
  const isNameInvalid = hasTriedSubmit && !displayName.trim()

  useEffect(() => { setMessages(id ? getInitialMessages(id) : []) }, [id])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  useEffect(() => {
    if (!modalUser && !groupModalOpen && !editOpen && !avatarMenuOpen) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') { setModalUser(null); setGroupModalOpen(false); setEditOpen(false); setAvatarMenuOpen(false) }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [modalUser, groupModalOpen, editOpen, avatarMenuOpen])

  useEffect(() => () => { if (avatarPreview) URL.revokeObjectURL(avatarPreview) }, [avatarPreview])

  function handleLogout() { clearAuthTokens(); navigate('/login') }

  function send() {
    const trimmed = text.trim()
    if (!trimmed) return
    setMessages(prev => [...prev, { ...ME, id: Date.now(), text: trimmed, time: new Date().toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }), date: 'Сегодня' }])
    setText('')
    textareaRef.current?.focus()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  function openEdit() {
    setDisplayName(STUB_USER.fullName); setEditStatus(''); setEditAvatar(null)
    setAvatarPreview(undefined); setHasTriedSubmit(false); setFormError('')
    setEditOpen(true)
  }

  async function handleEditSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setHasTriedSubmit(true)
    if (!displayName.trim()) return
    setFormError(''); setIsLoading(true)
    try { console.log({ displayName: displayName.trim(), status: editStatus.trim(), avatar: editAvatar }); setEditOpen(false) }
    catch { setFormError('Не удалось сохранить профиль. Попробуйте ещё раз.') }
    finally { setIsLoading(false) }
  }

  const counts = { all: CHATS.length, direct: CHATS.filter(c => !c.group).length, group: CHATS.filter(c => c.group).length }
  const q = query.trim().toLowerCase()
  const visibleChats = CHATS
    .filter(c => filter === 'all' ? true : filter === 'group' ? c.group : !c.group)
    .filter(c => !q || c.name.toLowerCase().includes(q) || c.preview.toLowerCase().includes(q))

  const TABS: { id: Filter; label: string }[] = [
    { id: 'all', label: 'Все' }, { id: 'direct', label: 'Личные' }, { id: 'group', label: 'Группы' },
  ]

  const meta = id ? (CHAT_META[id] ?? CHAT_META['1']) : null

  type RenderedItem =
    | { type: 'sep'; label: string }
    | { type: 'msg'; msg: Message; showAvatar: boolean; showName: boolean; senderSwitch: boolean }

  const rendered: RenderedItem[] = []
  if (id && meta) {
    let lastDate = ''
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i], prev = messages[i - 1], next = messages[i + 1]
      if (msg.date !== lastDate) { rendered.push({ type: 'sep', label: msg.date }); lastDate = msg.date }
      rendered.push({
        type: 'msg', msg,
        showAvatar: !next || next.senderId !== msg.senderId,
        showName: !msg.own && meta.group && (!prev || prev.senderId !== msg.senderId),
        senderSwitch: !!prev && prev.senderId !== msg.senderId,
      })
    }
  }

  return (
    <div className={s.root}>
      {/* Mobile top bar */}
      <header className={s.topBar}>
        {id
          ? <button className={s.topBarBack} onClick={() => navigate('/chats')}>‹</button>
          : <div className={s.topBarLogo}>TL:MESSENGER</div>
        }
        <button className={s.topBarUserBtn} onClick={() => setProfileOpen(true)}>АС</button>
      </header>

      <div className={s.body}>
        {/* Column 1: icon nav */}
        <nav className={s.iconNav}>
          <div className={s.iconNavLogo}>TL</div>
          <div className={s.iconNavBottom}>
            <div className={s.avatarMenuWrap}>
              {avatarMenuOpen && (
                <div className={s.avatarMenu}>
                  <button className={s.avatarMenuItem} onClick={() => { setAvatarMenuOpen(false); setProfileOpen(true) }}>Открыть профиль</button>
                  <button className={`${s.avatarMenuItem} ${s.avatarMenuItemDanger}`} onClick={() => { setAvatarMenuOpen(false); handleLogout() }}>Выйти</button>
                </div>
              )}
              <button className={s.userAvatarBtn} onClick={() => setAvatarMenuOpen(v => !v)}>АС</button>
            </div>
          </div>
        </nav>

        {/* Column 2: chat list */}
        <aside className={`${s.chatListPanel} ${id ? s.chatListPanelHidden : ''}`}>
          <div className={s.clHeader}>
            <h2 className={s.clTitle}>Сообщения</h2>
            <button className={s.clNewBtn} onClick={() => alert('Новый чат')}>＋</button>
          </div>
          <div className={s.clSearch}>
            <span className={s.clSearchIcon}>🔍</span>
            <input className={s.clSearchInput} placeholder="Поиск" value={query} onChange={e => setQuery(e.target.value)} />
          </div>
          <div className={s.clTabs}>
            {TABS.map(t => (
              <button key={t.id} className={`${s.clTab} ${filter === t.id ? s.clTabActive : ''}`} onClick={() => setFilter(t.id)}>
                {t.label}
                <span className={`${s.clTabCount} ${filter === t.id ? s.clTabCountActive : ''}`}>{counts[t.id]}</span>
              </button>
            ))}
          </div>
          <div className={s.clList}>
            {visibleChats.length === 0
              ? <div className={s.clEmpty}>Ничего не найдено</div>
              : visibleChats.map(chat => (
                <div
                  key={chat.id}
                  className={`${s.clRow} ${id === String(chat.id) ? s.clRowActive : ''}`}
                  onClick={() => navigate(`/chats/${chat.id}`)}
                >
                  <div className={`${s.clAvatar} ${chat.group ? s.clAvatarGroup : ''}`} style={{ background: chat.color }}>
                    {chat.initials}
                    {chat.online && <span className={s.clOnlineDot} />}
                  </div>
                  <div className={s.clInfo}>
                    <div className={s.clNameRow}>
                      <span className={s.clName}>{chat.name}</span>
                      {chat.group && <span className={s.clGroupBadge}>ГРУППА</span>}
                    </div>
                    <div className={s.clPreview}>{chat.preview}</div>
                  </div>
                  <div className={s.clMeta}>
                    <span className={s.clTime}>{chat.time}</span>
                    {chat.unread && <span className={s.clUnread}>{chat.unread}</span>}
                  </div>
                </div>
              ))
            }
          </div>
        </aside>

        {/* Column 3: content */}
        <main className={`${s.content}${!id ? ` ${s.contentMobileHidden}` : ''}`}>
          {id && meta ? (
            <>
              <div className={s.chatHeader}>
                <button
                  type="button" className={s.chatHeaderTrigger}
                  onClick={() => meta.group
                    ? setGroupModalOpen(true)
                    : setModalUser({ name: meta.name, initials: meta.initials, color: meta.color, online: meta.online, ...USER_PROFILES[id] })
                  }
                >
                  <div className={`${s.chatHeaderAvatar} ${meta.group ? s.chatHeaderAvatarGroup : ''}`} style={{ background: meta.color }}>{meta.initials}</div>
                  <div className={s.chatHeaderInfo}>
                    <div className={s.chatHeaderName}>{meta.name}</div>
                    <div className={s.chatHeaderSub}>
                      {meta.online ? <><span className={s.chatHeaderOnlineDot} />в сети</> : meta.group ? `${(GROUP_MEMBERS[id] ?? []).length} участника` : 'был(а) недавно'}
                    </div>
                  </div>
                </button>
              </div>

              <div className={s.messages}>
                {rendered.map((item, i) =>
                  item.type === 'sep' ? (
                    <div key={`sep-${i}`} className={s.dateSep}><span className={s.dateSepLabel}>{item.label}</span></div>
                  ) : (
                    <div key={item.msg.id}>
                      {item.showName && (
                        <div className={`${s.senderName} ${s.senderNameClickable}`} style={{ color: item.msg.senderColor }} onClick={() => setModalUser(getModalUserFromMsg(item.msg))}>
                          {item.msg.senderName}
                        </div>
                      )}
                      <div className={`${s.msgRow} ${item.senderSwitch && !item.showName ? s.senderSwitch : ''}`}>
                        <div
                          className={`${s.msgAvatar} ${item.showAvatar ? s.msgAvatarClickable : s.msgAvatarHidden}`}
                          style={{ background: item.msg.senderColor }}
                          onClick={() => item.showAvatar ? setModalUser(getModalUserFromMsg(item.msg)) : undefined}
                        >{item.msg.senderInitials}</div>
                        <div className={`${s.bubble} ${item.msg.own ? s.bubbleOwn : s.bubbleOther} ${item.showAvatar ? s.bubbleTail : ''}`}>{item.msg.text}</div>
                      </div>
                      <span className={s.msgTime}>{item.msg.time}</span>
                    </div>
                  )
                )}
                <div ref={bottomRef} />
              </div>

              <div className={s.inputBar}>
                <textarea ref={textareaRef} className={s.textInput} placeholder="Написать сообщение…" value={text} rows={1} onChange={e => setText(e.target.value)} onKeyDown={handleKeyDown} />
                <button className={s.sendBtn} disabled={!text.trim()} onClick={send}>
                  <svg className={s.sendIcon} viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                </button>
              </div>
            </>
          ) : (
            <div className={s.placeholder}>
              <div className={s.placeholderIcon}>💬</div>
              <h3 className={s.placeholderTitle}>Выберите чат</h3>
              <p className={s.placeholderText}>Выберите чат из списка слева, чтобы начать общение</p>
            </div>
          )}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className={`${s.bottomNav}${id ? ` ${s.bottomNavHidden}` : ''}`}>
        <button className={`${s.bnItem} ${s.bnItemActive}`} onClick={() => navigate('/chats')}>
          <span className={s.bnGlyph}>💬<span className={s.bnBadge}>12</span></span>
          <span>Чаты</span>
        </button>
        <button className={s.bnItem} onClick={() => setProfileOpen(true)}>
          <span className={s.bnAvatarMini}>АС</span>
          <span>Профиль</span>
        </button>
      </nav>

      {avatarMenuOpen && <div className={s.avatarMenuBg} onClick={() => setAvatarMenuOpen(false)} />}

      {/* Profile panel */}
      {profileOpen && (
        <>
          <div className={s.panelBg} onClick={() => setProfileOpen(false)} />
          <div className={s.profilePanel}>
            <div className={s.ppMobileBar}>
              <button type="button" className={s.topBarBack} onClick={() => setProfileOpen(false)}>‹</button>
            </div>
            <button type="button" className={s.ppClose} onClick={() => setProfileOpen(false)}>✕</button>
            <div className={s.ppScrollArea}>
              <div className={s.ppCover} />
              <div className={s.ppBody}>
                <div className={s.ppAvatar}>{STUB_USER.initials}</div>
                <div className={s.ppStatusBadge}><span className={s.ppStatusDot} />В сети</div>
                <h2 className={s.ppName}>{STUB_USER.fullName}</h2>
                <div className={s.ppUsername}>{STUB_USER.username}</div>
                <p className={s.ppBio}>{STUB_USER.bio}</p>
                <div className={s.ppTags}>
                  <span className={s.ppTag}>📍 {STUB_USER.city}</span>
                  <span className={s.ppTag}>📅 {STUB_USER.since}</span>
                </div>
                <div className={s.ppDivider} />
                <div className={s.ppDetails}>
                  <div className={s.ppDetailRow}><span className={s.ppDetailLabel}>Эл. почта</span><span className={s.ppDetailValue}>{STUB_USER.email}</span></div>
                  <div className={s.ppDetailRow}><span className={s.ppDetailLabel}>Телефон</span><span className={s.ppDetailValue}>{STUB_USER.phone}</span></div>
                </div>
                <button className={s.ppEditBtn} onClick={openEdit}>✎ Изменить профиль</button>
                <button className={s.ppLogoutBtn} onClick={handleLogout}>Выйти из аккаунта</button>
              </div>
            </div>
            <nav className={s.ppBottomNav}>
              <button className={s.bnItem} onClick={() => setProfileOpen(false)}>
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
      )}

      {/* Edit profile modal */}
      {editOpen && (
        <div className={s.modalOverlay} onClick={() => setEditOpen(false)}>
          <div className={s.modalPanel} onClick={e => e.stopPropagation()}>
            <div className={s.modalHeader}>
              <span className={s.modalTitle}>Редактирование профиля</span>
              <button type="button" className={s.modalClose} onClick={() => setEditOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleEditSubmit} className={s.modalForm} noValidate>
              <div className={s.modalAvatarBlock}>
                <AvatarUpload name={displayName} avatarPreview={avatarPreview} onChange={f => { setEditAvatar(f); setAvatarPreview(URL.createObjectURL(f)) }} />
              </div>
              <div className={s.modalFields}>
                <label className={s.modalField}>
                  <span className={s.modalFieldLabel}>Имя пользователя <span className={s.required}>*</span></span>
                  <input className={`${s.modalFieldInput} ${isNameInvalid ? s.modalFieldInputError : ''}`} type="text" value={displayName} onChange={(e: ChangeEvent<HTMLInputElement>) => setDisplayName(e.target.value)} placeholder="Например, Николай" />
                  {isNameInvalid && <span className={s.modalFieldError}>Введите имя пользователя</span>}
                </label>
                <label className={s.modalField}>
                  <span className={s.modalFieldLabel}>Статус</span>
                  <input className={s.modalFieldInput} type="text" value={editStatus} onChange={(e: ChangeEvent<HTMLInputElement>) => setEditStatus(e.target.value)} placeholder="Например, на связи" />
                </label>
              </div>
              {formError && <p className={s.modalFormError}>{formError}</p>}
              <div className={s.modalActions}>
                <button type="button" className={s.modalCancelBtn} onClick={() => setEditOpen(false)}>Отмена</button>
                <button type="submit" className={s.modalSaveBtn} disabled={isLoading}>{isLoading ? 'Сохраняем...' : 'Сохранить'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* User profile modal */}
      {modalUser && (
        <div className={s.modalOverlay} onClick={() => setModalUser(null)}>
          <div className={s.modalPanel} onClick={e => e.stopPropagation()}>
            <button type="button" className={s.modalClose} onClick={() => setModalUser(null)}>✕</button>
            <div className={s.umAvatar} style={{ background: modalUser.color }}>{modalUser.initials}</div>
            <div className={s.umName}>{modalUser.name}</div>
            <div className={s.umStatus}>{modalUser.online ? <><span className={s.umStatusDot} />в сети</> : 'был(а) недавно'}</div>
            {(modalUser.phone || modalUser.email || modalUser.department) && (
              <>
                <div className={s.umDivider} />
                <div className={s.umSection}>Контакт</div>
                {modalUser.phone      && <div className={s.umField}><span className={s.umFieldLabel}>Телефон</span><span className={s.umFieldValue}>{modalUser.phone}</span></div>}
                {modalUser.email      && <div className={s.umField}><span className={s.umFieldLabel}>Email</span><span className={s.umFieldValue}>{modalUser.email}</span></div>}
                {modalUser.department && <div className={s.umField}><span className={s.umFieldLabel}>Отдел</span><span className={s.umFieldValue}>{modalUser.department}</span></div>}
              </>
            )}
          </div>
        </div>
      )}

      {/* Group modal */}
      {groupModalOpen && meta && (
        <div className={s.modalOverlay} onClick={() => setGroupModalOpen(false)}>
          <div className={s.modalPanel} onClick={e => e.stopPropagation()}>
            <button type="button" className={s.modalClose} onClick={() => setGroupModalOpen(false)}>✕</button>
            <div className={`${s.umAvatar} ${s.umAvatarGroup}`} style={{ background: meta.color }}>{meta.initials}</div>
            <div className={s.umName}>{meta.name}</div>
            <div className={s.umStatus}>{(GROUP_MEMBERS[id!] ?? []).length} участника</div>
            <div className={s.umDivider} />
            <div className={s.umSectionRow}>
              <span className={s.umSection}>Участники ({(GROUP_MEMBERS[id!] ?? []).length})</span>
              <button type="button" className={s.umAddMemberBtn} onClick={() => alert('Добавить участника')} title="Добавить участника">+</button>
            </div>
            <div className={s.umMemberList}>
              {(GROUP_MEMBERS[id!] ?? []).map(member => (
                <div key={member.name} className={`${s.umMemberRow} ${s.umMemberRowClickable}`} onClick={() => { setGroupModalOpen(false); setModalUser({ name: member.name, initials: member.initials, color: member.color, online: member.online }) }}>
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
      )}
    </div>
  )
}

export default MessengerPage
