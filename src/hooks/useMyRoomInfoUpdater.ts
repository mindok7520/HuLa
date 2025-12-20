import { useCachedStore } from '@/stores/cached'
import { useChatStore } from '@/stores/chat'
import { useGroupStore } from '@/stores/group'
import { useUserStore } from '@/stores/user.ts'
import { updateMyRoomInfo } from '@/utils/ImRequestUtils'

type UpdatePayload = {
  roomId: string
  myName: string
  remark: string
}

// 이미 멤버 목록을 동기화한 방 ID 기록, 동일한 세션에서 반복 동기화 트리거 방지
const syncedRoomMembers = new Set<string>()

export const useMyRoomInfoUpdater = () => {
  const cacheStore = useCachedStore()
  const chatStore = useChatStore()
  const groupStore = useGroupStore()
  const userStore = useUserStore()

  const persistMyRoomInfo = async ({ roomId, myName, remark }: UpdatePayload) => {
    const payload = {
      id: roomId,
      myName,
      remark
    }

    // 방의 닉네임/메모를 처음 편집할 때, 멤버 목록을 한 번 동기화 시도하여 로컬에 관련 기록이 있는지 확인
    if (!syncedRoomMembers.has(roomId)) {
      const synced = await cacheStore.syncRoomMembersToLocal(roomId)
      if (synced) {
        syncedRoomMembers.add(roomId)
      }
    }

    let updated = await cacheStore.updateMyRoomInfo(payload)
    if (!updated) {
      // 여전히 실패하면 로컬 캐시가 만료되었을 수 있으므로, 플래그를 지우고 다시 강제 동기화 후 재시도
      syncedRoomMembers.delete(roomId)
      const synced = await cacheStore.syncRoomMembersToLocal(roomId)
      if (synced) {
        syncedRoomMembers.add(roomId)
        updated = await cacheStore.updateMyRoomInfo(payload)
      }
    }
    await updateMyRoomInfo(payload)

    groupStore.myNameInCurrentGroup = myName
    if (groupStore.countInfo) {
      groupStore.countInfo.remark = remark
    }
    chatStore.updateSession(roomId, { remark })
  }

  const resolveMyRoomNickname = ({ roomId, myName }: { roomId?: string; myName?: string }) => {
    if (myName) {
      return myName
    }
    if (!roomId) {
      return ''
    }
    const currentUid = userStore.userInfo?.uid
    if (!currentUid) {
      return ''
    }
    const currentUser = groupStore.getUser(roomId, currentUid) ?? groupStore.getUserInfo(currentUid, roomId)
    return currentUser?.name || userStore.userInfo?.name || ''
  }

  return {
    persistMyRoomInfo,
    resolveMyRoomNickname
  }
}
