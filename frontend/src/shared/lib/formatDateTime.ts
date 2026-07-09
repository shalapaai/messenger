import i18n, { getCurrentLocale } from '../i18n'

function isSameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString()
}

function yesterdayOf(now: Date): Date {
  const d = new Date(now)
  d.setDate(now.getDate() - 1)
  return d
}

export function formatMessageTime(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function formatChatListTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  if (isSameDay(d, now)) return formatMessageTime(iso)
  if (isSameDay(d, yesterdayOf(now))) return i18n.t('common.yesterday')
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function formatDateLabel(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  if (isSameDay(d, now)) return i18n.t('common.today')
  if (isSameDay(d, yesterdayOf(now))) return i18n.t('common.yesterday')
  return d.toLocaleDateString(getCurrentLocale(), { day: 'numeric', month: 'long' })
}

export function dateKey(iso: string): string {
  return new Date(iso).toDateString()
}
