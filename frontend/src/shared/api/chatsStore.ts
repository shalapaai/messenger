import { create } from 'zustand'
import type { Chat } from '../types/messenger'
import type { IncomingMessage } from './signalrClient'

export type { Chat }

import { CHATS as STUB_CHATS } from '../lib/messenger/stubData'

interface ChatsState {
  chats: Chat[]
  loadChats: () => Promise<void>
  handleNewMessage: (msg: IncomingMessage, activeChatId: string | null) => void
  resetUnread: (chatId: string) => void
}

export const useChatsStore = create<ChatsState>((set) => ({
  chats: STUB_CHATS,

  loadChats: async () => {
    const { fetchChats } = await import('./chatsApi')
    const chats = await fetchChats()
    set({ chats })
  },

  handleNewMessage: (msg, activeChatId) => set((state) => {
    const time = new Date(msg.sentAt).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })
    const chats = state.chats.map(chat =>
      chat.id === msg.chatId
        ? {
            ...chat,
            preview: msg.content,
            time,
            // не считаем непрочитанными если чат сейчас открыт
            unread: msg.chatId === activeChatId ? chat.unread : chat.unread + 1,
          }
        : chat
    )
    // переносим обновлённый чат наверх списка
    const idx = chats.findIndex(c => c.id === msg.chatId)
    if (idx > 0) {
      const [chat] = chats.splice(idx, 1)
      chats.unshift(chat)
    }
    return { chats }
  }),

  resetUnread: (chatId) => set((state) => ({
    chats: state.chats.map(chat =>
      chat.id === chatId ? { ...chat, unread: 0 } : chat
    ),
  })),
}))
