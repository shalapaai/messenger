import { getFileTypeInfo } from '../../lib/fileType'
import s from './FileTypeIcon.module.css'

interface FileTypeIconProps {
  fileName: string | null | undefined
  contentType: string | null | undefined
  size?: number
}

export function FileTypeIcon({ fileName, contentType, size = 40 }: FileTypeIconProps) {
  const { label, color } = getFileTypeInfo(fileName, contentType)

  return (
    <div className={s.icon} style={{ width: size, height: size, background: color }}>
      <span className={s.label} style={{ fontSize: Math.max(8, size * 0.24) }}>{label}</span>
    </div>
  )
}
