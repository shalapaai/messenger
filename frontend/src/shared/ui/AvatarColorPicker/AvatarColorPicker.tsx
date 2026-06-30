import { AVATAR_COLORS } from '../../lib/avatarColors'
import s from './AvatarColorPicker.module.css'

interface AvatarColorPickerProps {
  value: string
  onChange: (color: string) => void
}

export function AvatarColorPicker({ value, onChange }: AvatarColorPickerProps) {
  return (
    <div className={s.picker}>
      {AVATAR_COLORS.map(color => (
        <button
          key={color}
          type="button"
          aria-label={`Цвет ${color}`}
          aria-pressed={value === color}
          className={s.swatch}
          style={{
            background: color,
            ...(value === color
              ? { boxShadow: `0 0 0 2.5px var(--color-surface), 0 0 0 4.5px ${color}` }
              : {}),
          }}
          onClick={() => onChange(color)}
        />
      ))}
    </div>
  )
}
