import { apiClient } from './apiClient'

export async function deleteMessage(chatId: string, messageId: string): Promise<void> {
  await apiClient.delete(`/chats/${chatId}/messages/${messageId}`)
}

/** Удаляет несколько сообщений одним запросом вместо отдельного DELETE на каждое. */
export async function deleteMessages(chatId: string, messageIds: string[]): Promise<void> {
  await apiClient.post(`/chats/${chatId}/messages/delete-bulk`, { messageIds })
}

export async function editMessage(chatId: string, messageId: string, newContent: string): Promise<void> {
  await apiClient.patch(`/chats/${chatId}/messages/${messageId}`, { newContent })
}

/** Пересылает сообщения из sourceChatId в targetChatId — копии создаются от имени
 *  текущего пользователя с пометкой "переслано от" оригинального автора. */
export async function forwardMessages(targetChatId: string, sourceChatId: string, messageIds: string[]): Promise<void> {
  await apiClient.post(`/chats/${targetChatId}/messages/forward`, { sourceChatId, messageIds })
}
