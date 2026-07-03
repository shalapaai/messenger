import { Skeleton } from '../../shared/ui/Skeleton'
import s from './UserListSkeleton.module.css'

interface UserListSkeletonProps {
  count?: number
  showMeta?: boolean
}

export function UserListSkeleton({
  count = 3,
  showMeta = false,
}: UserListSkeletonProps) {
  return (
    <div className={s.list} aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div className={s.row} key={index}>
          <Skeleton className={s.avatar} />

          <div className={s.info}>
            <Skeleton className={s.name} />
            <Skeleton className={s.sub} />
          </div>

          {showMeta && <Skeleton className={s.meta} />}
        </div>
      ))}
    </div>
  )
}
