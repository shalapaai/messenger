import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EMOJI_CATEGORIES, type EmojiItem } from './emojiData'
import s from './EmojiPicker.module.css'

const RECENT_EMOJIS_STORAGE_KEY = 'messenger_recent_emojis'
const MAX_RECENT_EMOJIS = 16

interface EmojiPickerProps {
  onSelect: (emoji: string) => void
  disabled?: boolean
}

function getRecentEmojis(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_EMOJIS_STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []

    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === 'string')
      : []
  } catch {
    return []
  }
}

function saveRecentEmoji(emoji: string, recentEmojis: string[]) {
  const nextRecentEmojis = [
    emoji,
    ...recentEmojis.filter((item) => item !== emoji),
  ].slice(0, MAX_RECENT_EMOJIS)

  try {
    localStorage.setItem(
      RECENT_EMOJIS_STORAGE_KEY,
      JSON.stringify(nextRecentEmojis),
    )
  } catch {
    // localStorage can be unavailable in private mode or restricted environments.
  }

  return nextRecentEmojis
}

function matchesQuery(item: EmojiItem, query: string) {
  const normalizedQuery = query.trim().toLowerCase()

  if (!normalizedQuery) return true

  return [item.emoji, ...item.keywords].some((value) =>
    value.toLowerCase().includes(normalizedQuery),
  )
}

export function EmojiPicker({ onSelect, disabled = false }: EmojiPickerProps) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [recentEmojis, setRecentEmojis] = useState(getRecentEmojis)

  const hasQuery = !!query.trim()
  const visibleCategories = EMOJI_CATEGORIES.map((category) => ({
    ...category,
    items: category.items.filter((item) => matchesQuery(item, query)),
  })).filter((category) => category.items.length > 0)
  const visibleSearchItems = visibleCategories.flatMap(
    (category) => category.items,
  )
  const hasVisibleEmojis = visibleSearchItems.length > 0

  function handleEmojiClick(emoji: string) {
    setRecentEmojis((current) => saveRecentEmoji(emoji, current))
    onSelect(emoji)
  }

  return (
    <div className={s.picker}>
      <input
        className={s.search}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t('emoji.search')}
        disabled={disabled}
      />

      {recentEmojis.length > 0 && !hasQuery && (
        <section className={s.section}>
          <div className={s.sectionTitle}>{t('emoji.recent')}</div>

          <div className={s.grid}>
            {recentEmojis.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className={s.emojiButton}
                onClick={() => handleEmojiClick(emoji)}
                disabled={disabled}
              >
                {emoji}
              </button>
            ))}
          </div>
        </section>
      )}

      {hasQuery && hasVisibleEmojis && (
        <section className={s.section}>
          <div className={s.sectionTitle}>{t('emoji.searchResults')}</div>

          <div className={s.grid}>
            {visibleSearchItems.map((item) => (
              <button
                key={item.emoji}
                type="button"
                className={s.emojiButton}
                onClick={() => handleEmojiClick(item.emoji)}
                disabled={disabled}
              >
                {item.emoji}
              </button>
            ))}
          </div>
        </section>
      )}

      {!hasQuery &&
        visibleCategories.map((category) => (
          <section className={s.section} key={category.id}>
            <div className={s.sectionTitle}>{t(category.labelKey)}</div>

            <div className={s.grid}>
              {category.items.map((item) => (
                <button
                  key={item.emoji}
                  type="button"
                  className={s.emojiButton}
                  onClick={() => handleEmojiClick(item.emoji)}
                  disabled={disabled}
                >
                  {item.emoji}
                </button>
              ))}
            </div>
          </section>
        ))}

      {!hasVisibleEmojis && (
        <div className={s.empty}>{t('emoji.nothingFound')}</div>
      )}
    </div>
  )
}
