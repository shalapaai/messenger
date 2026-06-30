import { apiClient } from './apiClient'
import { getMyUserId } from '../lib/auth/authTokens'
import i18n, { getCurrentLocale } from '../i18n'
import type { Chat, Message } from '../types/messenger'

// ── DTO-формы от сервера ──────────────────────────────────────────────────────

interface LastMessageDto { messageId: string; senderId: string; content: string; sentAt: string }
interface ChatSummaryDto { id: string; type: 'direct' | 'group'; name: string | null; avatarUrl: string | null; avatarColor: string | null; lastMessage: LastMessageDto | null; otherUserId: string | null; isOnline: boolean }
interface MessageDto     { id: string; chatId: string; senderId: string; senderName: string; senderAvatarUrl: string | null; senderAvatarColor: string; content: string; fileUrl: string | null; status: string; sentAt: string; editedAt: string | null }
interface MessagesPageDto { items: MessageDto[]; nextCursor: string | null }

// ── Вспомогательные ──────────────────────────────────────────────────────────

const COLORS = ['#2C5BF0', '#7A5BF0', '#22B07D', '#F0902C', '#E0556E', '#2CA6C9', '#9B59B6']

/** Детерминированный цвет аватарки по id — один и тот же человек всегда одного цвета,
 *  независимо от того, пришло сообщение из истории (REST) или realtime (SignalR). */
export function colorFromId(id: string): string {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0
  return COLORS[Math.abs(h) % COLORS.length]
}

/** Инициалы из displayName — общий хелпер для REST-истории и realtime-сообщений. */
export function initials(name: string | null): string {
  if (!name) return '?'
  const w = name.trim().split(/\s+/)
  return w.length >= 2 ? (w[0][0] + w[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase()
}

function formatTime(iso: string): string {
  const d   = new Date(iso)
  const now = new Date()
  const locale = getCurrentLocale()
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return i18n.t('common.yesterday')
  return d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' })
}

function formatDate(iso: string): string {
  const d   = new Date(iso)
  const now = new Date()
  const locale = getCurrentLocale()
  if (d.toDateString() === now.toDateString()) return i18n.t('common.today')
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return i18n.t('common.yesterday')
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'long' })
}

let _msgId = 100_000

/** Единый источник локальных (клиентских) ID сообщений — и для истории, и для realtime,
 *  и для оптимистичной отправки, чтобы не пересекались разные счётчики/стратегии. */
export function nextMessageId(): number {
  return _msgId++
}

// ── Публичные функции ─────────────────────────────────────────────────────────

export async function fetchChats(): Promise<Chat[]> {
  const res = await apiClient.get<ChatSummaryDto[]>('/chats')
  return res.data.map(dto => ({
    id:          dto.id,
    name:        dto.name ?? i18n.t('messenger.tabs.direct'),
    initials:    initials(dto.name),
    color:       dto.avatarColor ?? colorFromId(dto.id),
    avatarUrl:   dto.avatarUrl,
    preview:     dto.lastMessage?.content ?? '',
    time:        dto.lastMessage ? formatTime(dto.lastMessage.sentAt) : '',
    unread:      0,
    online:      dto.isOnline,
    group:       dto.type === 'group',
    otherUserId: dto.otherUserId ?? undefined,
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

  const messages: Message[] = [...res.data.items].reverse().map(dto => ({
    id:             nextMessageId(),
    messageId:      dto.id,
    text:           dto.content,
    own:            dto.senderId === myId,
    senderId:       dto.senderId,
    senderName:     dto.senderName,
    senderInitials: initials(dto.senderName),
    senderColor:     dto.senderAvatarColor,
    senderAvatarUrl: dto.senderAvatarUrl,
    time:           formatTime(dto.sentAt),
    date:           formatDate(dto.sentAt),
    deleted:        dto.status === 'deleted',
  }))

  return { messages, nextCursor: res.data.nextCursor }
}

/** Создаёт (или возвращает существующий) личный чат с пользователем — идемпотентно. */
export async function createDirectChat(otherUserId: string): Promise<string> {
  const res = await apiClient.post<string>('/chats/direct', { otherUserId })
  return res.data
}

/** Полностью удаляет личный чат — для обеих сторон. */
export async function deleteChat(chatId: string): Promise<void> {
  await apiClient.delete(`/chats/${chatId}`)
}

/** Выйти из группового чата (или удалить участника, если передан другой userId). */
export async function leaveGroupChat(chatId: string, userId: string): Promise<void> {
  await apiClient.delete(`/chats/${chatId}/members/${userId}`)
}

/** Отправка сообщения через REST (а не SignalR) — нужна, чтобы отправить самое первое
 *  сообщение в только что созданный чат до того, как клиент вступит в его SignalR-группу. */
export async function sendMessageRest(chatId: string, content: string): Promise<string> {
  const res = await apiClient.post<string>(`/chats/${chatId}/messages`, { content })
  return res.data
}
