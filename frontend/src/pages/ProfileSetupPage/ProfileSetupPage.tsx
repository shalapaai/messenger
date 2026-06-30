import { useTranslation } from 'react-i18next'
import { ProfileSetupForm } from '../../features/profile/ProfileSetupForm'
import { AuthLayout } from '../../widgets/AuthLayout'
import styles from './ProfileSetupPage.module.css'

function ProfileSetupPage() {
  const { t } = useTranslation()

  return (
    <div className={styles.page}>
      <div className={styles.blobPrimary} />
      <div className={styles.blobSecondary} />
      <div className={styles.blobAccent} />

      <AuthLayout
        title={t('profileSetup.heroTitle')}
        description={t('profileSetup.heroDescription')}
        isTitleWrapped
      >
        <ProfileSetupForm />
      </AuthLayout>
    </div>
  )
}

export default ProfileSetupPage
