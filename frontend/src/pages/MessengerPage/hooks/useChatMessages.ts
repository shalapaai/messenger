import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Message, Sender } from '../../../shared/types/messenger'
import { fetchMessages, initials, nextMessageId } from '../../../shared/api/chatsApi'
import { deleteMessage as deleteMessageApi, deleteMessages as deleteMessagesApi, editMessage as editMessageApi, setMessageReaction as setMessageReactionApi, votePoll as votePollApi, retractPollVote as retractPollVoteApi, uploadChatMessageFiles } from '../../../shared/api/messagesApi'
import { getMyUserId } from '../../../shared/lib/auth/authTokens'
import type { IncomingMessage, MessageDeleted, MessageEdited, MessageReactionChanged, PollVoteChangedEvent, UserProfileUpdatedEvent } from '../../../shared/api/signalrClient'
import { formatMessageTime } from '../../../shared/lib/formatDateTime'

type SendFn = (content: string, replyToMessageId?: string) => Promise<{ messageId: string }>

const REPLY_PREVIEW_MAX_LENGTH = 120

function truncateReplyPreview(content: string): string {
  return content.length <= REPLY_PREVIEW_MAX_LENGTH ? content : content.slice(0, REPLY_PREVIEW_MAX_LENGTH) + '…'
}

interface UseChatMessagesOptions {
  onAppend?: (smooth: boolean) => void
  onIncomingRead?: (chatId: string) => void
}

