import { useMemo } from 'react'
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
  const avatarClassName = `${styles.avatar} ${styles[size]}`
  const fallbackLetter = name.trim().charAt(0).toUpperCase() || '?'

  const fallbackBackground = useMemo(() => color ?? getRandomAvatarBackground(), [color])

  if (src) {
    return <img src={src} alt={name} className={avatarClassName} />
  }

  return (
    <div
      className={avatarClassName}
      role="img"
      aria-label={name || 'Аватар пользователя'}
      style={{ background: fallbackBackground }}
    >
      {fallbackLetter}
    </div>
  )
}

export default Avatar
