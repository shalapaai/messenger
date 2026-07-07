import { apiClient } from './apiClient'
import { getMyUserId } from '../lib/auth/authTokens'
import i18n from '../i18n'
import { formatChatListTime, formatMessageTime } from '../lib/formatDateTime'
import type { Chat, Message, GroupMember } from '../types/messenger'

interface LastMessageDto {
  messageId: string; senderId: string; content: string; sentAt: string
  hasAttachments: boolean
  firstAttachmentUrl: string | null
  firstAttachmentContentType: string | null
  firstAttachmentFileName: string | null
  kind: 'Text' | 'System'
}
interface ChatSummaryDto { id: string; type: 'direct' | 'group'; name: string | null; avatarUrl: string | null; avatarColor: string | null; lastMessage: LastMessageDto | null; otherUserId: string | null; isOnline: boolean; otherMemberLastReadAt: string | null; unreadCount: number }
interface ChatMemberDto { userId: string; displayName: string; avatarUrl: string | null; avatarColor: string; role: 'owner' | 'admin' | 'member'; joinedAt: string; online: boolean }
interface ChatDetailDto { id: string; type: 'direct' | 'group'; name: string | null; avatarUrl: string | null; createdAt: string; members: ChatMemberDto[] }
interface AttachmentDto  { fileUrl: string; fileName: string; contentType: string; fileSizeBytes: number }
interface MessageReactionDto { userId: string; userName: string; userAvatarUrl: string | null; userAvatarColor: string; emoji: string }
interface MessageDto     { id: string; chatId: string; senderId: string; senderName: string; senderAvatarUrl: string | null; senderAvatarColor: string; content: string; attachments: AttachmentDto[]; status: string; sentAt: string; editedAt: string | null; replyToMessageId: string | null; replyToSenderName: string | null; replyToContent: string | null; forwardedFromUserId: string | null; forwardedFromUserName: string | null; kind: 'Text' | 'System'; systemEventType: 'MemberAdded' | 'MemberLeft' | 'MemberRemoved' | null; targetUserId: string | null; targetUserName: string | null; reactions: MessageReactionDto[] }
interface MessagesPageDto { items: MessageDto[]; nextCursor: string | null }

const COLORS = ['#2C5BF0', '#7A5BF0', '#22B07D', '#F0902C', '#E0556E', '#2CA6C9', '#9B59B6']

/** Детерминированный цвет аватарки по id — один и тот же человек всегда одного цвета,
 *  независимо от того, пришло сообщение из истории (REST) или realtime (SignalR). */
export function colorFromId(id: string): string {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0
  return COLORS[Math.abs(h) % COLORS.length]
}

/** Подпись под именем в результатах поиска — показываем и login (если есть), и email, а не
 *  одно "login ?? email": иначе при совпадении по email (поиск матчит email/имя/login разом)
 *  у пользователя с заданным login email просто не виден нигде в строке, и непонятно,
 *  почему этот человек вообще оказался в выдаче. */
export function userSubtitle(user: { login: string | null; email: string }): string {
  return user.login ? `${user.login} · ${user.email}` : user.email
}

