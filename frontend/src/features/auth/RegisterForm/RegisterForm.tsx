import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { login, register } from '../api/authApi'
import { saveAuthTokens } from '../../../shared/lib/auth/authTokens'
import { isValidEmail } from '../../../shared/lib/validation/isValidEmail'
import { useUserProfile } from '../../../shared/context/UserProfileContext'
import styles from './RegisterForm.module.css'

function RegisterForm() {
  const navigate = useNavigate()
  const { refetchProfile } = useUserProfile()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [repeatPassword, setRepeatPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!email.trim() || !password.trim() || !repeatPassword.trim()) {
      setError('Заполните все поля')
      return
    }

    if (!isValidEmail(email)) {
      setError('Введите электронную почту в правильном формате')
      return
    }

    if (password.length < 8) {
      setError('Пароль должен быть не короче 8 символов')
      return
    }

    if (password !== repeatPassword) {
      setError('Пароли не совпадают')
      return
    }

    setError('')
    setIsLoading(true)

    try {
      const credentials = { email: email.trim(), password }

      await register(credentials)
      console.log('[Register] account created for:', credentials.email)

      const tokens = await login(credentials)
      saveAuthTokens(tokens)
      console.log('[Register] tokens saved:', tokens)

      const profile = await refetchProfile()
      console.log('[Register] profile after fetch:', profile)

      navigate('/profile/setup')
    } catch {
      setError(
        'Не удалось зарегистрироваться. Возможно, эта почта уже используется',
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.header}>
        <h2 className={styles.title}>Регистрация</h2>
        <p className={styles.subtitle}>
          Создайте аккаунт, чтобы начать пользоваться мессенджером.
        </p>
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
          placeholder="Придумайте пароль"
          autoComplete="new-password"
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Повторите пароль</span>
        <input
          className={styles.input}
          type="password"
          name="repeatPassword"
          value={repeatPassword}
          onChange={(event) => setRepeatPassword(event.target.value)}
          placeholder="Повторите пароль"
          autoComplete="new-password"
        />
      </label>

      {error && <p className={styles.error}>{error}</p>}

      <button className={styles.button} type="submit" disabled={isLoading}>
        {isLoading ? 'Создаём аккаунт...' : 'Зарегистрироваться'}
      </button>

      <p className={styles.footerText}>
        Уже есть аккаунт? <Link to="/login">Войти</Link>
      </p>
    </form>
  )
}

export default RegisterForm
