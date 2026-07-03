import { Skeleton } from '../../shared/ui/Skeleton'
import s from './ChatListSkeleton.module.css'

interface ChatListSkeletonProps {
  count?: number
}

export function ChatListSkeleton({ count = 7 }: ChatListSkeletonProps) {
  return (
    <div className={s.list} aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div className={s.item} key={index}>
          <Skeleton className={s.avatar} />

          <div className={s.content}>
            <Skeleton className={s.title} />
            <Skeleton className={s.subtitle} />
          </div>

          <Skeleton className={s.time} />
        </div>
      ))}
    </div>
  )
}
