import { apiClient } from './apiClient'

export interface VapidPublicKeyResponse {
  publicKey: string
}

export interface PushSubscriptionPayload {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

export async function fetchVapidPublicKey(): Promise<string> {
  const { data } = await apiClient.get<VapidPublicKeyResponse>('/notifications/vapid-public-key')
  return data.publicKey
}

export async function savePushSubscription(subscription: PushSubscriptionPayload): Promise<void> {
  await apiClient.post('/notifications/subscriptions', subscription)
}

export async function deletePushSubscription(endpoint: string): Promise<void> {
  await apiClient.delete('/notifications/subscriptions', { data: { endpoint } })
}
