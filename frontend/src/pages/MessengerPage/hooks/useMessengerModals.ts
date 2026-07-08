import { useEffect, useState } from 'react'
import type { Message, ModalUser } from '../../../shared/types/messenger'

export function useMessengerModals() {
  const [profileOpen, setProfileOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [modalUser, setModalUser] = useState<ModalUser | null>(null)
  const [modalUserIsChatPartner, setModalUserIsChatPartner] = useState(false)
  const [groupModalOpen, setGroupModalOpen] = useState(false)
  const [newGroupModalOpen, setNewGroupModalOpen] = useState(false)
  const [editGroupModalOpen, setEditGroupModalOpen] = useState(false)
  const [addMemberModalOpen, setAddMemberModalOpen] = useState(false)
  // sourceChatId фиксируется в момент выбора, чтобы пересылка ушла из исходного чата, даже
  // если пользователь успеет переключиться на другой, пока модалка ещё открыта.
  const [forwardState, setForwardState] = useState<{ sourceChatId: string; messages: Message[] } | null>(null)

  useEffect(() => {
    const anyOpen = !!modalUser || groupModalOpen || editOpen || profileOpen || !!forwardState
      || newGroupModalOpen || editGroupModalOpen || addMemberModalOpen
    if (!anyOpen) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setModalUser(null); setGroupModalOpen(false); setEditOpen(false); setProfileOpen(false); setForwardState(null)
        setNewGroupModalOpen(false); setEditGroupModalOpen(false); setAddMemberModalOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [modalUser, groupModalOpen, editOpen, profileOpen, forwardState, newGroupModalOpen, editGroupModalOpen, addMemberModalOpen])

  return {
    profileOpen, setProfileOpen,
    editOpen, setEditOpen,
    modalUser, setModalUser,
    modalUserIsChatPartner, setModalUserIsChatPartner,
    groupModalOpen, setGroupModalOpen,
    newGroupModalOpen, setNewGroupModalOpen,
    editGroupModalOpen, setEditGroupModalOpen,
    addMemberModalOpen, setAddMemberModalOpen,
    forwardState, setForwardState,
  }
}
