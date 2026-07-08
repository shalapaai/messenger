import { useCallback, useLayoutEffect, useRef, useState } from 'react'

export function useScrollRestore() {
  const bottomRef      = useRef<HTMLDivElement>(null)
  const messagesRef    = useRef<HTMLDivElement>(null)
  const topSentinelRef = useRef<HTMLDivElement>(null)

  const savedScrollHeight = useRef(0)
  const savedScrollTop    = useRef(0)
  const bottomSmooth      = useRef(false)

  const [restoreSignal, setRestoreSignal] = useState(0)
  const [bottomSignal,  setBottomSignal]  = useState(0)

  const scrollToBottomNow = useCallback((smooth: boolean) => {
    bottomSmooth.current = smooth
    setBottomSignal(s => s + 1)
  }, [])

  const prepareRestoreBeforePrepend = useCallback(() => {
    if (!messagesRef.current) return
    savedScrollHeight.current = messagesRef.current.scrollHeight
    savedScrollTop.current    = messagesRef.current.scrollTop
  }, [])

  const triggerRestore = useCallback(() => setRestoreSignal(s => s + 1), [])

  useLayoutEffect(() => {
    if (bottomSignal === 0) return
    const el = messagesRef.current

    if (!el) {
      bottomRef.current?.scrollIntoView({ behavior: bottomSmooth.current ? 'smooth' : 'auto' })
      return
    }

    el.scrollTo({
      top: el.scrollHeight,
      behavior: bottomSmooth.current ? 'smooth' : 'auto',
    })
    // messages НЕ в зависимостях специально: этот эффект должен скроллить только когда его
    // явно попросили (scrollToBottomNow → bottomSignal), а не при любом изменении messages
    // (например реакция на старое сообщение) — иначе чат дёргает в низ посреди чтения истории.
    // setChatMessages и scrollToBottomNow всегда вызываются синхронно друг за другом
    // (см. useChatMessages.ts), так что React их батчит в один коммит — к моменту, когда
    // bottomSignal меняется, messagesRef уже отражает обновлённый DOM.
  }, [bottomSignal])

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
