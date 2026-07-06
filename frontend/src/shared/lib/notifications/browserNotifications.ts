import {
  deletePushSubscription,
  fetchVapidPublicKey,
  savePushSubscription,
  type PushSubscriptionPayload,
} from '../../api/pushNotificationsApi'

export type BrowserNotificationPermission = NotificationPermission | 'unsupported'
interface IncomingMessageNotificationOptions {
  title: string
  body: string
  chatId: string
  notificationId?: string
  icon?: string | null
  onClick?: () => void
}

let activeNotificationChatId: string | null = getActiveChatIdFromPathname(window.location.pathname)
let activeNotificationDirectUserId: string | null = getDraftDirectUserIdFromPathname(window.location.pathname)
let activeRouteResponderReady = false

export function getBrowserNotificationPermission(): BrowserNotificationPermission {
  if (!isBrowserPushSupported()) return 'unsupported'
  return Notification.permission
}

export async function requestBrowserNotificationPermission(): Promise<BrowserNotificationPermission> {
  if (!isBrowserPushSupported()) return 'unsupported'
  const permission = await Notification.requestPermission()
  if (permission === 'granted') await syncPushSubscription()
  return permission
}

function isBrowserPushSupported(): boolean {
  return (
    window.isSecureContext &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  )
}

function toAbsoluteUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  return new URL(url, window.location.origin).toString()
}

export async function ensureNotificationRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  try {
    ensureActiveRouteResponder()
    await navigator.serviceWorker.register('/notification-sw.js', { scope: '/' })
    return navigator.serviceWorker.ready
  } catch {
    return null
  }
}

export function getActiveChatIdFromPathname(pathname: string): string | null {
  return pathname.match(/^\/chats\/([^/]+)$/)?.[1] ?? null
}

export function getDraftDirectUserIdFromPathname(pathname: string): string | null {
  return pathname.match(/^\/chats\/new\/([^/]+)$/)?.[1] ?? null
}

export function isSameNotificationId(left: string | null | undefined, right: string | null | undefined): boolean {
  return Boolean(left && right && left.toLowerCase() === right.toLowerCase())
}

function ensureActiveRouteResponder(): void {
  if (activeRouteResponderReady || !('serviceWorker' in navigator)) return

  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type !== 'GET_ACTIVE_CHAT') return

    event.ports[0]?.postMessage({
      chatId: activeNotificationChatId,
      directUserId: activeNotificationDirectUserId,
      pathname: window.location.pathname,
    })
  })

  activeRouteResponderReady = true
}

export function syncActiveNotificationRoute(pathname: string, directUserId: string | null = null): void {
  activeNotificationChatId = getActiveChatIdFromPathname(pathname)
  activeNotificationDirectUserId = directUserId

  if (!('serviceWorker' in navigator)) return
  ensureActiveRouteResponder()

  const message = {
    type: 'ACTIVE_CHAT_CHANGED',
    chatId: activeNotificationChatId,
    directUserId,
    chatPath: activeNotificationChatId ? `/chats/${activeNotificationChatId}` : null,
  }

  navigator.serviceWorker.controller?.postMessage(message)

  navigator.serviceWorker.ready
    .then((registration) => registration.active?.postMessage(message))
    .catch(() => {})
}

function base64UrlToArrayBuffer(value: string): ArrayBuffer {
  const padding = '='.repeat((4 - value.length % 4) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  const output = new Uint8Array(raw.length)

  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i)
  }

  return output.buffer
}

function keyToBase64Url(key: ArrayBuffer | null): string {
  if (!key) return ''
  const bytes = new Uint8Array(key)
  let binary = ''
  bytes.forEach(byte => { binary += String.fromCharCode(byte) })
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function toPayload(subscription: PushSubscription): PushSubscriptionPayload {
  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: keyToBase64Url(subscription.getKey('p256dh')),
      auth: keyToBase64Url(subscription.getKey('auth')),
    },
  }
}

export async function syncPushSubscription(): Promise<boolean> {
  if (!isBrowserPushSupported() || Notification.permission !== 'granted') return false

  const registration = await ensureNotificationRegistration()
  if (!registration) return false

  const publicKey = await fetchVapidPublicKey()
  if (!publicKey) return false

  const existingSubscription = await registration.pushManager.getSubscription()
  const subscription = existingSubscription ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64UrlToArrayBuffer(publicKey),
  })

  await savePushSubscription(toPayload(subscription))
  return true
}

export async function unsubscribePushNotifications(): Promise<void> {
  if (!('serviceWorker' in navigator)) return

  const registration = await navigator.serviceWorker.ready.catch(() => null)
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return

  await deletePushSubscription(subscription.endpoint).catch(() => {})
  await subscription.unsubscribe()
}

async function showBrowserNotification({
  title,
  body,
  tag,
  url,
  icon,
  onClick,
}: IncomingMessageNotificationOptions & { tag: string; url: string }): Promise<boolean> {
  if (!('Notification' in window) || !window.isSecureContext) return false
  if (Notification.permission !== 'granted') return false

  const notificationOptions: NotificationOptions = {
    body,
    icon: toAbsoluteUrl(icon),
    badge: toAbsoluteUrl('/favicon.svg'),
    tag,
    data: { url },
  }

  const registration = await ensureNotificationRegistration()

  if (registration) {
    try {
      await registration.showNotification(title, notificationOptions)
      return true
    } catch {
      return false
    }
  }

  const notification = new Notification(title, {
    ...notificationOptions,
  })

  notification.onclick = () => {
    window.focus()
    onClick?.()
    notification.close()
  }

  window.setTimeout(() => notification.close(), 8_000)
  return true
}

export function showIncomingMessageNotification(options: IncomingMessageNotificationOptions): Promise<boolean> {
  if (isSameNotificationId(getActiveChatIdFromPathname(window.location.pathname), options.chatId)) {
    return Promise.resolve(false)
  }

  return showBrowserNotification({
    ...options,
    tag: options.notificationId ? `message-${options.notificationId}` : `chat-${options.chatId}-${Date.now()}`,
    url: `/chats/${options.chatId}`,
  })
}
