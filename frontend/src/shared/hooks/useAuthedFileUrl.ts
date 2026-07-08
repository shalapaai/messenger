import { useEffect, useState } from 'react'
import axios from 'axios'
import { getAccessToken } from '../lib/auth/authTokens'
import { acquireFileBlobUrl, releaseFileBlobUrl } from '../lib/fileBlobCache'

// Вложения чатов отдаются не анонимно — обычный <img src="/api/files/..."> получит 401,
// поэтому качаем файл вручную с токеном и превращаем в blob-URL.
async function fetchProtectedFileBlob(url: string): Promise<Blob> {
  const res = await axios.get<Blob>(url, {
    responseType: 'blob',
    headers: { Authorization: `Bearer ${getAccessToken()}` },
  })
  return res.data
}

/** Резолвит защищённый fileUrl вложения в blob-URL, переиспользуя уже скачанный blob из
 *  fileBlobCache (иначе пересоздание ChatWindow при смене чата качало бы файлы заново).
 *  Передайте enabled=false, чтобы не загружать сразу. */
export function useAuthedFileUrl(fileUrl: string | null | undefined, enabled = true) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [error,   setError]   = useState(false)
  // null — процент неизвестен (сервер не прислал Content-Length) или загрузка ещё не началась.
  const [progress, setProgress] = useState<number | null>(null)

  useEffect(() => {
    if (!fileUrl || !enabled) return
    let cancelled = false
    setBlobUrl(null)
    setError(false)
    setProgress(null)

    const onProgress = (percent: number | null) => { if (!cancelled) setProgress(percent) }

    acquireFileBlobUrl(fileUrl, onProgress)
      .then(url => {
        if (!cancelled) setBlobUrl(url)
      })
      .catch(() => { if (!cancelled) setError(true) })

    return () => {
      cancelled = true
      releaseFileBlobUrl(fileUrl, onProgress)
    }
  }, [fileUrl, enabled])

  return { blobUrl, error, progress }
}

/** Скачивание "по клику" без предзагрузки на рендере — для карточек не-картиночных файлов,
 *  чтобы не тянуть содержимое каждого вложения в списке сообщений заранее. */
export async function downloadAuthedFile(fileUrl: string, fileName: string): Promise<void> {
  const blob = await fetchProtectedFileBlob(fileUrl)
  const localUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = localUrl
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(localUrl)
}
