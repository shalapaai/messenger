import { useState } from 'react'
import s from './AvatarImage.module.css'

interface AvatarImageProps {
  src: string
  alt: string
  className?: string
}

export function AvatarImage({ src, alt, className = '' }: AvatarImageProps) {
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null)
  const loaded = loadedSrc === src

  return (
    <span
      className={`${s.root} ${loaded ? s.loaded : s.loading} ${className}`}
      aria-hidden={!loaded}
    >
      <img
        src={src}
        alt={alt}
        className={s.image}
        onLoad={() => setLoadedSrc(src)}
      />
    </span>
  )
}
