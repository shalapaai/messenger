export interface Chat {
  id: string
  name: string
  initials: string
  color: string
  avatarUrl: string | null
  preview: string
  /** URL первого вложения последнего сообщения — для мини-превью в списке (только если это изображение).
   *  Вместе с пустым preview означает "последнее сообщение — вложение без текста" (см. ChatPreview) */
  previewAttachmentUrl?: string | null
  previewAttachmentContentType?: string | null
  /** Имя файла первого вложения — показывается вместо общей подписи "Файл" для не-фото вложений */
  previewAttachmentFileName?: string | null
  time: string
  unread: number
  online: boolean
  group: boolean
  /** userId собеседника — только для личных чатов, нужен для онлайн-статуса */
  otherUserId?: string
  /** momент, до которого собеседник прочитал переписку — для галочек "прочитано" в реальном времени */
  otherReadAt?: string | null
  /** messageId последнего обработанного realtime-сообщения — защита от дублей при двойной доставке по сокету */
  lastMessageId?: string
}

export interface ChatMeta {
  name: string
  initials: string
  color: string
  avatarUrl: string | null
  online: boolean
  group: boolean
  otherUserId?: string
}

export interface GroupMember {
  userId: string
  name: string
  initials: string
  color: string
  avatarUrl: string | null
  role: 'owner' | 'admin' | 'member'
  online: boolean
}

export interface Attachment {
  fileUrl: string
  fileName: string
  fileContentType: string
  fileSizeBytes: number
}

export interface MessageReaction {
  userId: string
  userName: string
  userAvatarUrl: string | null
  userAvatarColor: string
  emoji: string
}

export interface Message {
  id: number
  messageId?: string
  text: string
  own: boolean
  senderId: string
  senderName: string
  senderInitials: string
  senderColor: string
  senderAvatarUrl: string | null
  time: string
  /** ISO-момент отправки — для сверки с otherReadAt ("прочитано"?) и для метки-разделителя даты */
  sentAt: string
  status?: 'pending' | 'sent' | 'failed'
  edited?: boolean
  /** несколько файлов, отправленных одним сообщением — пусто/undefined, если сообщение без вложений */
  attachments?: Attachment[]
  reactions?: MessageReaction[]
  forwardedFromUserId?: string
  forwardedFromUserName?: string
  replyToMessageId?: string
  replyToSenderName?: string
  /** null, если оригинал удалён/недоступен — тогда показываем плейсхолдер вместо цитаты */
  replyToContent?: string | null
  /** 'System' — сообщение о смене состава группы (добавили/вышел/удалили), рендерится
   *  центрированной "таблеткой" вместо обычного бабла (см. MessageList.buildRenderedItems) */
  kind?: 'Text' | 'System'
  systemEventType?: 'MemberAdded' | 'MemberLeft' | 'MemberRemoved'
  /** только для kind: 'System' — кого добавили/удалили/кто вышел */
  targetUserId?: string
  targetUserName?: string
}

export type Sender = Omit<Message, 'id' | 'text' | 'time' | 'sentAt'>

export interface ModalUser {
  userId?: string
  name: string
  initials: string
  color: string
  avatarUrl?: string | null
  online: boolean
  login?: string | null
  status?: string | null
  phone?: string | null
  email?: string
  department?: string | null
  city?: string | null
}

export type Filter = 'all' | 'direct' | 'group'
