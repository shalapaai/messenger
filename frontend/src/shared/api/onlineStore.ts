import { create } from 'zustand'

interface OnlineState {
  statuses: Record<string, boolean>
  setOnline: (userId: string, isOnline: boolean) => void
}

export const useOnlineStore = create<OnlineState>((set) => ({
  statuses: {},
  setOnline: (userId, isOnline) =>
    set((s) => ({ statuses: { ...s.statuses, [userId]: isOnline } })),
}))

export function useIsOnline(userId: string | undefined): boolean {
  return useOnlineStore((s) => (userId ? (s.statuses[userId] ?? false) : false))
}
