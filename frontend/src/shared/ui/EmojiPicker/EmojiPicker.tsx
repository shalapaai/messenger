import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import s from './EmojiPicker.module.css'

type EmojiCategoryId = 'smiles' | 'gestures' | 'hearts' | 'objects' | 'symbols'

interface EmojiItem {
  emoji: string
  keywords: string[]
}

interface EmojiCategory {
  id: EmojiCategoryId
  labelKey: string
  items: EmojiItem[]
}

const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: 'smiles',
    labelKey: 'emoji.categories.smiles',
    items: [
      { emoji: '😂', keywords: ['laugh', 'funny', 'lol', 'смех', 'смешно'] },
      { emoji: '😅', keywords: ['sweat', 'laugh', 'нервно', 'смех'] },
      { emoji: '😊', keywords: ['smile', 'happy', 'улыбка', 'радость'] },
      { emoji: '😍', keywords: ['love', 'eyes', 'любовь', 'нравится'] },
      { emoji: '😘', keywords: ['kiss', 'love', 'поцелуй'] },
      { emoji: '😉', keywords: ['wink', 'подмигнуть'] },
      { emoji: '😁', keywords: ['grin', 'smile', 'улыбка'] },
      { emoji: '😎', keywords: ['cool', 'glasses', 'круто'] },
      { emoji: '😭', keywords: ['cry', 'sad', 'плакать', 'грусть'] },
      { emoji: '😢', keywords: ['tear', 'sad', 'слеза', 'грусть'] },
      { emoji: '😡', keywords: ['angry', 'mad', 'злость'] },
      { emoji: '😱', keywords: ['shock', 'scared', 'страх', 'шок'] },
      { emoji: '😋', keywords: ['tasty', 'yum', 'вкусно'] },
      { emoji: '🙈', keywords: ['monkey', 'shy', 'стыдно'] },
      { emoji: '🤔', keywords: ['think', 'thinking', 'думаю'] },
      { emoji: '😴', keywords: ['sleep', 'tired', 'сон'] },
      { emoji: '🤯', keywords: ['mind blown', 'shock', 'вау'] },
      { emoji: '🥳', keywords: ['party', 'celebrate', 'праздник'] },
      { emoji: '😇', keywords: ['angel', 'good', 'ангел'] },
      { emoji: '🤗', keywords: ['hug', 'обнять'] },
      { emoji: '😐', keywords: ['neutral', 'ok', 'нейтрально'] },
      { emoji: '🙃', keywords: ['upside', 'irony', 'ирония'] },
      { emoji: '😬', keywords: ['awkward', 'неловко'] },
      { emoji: '🤩', keywords: ['star', 'wow', 'восторг'] },
    ],
  },
  {
    id: 'gestures',
    labelKey: 'emoji.categories.gestures',
    items: [
      { emoji: '👍', keywords: ['like', 'thumbs up', 'класс', 'лайк'] },
      { emoji: '👎', keywords: ['dislike', 'thumbs down', 'дизлайк'] },
      { emoji: '👏', keywords: ['clap', 'applause', 'аплодисменты'] },
      { emoji: '🙏', keywords: ['please', 'thanks', 'спасибо', 'пожалуйста'] },
      { emoji: '💪', keywords: ['strong', 'power', 'сила'] },
      { emoji: '🤝', keywords: ['deal', 'handshake', 'договорились'] },
      { emoji: '👌', keywords: ['ok', 'perfect', 'хорошо'] },
      { emoji: '✌️', keywords: ['peace', 'victory', 'мир'] },
      { emoji: '🤞', keywords: ['luck', 'hope', 'удача'] },
      { emoji: '👋', keywords: ['hello', 'bye', 'привет', 'пока'] },
      { emoji: '🙌', keywords: ['hands', 'hooray', 'ура'] },
      { emoji: '🤌', keywords: ['chef kiss', 'perfect', 'идеально'] },
      { emoji: '🫶', keywords: ['heart hands', 'care', 'любовь'] },
      { emoji: '👀', keywords: ['eyes', 'look', 'смотрю'] },
      { emoji: '💅', keywords: ['nails', 'style', 'стиль'] },
      { emoji: '🫡', keywords: ['salute', 'respect', 'понял'] },
    ],
  },
  {
    id: 'hearts',
    labelKey: 'emoji.categories.hearts',
    items: [
      { emoji: '❤️', keywords: ['heart', 'love', 'сердце', 'любовь'] },
      { emoji: '🧡', keywords: ['orange heart', 'love', 'сердце'] },
      { emoji: '💛', keywords: ['yellow heart', 'love', 'сердце'] },
      { emoji: '💚', keywords: ['green heart', 'love', 'сердце'] },
      { emoji: '💙', keywords: ['blue heart', 'love', 'сердце'] },
      { emoji: '💜', keywords: ['purple heart', 'love', 'сердце'] },
      { emoji: '🖤', keywords: ['black heart', 'love', 'сердце'] },
      { emoji: '🤍', keywords: ['white heart', 'love', 'сердце'] },
      { emoji: '💔', keywords: ['broken heart', 'sad', 'разбитое сердце'] },
      { emoji: '💕', keywords: ['hearts', 'love', 'сердца'] },
      { emoji: '💞', keywords: ['hearts', 'love', 'сердца'] },
      { emoji: '💘', keywords: ['cupid', 'love', 'любовь'] },
      { emoji: '💖', keywords: ['sparkle heart', 'love', 'сердце'] },
      { emoji: '💯', keywords: ['hundred', 'perfect', 'сто'] },
      { emoji: '✨', keywords: ['sparkles', 'magic', 'искры'] },
      { emoji: '🔥', keywords: ['fire', 'hot', 'огонь'] },
    ],
  },
  {
    id: 'objects',
    labelKey: 'emoji.categories.objects',
    items: [
      { emoji: '🎉', keywords: ['party', 'celebrate', 'праздник'] },
      { emoji: '🎂', keywords: ['cake', 'birthday', 'торт'] },
      { emoji: '🎁', keywords: ['gift', 'present', 'подарок'] },
      { emoji: '☕', keywords: ['coffee', 'drink', 'кофе'] },
      { emoji: '🍕', keywords: ['pizza', 'food', 'пицца'] },
      { emoji: '🍫', keywords: ['chocolate', 'sweet', 'шоколад'] },
      { emoji: '🌟', keywords: ['star', 'favorite', 'звезда'] },
      { emoji: '⭐', keywords: ['star', 'rating', 'звезда'] },
      { emoji: '⚡', keywords: ['fast', 'lightning', 'молния'] },
      { emoji: '💡', keywords: ['idea', 'lamp', 'идея'] },
      { emoji: '📌', keywords: ['pin', 'important', 'важно'] },
      { emoji: '✅', keywords: ['done', 'check', 'готово'] },
      { emoji: '❌', keywords: ['no', 'cancel', 'нет'] },
      { emoji: '🚀', keywords: ['rocket', 'launch', 'ракета'] },
      { emoji: '🏆', keywords: ['winner', 'trophy', 'кубок'] },
      { emoji: '📎', keywords: ['attach', 'file', 'скрепка'] },
    ],
  },
  {
    id: 'symbols',
    labelKey: 'emoji.categories.symbols',
    items: [
      { emoji: '❗', keywords: ['important', 'exclamation', 'важно'] },
      { emoji: '❓', keywords: ['question', 'вопрос'] },
      { emoji: '⁉️', keywords: ['question', 'surprise', 'вопрос'] },
      { emoji: '‼️', keywords: ['important', 'важно'] },
      { emoji: '➕', keywords: ['plus', 'add', 'плюс'] },
      { emoji: '➖', keywords: ['minus', 'remove', 'минус'] },
      { emoji: '🔴', keywords: ['red', 'circle', 'красный'] },
      { emoji: '🟠', keywords: ['orange', 'circle', 'оранжевый'] },
      { emoji: '🟡', keywords: ['yellow', 'circle', 'желтый'] },
      { emoji: '🟢', keywords: ['green', 'circle', 'зеленый'] },
      { emoji: '🔵', keywords: ['blue', 'circle', 'синий'] },
      { emoji: '🟣', keywords: ['purple', 'circle', 'фиолетовый'] },
      { emoji: '⬆️', keywords: ['up', 'верх'] },
      { emoji: '⬇️', keywords: ['down', 'низ'] },
      { emoji: '➡️', keywords: ['right', 'право'] },
      { emoji: '⬅️', keywords: ['left', 'лево'] },
    ],
  },
]

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
