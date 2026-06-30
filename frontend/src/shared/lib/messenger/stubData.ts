import type { Chat, ChatMeta, GroupMember, Message, ModalUser, Sender, StubUser } from '../../types/messenger'

export const CHATS: Chat[] = [
  { id: '1', name: 'Михаил Орлов',        initials: 'МО', color: '#2C5BF0', preview: 'Отправил макеты, посмотри когда будет время',  time: '12:48', unread: 3, online: true,  group: false },
  { id: '2', name: 'Дизайн-команда',      initials: 'ДК', color: '#7A5BF0', preview: 'Катя: согласовали финальную палитру 🎨',       time: '12:31', unread: 8, online: false, group: true  },
  { id: '3', name: 'Елена Власова',       initials: 'ЕВ', color: '#22B07D', preview: 'Спасибо! Жду созвон в 15:00',                  time: '11:05', unread: 0, online: true,  group: false },
  { id: '4', name: 'TravelLine — Релизы', initials: 'TL', color: '#F0902C', preview: 'Денис: выкатили обновление 4.2 на прод',       time: '10:52', unread: 0, online: false, group: true  },
  { id: '5', name: 'Артём Кузнецов',      initials: 'АК', color: '#E0556E', preview: 'Ты: ок, договорились 👍',                     time: 'Вчера', unread: 0, online: false, group: false },
  { id: '6', name: 'Маркетинг',           initials: 'МР', color: '#2CA6C9', preview: 'Ольга: накидайте идей к понедельнику',         time: 'Вчера', unread: 0, online: false, group: true  },
  { id: '7', name: 'Софья Белова',        initials: 'СБ', color: '#9B59B6', preview: 'Голосовое сообщение · 0:42',                  time: 'Пн',    unread: 0, online: true,  group: false },
  { id: '8', name: 'Павел Громов',        initials: 'ПГ', color: '#56607a', preview: '',                                             time: '',      unread: 0, online: false, group: false },
]

export const CHAT_META: Record<string, ChatMeta> = {
  '1': { name: 'Михаил Орлов',        initials: 'МО', color: '#2C5BF0', online: true,  group: false },
  '2': { name: 'Дизайн-команда',      initials: 'ДК', color: '#7A5BF0', online: false, group: true  },
  '3': { name: 'Елена Власова',       initials: 'ЕВ', color: '#22B07D', online: true,  group: false },
  '4': { name: 'TravelLine — Релизы', initials: 'TL', color: '#F0902C', online: false, group: true  },
  '5': { name: 'Артём Кузнецов',      initials: 'АК', color: '#E0556E', online: false, group: false },
  '6': { name: 'Маркетинг',           initials: 'МР', color: '#2CA6C9', online: false, group: true  },
  '7': { name: 'Софья Белова',        initials: 'СБ', color: '#9B59B6', online: true,  group: false },
  '8': { name: 'Павел Громов',        initials: 'ПГ', color: '#56607a', online: false, group: false },
}

export const GROUP_MEMBERS: Record<string, GroupMember[]> = {
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

export const USER_PROFILES: Record<string, { phone: string; email: string; department: string }> = {
  '1': { phone: '+7 912 345-67-89', email: 'mikhail.orlov@travelline.ru',   department: 'Дизайн'     },
  '3': { phone: '+7 916 234-56-78', email: 'elena.vlasova@travelline.ru',   department: 'Разработка' },
  '5': { phone: '+7 903 456-78-90', email: 'artem.kuznetsov@travelline.ru', department: 'Аналитика'  },
  '7': { phone: '+7 925 567-89-01', email: 'sofya.belova@travelline.ru',    department: 'Маркетинг'  },
}

const SENDER_DETAILS: Record<string, { phone: string; email: string; department: string; online: boolean }> = {
  'katya': { phone: '+7 495 123-45-67', email: 'katya.andreeva@travelline.ru',   department: 'Дизайн',     online: true  },
  'slava': { phone: '+7 499 234-56-78', email: 'slava.vinogradov@travelline.ru', department: 'Разработка', online: false },
  'misha': { phone: '+7 916 345-67-89', email: 'mikhail.ivanov@travelline.ru',   department: 'Дизайн',     online: true  },
}

export const ME_PROFILE: ModalUser = {
  name: 'Анна Соколова', initials: 'АС', color: '#2C5BF0', online: true,
  phone: '+7 905 •• •• 12', email: 'anna.sokolova@travelline.tech', department: 'Дизайн',
}

export const STUB_USER: StubUser = {
  initials: 'АС', fullName: 'Анна Соколова', username: '@anna.sokolova',
  bio: 'Продакт-дизайнер в команде TravelLine. Веду проекты интерфейсов и обожаю осмысленные диалоги.',
  city: 'Москва', since: 'С марта 2023',
  email: 'anna.sokolova@travelline.tech', phone: '+7 905 •• •• 12', department: 'Дизайн',
}

/* ── Message factories ──────────────────────────────────────────────────── */

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

export function getInitialMessages(chatId: string): Message[] {
  if (chatId === '8') return []
  if (chatId === '2') return GROUP_MESSAGES_2
  const meta = CHAT_META[chatId] ?? CHAT_META['1']
  const other: Sender = {
    own: false, senderId: `other-${chatId}`,
    senderName: meta.name.split(' ')[0], senderInitials: meta.initials, senderColor: meta.color,
  }
  return directMessages(other)
}

let _hid = 10000
export function makeOlderBatch(chatId: string): Message[] {
  if (chatId === '8') return []
  const meta = CHAT_META[chatId]
  if (!meta) return []
  const h = (s: Sender, t: string, time: string): Message => ({ id: _hid++, ...s, text: t, time, date: 'Вчера' })
  const other: Sender = {
    own: false, senderId: `hist-${chatId}`,
    senderName: meta.name.split(' ')[0], senderInitials: meta.initials, senderColor: meta.color,
  }
  if (chatId === '2') {
    return [
      h(KATYA, 'Ребята, нужно определиться с направлением дизайна до конца недели', '09:00'),
      h(SLAVA, 'Видел референсы — мне нравится минималистичный подход',              '09:20'),
      h(MISHA, 'Согласен, меньше — лучше',                                           '09:22'),
      h(ME,    'Поддерживаю. Пришлю несколько примеров сегодня',                     '09:40'),
      h(KATYA, 'Отлично, ждём 👍',                                                   '09:45'),
    ]
  }
  return [
    h(other, 'Добрый день! Как продвигается работа?',          '09:00'),
    h(ME,    'Всё по плану, заканчиваем основную часть',        '09:15'),
    h(other, 'Хорошо, если что — пиши',                        '09:17'),
    h(ME,    'Конечно, напишу к вечеру',                        '09:20'),
    h(other, 'Жду 👌',                                          '09:21'),
  ]
}

export function getModalUserFromMsg(msg: Message): ModalUser {
  if (msg.senderId === 'me') return ME_PROFILE
  if (msg.senderId.startsWith('other-') || msg.senderId.startsWith('hist-')) {
    const cid = msg.senderId.replace('other-', '').replace('hist-', '')
    const cm = CHAT_META[cid] ?? CHAT_META['1']
    return { name: cm.name, initials: cm.initials, color: cm.color, online: cm.online, ...USER_PROFILES[cid] }
  }
  const d = SENDER_DETAILS[msg.senderId]
  return {
    name: msg.senderName, initials: msg.senderInitials, color: msg.senderColor,
    online: d?.online ?? false, phone: d?.phone, email: d?.email, department: d?.department,
  }
}
