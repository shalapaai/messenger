import { useCallback, useEffect, useRef, useState } from 'react'
import type { TypingEvent } from '../../../shared/api/signalrClient'

/**
 * Чужая печать (через realtime UserTyping/UserStoppedTyping) + своя печать
 * (дебаунс StartTyping/StopTyping, чтобы не слать на каждую букву).
 */
export function useTypingIndicator(startTyping: () => void, stopTyping: () => void) {
  const [typingChats, setTypingChats] = useState<Record<string, boolean>>({})
  const clearTimers  = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const ownDebounce   = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleUserTyping = useCallback((event: TypingEvent) => {
    setTypingChats(prev => ({ ...prev, [event.chatId]: true }))
    clearTimeout(clearTimers.current[event.chatId])
    // подстраховка на случай если StopTyping не придёт (обрыв связи и т.п.)
    clearTimers.current[event.chatId] = setTimeout(() => {
      setTypingChats(prev => ({ ...prev, [event.chatId]: false }))
    }, 3000)
  }, [])

  const handleUserStoppedTyping = useCallback((event: TypingEvent) => {
    clearTimeout(clearTimers.current[event.chatId])
    setTypingChats(prev => ({ ...prev, [event.chatId]: false }))
  }, [])

  const handleOwnTyping = useCallback(() => {
    // Шлём StartTyping на каждое нажатие, а не только при первом — иначе после
    // паузы (когда дебаунс уже сбросил "печатает" и обнулил ownDebounce) повторный
    // вызов мог зависеть от устаревшего состояния. StartTyping — дешёвый вызов,
    // получатель просто продлевает себе индикатор по новому событию.
    startTyping()
    if (ownDebounce.current) clearTimeout(ownDebounce.current)
    ownDebounce.current = setTimeout(() => {
      stopTyping()
      ownDebounce.current = null
    }, 2000)
  }, [startTyping, stopTyping])

  const stopOwnTyping = useCallback(() => {
    if (ownDebounce.current) {
      clearTimeout(ownDebounce.current)
      ownDebounce.current = null
    }
    stopTyping()
  }, [stopTyping])

  useEffect(() => () => {
    Object.values(clearTimers.current).forEach(clearTimeout)
    if (ownDebounce.current) clearTimeout(ownDebounce.current)
  }, [])

  return { typingChats, handleUserTyping, handleUserStoppedTyping, handleOwnTyping, stopOwnTyping }
}
