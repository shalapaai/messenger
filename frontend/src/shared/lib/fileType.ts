import { AVATAR_COLORS } from './avatarColors'

export interface FileTypeInfo {
  label: string
  color: string
}

// та же палитра, что уже используется для цвета аватарок — чтобы цветные иконки файлов
// не выглядели чужеродно рядом с остальным интерфейсом
const [BLUE, VIOLET, GREEN, ORANGE, RED, CYAN, PURPLE] = AVATAR_COLORS
const GRAY = '#8A94A6'

const EXTENSION_INFO: Record<string, FileTypeInfo> = {
  pdf:  { label: 'PDF', color: RED },
  doc:  { label: 'DOC', color: BLUE },
  docx: { label: 'DOC', color: BLUE },
  xls:  { label: 'XLS', color: GREEN },
  xlsx: { label: 'XLS', color: GREEN },
  csv:  { label: 'CSV', color: GREEN },
  ppt:  { label: 'PPT', color: ORANGE },
  pptx: { label: 'PPT', color: ORANGE },
  txt:  { label: 'TXT', color: GRAY },
  zip:  { label: 'ZIP', color: PURPLE },
  rar:  { label: 'RAR', color: PURPLE },
  '7z': { label: '7Z',  color: PURPLE },
  mp3:  { label: 'MP3', color: CYAN },
  wav:  { label: 'WAV', color: CYAN },
  ogg:  { label: 'OGG', color: CYAN },
  m4a:  { label: 'M4A', color: CYAN },
  mp4:  { label: 'MP4', color: VIOLET },
  webm: { label: 'WEBM', color: VIOLET },
  mov:  { label: 'MOV', color: VIOLET },
}

const DEFAULT_INFO: FileTypeInfo = { label: 'FILE', color: GRAY }

/** Подпись + цвет иконки файла — сперва по расширению имени, затем по общей категории
 *  content-type (на случай отсутствующего/незнакомого расширения), иначе — нейтральный дефолт. */
export function getFileTypeInfo(fileName: string | null | undefined, contentType: string | null | undefined): FileTypeInfo {
  const ext = fileName?.split('.').pop()?.toLowerCase()
  if (ext && EXTENSION_INFO[ext]) return EXTENSION_INFO[ext]

  if (contentType?.startsWith('audio/')) return { label: 'AUD', color: CYAN }
  if (contentType?.startsWith('video/')) return { label: 'VID', color: VIOLET }
  if (contentType === 'application/pdf') return EXTENSION_INFO.pdf
  if (contentType?.includes('word')) return EXTENSION_INFO.doc
  if (contentType?.includes('sheet') || contentType?.includes('excel')) return EXTENSION_INFO.xls
  if (contentType?.includes('presentation') || contentType?.includes('powerpoint')) return EXTENSION_INFO.ppt
  if (contentType?.includes('zip') || contentType?.includes('compressed')) return EXTENSION_INFO.zip

  return DEFAULT_INFO
}

// Должно соответствовать AllowedAttachmentMimeTypes в backend/.../Files/FilesModuleApi.cs —
// проверяем на клиенте по расширению (не по File.type: браузер на некоторых ОС не знает
// MIME для .rar/.7z/.docx и отдаёт пустую строку или application/octet-stream, из-за чего
// проверка по одному только MIME-типу ложно отклоняла бы совершенно нормальные файлы).
// Бэкенд всё равно перепроверяет сам — это только быстрая обратная связь на клиенте.
export const ALLOWED_ATTACHMENT_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'webp', 'gif', 'svg',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv',
  'zip', 'rar', '7z',
  'mp3', 'wav', 'ogg', 'm4a', 'weba',
  'mp4', 'webm', 'mov',
])

export const MAX_ATTACHMENT_SIZE_BYTES = 25 * 1024 * 1024

export function isAllowedAttachment(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext && ALLOWED_ATTACHMENT_EXTENSIONS.has(ext)) return true
  // файл без расширения (или с незнакомым) — доверяем MIME-типу, если браузер его распознал
  return file.type.startsWith('image/') || file.type.startsWith('audio/') || file.type.startsWith('video/') || file.type === 'application/pdf'
}

// Должно соответствовать AvatarReplace.AllowedMimeTypes на бэкенде — уже без SVG (в отличие от
// вложений чата): аватарки рендерятся как <img src>, а неанимированный растровый набор проще
// и безопаснее, чем разрешать SVG с потенциальным script/onload внутри.
const ALLOWED_AVATAR_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif'])

export const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024

export function isAllowedAvatarImage(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext && ALLOWED_AVATAR_EXTENSIONS.has(ext)) return true
  return file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/webp' || file.type === 'image/gif'
}