export function useChatMessages(id: string | undefined, opts: UseChatMessagesOptions = {}) {
  const [chatMessages,   setChatMessages]   = useState<Record<string, Message[]>>({})
  const [loadingInitial, setLoadingInitial] = useState<Record<string, boolean>>({})
  const [loadError,      setLoadError]      = useState<Record<string, boolean>>({})
  const [nextCursor,     setNextCursor]     = useState<Record<string, string | null>>({})
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [historyLoaded,  setHistoryLoaded]  = useState<Record<string, boolean>>({})

  const rawMessages = id ? chatMessages[id] : undefined
  const messages = useMemo(() => {
    if (!rawMessages) return []
    const seenMessageIds = new Set<string>()
    return rawMessages.filter(m => {
      if (!m.messageId) return true
      if (seenMessageIds.has(m.messageId)) return false
      seenMessageIds.add(m.messageId)
      return true
    })
  }, [rawMessages])

  const loadInitial = useCallback((chatId: string) => {
    setLoadingInitial(prev => ({ ...prev, [chatId]: true }))
    setLoadError(prev => ({ ...prev, [chatId]: false }))

    fetchMessages(chatId).then(({ messages: loaded, nextCursor: cursor }) => {
      setChatMessages(prev => ({ ...prev, [chatId]: loaded }))
      setNextCursor(prev => ({ ...prev, [chatId]: cursor }))
      setHistoryLoaded(prev => ({ ...prev, [chatId]: cursor === null }))
      setLoadingInitial(prev => ({ ...prev, [chatId]: false }))
    }).catch(() => {
      setLoadError(prev => ({ ...prev, [chatId]: true }))
      setLoadingInitial(prev => ({ ...prev, [chatId]: false }))
    })
  }, [])

  useEffect(() => {
    if (!id) return
    if (chatMessages[id] || loadingInitial[id]) return

    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) loadInitial(id)
    })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const handleIncomingMessage = useCallback((msg: IncomingMessage) => {
    // Опрос отправляется через отдельный REST-эндпоинт (не через signalRSend), поэтому у него
    // нет локального оптимистичного сообщения, которое нужно было бы не задублировать —
    // в отличие от обычного текста, здесь именно live-событие и есть единственный способ
    // добавить опрос в UI создателю.
    if (msg.senderId === getMyUserId() && !msg.forwardedFromUserId && msg.kind !== 'System' && msg.kind !== 'Poll') return

    setChatMessages(prev => {
      const chatMsgs = prev[msg.chatId]
      if (!chatMsgs) return prev
      if (chatMsgs.some(m => m.messageId === msg.messageId)) return prev

      const own = msg.senderId === getMyUserId()
      return {
        ...prev,
        [msg.chatId]: [...chatMsgs, {
          id:              nextMessageId(),
          messageId:       msg.messageId,
          text:            msg.content,
          own,
          senderId:        msg.senderId,
          senderName:      msg.senderName,
          senderInitials:  initials(msg.senderName),
          senderColor:     msg.senderAvatarColor,
          senderAvatarUrl: msg.senderAvatarUrl,
          time:            formatMessageTime(msg.sentAt),
          sentAt:          msg.sentAt,
          status:          own ? 'sent' as const : undefined,
          attachments:     msg.attachments,
          forwardedFromUserId:   msg.forwardedFromUserId ?? undefined,
          forwardedFromUserName: msg.forwardedFromUserName ?? undefined,
          replyToMessageId:   msg.replyToMessageId ?? undefined,
          replyToSenderName:  msg.replyToSenderName ?? undefined,
          replyToContent:     msg.replyToContent,
          kind:            msg.kind,
          systemEventType: msg.systemEventType ?? undefined,
          targetUserId:    msg.targetUserId ?? undefined,
          targetUserName:  msg.targetUserName ?? undefined,
          reactions:       [],
          poll: msg.pollOptions
            ? { options: msg.pollOptions.map(o => ({ id: o.id, text: o.text, voters: [] })) }
            : undefined,
        }],
      }
    })

    if (msg.chatId === id) {
      opts.onAppend?.(true)
      opts.onIncomingRead?.(msg.chatId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const handleDeletedMessage = useCallback((event: MessageDeleted) => {
    setChatMessages(prev => {
      const chatMsgs = prev[event.chatId]
      if (!chatMsgs) return prev
      return {
        ...prev,
        [event.chatId]: chatMsgs
          .filter(m => m.messageId !== event.messageId)
          .map(m => m.replyToMessageId === event.messageId ? { ...m, replyToContent: null } : m),
      }
    })
  }, [])

  const deleteMessage = useCallback(async (chatId: string, msg: Message) => {
    if (!msg.messageId) return
    await deleteMessageApi(chatId, msg.messageId)
    setChatMessages(prev => ({
      ...prev,
      [chatId]: (prev[chatId] ?? []).filter(m => m.id !== msg.id),
    }))
  }, [])

  const removeLocalMessage = useCallback((chatId: string, msg: Message) => {
    setChatMessages(prev => ({
      ...prev,
      [chatId]: (prev[chatId] ?? []).filter(m => m.id !== msg.id),
    }))
  }, [])

  const deleteMessages = useCallback(async (chatId: string, msgs: Message[]) => {
    const messageIds = msgs.map(m => m.messageId).filter((mid): mid is string => !!mid)
    if (messageIds.length === 0) return
    await deleteMessagesApi(chatId, messageIds)
    const localIds = new Set(msgs.map(m => m.id))
    setChatMessages(prev => ({
      ...prev,
      [chatId]: (prev[chatId] ?? []).filter(m => !localIds.has(m.id)),
    }))
  }, [])

  const handleEditedMessage = useCallback((event: MessageEdited) => {
    setChatMessages(prev => {
      const chatMsgs = prev[event.chatId]
      if (!chatMsgs) return prev
      const replyPreview = truncateReplyPreview(event.newContent)
      return {
        ...prev,
        [event.chatId]: chatMsgs.map(m => {
          if (m.messageId === event.messageId) return { ...m, text: event.newContent, edited: true }
          if (m.replyToMessageId === event.messageId) return { ...m, replyToContent: replyPreview }
          return m
        }),
      }
    })
  }, [])

  const handleUserProfileUpdated = useCallback((event: UserProfileUpdatedEvent) => {
    setChatMessages(prev => {
      let changed = false
      const next: typeof prev = {}
      for (const [chatId, msgs] of Object.entries(prev)) {
        next[chatId] = msgs.map(m => {
          let patched = m

          if (patched.senderId === event.userId) {
            changed = true
            patched = {
              ...patched,
              senderName:      event.displayName,
              senderInitials:  initials(event.displayName),
              senderColor:     event.avatarColor,
              senderAvatarUrl: event.avatarUrl,
            }
          }

          if (patched.forwardedFromUserId === event.userId) {
            changed = true
            patched = { ...patched, forwardedFromUserName: event.displayName }
          }

          if (patched.poll?.options.some(o => o.voters.some(v => v.userId === event.userId))) {
            changed = true
            patched = {
              ...patched,
              poll: {
                options: patched.poll.options.map(o => ({
                  ...o,
                  voters: o.voters.map(v =>
                    v.userId === event.userId
                      ? { ...v, userName: event.displayName, userAvatarUrl: event.avatarUrl, userAvatarColor: event.avatarColor }
                      : v
                  ),
                })),
              },
            }
          }

          return patched
        })
      }
      return changed ? next : prev
    })
  }, [])

  const handleReactionChanged = useCallback((event: MessageReactionChanged) => {
    setChatMessages(prev => {
      const chatMsgs = prev[event.chatId]
      if (!chatMsgs) return prev

      return {
        ...prev,
        [event.chatId]: chatMsgs.map(m => {
          if (m.messageId !== event.messageId) return m

          const currentReactions = m.reactions ?? []
          const withoutUserReaction = currentReactions.filter(r => r.userId !== event.userId)

          return {
            ...m,
            reactions: event.emoji
              ? [
                  ...withoutUserReaction,
                  {
                    userId: event.userId,
                    userName: event.userName,
                    userAvatarUrl: event.userAvatarUrl,
                    userAvatarColor: event.userAvatarColor,
                    emoji: event.emoji,
                  },
                ]
              : withoutUserReaction,
          }
        }),
      }
    })
  }, [])

  const setMessageReaction = useCallback(async (chatId: string, msg: Message, emoji: string | null) => {
    if (!msg.messageId) return
    await setMessageReactionApi(chatId, msg.messageId, emoji)
  }, [])

  const handlePollVoteChanged = useCallback((event: PollVoteChangedEvent) => {
    setChatMessages(prev => {
      const chatMsgs = prev[event.chatId]
      if (!chatMsgs) return prev

      return {
        ...prev,
        [event.chatId]: chatMsgs.map(m => {
          if (m.messageId !== event.messageId || !m.poll) return m

          const options = m.poll.options.map(o => ({
            ...o,
            voters: o.voters.filter(v => v.userId !== event.userId),
          }))

          if (event.optionId) {
            const target = options.find(o => o.id === event.optionId)
            if (target) {
              target.voters = [...target.voters, {
                userId: event.userId,
                userName: event.userName,
                userAvatarUrl: event.userAvatarUrl,
                userAvatarColor: event.userAvatarColor,
              }]
            }
          }

          return { ...m, poll: { options } }
        }),
      }
    })
  }, [])

  const votePoll = useCallback(async (chatId: string, msg: Message, optionId: string) => {
    if (!msg.messageId) return
    await votePollApi(chatId, msg.messageId, optionId)
  }, [])

  const retractPollVote = useCallback(async (chatId: string, msg: Message) => {
    if (!msg.messageId) return
    await retractPollVoteApi(chatId, msg.messageId)
  }, [])

  const editMessage = useCallback(async (chatId: string, msg: Message, newText: string) => {
    if (!msg.messageId) return
    await editMessageApi(chatId, msg.messageId, newText)
    setChatMessages(prev => ({
      ...prev,
      [chatId]: (prev[chatId] ?? []).map(m =>
        m.id === msg.id ? { ...m, text: newText, edited: true } : m
      ),
    }))
  }, [])

  const loadMoreHistory = useCallback((
    onBeforePrepend: () => void,
    onAfterPrepend: () => void,
  ) => {
    if (!id || loadingHistory || historyLoaded[id]) return
    setLoadingHistory(true)
    onBeforePrepend()

    async function fetchUntilVisible(before: string | null) {
      const { messages: older, nextCursor: cursor } = await fetchMessages(id!, { before })
      setNextCursor(prev => ({ ...prev, [id!]: cursor }))

      if (older.length > 0) {
        setChatMessages(prev => ({ ...prev, [id!]: [...older, ...(prev[id!] ?? [])] }))
        onAfterPrepend()
        setHistoryLoaded(prev => ({ ...prev, [id!]: cursor === null }))
        return
      }

      if (cursor === null) {
        setHistoryLoaded(prev => ({ ...prev, [id!]: true }))
        return
      }

      await fetchUntilVisible(cursor)
    }

    fetchUntilVisible(nextCursor[id]).finally(() => setLoadingHistory(false))
  }, [id, loadingHistory, historyLoaded, nextCursor])

  const doSend = useCallback(async (chatId: string, text: string, tempId: number, signalRSend: SendFn, replyToMessageId?: string) => {
    try {
      const { messageId } = await signalRSend(text, replyToMessageId)
      setChatMessages(prev => ({
        ...prev,
        [chatId]: (prev[chatId] ?? []).map(m =>
          m.id === tempId ? { ...m, status: 'sent' as const, messageId } : m
        ),
      }))
    } catch {
      setChatMessages(prev => ({
        ...prev,
        [chatId]: (prev[chatId] ?? []).map(m =>
          m.id === tempId ? { ...m, status: 'failed' as const } : m
        ),
      }))
    }
  }, [])

  const send = useCallback((chatId: string, text: string, signalRSend: SendFn, meSender: Sender, replyTo?: Message) => {
    const tempId = nextMessageId()
    const now = new Date()
    const newMsg: Message = {
      ...meSender, id: tempId, text,
      time: formatMessageTime(now.toISOString()),
      sentAt: now.toISOString(),
      status: 'pending',
      replyToMessageId:  replyTo?.messageId,
      replyToSenderName: replyTo?.senderName,
      replyToContent:    replyTo?.text,
      reactions: [],
    }
    setChatMessages(prev => ({ ...prev, [chatId]: [...(prev[chatId] ?? []), newMsg] }))
    opts.onAppend?.(true)
    doSend(chatId, text, tempId, signalRSend, replyTo?.messageId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doSend])

  const sendFiles = useCallback(async (
    chatId: string, files: File[], caption: string | undefined, meSender: Sender,
    onUploadProgress?: (percent: number) => void,
  ) => {
    const result = await uploadChatMessageFiles(chatId, files, caption, onUploadProgress)
    const newMsg: Message = {
      ...meSender,
      id:          nextMessageId(),
      messageId:   result.messageId,
      text:        result.content,
      time:        formatMessageTime(result.sentAt),
      sentAt:      result.sentAt,
      status:      'sent',
      attachments: result.attachments.map(a => ({
        fileUrl:         a.fileUrl,
        fileName:        a.fileName,
        fileContentType: a.contentType,
        fileSizeBytes:   a.fileSizeBytes,
      })),
      reactions: [],
    }
    setChatMessages(prev => {
      const chatMsgs = prev[chatId] ?? []
      if (chatMsgs.some(m => m.messageId === newMsg.messageId)) return prev
      return { ...prev, [chatId]: [...chatMsgs, newMsg] }
    })
    opts.onAppend?.(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const retry = useCallback((chatId: string, msg: Message, signalRSend: SendFn) => {
    setChatMessages(prev => ({
      ...prev,
      [chatId]: (prev[chatId] ?? []).map(m =>
        m.id === msg.id ? { ...m, status: 'pending' as const } : m
      ),
    }))
    doSend(chatId, msg.text, msg.id, signalRSend, msg.replyToMessageId)
  }, [doSend])

  return {
    messages,
    loadingInitial: id ? (chatMessages[id] === undefined ? !loadError[id] : !!loadingInitial[id]) : false,
    loadError:      id ? !!loadError[id] : false,
    retryLoadInitial: () => id && loadInitial(id),
    handleIncomingMessage,
    handleDeletedMessage,
    handleEditedMessage,
    handleUserProfileUpdated,
    handleReactionChanged,
    handlePollVoteChanged,
    loadMoreHistory,
    loadingHistory,
    historyLoaded: id ? !!historyLoaded[id] : false,
    send,
    sendFiles,
    retry,
    deleteMessage,
    removeLocalMessage,
    deleteMessages,
    editMessage,
    setMessageReaction,
    votePoll,
    retractPollVote,
  }
}
