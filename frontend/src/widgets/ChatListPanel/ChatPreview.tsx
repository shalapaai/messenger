import { useTranslation } from 'react-i18next'
import type { Chat } from '../../shared/types/messenger'
import { useAuthedFileUrl } from '../../shared/hooks/useAuthedFileUrl'
import s from './ChatListPanel.module.css'

const isImageContentType = (contentType: string | null | undefined) =>
  !!contentType?.startsWith('image/')

function PreviewThumbnail({ src, alt }: { src: string; alt: string }) {
  const { blobUrl } = useAuthedFileUrl(src)
  if (!blobUrl) return <span className={s.clPreviewAttachmentIcon}>🖼</span>
  return <img src={blobUrl} alt={alt} className={s.clPreviewThumb} />
}

export function ChatPreview({ chat }: { chat: Chat }) {
  const { t } = useTranslation()
  const isAttachmentPreview = !chat.preview && !!(chat.previewAttachmentUrl || chat.previewAttachmentFileName)

  if (isAttachmentPreview) {
    const isPhoto = isImageContentType(chat.previewAttachmentContentType)
    return (
      <>
        {isPhoto && chat.previewAttachmentUrl ? (
          <PreviewThumbnail src={chat.previewAttachmentUrl} alt={chat.name} />
        ) : (
          <span className={s.clPreviewAttachmentIcon}>📎</span>
        )}
        <span>{isPhoto ? t('messenger.previewPhoto') : (chat.previewAttachmentFileName ?? t('messenger.attachmentFile'))}</span>
      </>
    )
  }

  return chat.preview ? (
    <span>{chat.preview}</span>
  ) : (
    <span className={s.clPreviewEmpty}>{t('messenger.noMessages')}</span>
  )
}
