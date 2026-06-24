import { LoginForm } from '../../features/auth/LoginForm'
import { AuthLayout } from '../../widgets/AuthLayout'

function LoginPage() {
  return (
    <AuthLayout
      isTitleWrapped
      title="Мессенджер для команды"
      description="Войдите в аккаунт, чтобы продолжить общение, открыть чаты и не потерять важные сообщения."
    >
      <LoginForm />
    </AuthLayout>
  )
}

export default LoginPage