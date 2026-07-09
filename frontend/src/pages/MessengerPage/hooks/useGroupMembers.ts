import { useEffect, useRef, useState } from 'react'
import type { GroupMember } from '../../../shared/types/messenger'
import { fetchChatDetail } from '../../../shared/api/chatsApi'

export function useGroupMembers(id: string | undefined, isGroupChat: boolean, currentUserId: string | undefined) {
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([])
  const [groupMembersLoading, setGroupMembersLoading] = useState(false)

  const requestedGroupChatIdRef = useRef<string | null>(null)

  async function loadGroupMembers(chatId: string) {
    requestedGroupChatIdRef.current = chatId
    setGroupMembersLoading(true)
    try {
      const fresh = await fetchChatDetail(chatId)
      if (requestedGroupChatIdRef.current !== chatId) return
      setGroupMembers(prev => {
        if (prev.length === 0) return fresh
        const freshMap = new Map(fresh.map(m => [m.userId, m]))
        const merged = prev
          .filter(m => freshMap.has(m.userId))
          .map(m => ({ ...freshMap.get(m.userId)! }))
        const existingIds = new Set(prev.map(m => m.userId))
        for (const m of fresh) {
          if (!existingIds.has(m.userId)) merged.push(m)
        }
        return merged
      })
    } catch {
      if (requestedGroupChatIdRef.current === chatId) setGroupMembers([])
    } finally {
      if (requestedGroupChatIdRef.current === chatId) setGroupMembersLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      if (id && isGroupChat) loadGroupMembers(id)
      else { requestedGroupChatIdRef.current = null; setGroupMembers([]) }
    })
    return () => { cancelled = true }
  }, [id, isGroupChat])

  function updateMemberRoleLocally(userId: string, role: 'admin' | 'member') {
    setGroupMembers(prev => prev.map(m => m.userId === userId ? { ...m, role } : m))
  }

  function patchMemberProfile(userId: string, patch: Pick<GroupMember, 'name' | 'initials' | 'avatarUrl' | 'color'>) {
    setGroupMembers(prev => prev.map(m => m.userId === userId ? { ...m, ...patch } : m))
  }

  const myGroupRole = isGroupChat && currentUserId
    ? (groupMembers.find(m => m.userId === currentUserId)?.role ?? null)
    : null
  const canDeleteMessages = isGroupChat ? (myGroupRole === 'owner' || myGroupRole === 'admin') : true

  return {
    groupMembers,
    groupMembersLoading,
    loadGroupMembers,
    updateMemberRoleLocally,
    patchMemberProfile,
    myGroupRole,
    canDeleteMessages,
  }
}
