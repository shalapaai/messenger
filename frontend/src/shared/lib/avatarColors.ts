export const AVATAR_COLORS = [
  '#2C5BF0',
  '#7A5BF0',
  '#22B07D',
  '#F0902C',
  '#E0556E',
  '#2CA6C9',
  '#9B59B6',
] as const

export type AvatarColor = typeof AVATAR_COLORS[number]

export function randomAvatarColor(): string {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]
}
