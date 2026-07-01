import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { register, verifyOtp } from '../api/authApi'
import { saveAuthTokens } from '../../../shared/lib/auth/authTokens'
import { isValidEmail } from '../../../shared/lib/validation/isValidEmail'
import styles from './RegisterForm.module.css'

function RegisterForm() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [email, setEmail]               = useState('')
  const [password, setPassword]         = useState('')
  const [repeatPassword, setRepeatPassword] = useState('')
  const [error, setError]               = useState('')
  const [isLoading, setIsLoading]       = useState(false)

  // OTP state
  const [otpEmail, setOtpEmail]     = useState<string | null>(null)
  const [otpCode, setOtpCode]       = useState('')
  const [otpError, setOtpError]     = useState('')
  const [otpLoading, setOtpLoading] = useState(false)

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault()

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
      const result = await register({ email: email.trim(), password })

      if (result.requiresOtp) {
        setOtpEmail(result.email!)
      } else {
        saveAuthTokens({ accessToken: result.accessToken!, refreshToken: result.refreshToken })
        navigate('/profile/setup')
      }
    } catch {
      setError(t('auth.errors.registerFailed'))
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
      navigate('/profile/setup')
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
          <h2 className={styles.title}>Подтверждение email</h2>
          <p className={styles.subtitle}>
            Код отправлен на <strong>{otpEmail}</strong>. Введите его для завершения регистрации.
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
        <h2 className={styles.title}>{t('auth.registerTitle')}</h2>
        <p className={styles.subtitle}>{t('auth.registerSubtitle')}</p>
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
          onChange={e => setRepeatPassword(e.target.value)}
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
