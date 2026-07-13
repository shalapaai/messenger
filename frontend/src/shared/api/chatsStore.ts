import { create } from 'zustand'
import type { Chat } from '../types/messenger'
import type { IncomingMessage, UserProfileUpdatedEvent } from './signalrClient'
import { fetchChats, initials } from './chatsApi'
import { useOnlineStore } from './onlineStore'
import { getMyUserId } from '../lib/auth/authTokens'
import { formatChatListTime } from '../lib/formatDateTime'
import i18n from '../i18n'

export type { Chat }

interface ChatsState {
  chats: Chat[]
  chatsLoaded: boolean
  chatsError: boolean
  loadChats: () => Promise<void>
  handleNewMessage: (msg: IncomingMessage, activeChatId: string | null) => void
  handleMessagesRead: (chatId: string, readerId: string, readAt: string) => void
  handleMessageDeleted: (chatId: string, messageId: string) => void
  handleUserProfileUpdated: (event: UserProfileUpdatedEvent) => void
  resetUnread: (chatId: string) => void
  removeChat: (chatId: string) => void
  reset: () => void
}

let loadChatsInFlight: Promise<void> | null = null

export const useChatsStore = create<ChatsState>((set, get) => ({
  chats: [],
  chatsLoaded: false,
  chatsError: false,

  loadChats: () => {
    if (loadChatsInFlight) return loadChatsInFlight

    loadChatsInFlight = (async () => {
      set({ chatsError: false })
      try {
        const fetched = await fetchChats()
        set({ chats: fetched, chatsLoaded: true })
        const { setOnline } = useOnlineStore.getState()
        fetched.forEach(chat => {
          if (chat.otherUserId) setOnline(chat.otherUserId, chat.online)
        })
      } catch {
        set({ chatsError: true })
      } finally {
        loadChatsInFlight = null
      }
    })()

    return loadChatsInFlight
  },

  handleNewMessage: (msg, activeChatId) => {
    const target = get().chats.find(c => c.id === msg.chatId)
    const isOwnMessage = msg.senderId === getMyUserId()

    if (!target) {
      get().loadChats().then(() => {
        set((s) => ({
          chats: s.chats.map(c =>
            c.id === msg.chatId ? { ...c, lastMessageId: msg.messageId } : c
          ),
        }))
      })
      return
    }

    if (target.lastMessageId === msg.messageId) return

    set((state) => {
      const time = formatChatListTime(msg.sentAt)
      const firstAttachment = msg.attachments?.[0]
      const preview = msg.kind === 'System' ? i18n.t('messenger.systemPreviewGeneric') : msg.content
      const chats = state.chats.map(chat =>
        chat.id === msg.chatId
          ? {
              ...chat,
              preview,
              previewAttachmentUrl: firstAttachment?.fileUrl,
              previewAttachmentContentType: firstAttachment?.fileContentType,
              previewAttachmentFileName: firstAttachment?.fileName,
              time,
              lastMessageId: msg.messageId,
              unread: (msg.chatId === activeChatId || isOwnMessage) ? chat.unread : chat.unread + 1,
            }
          : chat
      )
      const idx = chats.findIndex(c => c.id === msg.chatId)
      if (idx > 0) {
        const [chat] = chats.splice(idx, 1)
        chats.unshift(chat)
      }
      return { chats }
    })
  },

  handleMessagesRead: (chatId, readerId, readAt) => set((state) => {
    if (readerId === getMyUserId()) {
      return {
        chats: state.chats.map(chat =>
          chat.id === chatId ? { ...chat, unread: 0 } : chat
        ),
      }
    }
    return {
      chats: state.chats.map(chat => {
        if (chat.id !== chatId) return chat
        const prev = chat.otherReadAt
        const isNewer = !prev || new Date(readAt).getTime() > new Date(prev).getTime()
        return isNewer ? { ...chat, otherReadAt: readAt } : chat
      }),
    }
  }),

  handleMessageDeleted: (chatId, messageId) => {
    const chat = get().chats.find(c => c.id === chatId)
    if (!chat || chat.lastMessageId !== messageId) return
    get().loadChats()
  },

  handleUserProfileUpdated: (event) => set((state) => ({
    chats: state.chats.map(chat =>
      chat.otherUserId === event.userId
        ? { ...chat, name: event.displayName, initials: initials(event.displayName), avatarUrl: event.avatarUrl, color: event.avatarColor }
        : chat
    ),
  })),

  resetUnread: (chatId) => set((state) => ({
    chats: state.chats.map(chat =>
      chat.id === chatId ? { ...chat, unread: 0 } : chat
    ),
  })),

  removeChat: (chatId) => set((state) => ({
    chats: state.chats.filter(chat => chat.id !== chatId),
  })),

  reset: () => {
    loadChatsInFlight = null
    set({ chats: [], chatsLoaded: false, chatsError: false })
  },
}))
