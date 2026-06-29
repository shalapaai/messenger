export interface UserProfile {
  userId: string
  email: string
  displayName: string
  login: string | null
  status: string | null
  avatarUrl: string | null
  phone: string | null
  city: string | null
  department: string | null
  registeredAt: string
  updatedAt: string | null
}
