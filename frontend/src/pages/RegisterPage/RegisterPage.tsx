import { RegisterForm } from '../../features/auth/RegisterForm'
import { AuthLayout } from '../../widgets/AuthLayout'

function RegisterPage() {
  return (
    <AuthLayout
      title="Начните общение"
      description="Создайте аккаунт, чтобы писать пользователям, создавать личные и групповые чаты."
    >
      <RegisterForm />
    </AuthLayout>
  )
}

export default RegisterPage