import { useTranslation } from 'react-i18next'
import { RegisterForm } from '../../features/auth/RegisterForm'
import { AuthLayout } from '../../widgets/AuthLayout'

function RegisterPage() {
  const { t } = useTranslation()

  return (
    <AuthLayout
      title={t('auth.registerHeroTitle')}
      description={t('auth.registerHeroDescription')}
    >
      <RegisterForm />
    </AuthLayout>
  )
}

export default RegisterPage
