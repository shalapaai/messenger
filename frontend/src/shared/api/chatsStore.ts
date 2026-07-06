import { create } from 'zustand'
import type { Chat } from '../types/messenger'
import type { IncomingMessage } from './signalrClient'
import { fetchChats } from './chatsApi'
import { useOnlineStore } from './onlineStore'
import { getMyUserId } from '../lib/auth/authTokens'
import { formatChatListTime } from '../lib/formatDateTime'

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
      // сообщение пришло в чат, которого ещё нет в списке — собеседник только что создал
      // его первым сообщением. Подтягиваем список целиком, чтобы чат появился сразу, без
      // перезагрузки страницы — сервер уже отдаст верный unreadCount для него (сообщение
      // к этому моменту уже сохранено в БД), вручную прибавлять +1 НЕЛЬЗЯ: это задвоило бы
      // счётчик (сервер и так его уже посчитал). lastMessageId всё равно проставляем — иначе
      // повторная доставка этого же сообщения (chat-группа + личная группа) не задедуплицируется.
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
      const chats = state.chats.map(chat =>
        chat.id === msg.chatId
          ? {
              ...chat,
              preview: msg.content,
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

  resetUnread: (chatId) => set((state) => ({
    chats: state.chats.map(chat =>
      chat.id === chatId ? { ...chat, unread: 0 } : chat
    ),
  })),

  removeChat: (chatId) => set((state) => ({
    chats: state.chats.filter(chat => chat.id !== chatId),
  })),
}))
