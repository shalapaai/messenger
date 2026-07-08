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
  /** false пока не загрузили реальные чаты из API — chats пуст, в списке показываем скелетон */
  chatsLoaded: boolean
  /** true если последняя попытка loadChats() упала — список показывает ошибку с кнопкой "Повторить" */
  chatsError: boolean
  /** Чат, открытый прямо сейчас — пока markChatRead ещё не дошёл до сервера,
   *  loadChats() не должен возвращать по нему старый unread с сервера. */
  activeChatId: string | null
  setActiveChatId: (chatId: string | null) => void
  loadChats: () => Promise<void>
  handleNewMessage: (msg: IncomingMessage, activeChatId: string | null) => void
  handleMessagesRead: (chatId: string, readerId: string, readAt: string) => void
  handleMessageDeleted: (chatId: string, messageId: string) => void
  handleUserProfileUpdated: (event: UserProfileUpdatedEvent) => void
  resetUnread: (chatId: string) => void
  removeChat: (chatId: string) => void
}

// Вне store'а — схлопывает конкурентные вызовы loadChats() в один запрос fetchChats().
let loadChatsInFlight: Promise<void> | null = null

export const useChatsStore = create<ChatsState>((set, get) => ({
  chats: [],
  chatsLoaded: false,
  chatsError: false,
  activeChatId: null,

  setActiveChatId: (chatId) => set({ activeChatId: chatId }),

  loadChats: () => {
    if (loadChatsInFlight) return loadChatsInFlight

    loadChatsInFlight = (async () => {
      set({ chatsError: false })
      try {
        // Сервер — источник истины для unreadCount. Исключение: активный чат в этой вкладке,
        // где markChatRead мог ещё не дойти до сервера — иначе устаревший unread вернулся бы обратно.
        const { activeChatId } = get()
        const fetched = await fetchChats()
        const chats = activeChatId
          ? fetched.map(c => c.id === activeChatId ? { ...c, unread: 0 } : c)
          : fetched
        set({ chats, chatsLoaded: true })
        // засеваем начальный онлайн-статус собеседников; дальше его обновляют live-события UserOnline
        const { setOnline } = useOnlineStore.getState()
        chats.forEach(chat => {
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
    // свои же сообщения (в т.ч. пересланные) никогда не непрочитанные, даже если чат не открыт
    const isOwnMessage = msg.senderId === getMyUserId()

    if (!target) {
      // чата ещё нет в списке — перезапрашиваем, сервер сам посчитает unreadCount;
      // +1 вручную задвоило бы счётчик
      get().loadChats().then(() => {
        set((s) => ({
          chats: s.chats.map(c =>
            c.id === msg.chatId ? { ...c, lastMessageId: msg.messageId } : c
          ),
        }))
      })
      return
    }

    // сервер шлёт ReceiveMessage и в группу чата, и в личную группу участника —
    // если получатель уже состоит в обеих (обычное дело), событие приходит дважды
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
              // не считаем непрочитанными если чат сейчас открыт или сообщение отправлено мной же
              unread: (msg.chatId === activeChatId || isOwnMessage) ? chat.unread : chat.unread + 1,
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
      chats: state.chats.map(chat => {
        if (chat.id !== chatId) return chat
        // события MessagesRead от разных участников группы могут прийти не по порядку;
        // берём максимум, чтобы устаревшее событие не откатило галочку "прочитано" назад
        const prev = chat.otherReadAt
        const isNewer = !prev || new Date(readAt).getTime() > new Date(prev).getTime()
        return isNewer ? { ...chat, otherReadAt: readAt } : chat
      }),
    }
  }),

  // если удалённое сообщение было последним в чате, локально нечем заменить превью/unread —
  // просто перезапрашиваем список целиком
  handleMessageDeleted: (chatId, messageId) => {
    const chat = get().chats.find(c => c.id === chatId)
    if (!chat || chat.lastMessageId !== messageId) return
    get().loadChats()
  },

  // имя/аватарка личного чата — это профиль собеседника, поэтому патчим только чаты,
  // где он в роли otherUserId; у групп своё название, к профилю участника не привязанное
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
}))
