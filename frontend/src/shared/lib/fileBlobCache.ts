import axios from 'axios'
import { getAccessToken } from './auth/authTokens'

async function fetchProtectedFileBlob(url: string, onProgress?: (percent: number | null) => void): Promise<Blob> {
  const res = await axios.get<Blob>(url, {
    responseType: 'blob',
    headers: { Authorization: `Bearer ${getAccessToken()}` },
    onDownloadProgress: onProgress && (e => onProgress(e.total ? Math.round((e.loaded / e.total) * 100) : null)),
  })
  return res.data
}

type ProgressListener = (percent: number | null) => void

interface CacheEntry {
  blobUrl: string | null
  refCount: number
  lastReleasedAt: number
  loadingPromise: Promise<string> | null
  progress: number | null
  progressListeners: Set<ProgressListener>
}

const cache = new Map<string, CacheEntry>()

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

export function acquireFileBlobUrl(fileUrl: string, onProgress?: ProgressListener): Promise<string> {
  const existing = cache.get(fileUrl)
  if (existing) {
    existing.refCount++
    if (existing.blobUrl) return Promise.resolve(existing.blobUrl)
    if (onProgress) {
      onProgress(existing.progress)
      existing.progressListeners.add(onProgress)
    }
    return existing.loadingPromise!
  }

  const entry: CacheEntry = {
    blobUrl: null,
    refCount: 1,
    lastReleasedAt: 0,
    loadingPromise: null,
    progress: 0,
    progressListeners: new Set(onProgress ? [onProgress] : []),
  }

  entry.loadingPromise = fetchProtectedFileBlob(fileUrl, percent => {
    entry.progress = percent
    entry.progressListeners.forEach(fn => fn(percent))
  })
    .then(blob => {
      const blobUrl = URL.createObjectURL(blob)
      entry.blobUrl = blobUrl
      entry.loadingPromise = null
      entry.progressListeners.clear()
      return blobUrl
    })
    .catch(err => {
      cache.delete(fileUrl)
      throw err
    })

  cache.set(fileUrl, entry)
  return entry.loadingPromise
}

export function releaseFileBlobUrl(fileUrl: string, onProgress?: ProgressListener) {
  const entry = cache.get(fileUrl)
  if (!entry) return
  if (onProgress) entry.progressListeners.delete(onProgress)
  entry.refCount = Math.max(0, entry.refCount - 1)
  if (entry.refCount === 0) {
    entry.lastReleasedAt = Date.now()
    evictIfNeeded()
  }
}

export function clearFileBlobCache() {
  for (const entry of cache.values()) {
    if (entry.blobUrl) URL.revokeObjectURL(entry.blobUrl)
  }
  cache.clear()
}
