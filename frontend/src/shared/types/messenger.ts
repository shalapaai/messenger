export interface Chat {
  id: string
  name: string
  initials: string
  color: string
  preview: string
  time: string
  unread: number
  online: boolean
  group: boolean
  /** userId собеседника — только для личных чатов, нужен для онлайн-статуса */
  otherUserId?: string
}

export interface ChatMeta {
  name: string
  initials: string
  color: string
  online: boolean
  group: boolean
}

export interface GroupMember {
  name: string
  initials: string
  color: string
  role: 'Администратор' | 'Участник'
  online: boolean
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
  time: string
  date: string
  status?: 'pending' | 'sent' | 'failed'
  deleted?: boolean
}

export type Sender = Omit<Message, 'id' | 'text' | 'time' | 'date'>

export interface ModalUser {
  name: string
  initials: string
  color: string
  online: boolean
  phone?: string
  email?: string
  department?: string
}

export interface StubUser {
  initials: string
  fullName: string
  username: string
  bio: string
  city: string
  since: string
  email: string
  phone: string
  department: string
}

export type Filter = 'all' | 'direct' | 'group'
