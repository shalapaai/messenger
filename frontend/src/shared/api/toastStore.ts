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

/** Лёгкий тост для мгновенной обратной связи о неудаче действия (удаление сообщения, выход из
 *  группы и т.п.) — единственный оставшийся канал для таких ошибок с тех пор, как модальный
 *  ErrorModal убрали в пользу браузерных push-уведомлений (те для этого не подходят: сообщения
 *  об ошибках формы/действия не должны уходить в системный центр уведомлений). */
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
