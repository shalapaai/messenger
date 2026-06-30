import { useTranslation } from 'react-i18next'
import { useTheme } from '../../context/useTheme'
import s from './ThemeModeToggle.module.css'

interface ThemeModeToggleProps {
  className?: string
}

export function ThemeModeToggle({ className = '' }: ThemeModeToggleProps) {
  const { t } = useTranslation()
  const { themeMode, toggleThemeMode } = useTheme()
  const isDark = themeMode === 'dark'
  const label = isDark ? t('theme.enableLight') : t('theme.enableDark')

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
