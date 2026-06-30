import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Message } from '../../../shared/types/messenger'

/**
 * Управляет скроллом окна сообщений: автоскролл вниз на новое/своё сообщение,
 * и восстановление позиции при подгрузке истории вверх (чтобы не "прыгало").
 */
export function useScrollRestore(messages: Message[]) {
  const bottomRef      = useRef<HTMLDivElement>(null)
  const messagesRef    = useRef<HTMLDivElement>(null)
  const topSentinelRef = useRef<HTMLDivElement>(null)

  const savedScrollHeight = useRef(0)
  const savedScrollTop    = useRef(0)

  const [restoreSignal, setRestoreSignal] = useState(0)
  const [bottomSignal,  setBottomSignal]  = useState<{ smooth: boolean } | null>(null)

  const scrollToBottomNow = useCallback((smooth: boolean) => {
    setBottomSignal({ smooth })
  }, [])

  const prepareRestoreBeforePrepend = useCallback(() => {
    if (!messagesRef.current) return
    savedScrollHeight.current = messagesRef.current.scrollHeight
    savedScrollTop.current    = messagesRef.current.scrollTop
  }, [])

  const triggerRestore = useCallback(() => setRestoreSignal(s => s + 1), [])

  useEffect(() => {
    if (!bottomSignal) return
    bottomRef.current?.scrollIntoView({ behavior: bottomSignal.smooth ? 'smooth' : 'instant' })
    setBottomSignal(null)
  }, [messages, bottomSignal])

  useLayoutEffect(() => {
    if (restoreSignal === 0 || !messagesRef.current) return
    messagesRef.current.scrollTop =
      savedScrollTop.current + (messagesRef.current.scrollHeight - savedScrollHeight.current)
  }, [restoreSignal])

  return {
    bottomRef, messagesRef, topSentinelRef,
    scrollToBottomNow, prepareRestoreBeforePrepend, triggerRestore,
  }
}
