import { Skeleton } from '../../../shared/ui/Skeleton'
import s from './UserProfileSkeleton.module.css'

const FIELD_ROWS = [72, 58, 84, 66] as const

export function UserProfileSkeleton() {
  return (
    <div className={s.wrapper} aria-hidden="true">
      <Skeleton className={s.divider} />
      <Skeleton className={s.sectionTitle} />

      {FIELD_ROWS.map((width, index) => (
        <div className={s.field} key={index}>
          <Skeleton className={s.label} />
          <Skeleton className={s.value} style={{ width: `${width}%` }} />
        </div>
      ))}
    </div>
  )
}
