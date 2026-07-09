export interface Chat {
  id: string
  name: string
  initials: string
  color: string
  avatarUrl: string | null
  preview: string
  previewAttachmentUrl?: string | null
  previewAttachmentContentType?: string | null
  previewAttachmentFileName?: string | null
  time: string
  unread: number
  online: boolean
  group: boolean
  otherUserId?: string
  otherReadAt?: string | null
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
  userInitials?: string
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
  sentAt: string
  status?: 'pending' | 'sent' | 'failed'
  edited?: boolean
  attachments?: Attachment[]
  reactions?: MessageReaction[]
  forwardedFromUserId?: string
  forwardedFromUserName?: string
  replyToMessageId?: string
  replyToSenderName?: string
  replyToContent?: string | null
  kind?: 'Text' | 'System'
  systemEventType?: 'MemberAdded' | 'MemberLeft' | 'MemberRemoved'
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
