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

export interface UploadedMessageResult {
  messageId: string
  content: string
  fileUrl: string
  fileName: string
  contentType: string
  fileSizeBytes: number
  sentAt: string
}

/** Загружает файл и отправляет его как сообщение — сервер не эхо-шлёт отправителю его же
 *  сообщение по SignalR, поэтому клиент строит bubble сам из этого ответа (см. useChatMessages). */
export async function uploadChatMessageFile(
  chatId: string,
  file: File,
  caption?: string,
  onUploadProgress?: (percent: number) => void,
): Promise<UploadedMessageResult> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await apiClient.post<UploadedMessageResult>(
    `/chats/${chatId}/messages/upload`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      params: caption ? { caption } : undefined,
      onUploadProgress: onUploadProgress && ((event) => {
        if (!event.total) return
        onUploadProgress(Math.round((event.loaded / event.total) * 100))
      }),
    }
  )
  return res.data
}
