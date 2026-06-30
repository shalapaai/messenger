import { apiClient } from './apiClient'

export interface UserSearchResult {
  userId: string
  email: string
  displayName: string
  login: string | null
  avatarUrl: string | null
}

interface SearchResultDto {
  items: UserSearchResult[]
  totalCount: number
  page: number
  pageSize: number
}

export async function searchUsers(query: string): Promise<UserSearchResult[]> {
  const q = query.trim()
  if (!q) return []
  const res = await apiClient.get<SearchResultDto>('/users/search', { params: { q } })
  return res.data.items
}
