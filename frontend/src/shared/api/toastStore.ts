import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastItem {
  id: number
  type: ToastType
  message: string
  durationMs: number
}

interface ToastState {
  toasts: ToastItem[]
  showToast: (type: ToastType, message: string, durationMs?: number) => number
  showSuccess: (message: string, durationMs?: number) => number
  showError: (message: string, durationMs?: number) => number
  showInfo: (message: string, durationMs?: number) => number
  dismissToast: (id: number) => void
  clearToasts: () => void
}

const DEFAULT_DURATION_BY_TYPE: Record<ToastType, number> = {
  success: 3400,
  info: 3200,
  error: 4600,
}

let nextToastId = 1

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  showToast: (type, message, durationMs) => {
    const id = nextToastId++
    const toast: ToastItem = {
      id,
      type,
      message,
      durationMs: durationMs ?? DEFAULT_DURATION_BY_TYPE[type],
    }

    set((state) => ({
      toasts: [...state.toasts.filter((item) => item.message !== message || item.type !== type), toast].slice(-4),
    }))

    return id
  },

  showSuccess: (message, durationMs) => get().showToast('success', message, durationMs),
  showError: (message, durationMs) => get().showToast('error', message, durationMs),
  showInfo: (message, durationMs) => get().showToast('info', message, durationMs),

  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
  clearToasts: () => set({ toasts: [] }),
}))
