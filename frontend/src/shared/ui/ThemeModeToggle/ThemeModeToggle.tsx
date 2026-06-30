import { useTheme } from '../../context/useTheme'
import s from './ThemeModeToggle.module.css'

interface ThemeModeToggleProps {
  className?: string
}

export function ThemeModeToggle({ className = '' }: ThemeModeToggleProps) {
  const { themeMode, toggleThemeMode } = useTheme()
  const isDark = themeMode === 'dark'
  const label = isDark ? 'Включить светлую тему' : 'Включить тёмную тему'

  return (
    <button
      type="button"
      className={`${s.toggle} ${className}`}
      onClick={toggleThemeMode}
      aria-label={label}
      title={label}
    >
      <span aria-hidden="true" className={s.icon}>{isDark ? '☀' : '☾'}</span>
    </button>
  )
}
