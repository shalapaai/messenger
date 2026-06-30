import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { register } from '../api/authApi'
import { saveAuthTokens } from '../../../shared/lib/auth/authTokens'
import { isValidEmail } from '../../../shared/lib/validation/isValidEmail'
import styles from './RegisterForm.module.css'

function RegisterForm() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [repeatPassword, setRepeatPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!email.trim() || !password.trim() || !repeatPassword.trim()) {
      setError(t('auth.errors.requiredRegister'))
      return
    }

    if (!isValidEmail(email)) {
      setError(t('auth.errors.invalidEmail'))
      return
    }

    if (password.length < 8) {
      setError(t('auth.errors.shortPassword'))
      return
    }

    if (password !== repeatPassword) {
      setError(t('auth.errors.passwordMismatch'))
      return
    }

    setError('')
    setIsLoading(true)

    try {
      const tokens = await register({
        email: email.trim(),
        password,
      })
      saveAuthTokens(tokens)
      navigate('/profile/setup')
    } catch {
      setError(t('auth.errors.registerFailed'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.header}>
        <h2 className={styles.title}>{t('auth.registerTitle')}</h2>
        <p className={styles.subtitle}>
          {t('auth.registerSubtitle')}
        </p>
      </div>

      <label className={styles.field}>
        <span className={styles.label}>{t('common.email')}</span>
        <input
          className={styles.input}
          type="email"
          name="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={t('auth.emailPlaceholder')}
          autoComplete="email"
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>{t('common.password')}</span>
        <input
          className={styles.input}
          type="password"
          name="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder={t('auth.newPasswordPlaceholder')}
          autoComplete="new-password"
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>{t('auth.repeatPassword')}</span>
        <input
          className={styles.input}
          type="password"
          name="repeatPassword"
          value={repeatPassword}
          onChange={(event) => setRepeatPassword(event.target.value)}
          placeholder={t('auth.repeatPasswordPlaceholder')}
          autoComplete="new-password"
        />
      </label>

      {error && <p className={styles.error}>{error}</p>}

      <button className={styles.button} type="submit" disabled={isLoading}>
        {isLoading ? t('auth.registerLoading') : t('auth.registerButton')}
      </button>

      <p className={styles.footerText}>
        {t('auth.registerFooter')} <Link to="/login">{t('auth.registerFooterLink')}</Link>
      </p>
    </form>
  )
}

export default RegisterForm
