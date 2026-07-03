import { Skeleton } from '../../shared/ui/Skeleton'
import s from './MessagesSkeleton.module.css'

const FULL_ITEMS = [
  { side: 'left', width: '58%' },
  { side: 'right', width: '42%' },
  { side: 'left', width: '68%' },
  { side: 'right', width: '54%' },
  { side: 'left', width: '46%' },
  { side: 'right', width: '62%' },
] as const

const COMPACT_ITEMS = [
  { side: 'left', width: '52%' },
  { side: 'right', width: '38%' },
  { side: 'left', width: '64%' },
] as const

interface MessagesSkeletonProps {
  compact?: boolean
}

export function MessagesSkeleton({ compact = false }: MessagesSkeletonProps) {
  const items = compact ? COMPACT_ITEMS : FULL_ITEMS

  return (
    <div
      className={`${s.wrapper} ${compact ? s.compact : ''}`}
      aria-hidden="true"
    >
      {items.map((item, index) => (
        <div
          key={index}
          className={`${s.row} ${item.side === 'right' ? s.rowRight : ''}`}
        >
          {item.side === 'left' && <Skeleton className={s.avatar} />}

          <div className={s.messageGroup}>
            <Skeleton className={s.bubble} style={{ width: item.width }} />
            <Skeleton className={s.time} />
          </div>
        </div>
      ))}
    </div>
  )
}
