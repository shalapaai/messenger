import { Skeleton } from '../../shared/ui/Skeleton'
import s from './AppLoadingSkeleton.module.css'

export function AppLoadingSkeleton() {
  return (
    <div className={s.shell} aria-hidden="true">
      <aside className={s.sidebar}>
        <Skeleton className={s.logo} />
        <Skeleton className={s.search} />

        <div className={s.tabs}>
          <Skeleton className={s.tab} />
          <Skeleton className={s.tab} />
          <Skeleton className={s.tab} />
        </div>

        <div className={s.list}>
          {Array.from({ length: 6 }).map((_, index) => (
            <div className={s.row} key={index}>
              <Skeleton className={s.avatar} />
              <div className={s.rowText}>
                <Skeleton className={s.rowTitle} />
                <Skeleton className={s.rowSubtitle} />
              </div>
            </div>
          ))}
        </div>
      </aside>

      <main className={s.main}>
        <Skeleton className={s.emptyIcon} />
        <Skeleton className={s.emptyTitle} />
        <Skeleton className={s.emptySubtitle} />
      </main>
    </div>
  )
}
