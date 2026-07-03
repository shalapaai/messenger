import type { CSSProperties } from 'react'
import s from './Skeleton.module.css'

interface SkeletonProps {
  className?: string
  style?: CSSProperties
}

export function Skeleton({ className = '', style }: SkeletonProps) {
  return (
    <div
      className={`${s.skeleton} ${className}`}
      style={style}
      aria-hidden="true"
    />
  )
}
