import { create } from 'zustand'

export interface ToastItem {
  id: number
  message: string
}

interface ToastState {
  toasts: ToastItem[]
  showToast: (message: string) => void
  dismissToast: (id: number) => void
}

let nextToastId = 0

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  showToast: (message) =>
    set((s) => ({ toasts: [...s.toasts, { id: nextToastId++, message }] })),
  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((toast) => toast.id !== id) })),
}))

export function showToast(message: string): void {
  useToastStore.getState().showToast(message)
}
