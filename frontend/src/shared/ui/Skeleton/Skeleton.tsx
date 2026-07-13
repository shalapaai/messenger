import type { CSSProperties } from 'react'
import s from './Skeleton.module.css'

interface SkeletonProps {
  as?: 'div' | 'span'
  className?: string
  style?: CSSProperties
}

export function Skeleton({ as: Component = 'div', className = '', style }: SkeletonProps) {
  return (
    <Component
      className={`${s.skeleton} ${className}`}
      style={style}
      aria-hidden="true"
    />
  )
}
