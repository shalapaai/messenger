import { apiClient } from './apiClient'

export async function deleteMessage(chatId: string, messageId: string): Promise<void> {
  await apiClient.delete(`/chats/${chatId}/messages/${messageId}`)
}

export async function deleteMessages(chatId: string, messageIds: string[]): Promise<void> {
  await apiClient.post(`/chats/${chatId}/messages/delete-bulk`, { messageIds })
}

export async function editMessage(chatId: string, messageId: string, newContent: string): Promise<void> {
  await apiClient.patch(`/chats/${chatId}/messages/${messageId}`, { newContent })
}

export async function setMessageReaction(chatId: string, messageId: string, emoji: string | null): Promise<void> {
  await apiClient.put(`/chats/${chatId}/messages/${messageId}/reaction`, { emoji })
}

export async function forwardMessages(targetChatId: string, sourceChatId: string, messageIds: string[]): Promise<void> {
  await apiClient.post(`/chats/${targetChatId}/messages/forward`, { sourceChatId, messageIds })
}

export async function createPoll(chatId: string, question: string, options: string[]): Promise<string> {
  const res = await apiClient.post<string>(`/chats/${chatId}/polls`, { question, options })
  return res.data
}

export async function votePoll(chatId: string, messageId: string, optionId: string): Promise<void> {
  await apiClient.put(`/chats/${chatId}/polls/${messageId}/vote`, { optionId })
}

export async function retractPollVote(chatId: string, messageId: string): Promise<void> {
  await apiClient.delete(`/chats/${chatId}/polls/${messageId}/vote`)
}

export interface UploadedAttachment {
  fileUrl: string
  fileName: string
  contentType: string
  fileSizeBytes: number
}

export interface UploadedMessageResult {
  messageId: string
  content: string
  attachments: UploadedAttachment[]
  sentAt: string
}

export async function uploadChatMessageFiles(
  chatId: string,
  files: File[],
  caption?: string,
  onUploadProgress?: (percent: number) => void,
): Promise<UploadedMessageResult> {
  const formData = new FormData()
  files.forEach(file => formData.append('files', file))
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
