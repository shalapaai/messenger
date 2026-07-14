import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AvatarImage } from '../../shared/ui/AvatarImage'
import type { Poll, Sender } from '../../shared/types/messenger'
import s from './ChatWindow.module.css'

interface PollMessageProps {
  question: string
  poll: Poll
  meSender: Sender
  onVote: (optionId: string) => void
  onRetractVote: () => void
}

export function PollMessage({ question, poll, meSender, onVote, onRetractVote }: PollMessageProps) {
  const { t } = useTranslation()
  const [expandedOptionId, setExpandedOptionId] = useState<string | null>(null)

  const totalVotes = poll.options.reduce((sum, o) => sum + o.voters.length, 0)
  const myVotedOptionId = poll.options.find(o => o.voters.some(v => v.userId === meSender.senderId))?.id ?? null

  return (
    <div className={s.pollRoot}>
      <div className={s.pollQuestion}>{question}</div>

      <div className={s.pollOptionsView}>
        {poll.options.map(option => {
          const count = option.voters.length
          const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0
          const isMine = option.id === myVotedOptionId
          const isExpanded = expandedOptionId === option.id

          return (
            <div key={option.id} className={s.pollOptionBlock}>
              <button
                type="button"
                className={`${s.pollOptionBtn} ${isMine ? s.pollOptionBtnSelected : ''}`}
                onClick={(e) => { e.stopPropagation(); isMine ? onRetractVote() : onVote(option.id) }}
                title={isMine ? t('poll.retractVote') : undefined}
              >
                <span className={s.pollOptionFill} style={{ width: `${percent}%` }} />
                <span className={s.pollOptionContent}>
                  <span className={s.pollOptionText}>
                    {isMine && <span className={s.pollOptionCheck}>✓</span>}
                    {option.text}
                  </span>
                  <span className={s.pollOptionPercent}>{percent}%</span>
                </span>
              </button>

              {count > 0 && (
                <button
                  type="button"
                  className={s.pollVotersToggle}
                  onClick={(e) => { e.stopPropagation(); setExpandedOptionId(isExpanded ? null : option.id) }}
                >
                  <span className={s.pollVotersAvatars}>
                    {option.voters.slice(0, 5).map(voter => (
                      voter.userAvatarUrl
                        ? <AvatarImage key={voter.userId} src={voter.userAvatarUrl} alt={voter.userName} className={s.pollVoterAvatarImg} />
                        : <span key={voter.userId} className={s.pollVoterAvatar} style={{ background: voter.userAvatarColor }}>{voter.userName.slice(0, 1).toUpperCase()}</span>
                    ))}
                  </span>
                  <span className={s.pollVotersCount}>{t('poll.votes', { count })}</span>
                </button>
              )}

              {isExpanded && (
                <div className={s.pollVotersList}>
                  {option.voters.map(voter => (
                    <div key={voter.userId} className={s.pollVoterRow}>
                      {voter.userAvatarUrl
                        ? <AvatarImage src={voter.userAvatarUrl} alt={voter.userName} className={s.pollVoterAvatarImg} />
                        : <span className={s.pollVoterAvatar} style={{ background: voter.userAvatarColor }}>{voter.userName.slice(0, 1).toUpperCase()}</span>
                      }
                      <span className={s.pollVoterName}>{voter.userName}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className={s.pollTotalVotes}>
        {totalVotes > 0 ? t('poll.votes', { count: totalVotes }) : t('poll.noVotes')}
      </div>
    </div>
  )
}
