import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { forgotPassword, resetPassword } from '../api/authApi'
import styles from '../LoginForm/LoginForm.module.css'

type Step = 'email' | 'code'

function ForgotPasswordForm() {
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
      setError('Не удалось отправить код. Попробуйте позже.')
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
      setError('Неверный или устаревший код. Попробуйте ещё раз.')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'code') {
    return (
      <form className={styles.form} onSubmit={handleResetSubmit} noValidate>
        <div className={styles.header}>
          <h2 className={styles.title}>Новый пароль</h2>
          <p className={styles.subtitle}>
            Код отправлен на <strong>{email}</strong>. Введите его и придумайте новый пароль.
          </p>
        </div>

        <label className={styles.field}>
          <span className={styles.label}>Код из письма</span>
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
          <span className={styles.label}>Новый пароль</span>
          <input
            className={styles.input}
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            placeholder="Минимум 8 символов"
            autoComplete="new-password"
          />
        </label>

        {error && <p className={styles.error}>{error}</p>}

        <button
          className={styles.button}
          type="submit"
          disabled={loading || code.length !== 6 || newPassword.length < 8}
        >
          {loading ? 'Сохраняем…' : 'Сохранить пароль'}
        </button>

        <button
          type="button"
          className={styles.footerText}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          onClick={() => { setStep('email'); setCode(''); setError('') }}
        >
          ← Вернуться
        </button>
      </form>
    )
  }

  return (
    <form className={styles.form} onSubmit={handleEmailSubmit} noValidate>
      <div className={styles.header}>
        <h2 className={styles.title}>Забыли пароль?</h2>
        <p className={styles.subtitle}>
          Введите email — мы отправим код для сброса пароля.
        </p>
      </div>

      <label className={styles.field}>
        <span className={styles.label}>Email</span>
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
        {loading ? 'Отправляем…' : 'Отправить код'}
      </button>

      <p className={styles.footerText}>
        Вспомнили пароль? <a href="/login">Войти</a>
      </p>
    </form>
  )
}

export default ForgotPasswordForm
