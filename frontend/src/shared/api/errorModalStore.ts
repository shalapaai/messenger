import { create } from 'zustand'

interface ErrorModalState {
  message: string | null
  showError: (message: string) => void
  hideError: () => void
}

/** Общий на всё приложение стор для модалки ошибок — showError можно звать откуда угодно
 *  (в том числе не из компонента, через .getState()), не пробрасывая колбэки через пропсы. */
export const useErrorModalStore = create<ErrorModalState>((set) => ({
  message: null,
  showError: (message) => set({ message }),
  hideError: () => set({ message: null }),
}))
