import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Attachment, Message } from '../../../shared/types/messenger'
import { useAuthedFileUrl, downloadAuthedFile } from '../../../shared/hooks/useAuthedFileUrl'
import { FileTypeIcon } from '../../../shared/ui/FileTypeIcon'
import { Skeleton } from '../../../shared/ui/Skeleton'
import { formatDateLabel } from '../../../shared/lib/formatDateTime'
import { matchUrls } from '../../../shared/lib/linkify'
import s from './ChatSharedContent.module.css'

type SharedTab = 'media' | 'files' | 'links'

interface ChatSharedExtraTab {
  id: string
  label: string
  content: ReactNode
  headerContent?: ReactNode
}

interface SharedAttachment {
  message: Message
  attachment: Attachment
}

interface SharedLink {
  message: Message
  url: string
  host: string
}

interface ChatSharedContentProps {
  messages: Message[]
  hasMoreHistory: boolean
  loadingHistory: boolean
  onLoadMoreHistory: () => void
  extraTabs?: ChatSharedExtraTab[]
  initialTab?: string
}

const MEDIA_SKELETON_COUNT = 6
const LIST_SKELETON_COUNT = 4

function isMediaAttachment(attachment: Attachment): boolean {
  return attachment.fileContentType.startsWith('image/') || attachment.fileContentType.startsWith('video/')
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatSharedDate(iso: string): string {
  return `${formatDateLabel(iso)}, ${new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

function extractLinks(message: Message): SharedLink[] {
  return matchUrls(message.text).map(url => {
    try {
      return { message, url, host: new URL(url).hostname.replace(/^www\./, '') }
    } catch {
      return { message, url, host: url }
    }
  })
}

function MediaTile({ item }: { item: SharedAttachment }) {
  const { t } = useTranslation()
  const { attachment } = item
  const isVideo = attachment.fileContentType.startsWith('video/')
  const { blobUrl, error } = useAuthedFileUrl(attachment.fileUrl, true)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)

  async function handleDownload() {
    if (downloading) return
    setDownloading(true)
    try {
      await downloadAuthedFile(attachment.fileUrl, attachment.fileName)
    } catch {
      // Download errors are intentionally quiet here; message attachments use the same behavior.
    } finally {
      setDownloading(false)
    }
  }

  return (
    <>
      <button type="button" className={s.mediaTile} onClick={() => blobUrl && setLightboxOpen(true)} title={attachment.fileName}>
        {error && <span className={s.mediaPlaceholder}>{t('messenger.attachmentLoadFailed')}</span>}
        {!error && blobUrl && (isVideo
          ? <video src={blobUrl} className={s.mediaVideo} muted playsInline preload="metadata" />
          : <img src={blobUrl} alt={attachment.fileName} className={s.mediaImage} loading="lazy" />
        )}
        {!error && !blobUrl && <MediaTileSkeleton />}
        {isVideo && <span className={s.mediaBadge}>VID</span>}
      </button>

      {lightboxOpen && blobUrl && (
        <div className={s.lightboxOverlay} onClick={() => setLightboxOpen(false)}>
          {isVideo
            ? <video src={blobUrl} className={s.lightboxMedia} controls autoPlay onClick={event => event.stopPropagation()} />
            : <img src={blobUrl} alt={attachment.fileName} className={s.lightboxMedia} onClick={event => event.stopPropagation()} />
          }
          <button
            type="button"
            className={s.lightboxDownload}
            disabled={downloading}
            title={t('messenger.downloadFile')}
            onClick={event => { event.stopPropagation(); void handleDownload() }}
          >
            ↓
          </button>
          <button type="button" className={s.lightboxClose} onClick={() => setLightboxOpen(false)}>✕</button>
        </div>
      )}
    </>
  )
}

function MediaTileSkeleton() {
  return <Skeleton as="span" className={s.mediaSkeleton} />
}

function MediaGridSkeleton({ count = MEDIA_SKELETON_COUNT }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <MediaTileSkeleton key={index} />
      ))}
    </>
  )
}

function SharedRowSkeleton({ variant }: { variant: 'file' | 'link' }) {
  return (
    <div className={s.rowSkeleton} aria-hidden="true">
      <Skeleton className={variant === 'file' ? s.fileIconSkeleton : s.linkIconSkeleton} />
      <span className={s.rowSkeletonInfo}>
        <Skeleton className={s.rowSkeletonTitle} />
        <Skeleton className={s.rowSkeletonMeta} />
      </span>
    </div>
  )
}

function SharedListSkeleton({ variant, count = LIST_SKELETON_COUNT }: { variant: 'file' | 'link'; count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <SharedRowSkeleton key={index} variant={variant} />
      ))}
    </>
  )
}

function FileRow({ item }: { item: SharedAttachment }) {
  const { t } = useTranslation()
  const { attachment, message } = item
  const [downloading, setDownloading] = useState(false)

  async function handleDownload() {
    if (downloading) return
    setDownloading(true)
    try {
      await downloadAuthedFile(attachment.fileUrl, attachment.fileName)
    } catch {
      // Keep the list stable; the chat attachment component also ignores download failures.
    } finally {
      setDownloading(false)
    }
  }

  return (
    <button type="button" className={s.fileRow} onClick={handleDownload} disabled={downloading}>
      <FileTypeIcon fileName={attachment.fileName} contentType={attachment.fileContentType} size={40} />
      <span className={s.fileInfo}>
        <span className={s.fileName}>{attachment.fileName}</span>
        <span className={s.fileMeta}>
          {downloading ? t('messenger.attachmentDownloading') : `${formatFileSize(attachment.fileSizeBytes)} · ${formatSharedDate(message.sentAt)}`}
        </span>
      </span>
    </button>
  )
}

function LinkRow({ item }: { item: SharedLink }) {
  return (
    <a className={s.linkRow} href={item.url} target="_blank" rel="noreferrer">
      <span className={s.linkIcon}>{item.host.slice(0, 1).toUpperCase()}</span>
      <span className={s.linkInfo}>
        <span className={s.linkTitle}>{item.host}</span>
        <span className={s.linkMeta}>{item.url}</span>
      </span>
    </a>
  )
}

export function ChatSharedContent({
  messages, hasMoreHistory, loadingHistory, onLoadMoreHistory,
  extraTabs = [], initialTab,
}: ChatSharedContentProps) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<string>(initialTab ?? extraTabs[0]?.id ?? 'media')
  const tabsRef = useRef<HTMLDivElement>(null)
  const [tabScroll, setTabScroll] = useState({ left: 0, max: 0, viewport: 1, content: 1 })

  const { media, files, links } = useMemo(() => {
    const messageList = [...messages]
      .filter(message => message.kind !== 'System')
      .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())

    const allAttachments = messageList.flatMap(message =>
      (message.attachments ?? []).map(attachment => ({ message, attachment }))
    )

    return {
      media: allAttachments.filter(item => isMediaAttachment(item.attachment)),
      files: allAttachments.filter(item => !isMediaAttachment(item.attachment)),
      links: messageList.flatMap(extractLinks),
    }
  }, [messages])

  const countByTab: Record<SharedTab, number> = {
    media: media.length,
    files: files.length,
    links: links.length,
  }

  const sharedTabs: { id: SharedTab; label: string }[] = (['media', 'files', 'links'] as const).map(tab => ({
    id: tab,
    label: t(`sharedContent.tabs.${tab}`, { count: countByTab[tab] }),
  }))
  const activeExtraTab = extraTabs.find(tab => tab.id === activeTab)
  const activeSharedTab = activeTab as SharedTab
  const hasItems = activeExtraTab ? true : countByTab[activeSharedTab] > 0
  const tabCount = extraTabs.length + sharedTabs.length
  const isLoadingSharedTab = loadingHistory && hasMoreHistory && !activeExtraTab

  const updateTabScroll = useCallback(() => {
    const row = tabsRef.current
    if (!row) return
    setTabScroll({
      left: row.scrollLeft,
      max: Math.max(0, row.scrollWidth - row.clientWidth),
      viewport: row.clientWidth,
      content: row.scrollWidth,
    })
  }, [])

  useLayoutEffect(() => {
    updateTabScroll()
    window.addEventListener('resize', updateTabScroll)
    return () => window.removeEventListener('resize', updateTabScroll)
  }, [tabCount, updateTabScroll])

  const hasTabScroll = tabScroll.max > 1
  const tabThumbWidth = Math.max(28, (tabScroll.viewport / tabScroll.content) * tabScroll.viewport)
  const tabThumbLeft = hasTabScroll
    ? (tabScroll.left / tabScroll.max) * (tabScroll.viewport - tabThumbWidth)
    : 0

  return (
    <section className={s.sharedRoot}>
      <div className={s.sharedTabsScroller}>
        <div ref={tabsRef} className={s.sharedTabs} role="tablist" aria-label={t('sharedContent.title')} onScroll={updateTabScroll}>
          {[...extraTabs.map(tab => ({ id: tab.id, label: tab.label })), ...sharedTabs].map(tab => (
            <button
              key={tab.id}
              type="button"
              className={`${s.sharedTab} ${activeTab === tab.id ? s.sharedTabActive : ''}`}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              aria-selected={activeTab === tab.id}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {hasTabScroll && (
          <div className={s.sharedTabsScrollbar} aria-hidden="true">
            <span
              className={s.sharedTabsScrollbarThumb}
              style={{
                width: `${tabThumbWidth}px`,
                transform: `translateX(${tabThumbLeft}px)`,
              }}
            />
          </div>
        )}
      </div>

      {activeExtraTab?.headerContent && (
        <div className={s.sharedTabHeader}>
          {activeExtraTab.headerContent}
        </div>
      )}

      <div className={s.sharedBody}>
        {activeExtraTab?.content}

        {activeTab === 'media' && (
          media.length > 0 || isLoadingSharedTab
            ? (
              <div className={s.mediaGrid}>
                {media.map(item => <MediaTile key={`${item.message.messageId}-${item.attachment.fileUrl}`} item={item} />)}
                {isLoadingSharedTab && <MediaGridSkeleton />}
              </div>
            )
            : <div className={s.empty}>{t('sharedContent.empty.media')}</div>
        )}

        {activeTab === 'files' && (
          files.length > 0 || isLoadingSharedTab
            ? (
              <div className={s.list}>
                {files.map(item => <FileRow key={`${item.message.messageId}-${item.attachment.fileUrl}`} item={item} />)}
                {isLoadingSharedTab && <SharedListSkeleton variant="file" />}
              </div>
            )
            : <div className={s.empty}>{t('sharedContent.empty.files')}</div>
        )}

        {activeTab === 'links' && (
          links.length > 0 || isLoadingSharedTab
            ? (
              <div className={s.list}>
                {links.map((item, index) => <LinkRow key={`${item.message.messageId}-${item.url}-${index}`} item={item} />)}
                {isLoadingSharedTab && <SharedListSkeleton variant="link" />}
              </div>
            )
            : <div className={s.empty}>{t('sharedContent.empty.links')}</div>
        )}

        {hasMoreHistory && (
          <button type="button" className={s.historyAction} onClick={onLoadMoreHistory} disabled={loadingHistory}>
            {loadingHistory ? t('sharedContent.loadingHistory') : t('sharedContent.loadMore')}
          </button>
        )}

        {!hasItems && hasMoreHistory && (
          <div className={s.empty}>{t('sharedContent.moreHint')}</div>
        )}
      </div>
    </section>
  )
}
