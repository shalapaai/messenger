import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr'
import { getAccessToken } from '../lib/auth/authTokens'

export interface IncomingAttachment {
  fileUrl: string
  fileName: string
  fileContentType: string
  fileSizeBytes: number
}

export interface IncomingMessage {
  messageId: string
  chatId: string
  senderId: string
  senderName: string
  senderAvatarUrl: string | null
  senderAvatarColor: string
  content: string
  sentAt: string
  attachments?: IncomingAttachment[]
  forwardedFromUserId?: string | null
  forwardedFromUserName?: string | null
  replyToMessageId?: string | null
  replyToSenderName?: string | null
  replyToContent?: string | null
  kind?: 'Text' | 'System'
  systemEventType?: 'MemberAdded' | 'MemberLeft' | 'MemberRemoved'
  targetUserId?: string | null
  targetUserName?: string | null
}

export interface MessageEdited {
  messageId: string
  chatId: string
  newContent: string
  editedAt: string
}

export interface MessageDeleted {
  messageId: string
  chatId: string
}

export interface MessageReactionChanged {
  messageId: string
  chatId: string
  userId: string
  userName: string
  userAvatarUrl: string | null
  userAvatarColor: string
  emoji: string | null
}

export interface MessagesReadEvent {
  chatId: string
  readerId: string
  readAt: string
}

export interface TypingEvent {
  userId: string
  chatId: string
}

export interface UserOnlineEvent {
  userId: string
  isOnline: boolean
}

export interface ChatUpdatedEvent {
  chatId: string
}

export interface UserProfileUpdatedEvent {
  userId: string
  displayName: string
  avatarUrl: string | null
  avatarColor: string
}

export class SignalRClient {
  private connection: HubConnection
  private _onReconnecting: (() => void) | null = null
  private _onReconnected:  (() => void) | null = null
  private _onDisconnected: (() => void) | null = null

  constructor() {
    this.connection = new HubConnectionBuilder()
      .withUrl('/hubs/messenger', {
        accessTokenFactory: () => getAccessToken() ?? '',
      })
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: (ctx) => {
          if (ctx.previousRetryCount < 1) return 0
          if (ctx.previousRetryCount < 2) return 2_000
          if (ctx.previousRetryCount < 3) return 10_000
          return 30_000
        },
      })
      .configureLogging(LogLevel.Warning)
      .build()

    this.connection.onreconnecting(() => this._onReconnecting?.())
    this.connection.onreconnected(() => this._onReconnected?.())
    this.connection.onclose(() => this._onDisconnected?.())
  }

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

  onReceiveMessage(handler: (msg: IncomingMessage) => void): () => void {
    this.connection.on('ReceiveMessage', handler)
    return () => this.connection.off('ReceiveMessage', handler)
  }

  onMessageEdited(handler: (event: MessageEdited) => void): () => void {
    this.connection.on('MessageEdited', handler)
    return () => this.connection.off('MessageEdited', handler)
  }

  onMessageDeleted(handler: (event: MessageDeleted) => void): () => void {
    this.connection.on('MessageDeleted', handler)
    return () => this.connection.off('MessageDeleted', handler)
  }

  onMessageReactionChanged(handler: (event: MessageReactionChanged) => void): () => void {
    this.connection.on('MessageReactionChanged', handler)
    return () => this.connection.off('MessageReactionChanged', handler)
  }

  onMessagesRead(handler: (event: MessagesReadEvent) => void): () => void {
    this.connection.on('MessagesRead', handler)
    return () => this.connection.off('MessagesRead', handler)
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

  onChatUpdated(handler: (event: ChatUpdatedEvent) => void): () => void {
    this.connection.on('ChatUpdated', handler)
    return () => this.connection.off('ChatUpdated', handler)
  }

  onUserProfileUpdated(handler: (event: UserProfileUpdatedEvent) => void): () => void {
    this.connection.on('UserProfileUpdated', handler)
    return () => this.connection.off('UserProfileUpdated', handler)
  }

  onReconnecting(handler: () => void): void {
    this._onReconnecting = handler
  }

  onReconnected(handler: () => void): void {
    this._onReconnected = handler
  }

  onDisconnected(handler: () => void): void {
    this._onDisconnected = handler
  }
}

export const signalR = new SignalRClient()
