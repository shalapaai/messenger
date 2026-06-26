import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import s from './ChatPage.module.css'
import { clearAuthTokens } from '../../shared/lib/auth/authTokens'

interface Message {
  id: number
  text: string
  own: boolean
  senderId: string
  senderName: string
  senderInitials: string
  senderColor: string
  time: string
  date: string
}

type Sender = Omit<Message, 'id' | 'text' | 'time' | 'date'>

const ME: Sender    = { own: true,  senderId: 'me',    senderName: 'Анна',   senderInitials: 'АС', senderColor: '#2C5BF0' }
const ME_PROFILE: ModalUser = { name: 'Анна Соколова', initials: 'АС', color: '#2C5BF0', online: true, phone: '+7 905 •• •• 12', email: 'anna.sokolova@travelline.tech', department: 'Дизайн' }
const KATYA: Sender = { own: false, senderId: 'katya', senderName: 'Катя',   senderInitials: 'КА', senderColor: '#E0556E' }
const SLAVA: Sender = { own: false, senderId: 'slava', senderName: 'Слава',  senderInitials: 'СВ', senderColor: '#22B07D' }
const MISHA: Sender = { own: false, senderId: 'misha', senderName: 'Михаил', senderInitials: 'МИ', senderColor: '#F0902C' }

let _id = 1
const m = (sender: Sender, text: string, time: string, date = 'Сегодня'): Message =>
  ({ id: _id++, ...sender, text, time, date })

function directMessages(other: Sender): Message[] {
  return [
    m(other, 'Привет! Отправил макеты на почту, посмотри когда будет время',       '12:30'),
    m(ME,    'Привет! Гляну сегодня вечером',                                       '12:33'),
    m(other, 'Окей, там три варианта главного экрана. Жду фидбека',                 '12:34'),
    m(other, 'Особенно посмотри второй — там новый подход к навигации',             '12:34'),
    m(ME,    'Договорились, напишу как просмотрю',                                  '12:40'),
    m(other, 'Кстати, встреча завтра в 10 всё ещё актуальна?',                      '12:41'),
    m(ME,    'Да, всё в силе',                                                      '12:42'),
    m(other, '👍',                                                                   '12:43'),
    m(ME,    'Посмотрел макеты — второй вариант интересный. Давай обсудим завтра',  '18:02'),
    m(other, 'Отлично! До завтра 🙌',                                               '18:05'),
  ]
}

