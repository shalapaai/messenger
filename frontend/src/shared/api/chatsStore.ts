import { create } from 'zustand'
import type { Chat } from '../types/messenger'
import type { IncomingMessage } from './signalrClient'
import { fetchChats } from './chatsApi'
import { useOnlineStore } from './onlineStore'
import { getMyUserId } from '../lib/auth/authTokens'

export type { Chat }

interface ChatsState {
  chats: Chat[]
  /** false пока не загрузили реальные чаты из API — chats пуст, в списке показываем скелетон */
  chatsLoaded: boolean
  /** true если последняя попытка loadChats() упала — список показывает ошибку с кнопкой "Повторить" */
  chatsError: boolean
  loadChats: () => Promise<void>
  handleNewMessage: (msg: IncomingMessage, activeChatId: string | null) => void
  handleMessagesRead: (chatId: string, readerId: string, readAt: string) => void
  resetUnread: (chatId: string) => void
  removeChat: (chatId: string) => void
}

export const useChatsStore = create<ChatsState>((set, get) => ({
  chats: [],
  chatsLoaded: false,
  chatsError: false,

  loadChats: async () => {
    set({ chatsError: false })
    try {
      const chats = await fetchChats()
      set({ chats, chatsLoaded: true })
      // засеваем начальный онлайн-статус собеседников; дальше его обновляют live-события UserOnline
      const { setOnline } = useOnlineStore.getState()
      chats.forEach(chat => {
        if (chat.otherUserId) setOnline(chat.otherUserId, chat.online)
      })
    } catch {
      set({ chatsError: true })
    }
  },

  handleNewMessage: (msg, activeChatId) => {
    const target = get().chats.find(c => c.id === msg.chatId)

    if (!target) {
      // сообщение пришло в чат, которого ещё нет в списке — собеседник только что создал
      // его первым сообщением. Подтягиваем список целиком, чтобы чат появился сразу,
      // без перезагрузки страницы.
      get().loadChats().then(() => {
        if (msg.chatId === activeChatId) return
        set((s) => ({
          chats: s.chats.map(c =>
            c.id === msg.chatId ? { ...c, unread: c.unread + 1, lastMessageId: msg.messageId } : c
          ),
        }))
      })
      return
    }

    // сервер шлёт ReceiveMessage и в группу чата, и в личную группу участника —
    // если получатель уже состоит в обеих (обычное дело), событие приходит дважды
    if (target.lastMessageId === msg.messageId) return

    set((state) => {
      const time = new Date(msg.sentAt).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })
      const chats = state.chats.map(chat =>
        chat.id === msg.chatId
          ? {
              ...chat,
              preview: msg.content,
              time,
              lastMessageId: msg.messageId,
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
    })
  },

  handleMessagesRead: (chatId, readerId, readAt) => set((state) => {
    // otherReadAt — момент, до которого СОБЕСЕДНИК прочитал переписку;
    // если readerId — это я сам (прочитал с другого устройства), это событие не про него
    if (readerId === getMyUserId()) return state
    return {
      chats: state.chats.map(chat =>
        chat.id === chatId ? { ...chat, otherReadAt: readAt } : chat
      ),
    }
  }),

  resetUnread: (chatId) => set((state) => ({
    chats: state.chats.map(chat =>
      chat.id === chatId ? { ...chat, unread: 0 } : chat
    ),
  })),

  removeChat: (chatId) => set((state) => ({
    chats: state.chats.filter(chat => chat.id !== chatId),
  })),
}))
