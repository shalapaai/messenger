import type { ReactNode } from 'react'

const URL_PATTERN = /\bhttps?:\/\/[^\s<>"']+/gi
const TRAILING_PUNCTUATION = /[.,!?;:)\]}]+$/

export function cleanUrl(rawUrl: string): string {
  return rawUrl.replace(TRAILING_PUNCTUATION, '')
}

export function matchUrls(text: string): string[] {
  return (text.match(URL_PATTERN) ?? []).map(cleanUrl)
}

export function linkifyText(text: string): ReactNode[] {
  const pattern = new RegExp(URL_PATTERN)
  const nodes: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    const start = match.index
    const url = cleanUrl(match[0])
    if (!url) continue

    if (start > lastIndex) nodes.push(text.slice(lastIndex, start))
    nodes.push(
      <a
        key={start}
        href={url}
        target="_blank"
        rel="noreferrer noopener"
        onClick={(e) => e.stopPropagation()}
      >
        {url}
      </a>
    )
    lastIndex = start + url.length
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))

  return nodes.length > 0 ? nodes : [text]
}
