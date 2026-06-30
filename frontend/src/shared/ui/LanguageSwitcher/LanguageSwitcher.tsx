import { useTranslation } from 'react-i18next'
import type { AppLanguage } from '../../i18n'
import { supportedLanguages } from '../../i18n'
import s from './LanguageSwitcher.module.css'

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation()
  const currentLanguage = i18n.language === 'en' ? 'en' : 'ru'

  function handleLanguageChange(language: AppLanguage) {
    void i18n.changeLanguage(language)
  }

  return (
    <div className={s.switcher} role="group" aria-label={t('language.label')}>
      {supportedLanguages.map((language) => (
        <button
          key={language}
          type="button"
          className={`${s.option} ${currentLanguage === language ? s.optionActive : ''}`}
          onClick={() => handleLanguageChange(language)}
          aria-pressed={currentLanguage === language}
        >
          {t(`language.${language}`)}
        </button>
      ))}
    </div>
  )
}
