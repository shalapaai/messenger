import axios from 'axios'
import { getAccessToken } from './auth/authTokens'

// Вложения чатов отдаются не анонимно (бэкенд проверяет членство в чате), поэтому
// их нельзя грузить через обычный <img src>, а нужно качать с Bearer-токеном и
// превращать в blob-URL. Без этого кэша каждое переключение чата (ChatWindow
// пересоздаётся с key={chatId}) заново скачивало те же файлы с нуля.
async function fetchProtectedFileBlob(url: string): Promise<Blob> {
  const res = await axios.get<Blob>(url, {
    responseType: 'blob',
    headers: { Authorization: `Bearer ${getAccessToken()}` },
  })
  return res.data
}

interface CacheEntry {
  blobUrl: string | null
  refCount: number
  lastReleasedAt: number
  loadingPromise: Promise<string> | null
}

const cache = new Map<string, CacheEntry>()

// Ограничивает число одновременно живых blob-URL (каждый держит декодированные
// байты файла в памяти вкладки) — как только лишние чаты вытесняются из этого
// лимита, самые давно отпущенные записи освобождаются первыми.
const MAX_ENTRIES = 150

function evictIfNeeded() {
  if (cache.size <= MAX_ENTRIES) return
  const evictable = [...cache.entries()]
    .filter(([, entry]) => entry.refCount === 0 && entry.blobUrl)
    .sort((a, b) => a[1].lastReleasedAt - b[1].lastReleasedAt)

  while (cache.size > MAX_ENTRIES && evictable.length > 0) {
    const [key, entry] = evictable.shift()!
    if (entry.blobUrl) URL.revokeObjectURL(entry.blobUrl)
    cache.delete(key)
  }
}

/** Возвращает blob-URL файла, переиспользуя уже скачанные данные при повторных
 *  обращениях (в т.ч. из разных компонентов). Каждый вызов увеличивает refCount —
 *  парный releaseFileBlobUrl обязателен (обычно в cleanup эффекта). */
export function acquireFileBlobUrl(fileUrl: string): Promise<string> {
  const existing = cache.get(fileUrl)
  if (existing) {
    existing.refCount++
    return existing.blobUrl
      ? Promise.resolve(existing.blobUrl)
      : existing.loadingPromise!
  }

  const loadingPromise = fetchProtectedFileBlob(fileUrl)
    .then(blob => {
      const blobUrl = URL.createObjectURL(blob)
      const entry = cache.get(fileUrl)
      if (entry) {
        entry.blobUrl = blobUrl
        entry.loadingPromise = null
      }
      return blobUrl
    })
    .catch(err => {
      cache.delete(fileUrl)
      throw err
    })

  cache.set(fileUrl, { blobUrl: null, refCount: 1, lastReleasedAt: 0, loadingPromise })
  return loadingPromise
}

/** Парная к acquireFileBlobUrl — не отзывает blob-URL сразу, а лишь помечает его
 *  свободным для вытеснения, чтобы возврат в тот же чат брал файл из кэша. */
export function releaseFileBlobUrl(fileUrl: string) {
  const entry = cache.get(fileUrl)
  if (!entry) return
  entry.refCount = Math.max(0, entry.refCount - 1)
  if (entry.refCount === 0) {
    entry.lastReleasedAt = Date.now()
    evictIfNeeded()
  }
}

/** Отзывает все blob-URL и очищает кэш — вызывать при логауте, чтобы данные
 *  вышедшего пользователя не оставались в памяти вкладки. */
export function clearFileBlobCache() {
  for (const entry of cache.values()) {
    if (entry.blobUrl) URL.revokeObjectURL(entry.blobUrl)
  }
  cache.clear()
}
