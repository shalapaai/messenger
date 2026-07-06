import { useTranslation } from 'react-i18next'
import { ForgotPasswordForm } from '../../features/auth/ForgotPasswordForm'
import { AuthLayout } from '../../widgets/AuthLayout'

function ForgotPasswordPage() {
  const { t } = useTranslation()

  return (
    <AuthLayout
      title={t('auth.forgotPasswordHeroTitle')}
      description={t('auth.forgotPasswordHeroDescription')}
    >
      <ForgotPasswordForm />
    </AuthLayout>
  )
}

export default ForgotPasswordPage
