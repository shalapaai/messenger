import { ForgotPasswordForm } from '../../features/auth/ForgotPasswordForm'
import { AuthLayout } from '../../widgets/AuthLayout'

function ForgotPasswordPage() {
  return (
    <AuthLayout
      title="Восстановление доступа"
      description="Введите email, и мы пришлём код для сброса пароля."
    >
      <ForgotPasswordForm />
    </AuthLayout>
  )
}

export default ForgotPasswordPage
