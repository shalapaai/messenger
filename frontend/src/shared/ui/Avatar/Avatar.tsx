import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { AvatarImage } from '../AvatarImage'
import styles from './Avatar.module.css'

type AvatarProps = {
  src?: string
  name: string
  size?: 'small' | 'medium' | 'large'
  color?: string
}

const avatarBackgrounds = [
  'linear-gradient(135deg, #2563eb, #38bdf8)',
  'linear-gradient(135deg, #7c3aed, #c084fc)',
  'linear-gradient(135deg, #db2777, #fb7185)',
  'linear-gradient(135deg, #ea580c, #facc15)',
  'linear-gradient(135deg, #059669, #34d399)',
  'linear-gradient(135deg, #0891b2, #67e8f9)',
  'linear-gradient(135deg, #4f46e5, #818cf8)',
]

function getRandomAvatarBackground() {
  const randomIndex = Math.floor(Math.random() * avatarBackgrounds.length)
  return avatarBackgrounds[randomIndex]
}

function Avatar({ src, name, size = 'medium', color }: AvatarProps) {
  const { t } = useTranslation()
  const avatarClassName = `${styles.avatar} ${styles[size]}`
  const trimmed = name.trim()
  const words = trimmed.split(/\s+/)
  const fallbackLetter = trimmed
    ? words.length >= 2 ? (words[0][0] + words[1][0]).toUpperCase() : trimmed.slice(0, 2).toUpperCase()
    : '?'

  const fallbackBackground = useMemo(() => color ?? getRandomAvatarBackground(), [color])

  if (src) {
    return <AvatarImage src={src} alt={name} className={avatarClassName} />
  }

  return (
    <div
      className={avatarClassName}
      role="img"
      aria-label={name || t('avatar.fallbackLabel')}
      style={{ background: fallbackBackground }}
    >
      {fallbackLetter}
    </div>
  )
}

export default Avatar
