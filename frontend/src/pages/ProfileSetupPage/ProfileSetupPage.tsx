import { ProfileSetupForm } from '../../features/profile/ProfileSetupForm'
import { AuthLayout } from '../../widgets/AuthLayout'
import styles from './ProfileSetupPage.module.css'

function ProfileSetupPage() {
  return (
    <div className={styles.page}>
      <div className={styles.blobPrimary} />
      <div className={styles.blobSecondary} />
      <div className={styles.blobAccent} />

      <AuthLayout
        title="Настройте профиль"
        description="Добавьте имя, статус и аватар, чтобы собеседникам было проще узнать вас."
        isTitleWrapped
      >
        <ProfileSetupForm />
      </AuthLayout>
    </div>
  )
}

export default ProfileSetupPage
