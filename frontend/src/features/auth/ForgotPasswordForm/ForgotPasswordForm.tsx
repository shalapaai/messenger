import { useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { forgotPassword, resetPassword } from '../api/authApi'
import styles from '../LoginForm/LoginForm.module.css'

type Step = 'email' | 'code'

function ForgotPasswordForm() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [step, setStep]               = useState<Step>('email')
  const [email, setEmail]             = useState('')
  const [code, setCode]               = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError]             = useState('')
  const [loading, setLoading]         = useState(false)

  async function handleEmailSubmit(e: { preventDefault(): void }) {
    e.preventDefault()
    if (!email.trim()) return

    setError('')
    setLoading(true)

    try {
      await forgotPassword(email.trim())
      setStep('code')
    } catch {
      setError(t('auth.errors.forgotPasswordFailed'))
    } finally {
      setLoading(false)
    }
  }

  async function handleResetSubmit(e: { preventDefault(): void }) {
    e.preventDefault()
    if (code.length !== 6 || newPassword.length < 8) return

    setError('')
    setLoading(true)

    try {
      await resetPassword(email.trim(), code, newPassword)
      navigate('/login')
    } catch {
      setError(t('auth.errors.invalidOrExpiredCode'))
    } finally {
      setLoading(false)
    }
  }

  if (step === 'code') {
    return (
      <form className={styles.form} onSubmit={handleResetSubmit} noValidate>
        <div className={styles.header}>
          <h2 className={styles.title}>{t('auth.resetPasswordTitle')}</h2>
          <p className={styles.subtitle}>
            <Trans i18nKey="auth.resetPasswordSubtitle" values={{ email }} components={{ strong: <strong /> }} />
          </p>
        </div>

        <label className={styles.field}>
          <span className={styles.label}>{t('auth.codeFromEmailLabel')}</span>
          <input
            className={styles.input}
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
            autoFocus
            autoComplete="one-time-code"
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>{t('common.password')}</span>
          <input
            className={styles.input}
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            placeholder={t('auth.resetPasswordNewPlaceholder')}
            autoComplete="new-password"
          />
        </label>

        {error && <p className={styles.error}>{error}</p>}

        <button
          className={styles.button}
          type="submit"
          disabled={loading || code.length !== 6 || newPassword.length < 8}
        >
          {loading ? t('common.saving') : t('auth.resetPasswordSave')}
        </button>

        <button
          type="button"
          className={styles.footerText}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          onClick={() => { setStep('email'); setCode(''); setError('') }}
        >
          ← {t('common.back')}
        </button>
      </form>
    )
  }

  return (
    <form className={styles.form} onSubmit={handleEmailSubmit} noValidate>
      <div className={styles.header}>
        <h2 className={styles.title}>{t('auth.forgotPassword')}</h2>
        <p className={styles.subtitle}>{t('auth.forgotPasswordSubtitle')}</p>
      </div>

      <label className={styles.field}>
        <span className={styles.label}>{t('common.email')}</span>
        <input
          className={styles.input}
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          autoFocus
        />
      </label>

      {error && <p className={styles.error}>{error}</p>}

      <button className={styles.button} type="submit" disabled={loading || !email.trim()}>
        {loading ? t('auth.forgotPasswordSending') : t('auth.forgotPasswordSubmit')}
      </button>

      <p className={styles.footerText}>
        {t('auth.forgotPasswordFooter')} <a href="/login">{t('auth.loginFooterLink')}</a>
      </p>
    </form>
  )
}

export default ForgotPasswordForm
