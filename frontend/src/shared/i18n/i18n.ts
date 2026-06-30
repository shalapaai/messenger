import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import ru from './locales/ru.json'

export const LANGUAGE_STORAGE_KEY = 'messenger_language'
export const supportedLanguages = ['ru', 'en'] as const
export type AppLanguage = (typeof supportedLanguages)[number]

function isAppLanguage(value: string | null): value is AppLanguage {
  return value === 'ru' || value === 'en'
}

function getLanguageStorage(): Storage | null {
  if (import.meta.env.MODE === 'test') {
    return null
  }

  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage
  } catch {
    return null
  }
}

function getBrowserLanguage(): AppLanguage {
  if (import.meta.env.MODE === 'test') {
    return 'ru'
  }

  if (typeof navigator === 'undefined') {
    return 'en'
  }

  const browserLanguage = navigator.languages?.[0] ?? navigator.language

  return browserLanguage.toLowerCase().startsWith('ru') ? 'ru' : 'en'
}

function getInitialLanguage(): AppLanguage {
  const storage = getLanguageStorage()

  const storedLanguage = storage?.getItem(LANGUAGE_STORAGE_KEY) ?? null

  return isAppLanguage(storedLanguage) ? storedLanguage : getBrowserLanguage()
}

void i18n
  .use(initReactI18next)
  .init({
    resources: {
      ru: { translation: ru },
      en: { translation: en },
    },
    lng: getInitialLanguage(),
    fallbackLng: 'ru',
    interpolation: {
      escapeValue: false,
    },
    returnEmptyString: false,
  })

i18n.on('languageChanged', (language) => {
  const storage = getLanguageStorage()

  if (storage && isAppLanguage(language)) {
    storage.setItem(LANGUAGE_STORAGE_KEY, language)
  }
})

export function getCurrentLocale(language = i18n.language): string {
  return language === 'en' ? 'en-US' : 'ru-RU'
}

export default i18n
