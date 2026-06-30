import { useTranslation } from 'react-i18next'
import { LoginForm } from '../../features/auth/LoginForm'
import { AuthLayout } from '../../widgets/AuthLayout'

function LoginPage() {
  const { t } = useTranslation()

  return (
    <AuthLayout
      isTitleWrapped
      title={t('auth.loginHeroTitle')}
      description={t('auth.loginHeroDescription')}
    >
      <LoginForm />
    </AuthLayout>
  )
}

export default LoginPage
