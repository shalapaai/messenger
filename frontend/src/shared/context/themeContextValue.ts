import { createContext } from 'react'

export type ThemeMode = 'light' | 'dark'
export type AccentColor = 'blue' | 'red' | 'green' | 'violet' | 'orange'

export const accentColors: AccentColor[] = ['blue', 'red', 'green', 'violet', 'orange']

export interface ThemeContextValue {
  themeMode: ThemeMode
  accentColor: AccentColor
  setThemeMode: (themeMode: ThemeMode) => void
  setAccentColor: (accentColor: AccentColor) => void
  toggleThemeMode: () => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)
