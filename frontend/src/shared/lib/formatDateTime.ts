import i18n, { getCurrentLocale } from '../i18n'

function isSameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString()
}

function yesterdayOf(now: Date): Date {
  const d = new Date(now)
  d.setDate(now.getDate() - 1)
  return d
}

/** Время сообщения — всегда 24-часовой формат (13:05, не 1:05 PM), не зависящий от языка
 *  интерфейса: смена языка — это перевод слов, а не смена системы счисления времени суток. */
export function formatMessageTime(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Время/дата последнего сообщения для превью в списке чатов: сегодня — время, вчера — слово
 *  "Вчера"/"Yesterday", иначе — короткая дата ДД.ММ (тоже фиксированного вида, не MM/DD). */
export function formatChatListTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  if (isSameDay(d, now)) return formatMessageTime(iso)
  if (isSameDay(d, yesterdayOf(now))) return i18n.t('common.yesterday')
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Метка-разделитель дат в переписке ("Сегодня" / "Вчера" / "5 июля") — считается заново при
 *  каждом вызове, чтобы обновляться при смене языка интерфейса без перезагрузки чата. */
export function formatDateLabel(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  if (isSameDay(d, now)) return i18n.t('common.today')
  if (isSameDay(d, yesterdayOf(now))) return i18n.t('common.yesterday')
  return d.toLocaleDateString(getCurrentLocale(), { day: 'numeric', month: 'long' })
}

/** Стабильный, не зависящий от языка ключ календарного дня — для группировки сообщений по датам.
 *  Переведённые метки (formatDateLabel) для этого не годятся: они расходятся после смены языка. */
export function dateKey(iso: string): string {
  return new Date(iso).toDateString()
}