const GROUP_MESSAGES_2: Message[] = [
  m(KATYA, 'Всем привет! Нужно утвердить финальную палитру до конца дня 🎨',       '11:00'),
  m(KATYA, 'Скинула три варианта в общую папку, посмотрите',                       '11:01'),
  m(SLAVA, 'Видел, я за второй — он нейтральнее и лучше читается',                 '11:08'),
  m(MISHA, 'Согласен со Славой. Второй вариант отлично под бренд ложится',         '11:09'),
  m(ME,    'Тоже второй. По-моему, там хорошо работает контраст',                  '11:14'),
  m(KATYA, 'Отлично, все за второй 👏',                                             '11:20'),
  m(KATYA, 'Тогда фиксируем, пришлю финальные файлы вечером',                      '11:20'),
  m(SLAVA, '👍',                                                                    '11:21'),
  m(MISHA, 'Ждём! И ещё — надо обсудить шрифты на следующей неделе',               '11:25'),
  m(ME,    'Договорились, создам встречу на понедельник',                           '11:30'),
  m(KATYA, 'Согласовали финальную палитру 🎉',                                      '12:31'),
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

interface GroupMember {
  name: string
  initials: string
  color: string
  role: 'Администратор' | 'Участник'
  online: boolean
}

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

interface ModalUser {
  name: string
  initials: string
  color: string
  online: boolean
  phone?: string
  email?: string
  department?: string
}

const SENDER_DETAILS: Record<string, { phone: string; email: string; department: string; online: boolean }> = {
  'katya': { phone: '+7 495 123-45-67', email: 'katya.andreeva@travelline.ru',   department: 'Дизайн',     online: true  },
  'slava': { phone: '+7 499 234-56-78', email: 'slava.vinogradov@travelline.ru', department: 'Разработка', online: false },
  'misha': { phone: '+7 916 345-67-89', email: 'mikhail.ivanov@travelline.ru',   department: 'Дизайн',     online: true  },
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

const NAV_ITEMS = [
  { id: 'chats',   label: 'Чаты',    glyph: '💬', badge: '12', path: '/chats'   },
  { id: 'profile', label: 'Профиль', glyph: '👤', badge: '',   path: '/profile' },
]

function getInitialMessages(chatId: string): Message[] {
  if (chatId === '2') return GROUP_MESSAGES_2
  const meta = CHAT_META[chatId] ?? CHAT_META['1']
  const other: Sender = {
    own: false,
    senderId: `other-${chatId}`,
    senderName: meta.name.split(' ')[0],
    senderInitials: meta.initials,
    senderColor: meta.color,
  }
  return directMessages(other)
}

export function ChatPage() {
  const { id = '1' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const meta = CHAT_META[id] ?? CHAT_META['1']

  const [messages, setMessages] = useState<Message[]>(() => getInitialMessages(id))
  const [text, setText] = useState('')
  const [modalUser, setModalUser] = useState<ModalUser | null>(null)
  const [groupModalOpen, setGroupModalOpen] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function handleLogout() {
    clearAuthTokens()
    navigate('/login')
  }

  useEffect(() => {
    setMessages(getInitialMessages(id))
  }, [id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!modalUser && !groupModalOpen) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') { setModalUser(null); setGroupModalOpen(false) }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [modalUser, groupModalOpen])

  function send() {
    const trimmed = text.trim()
    if (!trimmed) return
    setMessages(prev => [...prev, { ...ME, id: Date.now(), text: trimmed, time: new Date().toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }), date: 'Сегодня' }])
    setText('')
    textareaRef.current?.focus()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  type RenderedItem =
    | { type: 'sep'; label: string }
    | { type: 'msg'; msg: Message; showAvatar: boolean; showName: boolean; senderSwitch: boolean }

  const rendered: RenderedItem[] = []
  let lastDate = ''
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    const prev = messages[i - 1]
    const next = messages[i + 1]
    if (msg.date !== lastDate) {
      rendered.push({ type: 'sep', label: msg.date })
      lastDate = msg.date
    }
    const isLastInGroup  = !next || next.senderId !== msg.senderId
    const isFirstInGroup = !prev || prev.senderId !== msg.senderId
    const senderSwitch   = !!prev && prev.senderId !== msg.senderId
    rendered.push({
      type: 'msg',
      msg,
      showAvatar: isLastInGroup,
      showName: !msg.own && meta.group && isFirstInGroup,
      senderSwitch,
    })
  }

  return (
    <div className={s.root}>
      <header className={s.topBar}>
        <div className={s.topBarLogo}>TL:MESSENGER</div>
        <div className={s.topBarAvatar}>АС</div>
      </header>

      <div className={s.body}>
        <aside className={s.sidebar}>
          <div className={s.sidebarLogo}>TL:MESSENGER</div>
          <nav className={s.nav}>
            {NAV_ITEMS.map(item => (
              <button
                key={item.id}
                className={`${s.navItem} ${pathname.startsWith(item.path) ? s.navItemActive : ''}`}
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

        <div className={s.chatView}>
          <div className={s.chatHeader}>
            <button className={s.backBtn} onClick={() => navigate('/chats')}>‹</button>
            <button type="button" className={s.headerTrigger} onClick={() => meta.group ? setGroupModalOpen(true) : setModalUser({ name: meta.name, initials: meta.initials, color: meta.color, online: meta.online, ...USER_PROFILES[id] })}>
              <div
                className={`${s.headerAvatar} ${meta.group ? s.headerAvatarGroup : ''}`}
                style={{ background: meta.color }}
              >
                {meta.initials}
              </div>
              <div className={s.headerInfo}>
                <div className={s.headerName}>{meta.name}</div>
                <div className={s.headerSub}>
                  {meta.online
                    ? <><span className={s.headerOnlineDot} />в сети</>
                    : meta.group ? `${Object.values(CHAT_META).filter((_, i) => ['2','4','6'].includes(String(i+1))).length} участника` : 'был(а) недавно'
                  }
                </div>
              </div>
            </button>
          </div>

          <div className={s.messages}>
            {rendered.map((item, i) =>
              item.type === 'sep' ? (
                <div key={`sep-${i}`} className={s.dateSep}>
                  <span className={s.dateSepLabel}>{item.label}</span>
                </div>
              ) : (
                <div key={item.msg.id}>
                  {item.showName && (
                    <div
                      className={`${s.senderName} ${s.senderNameClickable}`}
                      style={{ color: item.msg.senderColor }}
                      onClick={() => setModalUser(getModalUserFromMsg(item.msg))}
                    >
                      {item.msg.senderName}
                    </div>
                  )}
                  <div className={`${s.msgRow} ${item.senderSwitch && !item.showName ? s.senderSwitch : ''}`}>
                    <div
                      className={`${s.msgAvatar} ${item.showAvatar ? '' : s.msgAvatarHidden} ${item.showAvatar ? s.msgAvatarClickable : ''}`}
                      style={{ background: item.msg.senderColor }}
                      onClick={() => item.showAvatar ? setModalUser(getModalUserFromMsg(item.msg)) : undefined}
                    >
                      {item.msg.senderInitials}
                    </div>
                    <div className={`${s.bubble} ${item.msg.own ? s.bubbleOwn : s.bubbleOther} ${item.showAvatar ? s.bubbleTail : ''}`}>
                      {item.msg.text}
                    </div>
                  </div>
                  <span className={s.msgTime}>{item.msg.time}</span>
                </div>
              )
            )}
            <div ref={bottomRef} />
          </div>

          <div className={s.inputBar}>
            <textarea
              ref={textareaRef}
              className={s.textInput}
              placeholder="Написать сообщение…"
              value={text}
              rows={1}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button className={s.sendBtn} disabled={!text.trim()} onClick={send}>
              <svg className={s.sendIcon} viewBox="0 0 24 24">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {modalUser && (
        <div className={s.modalOverlay} onClick={() => setModalUser(null)}>
          <div className={s.modalPanel} onClick={e => e.stopPropagation()}>
            <button type="button" className={s.modalClose} onClick={() => setModalUser(null)}>✕</button>
            <div className={s.modalAvatar} style={{ background: modalUser.color }}>{modalUser.initials}</div>
            <div className={s.modalName}>{modalUser.name}</div>
            <div className={s.modalStatus}>
              {modalUser.online ? <><span className={s.modalStatusDot} />в сети</> : 'был(а) недавно'}
            </div>
            {(modalUser.phone || modalUser.email || modalUser.department) && (
              <>
                <div className={s.modalDivider} />
                <div className={s.modalSection}>Контакт</div>
                {modalUser.phone && (
                  <div className={s.modalField}>
                    <span className={s.modalFieldLabel}>Телефон</span>
                    <span className={s.modalFieldValue}>{modalUser.phone}</span>
                  </div>
                )}
                {modalUser.email && (
                  <div className={s.modalField}>
                    <span className={s.modalFieldLabel}>Email</span>
                    <span className={s.modalFieldValue}>{modalUser.email}</span>
                  </div>
                )}
                {modalUser.department && (
                  <div className={s.modalField}>
                    <span className={s.modalFieldLabel}>Отдел</span>
                    <span className={s.modalFieldValue}>{modalUser.department}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {groupModalOpen && (
        <div className={s.modalOverlay} onClick={() => setGroupModalOpen(false)}>
          <div className={s.modalPanel} onClick={e => e.stopPropagation()}>
            <button type="button" className={s.modalClose} onClick={() => setGroupModalOpen(false)}>✕</button>
            <div className={`${s.modalAvatar} ${s.modalAvatarGroup}`} style={{ background: meta.color }}>{meta.initials}</div>
            <div className={s.modalName}>{meta.name}</div>
            <div className={s.modalStatus}>{(GROUP_MEMBERS[id] ?? []).length} участника</div>
            <div className={s.modalDivider} />
            <div className={s.modalSection}>Участники ({(GROUP_MEMBERS[id] ?? []).length})</div>
            <div className={s.memberList}>
              {(GROUP_MEMBERS[id] ?? []).map(member => (
                <div
                  key={member.name}
                  className={`${s.memberRow} ${s.memberRowClickable}`}
                  onClick={() => { setGroupModalOpen(false); setModalUser({ name: member.name, initials: member.initials, color: member.color, online: member.online }) }}
                >
                  <div className={s.memberAvatarWrap}>
                    <div className={s.memberAvatar} style={{ background: member.color }}>{member.initials}</div>
                    {member.online && <span className={s.memberOnlineDot} />}
                  </div>
                  <span className={s.memberName}>{member.name}</span>
                  <span className={`${s.roleBadge} ${member.role === 'Администратор' ? s.roleBadgeAdmin : ''}`}>
                    {member.role}
                  </span>
                </div>
              ))}
            </div>
            <button type="button" className={s.editGroupBtn} onClick={() => alert('Изменить группу')}>
              Изменить группу
            </button>
          </div>
        </div>
      )}

      <nav className={s.bottomNav}>
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            className={`${s.bottomNavItem} ${pathname.startsWith(item.path) ? s.bottomNavItemActive : ''}`}
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

export default ChatPage
