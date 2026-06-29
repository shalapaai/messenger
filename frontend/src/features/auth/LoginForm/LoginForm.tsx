import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { login } from '../api/authApi'
import { saveAuthTokens } from '../../../shared/lib/auth/authTokens'
import { isValidEmail } from '../../../shared/lib/validation/isValidEmail'
import { useUserProfile } from '../../../shared/context/useUserProfile'
import styles from './LoginForm.module.css'

function LoginForm() {
  const navigate = useNavigate()
  const { refetchProfile } = useUserProfile()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!email.trim() || !password.trim()) {
      setError('Заполните электронную почту и пароль')
      return
    }

    if (!isValidEmail(email)) {
      setError('Введите электронную почту в правильном формате')
      return
    }

    setError('')
    setIsLoading(true)

    try {
      const tokens = await login({
        email: email.trim(),
        password,
      })

      saveAuthTokens(tokens)
      console.log('[Login] tokens saved:', tokens)
      const profile = await refetchProfile()
      console.log('[Login] profile after fetch:', profile)
      navigate(profile ? '/chats' : '/profile/setup')
    } catch {
      setError('Не удалось войти. Проверьте почту и пароль')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.header}>
        <h2 className={styles.title}>Вход</h2>
        <p className={styles.subtitle}>Введите данные, чтобы продолжить общение.</p>
      </div>

      <label className={styles.field}>
        <span className={styles.label}>Электронная почта</span>
        <input
          className={styles.input}
          type="email"
          name="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Введите email"
          autoComplete="email"
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Пароль</span>
        <input
          className={styles.input}
          type="password"
          name="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Введите пароль"
          autoComplete="current-password"
        />
      </label>

      {error && <p className={styles.error}>{error}</p>}

      <button className={styles.button} type="submit" disabled={isLoading}>
        {isLoading ? 'Входим...' : 'Войти'}
      </button>

      <p className={styles.footerText}>
        Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
      </p>
    </form>
  )
}

export default LoginForm
