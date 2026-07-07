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
  loadChats: () => Promise<void>
  handleNewMessage: (msg: IncomingMessage, activeChatId: string | null) => void
  handleMessagesRead: (chatId: string, readerId: string, readAt: string) => void
  handleMessageDeleted: (chatId: string, messageId: string) => void
  handleUserProfileUpdated: (event: UserProfileUpdatedEvent) => void
  resetUnread: (chatId: string) => void
  removeChat: (chatId: string) => void
}

// Вне store'а — общий на все компоненты, переживает конкурентные вызовы loadChats() из
// разных мест (эффект в MessengerPage, ChatUpdated, новое сообщение в ещё не открытый чат
// и т.п.), схлопывая их в один запрос, а не запуская параллельные fetchChats().
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
        // Сервер не хранит unread — это чисто клиентский счётчик, накопленный live-событиями.
        // fetchChats() всегда возвращает unread: 0, так что наивная замена всего chats затирала
        // бы счётчики ВСЕХ чатов нулём при каждом loadChats() — а его вызывают в том числе по
        // поводу, не связанному с конкретным чатом (переименование группы, аватар, ChatUpdated
        // от чужого чата и т.п.). Переносим уже накопленное значение по каждому известному чату.
        const prevUnreadById = new Map(get().chats.map(c => [c.id, c.unread]))
        const chats = fetched.map(c => ({ ...c, unread: prevUnreadById.get(c.id) ?? c.unread }))
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
    // свои же сообщения (обычные — в открытом чате, пересланные — в любой) никогда не непрочитанные;
    // без этой проверки пересылка в чат, который сейчас не открыт, помечала бы его непрочитанным
    // собственным же сообщением отправителя
    const isOwnMessage = msg.senderId === getMyUserId()

    if (!target) {
      // Чата ещё нет в списке (собеседник только что создал его первым сообщением) — тянем
      // список целиком, сервер уже посчитает верный unreadCount сам; +1 вручную задвоило бы счётчик.
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
      chats: state.chats.map(chat =>
        chat.id === chatId ? { ...chat, otherReadAt: readAt } : chat
      ),
    }
  }),

  // Превью/unread в списке чатов резолвятся только сервером (GetChats) — если удалённое
  // сообщение было последним в чате, локально нечем его заменить, поэтому просто перезапрашиваем
  // список целиком. Не в этом чате прямо сейчас — правки в открытой переписке уже применяет
  // useChatMessages, а список чатов слушает это событие отдельно и глобально (см. ConnectedLayout).
  handleMessageDeleted: (chatId, messageId) => {
    const chat = get().chats.find(c => c.id === chatId)
    if (!chat || chat.lastMessageId !== messageId) return
    get().loadChats()
  },

  // Имя/аватарка личного чата без своего названия — это резолвленный displayName собеседника
  // (см. GetChatsQueryHandler), поэтому патчим только чаты, где он в роли otherUserId; у групп
  // своё название, к профилю конкретного участника не привязанное.
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
