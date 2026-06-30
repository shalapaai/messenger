import { apiClient } from './apiClient'
import { getMyUserId } from '../lib/auth/authTokens'
import type { Chat, Message } from '../types/messenger'

// ── DTO-формы от сервера ──────────────────────────────────────────────────────

interface LastMessageDto { messageId: string; senderId: string; content: string; sentAt: string }
interface ChatSummaryDto { id: string; type: 'direct' | 'group'; name: string | null; avatarUrl: string | null; lastMessage: LastMessageDto | null; otherUserId: string | null; isOnline: boolean }
interface MessageDto     { id: string; chatId: string; senderId: string; senderName: string; senderAvatarUrl: string | null; content: string; fileUrl: string | null; status: string; sentAt: string; editedAt: string | null }
interface MessagesPageDto { items: MessageDto[]; nextCursor: string | null }

// ── Вспомогательные ──────────────────────────────────────────────────────────

const COLORS = ['#2C5BF0', '#7A5BF0', '#22B07D', '#F0902C', '#E0556E', '#2CA6C9', '#9B59B6']

function colorFromId(id: string): string {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0
  return COLORS[Math.abs(h) % COLORS.length]
}

function initials(name: string | null): string {
  if (!name) return '?'
  const w = name.trim().split(/\s+/)
  return w.length >= 2 ? (w[0][0] + w[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase()
}

function formatTime(iso: string): string {
  const d   = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Вчера'
  return d.toLocaleDateString('ru', { day: '2-digit', month: '2-digit' })
}

function formatDate(iso: string): string {
  const d   = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return 'Сегодня'
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Вчера'
  return d.toLocaleDateString('ru', { day: 'numeric', month: 'long' })
}

let _msgId = 100_000

// ── Публичные функции ─────────────────────────────────────────────────────────

export async function fetchChats(): Promise<Chat[]> {
  const res = await apiClient.get<ChatSummaryDto[]>('/chats')
  return res.data.map(dto => ({
    id:          dto.id,
    name:        dto.name ?? 'Личный чат',
    initials:    initials(dto.name),
    color:       colorFromId(dto.id),
    preview:     dto.lastMessage?.content ?? '',
    time:        dto.lastMessage ? formatTime(dto.lastMessage.sentAt) : '',
    unread:      0,
    online:      dto.isOnline,
    group:       dto.type === 'group',
    otherUserId: dto.otherUserId ?? undefined,
  }))
}

export async function fetchMessages(chatId: string, limit = 50): Promise<{ messages: Message[]; nextCursor: string | null }> {
  const res   = await apiClient.get<MessagesPageDto>(`/chats/${chatId}/messages`, { params: { limit } })
  const myId  = getMyUserId()

  const messages: Message[] = [...res.data.items].reverse().map(dto => ({
    id:             _msgId++,
    messageId:      dto.id,
    text:           dto.content,
    own:            dto.senderId === myId,
    senderId:       dto.senderId,
    senderName:     dto.senderName,
    senderInitials: initials(dto.senderName),
    senderColor:    colorFromId(dto.senderId),
    time:           formatTime(dto.sentAt),
    date:           formatDate(dto.sentAt),
  }))

  return { messages, nextCursor: res.data.nextCursor }
}
