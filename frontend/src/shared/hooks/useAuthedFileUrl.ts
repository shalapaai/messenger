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
  const [fileState, setFileState] = useState<{
    fileUrl: string | null
    blobUrl: string | null
    error: boolean
    progress: number | null
  }>({ fileUrl: null, blobUrl: null, error: false, progress: null })
  // null — процент неизвестен (сервер не прислал Content-Length) или загрузка ещё не началась.

  useEffect(() => {
    if (!fileUrl || !enabled) return
    let cancelled = false

    const onProgress = (percent: number | null) => {
      if (!cancelled) setFileState({ fileUrl, blobUrl: null, error: false, progress: percent })
    }

    acquireFileBlobUrl(fileUrl, onProgress)
      .then(url => {
        if (!cancelled) setFileState({ fileUrl, blobUrl: url, error: false, progress: null })
      })
      .catch(() => { if (!cancelled) setFileState({ fileUrl, blobUrl: null, error: true, progress: null }) })

    return () => {
      cancelled = true
      releaseFileBlobUrl(fileUrl, onProgress)
    }
  }, [fileUrl, enabled])

  const isCurrentFile = enabled && !!fileUrl && fileState.fileUrl === fileUrl

  return {
    blobUrl: isCurrentFile ? fileState.blobUrl : null,
    error: isCurrentFile ? fileState.error : false,
    progress: isCurrentFile ? fileState.progress : null,
  }
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
