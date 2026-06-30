import { create } from 'zustand'
import type { Chat } from '../types/messenger'
import type { IncomingMessage } from './signalrClient'
import { fetchChats } from './chatsApi'
import { useOnlineStore } from './onlineStore'

export type { Chat }

interface ChatsState {
  chats: Chat[]
  /** false пока не загрузили реальные чаты из API — chats пуст, в списке показываем скелетон */
  chatsLoaded: boolean
  loadChats: () => Promise<void>
  handleNewMessage: (msg: IncomingMessage, activeChatId: string | null) => void
  resetUnread: (chatId: string) => void
}

export const useChatsStore = create<ChatsState>((set) => ({
  chats: [],
  chatsLoaded: false,

  loadChats: async () => {
    const chats = await fetchChats()
    set({ chats, chatsLoaded: true })
    // засеваем начальный онлайн-статус собеседников; дальше его обновляют live-события UserOnline
    const { setOnline } = useOnlineStore.getState()
    chats.forEach(chat => {
      if (chat.otherUserId) setOnline(chat.otherUserId, chat.online)
    })
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
