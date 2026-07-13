import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { searchMessages } from '../../shared/api/chatsApi'
import { formatChatListTime } from '../../shared/lib/formatDateTime'
import type { MessageSearchResult } from '../../shared/types/messenger'
import { SearchIcon } from './icons'
import s from './ChatWindow.module.css'

const SEARCH_DEBOUNCE_MS = 300

interface ChatSearchPanelProps {
  chatId: string
  onClose: () => void
  onResultClick: (messageId: string) => void
}

export function ChatSearchPanel({ chatId, onClose, onResultClick }: ChatSearchPanelProps) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MessageSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const requestIdRef = useRef(0)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const trimmed = query.trim()
    // Пустой запрос отменяет любой в полёте — иначе устаревший ответ может
    // перезаписать пустые результаты после того, как поле уже очистили.
    requestIdRef.current += 1
    if (!trimmed) {
      setResults([])
      setLoading(false)
      setError(false)
      return
    }

    const requestId = requestIdRef.current
    setLoading(true)
    setError(false)

    const timer = window.setTimeout(() => {
      searchMessages(chatId, trimmed)
        .then(found => {
          if (requestIdRef.current !== requestId) return
          setResults(found)
        })
        .catch(() => {
          if (requestIdRef.current !== requestId) return
          setError(true)
          setResults([])
        })
        .finally(() => {
          if (requestIdRef.current !== requestId) return
          setLoading(false)
        })
    }, SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(timer)
  }, [query, chatId])

  return (
    <div className={s.searchPanel}>
      <div className={s.searchPanelBar}>
        <span className={s.searchPanelIcon}><SearchIcon /></span>
        <input
          ref={inputRef}
          className={s.searchPanelInput}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t('messenger.chatSearchPlaceholder')}
        />
        <button type="button" className={s.searchPanelClose} onClick={onClose} aria-label={t('common.close')}>✕</button>
      </div>

      {query.trim() !== '' && (
        <div className={s.searchPanelResults}>
          {loading ? (
            <div className={s.searchPanelHint}>{t('messenger.searching')}</div>
          ) : error ? (
            <div className={s.searchPanelHint}>{t('messenger.chatSearchFailed')}</div>
          ) : results.length === 0 ? (
            <div className={s.searchPanelHint}>{t('messenger.chatSearchEmpty')}</div>
          ) : (
            results.map(r => (
              <button
                key={r.messageId}
                type="button"
                className={s.searchResultRow}
                onClick={() => onResultClick(r.messageId)}
              >
                <span className={s.searchResultTop}>
                  <span className={s.searchResultSender}>{r.senderName}</span>
                  <span className={s.searchResultTime}>{formatChatListTime(r.sentAt)}</span>
                </span>
                <span className={s.searchResultText}>{r.content}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
