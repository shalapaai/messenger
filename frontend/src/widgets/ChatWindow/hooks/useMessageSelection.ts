import { useEffect, useState } from 'react'
import type { Message } from '../../../shared/types/messenger'

export function useMessageSelection() {
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  function exitSelectMode() {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  useEffect(() => {
    if (!selectMode) return
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') exitSelectMode() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectMode])

  function enterSelectMode(msg: Message) {
    if (!msg.messageId) return
    setSelectMode(true)
    setSelectedIds(new Set([msg.id]))
  }

  function toggleSelect(msg: Message) {
    if (!msg.messageId) return
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(msg.id)) next.delete(msg.id); else next.add(msg.id)
      return next
    })
  }

  return { selectMode, selectedIds, enterSelectMode, exitSelectMode, toggleSelect }
}
