import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { UserSearchResult } from '../../../shared/api/usersApi'
import { colorFromId, initials } from '../../../shared/api/chatsApi'
import { useUserSearch } from '../../../shared/hooks/useUserSearch'
import s from './NewGroupModal.module.css'

interface NewGroupModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (name: string, memberIds: string[]) => Promise<void>
}

export function NewGroupModal({ isOpen, onClose, onCreate }: NewGroupModalProps) {
  const { t } = useTranslation()
  const [name,     setName]     = useState('')
  const [selected, setSelected] = useState<Map<string, UserSearchResult>>(new Map())
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState(false)
  const { query, setQuery, results, loading, error } = useUserSearch(isOpen)

  // isOpen=false — модалка закрыта (успешно создали группу или отменили); сбрасываем
  // весь локальный черновик, включая creating/createError, иначе после первого успешного
  // создания кнопка навсегда останется заблокированной в состоянии "Сохраняем..."
  useEffect(() => {
    if (isOpen) return
    const timer = setTimeout(() => {
      setName(''); setSelected(new Map()); setCreating(false); setCreateError(false)
    }, 0)
    return () => clearTimeout(timer)
  }, [isOpen])

  if (!isOpen) return null

  function toggleUser(user: UserSearchResult) {
    setSelected(prev => {
      const next = new Map(prev)
      if (next.has(user.userId)) next.delete(user.userId)
      else next.set(user.userId, user)
      return next
    })
  }

  async function handleCreate() {
    const trimmed = name.trim()
    if (!trimmed || selected.size === 0 || creating) return
    setCreating(true)
    setCreateError(false)
    try {
      await onCreate(trimmed, [...selected.keys()])
    } catch {
      setCreateError(true)
      setCreating(false)
    }
  }

  const canCreate = name.trim().length > 0 && selected.size > 0 && !creating

  return (
    <div className={s.modalOverlay} onClick={onClose}>
      <div className={s.modalPanel} onClick={e => e.stopPropagation()}>
        <button type="button" className={s.modalClose} onClick={onClose}>✕</button>
        <div className={s.title}>{t('group.newGroupTitle')}</div>

        <input
          className={s.searchInput}
          placeholder={t('group.namePlaceholder')}
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={100}
          autoFocus
        />

        {selected.size > 0 && (
          <div className={s.chips}>
            {[...selected.values()].map(user => (
              <button type="button" key={user.userId} className={s.chip} onClick={() => toggleUser(user)}>
                {user.displayName}
                <span className={s.chipRemove}>✕</span>
              </button>
            ))}
          </div>
        )}

        <input
          className={s.searchInput}
          placeholder={t('messenger.searchPlaceholder')}
          value={query}
          onChange={e => setQuery(e.target.value)}
        />

        <div className={s.results}>
          {loading ? (
            <div className={s.hint}>{t('messenger.searching')}</div>
          ) : error ? (
            <div className={s.hint}>{t('messenger.searchFailed')}</div>
          ) : !query.trim() ? (
            <div className={s.hint}>{t('group.selectMembersHint')}</div>
          ) : results.length === 0 ? (
            <div className={s.hint}>{t('messenger.emptySearch')}</div>
          ) : (
            results.map(user => {
              const init = initials(user.displayName)
              const checked = selected.has(user.userId)
              return (
                <div
                  key={user.userId}
                  className={`${s.row} ${s.rowClickable} ${checked ? s.rowChecked : ''}`}
                  onClick={() => toggleUser(user)}
                >
                  {user.avatarUrl
                    ? <img src={user.avatarUrl} alt={init} className={s.avatarImg} />
                    : <div className={s.avatar} style={{ background: colorFromId(user.userId) }}>{init}</div>
                  }
                  <div className={s.info}>
                    <span className={s.name}>{user.displayName}</span>
                    <span className={s.sub}>{user.login ?? user.email}</span>
                  </div>
                  <span className={`${s.checkbox} ${checked ? s.checkboxChecked : ''}`}>{checked && '✓'}</span>
                </div>
              )
            })
          )}
        </div>

        {createError && <p className={s.error}>{t('messenger.createGroupFailed')}</p>}

        <button type="button" className={s.createBtn} disabled={!canCreate} onClick={handleCreate}>
          {creating ? t('common.saving') : t('messenger.createGroup')}
        </button>
      </div>
    </div>
  )
}
