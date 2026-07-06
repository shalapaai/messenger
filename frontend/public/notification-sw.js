self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim())
})

function getChatIdFromPathname(pathname) {
  const match = pathname.match(/^\/chats\/([^/]+)$/)
  return match ? match[1] : null
}

function sameChatId(left, right) {
  return Boolean(left && right && String(left).toLowerCase() === String(right).toLowerCase())
}

function requestActiveChat(client) {
  return new Promise((resolve) => {
    const channel = new MessageChannel()
    const timeout = setTimeout(() => resolve(null), 200)

    channel.port1.onmessage = (event) => {
      clearTimeout(timeout)
      resolve(event.data || null)
    }

    client.postMessage({ type: 'GET_ACTIVE_CHAT' }, [channel.port2])
  })
}

self.addEventListener('push', (event) => {
  if (!event.data) return

  const payload = event.data.json()
  const title = payload.title || 'TL:Messenger'
  const notificationUrl = payload.url || '/chats'
  const target = new URL(notificationUrl, self.location.origin)
  const targetChatId = payload.chatId || getChatIdFromPathname(target.pathname)
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/favicon.svg',
    badge: '/favicon.svg',
    tag: payload.tag || `message-${Date.now()}`,
    data: { url: notificationUrl },
  }

  event.waitUntil((async () => {
    const clientList = await clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    })

    const targetChatIsVisible = await clientList.reduce(async (previousResult, client) => {
      if (await previousResult) return true

      const clientUrl = new URL(client.url)
      if (clientUrl.origin !== self.location.origin || client.visibilityState !== 'visible') return false

      const activeChat = await requestActiveChat(client)
      return (
        sameChatId(activeChat?.chatId, targetChatId) ||
        sameChatId(activeChat?.directUserId, payload.senderId) ||
        sameChatId(getChatIdFromPathname(clientUrl.pathname), targetChatId)
      )
    }, Promise.resolve(false))

    if (targetChatIsVisible) return

    await self.registration.showNotification(title, options)
  })())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const rawUrl = event.notification.data && event.notification.data.url
  const targetUrl = new URL(rawUrl || '/', self.location.origin).href

  event.waitUntil((async () => {
    const clientList = await clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    })

    for (const client of clientList) {
      const clientUrl = new URL(client.url)
      const target = new URL(targetUrl)

      if (clientUrl.origin !== target.origin) continue

      if ('navigate' in client && client.url !== targetUrl) {
        const navigatedClient = await client.navigate(targetUrl)
        if (navigatedClient && 'focus' in navigatedClient) {
          return navigatedClient.focus()
        }
      }

      if ('focus' in client) return client.focus()
    }

    if (clients.openWindow) return clients.openWindow(targetUrl)
    return undefined
  })())
})
