import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import s from './ChatPage.module.css'

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
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setMessages(getInitialMessages(id))
  }, [id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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
                    <div className={s.senderName} style={{ color: item.msg.senderColor }}>
                      {item.msg.senderName}
                    </div>
                  )}
                  <div className={`${s.msgRow} ${item.senderSwitch && !item.showName ? s.senderSwitch : ''}`}>
                    <div
                      className={`${s.msgAvatar} ${item.showAvatar ? '' : s.msgAvatarHidden}`}
                      style={{ background: item.msg.senderColor }}
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
      </nav>
    </div>
  )
}

export default ChatPage