/** Инициалы из displayName — общий хелпер для REST-истории и realtime-сообщений. */
export function initials(name: string | null): string {
  if (!name) return '?'
  const w = name.trim().split(/\s+/)
  return w.length >= 2 ? (w[0][0] + w[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase()
}

let _msgId = 100_000

/** Единый источник локальных (клиентских) ID сообщений — и для истории, и для realtime,
 *  и для оптимистичной отправки, чтобы не пересекались разные счётчики/стратегии. */
export function nextMessageId(): number {
  return _msgId++
}

export async function fetchChats(): Promise<Chat[]> {
  const res = await apiClient.get<ChatSummaryDto[]>('/chats')
  return res.data.map(dto => ({
    id:          dto.id,
    name:        dto.name ?? i18n.t('messenger.tabs.direct'),
    initials:    initials(dto.name),
    color:       dto.avatarColor ?? colorFromId(dto.id),
    avatarUrl:   dto.avatarUrl,
    preview:     dto.lastMessage
      ? (dto.lastMessage.kind === 'System' ? i18n.t('messenger.systemPreviewGeneric') : dto.lastMessage.content)
      : '',
    previewAttachmentUrl:         dto.lastMessage?.firstAttachmentUrl ?? undefined,
    previewAttachmentContentType: dto.lastMessage?.firstAttachmentContentType ?? undefined,
    previewAttachmentFileName:    dto.lastMessage?.firstAttachmentFileName ?? undefined,
    time:        dto.lastMessage ? formatChatListTime(dto.lastMessage.sentAt) : '',
    lastMessageId: dto.lastMessage?.messageId,
    unread:      dto.unreadCount,
    online:      dto.isOnline,
    group:       dto.type === 'group',
    otherUserId: dto.otherUserId ?? undefined,
    otherReadAt: dto.otherMemberLastReadAt,
  }))
}

export async function fetchMessages(
  chatId: string,
  opts: { limit?: number; before?: string | null } = {}
): Promise<{ messages: Message[]; nextCursor: string | null }> {
  const { limit = 50, before } = opts
  const res  = await apiClient.get<MessagesPageDto>(`/chats/${chatId}/messages`, {
    params: { limit, before: before ?? undefined },
  })
  const myId = getMyUserId()

  // удалённые сообщения не показываем вообще — ни истории, ни плейсхолдера "Сообщение удалено"
  const messages: Message[] = [...res.data.items].reverse()
    .filter(dto => dto.status !== 'deleted')
    .map(dto => ({
      id:             nextMessageId(),
      messageId:      dto.id,
      text:           dto.content,
      own:            dto.senderId === myId,
      // history отдаёт только уже персистентные (не deleted) сообщения — для своих это
      // всегда минимум 'sent'; без этого поля галочка "отправлено/прочитано" пропадала
      // у любого своего сообщения после перезахода в чат (в т.ч. у пересланных)
      status:         dto.senderId === myId ? 'sent' as const : undefined,
      senderId:       dto.senderId,
      senderName:     dto.senderName,
      senderInitials: initials(dto.senderName),
      senderColor:     dto.senderAvatarColor,
      senderAvatarUrl: dto.senderAvatarUrl,
      time:           formatMessageTime(dto.sentAt),
      sentAt:         dto.sentAt,
      attachments: dto.attachments.map(a => ({
        fileUrl:         a.fileUrl,
        fileName:        a.fileName,
        fileContentType: a.contentType,
        fileSizeBytes:   a.fileSizeBytes,
      })),
      forwardedFromUserId:   dto.forwardedFromUserId ?? undefined,
      forwardedFromUserName: dto.forwardedFromUserName ?? undefined,
      replyToMessageId:   dto.replyToMessageId ?? undefined,
      replyToSenderName:  dto.replyToSenderName ?? undefined,
      replyToContent:     dto.replyToContent,
      kind:            dto.kind,
      systemEventType: dto.systemEventType ?? undefined,
      targetUserId:    dto.targetUserId ?? undefined,
      targetUserName:  dto.targetUserName ?? undefined,
      reactions:       dto.reactions ?? [],
    }))

  return { messages, nextCursor: res.data.nextCursor }
}

/** Отмечает чат прочитанным текущим пользователем — двигает LastReadAt, чтобы собеседник
 *  увидел галочки "прочитано" в реальном времени (событие MessagesRead по SignalR). */
export async function markChatRead(chatId: string): Promise<void> {
  await apiClient.post(`/chats/${chatId}/read`)
}

/** Создаёт (или возвращает существующий) личный чат с пользователем — идемпотентно. */
export async function createDirectChat(otherUserId: string): Promise<string> {
  const res = await apiClient.post<string>('/chats/direct', { otherUserId })
  return res.data
}

/** Создаёт новый групповой чат — текущий пользователь становится владельцем. */
export async function createGroupChat(name: string, memberIds: string[], avatarColor?: string): Promise<string> {
  const res = await apiClient.post<string>('/chats/group', { name, memberIds, avatarColor })
  return res.data
}

/** Добавляет участника в групповой чат (доступно admin/owner). */
export async function addChatMember(chatId: string, userId: string): Promise<void> {
  await apiClient.post(`/chats/${chatId}/members`, { userId })
}

/** Обновляет название/аватарку/цвет группового чата (доступно admin/owner). */
export async function updateChat(chatId: string, patch: { name?: string; avatarUrl?: string; avatarColor?: string }): Promise<void> {
  await apiClient.patch(`/chats/${chatId}`, patch)
}

/** Загружает (и заменяет предыдущую) аватарку группового чата — доступно admin/owner. */
export async function uploadChatAvatar(chatId: string, file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await apiClient.post<{ url: string }>(`/chats/${chatId}/avatar`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data.url
}

/** Удаляет аватарку группового чата — доступно admin/owner. */
export async function removeChatAvatar(chatId: string): Promise<void> {
  await apiClient.delete(`/chats/${chatId}/avatar`)
}

/** Детальная информация о чате с резолвленными данными участников (имя, аватар, онлайн). */
export async function fetchChatDetail(chatId: string): Promise<GroupMember[]> {
  const res = await apiClient.get<ChatDetailDto>(`/chats/${chatId}`)
  return res.data.members.map(m => ({
    userId:    m.userId,
    name:      m.displayName,
    initials:  initials(m.displayName),
    color:     m.avatarColor,
    avatarUrl: m.avatarUrl,
    role:      m.role,
    online:    m.online,
  }))
}

/** Полностью удаляет личный чат — для обеих сторон. */
export async function deleteChat(chatId: string): Promise<void> {
  await apiClient.delete(`/chats/${chatId}`)
}

/** Выйти из группового чата (или удалить участника, если передан другой userId). */
export async function leaveGroupChat(chatId: string, userId: string): Promise<void> {
  await apiClient.delete(`/chats/${chatId}/members/${userId}`)
}

/** Изменить роль участника группового чата — только Owner может назначать/снимать Admin. */
export async function setMemberRole(chatId: string, userId: string, role: 'admin' | 'member'): Promise<void> {
  await apiClient.patch(`/chats/${chatId}/members/${userId}/role`, { role })
}

/** Отправка сообщения через REST (а не SignalR) — нужна, чтобы отправить самое первое
 *  сообщение в только что созданный чат до того, как клиент вступит в его SignalR-группу. */
export async function sendMessageRest(chatId: string, content: string): Promise<string> {
  const res = await apiClient.post<string>(`/chats/${chatId}/messages`, { content })
  return res.data
}
