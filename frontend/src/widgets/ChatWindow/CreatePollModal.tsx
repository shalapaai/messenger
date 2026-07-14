import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TrashIcon } from './icons'
import s from './ChatWindow.module.css'

const MIN_OPTIONS = 2
const MAX_OPTIONS = 10

interface CreatePollModalProps {
  onClose: () => void
  onCreate: (question: string, options: string[]) => Promise<void>
}

export function CreatePollModal({ onClose, onCreate }: CreatePollModalProps) {
  const { t } = useTranslation()
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState<string[]>(['', ''])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(false)

  const trimmedOptions = options.map(o => o.trim()).filter(o => o.length > 0)
  const canSubmit = question.trim().length > 0 && trimmedOptions.length >= MIN_OPTIONS && !submitting

  function updateOption(index: number, value: string) {
    setOptions(prev => prev.map((o, i) => i === index ? value : o))
  }

  function removeOption(index: number) {
    setOptions(prev => prev.filter((_, i) => i !== index))
  }

  function addOption() {
    setOptions(prev => prev.length < MAX_OPTIONS ? [...prev, ''] : prev)
  }

  async function handleSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    setError(false)
    try {
      await onCreate(question.trim(), trimmedOptions)
    } catch {
      setError(true)
      setSubmitting(false)
    }
  }

  return (
    <div className={s.modalOverlay} onClick={onClose}>
      <div className={s.modalPanel} onClick={e => e.stopPropagation()}>
        <button type="button" className={s.modalClose} onClick={onClose} aria-label={t('common.close')}>✕</button>
        <div className={s.modalTitle}>{t('poll.createTitle')}</div>

        <label className={s.modalField}>
          <span className={s.modalFieldLabel}>{t('poll.questionLabel')}</span>
          <input
            className={s.modalFieldInput}
            value={question}
            onChange={e => setQuestion(e.target.value)}
            placeholder={t('poll.questionPlaceholder')}
            maxLength={300}
            autoFocus
          />
        </label>

        <div className={s.pollOptionsList}>
          {options.map((option, index) => (
            <div key={index} className={s.pollOptionRow}>
              <input
                className={s.modalFieldInput}
                value={option}
                onChange={e => updateOption(index, e.target.value)}
                placeholder={t('poll.optionPlaceholder', { number: index + 1 })}
                maxLength={100}
              />
              {options.length > MIN_OPTIONS && (
                <button
                  type="button"
                  className={s.pollOptionRemoveBtn}
                  onClick={() => removeOption(index)}
                  aria-label={t('common.cancel')}
                >
                  <TrashIcon />
                </button>
              )}
            </div>
          ))}
        </div>

        {options.length < MAX_OPTIONS && (
          <button type="button" className={s.pollAddOptionBtn} onClick={addOption}>
            + {t('poll.addOption')}
          </button>
        )}

        {trimmedOptions.length < MIN_OPTIONS && (
          <div className={s.pollHint}>{t('poll.minOptionsHint')}</div>
        )}

        {error && <div className={s.modalFormError}>{t('poll.createFailed')}</div>}

        <div className={s.modalActions}>
          <button type="button" className={s.modalCancelBtn} onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="button" className={s.modalSaveBtn} disabled={!canSubmit} onClick={handleSubmit}>
            {submitting ? t('poll.creating') : t('poll.create')}
          </button>
        </div>
      </div>
    </div>
  )
}
