import { useEffect, useRef, useState } from 'react'
import { searchUsers, type UserSearchResult } from '../api/usersApi'

/** Debounced-поиск пользователей с защитой от гонки ответов — если более старый запрос
 *  (например "al") отвечает позже более нового ("alex"), его результат игнорируется. */
export function useUserSearch(isOpen: boolean) {
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState<UserSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(false)
  const requestIdRef = useRef(0)

  useEffect(() => {
    if (isOpen) return
    const timer = setTimeout(() => {
      setQuery(''); setResults([]); setError(false); setLoading(false)
    }, 0)
    return () => clearTimeout(timer)
  }, [isOpen])

  useEffect(() => {
    const q = query.trim()
    const timer = setTimeout(() => {
      const requestId = ++requestIdRef.current

      if (!q) {
        setResults([]); setError(false); setLoading(false)
        return
      }

      setLoading(true)
      setError(false)
      searchUsers(q)
        .then(res => { if (requestId === requestIdRef.current) setResults(res) })
        .catch(() => { if (requestId === requestIdRef.current) setError(true) })
        .finally(() => { if (requestId === requestIdRef.current) setLoading(false) })
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  return { query, setQuery, results, loading, error }
}
