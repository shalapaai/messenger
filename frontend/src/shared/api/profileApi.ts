import { apiClient } from './apiClient'
import type { UserProfile } from '../types/user'

export interface PublicUserProfile {
  userId: string
  displayName: string
  login: string | null
  status: string | null
  avatarUrl: string | null
  phone: string | null
  city: string | null
  department: string | null
  email: string
}

export interface CreateProfileData {
  displayName: string
  login?: string
}

export interface UpdateProfileData {
  displayName?: string
  status?: string
  login?: string
  phone?: string
  city?: string
  department?: string
}

export const profileApi = {
  async create(data: CreateProfileData): Promise<void> {
    await apiClient.post('/users/', data)
  },

  async getMe(): Promise<UserProfile> {
    const res = await apiClient.get<UserProfile>('/users/me')
    return res.data
  },

  async update(data: UpdateProfileData): Promise<UserProfile> {
    const res = await apiClient.patch<UserProfile>('/users/me', data)
    return res.data
  },

  async getUserById(userId: string): Promise<PublicUserProfile> {
    const res = await apiClient.get<PublicUserProfile>(`/users/${userId}`)
    return res.data
  },

  async uploadAvatar(file: File): Promise<string> {
    const formData = new FormData()
    formData.append('file', file)
    const res = await apiClient.post<{ avatarUrl: string }>('/users/me/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data.avatarUrl
  },
}
