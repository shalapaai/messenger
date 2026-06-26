import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr'
import { getAccessToken } from '../lib/auth/authTokens'

// ── Типы событий от сервера ───────────────────────────────────────────────────

export interface IncomingMessage {
  messageId: string
  chatId: string
  senderId: string
  content: string
  sentAt: string
}

export interface MessageEdited {
  messageId: string
  chatId: string
  newContent: string
  editedAt: string
}

export interface TypingEvent {
  userId: string
  chatId: string
}

export interface UserOnlineEvent {
  userId: string
  isOnline: boolean
}

// ── Клиент ────────────────────────────────────────────────────────────────────

export class SignalRClient {
  private connection: HubConnection

  constructor() {
    this.connection = new HubConnectionBuilder()
      .withUrl('/hubs/messenger', {
        // Токен передаётся через query string — WebSocket не поддерживает заголовки
        accessTokenFactory: () => getAccessToken() ?? '',
      })
      .withAutomaticReconnect({
        // 0s, 2s, 10s, 30s — потом каждые 30s
        nextRetryDelayInMilliseconds: (ctx) => {
          if (ctx.previousRetryCount < 1) return 0
          if (ctx.previousRetryCount < 2) return 2_000
          if (ctx.previousRetryCount < 3) return 10_000
          return 30_000
        },
      })
      .configureLogging(LogLevel.Warning)
      .build()
  }

  // ── Подключение ───────────────────────────────────────────────────────────

  async connect(): Promise<void> {
    if (this.connection.state === HubConnectionState.Disconnected) {
      await this.connection.start()
    }
  }

  async disconnect(): Promise<void> {
    await this.connection.stop()
  }

  get isConnected(): boolean {
    return this.connection.state === HubConnectionState.Connected
  }

  // ── Действия клиента → сервер ─────────────────────────────────────────────

  joinChat(chatId: string): Promise<void> {
    return this.connection.invoke('JoinChat', chatId)
  }

  leaveChat(chatId: string): Promise<void> {
    return this.connection.invoke('LeaveChat', chatId)
  }

  sendMessage(chatId: string, content: string, replyToMessageId?: string): Promise<{ messageId: string }> {
    return this.connection.invoke('SendMessage', { chatId, content, replyToMessageId })
  }

  startTyping(chatId: string): Promise<void> {
    return this.connection.invoke('StartTyping', chatId)
  }

  stopTyping(chatId: string): Promise<void> {
    return this.connection.invoke('StopTyping', chatId)
  }

  // ── Подписки на события сервера ───────────────────────────────────────────

  onReceiveMessage(handler: (msg: IncomingMessage) => void): () => void {
    this.connection.on('ReceiveMessage', handler)
    return () => this.connection.off('ReceiveMessage', handler)
  }

  onMessageEdited(handler: (event: MessageEdited) => void): () => void {
    this.connection.on('MessageEdited', handler)
    return () => this.connection.off('MessageEdited', handler)
  }

  onUserTyping(handler: (event: TypingEvent) => void): () => void {
    this.connection.on('UserTyping', handler)
    return () => this.connection.off('UserTyping', handler)
  }

  onUserStoppedTyping(handler: (event: TypingEvent) => void): () => void {
    this.connection.on('UserStoppedTyping', handler)
    return () => this.connection.off('UserStoppedTyping', handler)
  }

  onUserOnline(handler: (event: UserOnlineEvent) => void): () => void {
    this.connection.on('UserOnline', handler)
    return () => this.connection.off('UserOnline', handler)
  }

  onReconnecting(handler: () => void): void {
    this.connection.onreconnecting(() => handler())
  }

  onReconnected(handler: () => void): void {
    this.connection.onreconnected(() => handler())
  }

  onDisconnected(handler: () => void): void {
    this.connection.onclose(() => handler())
  }
}

// Синглтон — одно соединение на всё приложение
export const signalR = new SignalRClient()
