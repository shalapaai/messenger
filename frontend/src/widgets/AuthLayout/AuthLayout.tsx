import type { ReactNode } from 'react'
import styles from './AuthLayout.module.css'

type AuthLayoutProps = {
  title: string
  description: string
  children: ReactNode
  isTitleWrapped?: boolean
}

function AuthLayout({ title, description, children, isTitleWrapped = false}: AuthLayoutProps) {
  return (
    <main className={`${styles.authLayout} ${isTitleWrapped ? styles.titleWrapped : ''}`}>
      <section className={styles.hero}>
        <p className={styles.label}>TL:Messenger</p>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.description}>{description}</p>
      </section>

      <section className={styles.card}>
        {children}
      </section>
    </main>
  )
}

export default AuthLayout