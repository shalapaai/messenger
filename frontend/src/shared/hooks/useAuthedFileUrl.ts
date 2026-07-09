import { useEffect, useState } from 'react'
import axios from 'axios'
import { getAccessToken } from '../lib/auth/authTokens'
import { acquireFileBlobUrl, releaseFileBlobUrl } from '../lib/fileBlobCache'

async function fetchProtectedFileBlob(url: string): Promise<Blob> {
  const res = await axios.get<Blob>(url, {
    responseType: 'blob',
    headers: { Authorization: `Bearer ${getAccessToken()}` },
  })
  return res.data
}

export function useAuthedFileUrl(fileUrl: string | null | undefined, enabled = true) {
  const [fileState, setFileState] = useState<{
    fileUrl: string | null
    blobUrl: string | null
    error: boolean
    progress: number | null
  }>({ fileUrl: null, blobUrl: null, error: false, progress: null })

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
