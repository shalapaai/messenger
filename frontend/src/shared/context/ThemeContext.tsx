import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  accentColors,
  type AccentColor,
  type ThemeMode,
  ThemeContext,
} from './themeContextValue'

const THEME_STORAGE_KEY = 'messenger_theme_mode'
const ACCENT_STORAGE_KEY = 'messenger_accent_color'

function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'light' || value === 'dark'
}

function isAccentColor(value: string | null): value is AccentColor {
  return accentColors.includes(value as AccentColor)
}

function getSystemThemeMode(): ThemeMode {
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }

  return 'light'
}

function getInitialThemeMode(): ThemeMode {
  if (typeof localStorage === 'undefined') {
    return getSystemThemeMode()
  }

  const stored = localStorage.getItem(THEME_STORAGE_KEY)
  return isThemeMode(stored) ? stored : getSystemThemeMode()
}

function getInitialAccentColor(): AccentColor {
  if (typeof localStorage === 'undefined') {
    return 'blue'
  }

  const stored = localStorage.getItem(ACCENT_STORAGE_KEY)
  return isAccentColor(stored) ? stored : 'blue'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(getInitialThemeMode)
  const [accentColor, setAccentColorState] = useState<AccentColor>(getInitialAccentColor)

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode
    localStorage.setItem(THEME_STORAGE_KEY, themeMode)
  }, [themeMode])

  useEffect(() => {
    document.documentElement.dataset.accent = accentColor
    localStorage.setItem(ACCENT_STORAGE_KEY, accentColor)
  }, [accentColor])

  const value = useMemo(
    () => ({
      themeMode,
      accentColor,
      setThemeMode: setThemeModeState,
      setAccentColor: setAccentColorState,
      toggleThemeMode: () => setThemeModeState((current) => current === 'dark' ? 'light' : 'dark'),
    }),
    [accentColor, themeMode],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
