import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { logout } from '../../features/auth/api/authApi'
import { clearAuthTokens } from '../../shared/lib/auth/authTokens'
import { useChatsStore } from '../../shared/api/chatsStore'
import { useUserProfile } from '../../shared/context/useUserProfile'
import { useTheme } from '../../shared/context/useTheme'
import { accentColors, type AccentColor } from '../../shared/context/themeContextValue'
import { ThemeModeToggle } from '../../shared/ui/ThemeModeToggle'
import { LanguageSwitcher } from '../../shared/ui/LanguageSwitcher'
import { AvatarImage } from '../../shared/ui/AvatarImage'
import {
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
  unsubscribePushNotifications,
  type BrowserNotificationPermission,
} from '../../shared/lib/notifications'
import { getCurrentLocale } from '../../shared/i18n'
import type { UserProfile } from '../../shared/types/user'
import s from './ProfilePanel.module.css'

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

interface ProfilePanelProps {
  isOpen: boolean
  profile: UserProfile
  totalUnread: number
  onClose: () => void
  onEdit: () => void
  onChats: () => void
}

function getInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return displayName.slice(0, 2).toUpperCase()
}

function formatDate(isoDate: string, locale: string): string {
  return new Date(isoDate).toLocaleDateString(locale, { year: 'numeric', month: 'long' })
}

export function ProfilePanel({ isOpen, profile, totalUnread, onClose, onEdit, onChats }: ProfilePanelProps) {
  const { i18n, t } = useTranslation()
  const navigate = useNavigate()
  const { clearProfile } = useUserProfile()
  const { accentColor, setAccentColor } = useTheme()
  const [notificationPermission, setNotificationPermission] =
    useState<BrowserNotificationPermission>(() => getBrowserNotificationPermission())

  if (!isOpen) return null

  async function handleLogout() {
    try {
      await unsubscribePushNotifications()
      await logout()
    } finally {
      clearAuthTokens()
      clearProfile()
      useChatsStore.getState().reset()
      navigate('/login')
    }
  }

  async function handleEnableNotifications() {
    const permission = await requestBrowserNotificationPermission()
    setNotificationPermission(permission)
  }

  const initials = getInitials(profile.displayName)

  return (
    <>
      <div className={s.panelBg} onClick={onClose} />
      <div className={s.profilePanel}>
        <div className={s.ppMobileBar}>
          <button type="button" className={s.backBtn} onClick={onClose}>‹</button>
        </div>
        <button type="button" className={s.ppClose} onClick={onClose}>✕</button>

        <div className={s.ppScrollArea}>
          <div className={s.ppCover} />
          <div className={s.ppBody}>
            {profile.avatarUrl ? (
              <AvatarImage className={s.ppAvatar} src={profile.avatarUrl} alt={profile.displayName} />
            ) : (
              <div className={s.ppAvatar} style={{ background: profile.avatarColor, color: '#fff' }}>{initials}</div>
            )}
            <div className={s.ppStatusBadge}><span className={s.ppStatusDot} />{t('common.online')}</div>
            <h2 className={s.ppName}>{profile.displayName}</h2>
            {profile.login && <div className={s.ppUsername}>{profile.login}</div>}
            {profile.status && <p className={s.ppBio}>{profile.status}</p>}
            <div className={s.ppTags}>
              {profile.city && <span className={s.ppTag}>📍 {profile.city}</span>}
              <span className={s.ppTag}><CalendarIcon /> {formatDate(profile.registeredAt, getCurrentLocale(i18n.language))}</span>
            </div>
            <div className={s.ppDivider} />
            <div className={s.ppDetails}>
              <div className={s.ppDetailRow}><span className={s.ppDetailLabel}>{t('profile.email')}</span><span className={s.ppDetailValue}>{profile.email}</span></div>
              {profile.phone && <div className={s.ppDetailRow}><span className={s.ppDetailLabel}>{t('common.phone')}</span><span className={s.ppDetailValue}>{profile.phone}</span></div>}
              {profile.department && <div className={s.ppDetailRow}><span className={s.ppDetailLabel}>{t('common.department')}</span><span className={s.ppDetailValue}>{profile.department}</span></div>}
            </div>
            <div className={s.ppDivider} />
            <div className={s.ppThemeSettings}>
              <div className={s.ppSettingsHeader}>
                <span className={s.ppSettingsTitle}>{t('theme.appearance')}</span>
                <ThemeModeToggle />
              </div>
              <div className={s.ppAccentList} aria-label={t('theme.accentColor')}>
                {accentColors.map((color: AccentColor) => (
                  <button
                    key={color}
                    type="button"
                    className={`${s.ppAccentSwatch} ${accentColor === color ? s.ppAccentSwatchActive : ''}`}
                    data-accent-color={color}
                    onClick={() => setAccentColor(color)}
                    aria-label={t('theme.chooseAccent', { color })}
                    aria-pressed={accentColor === color}
                  />
                ))}
              </div>
              <div className={s.ppSettingsHeader}>
                <span className={s.ppSettingsTitle}>{t('language.label')}</span>
                <LanguageSwitcher />
              </div>
              <div className={s.ppSettingsHeader}>
                <span className={s.ppSettingsTitle}>{t('notifications.label')}</span>
                {notificationPermission === 'granted' ? (
                  <span className={s.ppSettingStatus}>{t('notifications.enabled')}</span>
                ) : (
                  <button
                    type="button"
                    className={s.ppSettingAction}
                    onClick={handleEnableNotifications}
                    disabled={notificationPermission === 'denied' || notificationPermission === 'unsupported'}
                  >
                    {notificationPermission === 'denied'
                      ? t('notifications.blocked')
                      : notificationPermission === 'unsupported'
                        ? t('notifications.unsupported')
                        : t('notifications.enable')}
                  </button>
                )}
              </div>
            </div>
            <button className={s.ppEditBtn} onClick={onEdit}>✎ {t('profile.edit')}</button>
            <button className={s.ppLogoutBtn} onClick={handleLogout}>{t('profile.logoutAccount')}</button>
          </div>
        </div>

        <nav className={s.ppBottomNav}>
          <button className={s.bnItem} onClick={() => { onClose(); onChats() }}>
            <span className={s.bnGlyph}>💬{totalUnread > 0 && <span className={s.bnBadge}>{totalUnread}</span>}</span>
            <span>{t('profile.chats')}</span>
          </button>
          <button className={`${s.bnItem} ${s.bnItemActive}`}>
            <span className={s.bnAvatarMini} style={{ background: profile.avatarColor }}>{initials}</span>
            <span>{t('profile.profile')}</span>
          </button>
        </nav>
      </div>
    </>
  )
}
