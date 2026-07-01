import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { login, verifyOtp } from '../api/authApi'
import { saveAuthTokens } from '../../../shared/lib/auth/authTokens'
import { isValidEmail } from '../../../shared/lib/validation/isValidEmail'
import { useUserProfile } from '../../../shared/context/useUserProfile'
import styles from './LoginForm.module.css'

function LoginForm() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { refetchProfile } = useUserProfile()

  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [error, setError]         = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // OTP state
  const [otpEmail, setOtpEmail]     = useState<string | null>(null)
  const [otpCode, setOtpCode]       = useState('')
  const [otpError, setOtpError]     = useState('')
  const [otpLoading, setOtpLoading] = useState(false)

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault()

    if (!email.trim() || !password.trim()) {
      setError(t('auth.errors.requiredLogin'))
      return
    }
    if (!isValidEmail(email)) {
      setError(t('auth.errors.invalidEmail'))
      return
    }

    setError('')
    setIsLoading(true)

    try {
      const result = await login({ email: email.trim(), password })

      if (result.requiresOtp) {
        setOtpEmail(result.email!)
      } else {
        saveAuthTokens({ accessToken: result.accessToken!, refreshToken: result.refreshToken })
        const profile = await refetchProfile()
        navigate(profile ? '/chats' : '/profile/setup')
      }
    } catch {
      setError(t('auth.errors.loginFailed'))
    } finally {
      setIsLoading(false)
    }
  }

  async function handleOtpSubmit(e: { preventDefault(): void }) {
    e.preventDefault()
    if (!otpEmail || !otpCode.trim()) return

    setOtpError('')
    setOtpLoading(true)

    try {
      const tokens = await verifyOtp(otpEmail, otpCode.trim())
      saveAuthTokens(tokens)
      const profile = await refetchProfile()
      navigate(profile ? '/chats' : '/profile/setup')
    } catch {
      setOtpError('Неверный или устаревший код. Попробуйте ещё раз.')
    } finally {
      setOtpLoading(false)
    }
  }

  // OTP screen
  if (otpEmail) {
    return (
      <form className={styles.form} onSubmit={handleOtpSubmit} noValidate>
        <div className={styles.header}>
          <h2 className={styles.title}>Подтверждение</h2>
          <p className={styles.subtitle}>
            Код отправлен на <strong>{otpEmail}</strong>. Введите его ниже.
          </p>
        </div>

        <label className={styles.field}>
          <span className={styles.label}>Код из письма</span>
          <input
            className={styles.input}
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={otpCode}
            onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
            autoFocus
            autoComplete="one-time-code"
          />
        </label>

        {otpError && <p className={styles.error}>{otpError}</p>}

        <button className={styles.button} type="submit" disabled={otpLoading || otpCode.length !== 6}>
          {otpLoading ? 'Проверяем…' : 'Подтвердить'}
        </button>

        <button
          type="button"
          className={styles.footerText}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          onClick={() => { setOtpEmail(null); setOtpCode(''); setOtpError('') }}
        >
          ← Вернуться
        </button>
      </form>
    )
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.header}>
        <h2 className={styles.title}>{t('auth.loginTitle')}</h2>
        <p className={styles.subtitle}>{t('auth.loginSubtitle')}</p>
      </div>

      <label className={styles.field}>
        <span className={styles.label}>{t('common.email')}</span>
        <input
          className={styles.input}
          type="email"
          name="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
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
          onChange={e => setPassword(e.target.value)}
          placeholder={t('auth.passwordPlaceholder')}
          autoComplete="current-password"
        />
      </label>

      {error && <p className={styles.error}>{error}</p>}

      <button className={styles.button} type="submit" disabled={isLoading}>
        {isLoading ? t('auth.loginLoading') : t('auth.loginButton')}
      </button>

      <p className={styles.footerText}>
        {t('auth.loginFooter')} <Link to="/register">{t('auth.loginFooterLink')}</Link>
      </p>
    </form>
  )
}

export default LoginForm
