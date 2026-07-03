import { useEffect, useState } from 'react'
import axios from 'axios'
import { getAccessToken } from '../lib/auth/authTokens'

// Вложения чатов (в отличие от аватарок) отдаются НЕ анонимно — бэкенд проверяет,
// что скачивающий состоит в этом чате (см. DownloadFile в FilesEndpoints.cs). Обычный
// <img src="/api/files/..."> браузер шлёт без заголовка Authorization и получит 401 —
// поэтому качаем файл вручную с токеном и превращаем в blob-URL для <img>/скачивания.
async function fetchProtectedFileBlob(url: string): Promise<Blob> {
  const res = await axios.get<Blob>(url, {
    responseType: 'blob',
    headers: { Authorization: `Bearer ${getAccessToken()}` },
  })
  return res.data
}

/** Резолвит защищённый fileUrl вложения в локальный blob-URL. Лениво: пока не понадобится
 *  (см. useLazyAuthedFileDownload) — просто передайте enabled=false. */
export function useAuthedFileUrl(fileUrl: string | null | undefined, enabled = true) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [error,   setError]   = useState(false)

  useEffect(() => {
    if (!fileUrl || !enabled) return
    let cancelled = false
    let localUrl: string | null = null

    fetchProtectedFileBlob(fileUrl)
      .then(blob => {
        if (cancelled) return
        localUrl = URL.createObjectURL(blob)
        setBlobUrl(localUrl)
        setError(false)
      })
      .catch(() => { if (!cancelled) setError(true) })

    return () => {
      cancelled = true
      if (localUrl) URL.revokeObjectURL(localUrl)
    }
  }, [fileUrl, enabled])

  return { blobUrl, error }
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
