import { defineStore } from 'pinia'
import { StoresEnum, TauriCommand } from '@/enums'
import type { CacheBadgeItem, CacheUserItem } from '@/services/types'
import { getAnnouncementList, getBadgesBatch } from '@/utils/ImRequestUtils'
import { invokeSilently } from '@/utils/TauriInvokeHandler.ts'

// 기본 사용자 정보 유형 정의, uid, 아바타, 이름만 포함
export type BaseUserItem = Pick<CacheUserItem, 'uid' | 'avatar' | 'name' | 'account'>

export const useCachedStore = defineStore(StoresEnum.CACHED, () => {
  const badgeList = ref<CacheBadgeItem[]>([])

  const badgeById = computed(() => (id?: string) => {
    return badgeList.value.find((badge) => badge.itemId === id)
  })

  const getAllBadgeList = async () => {
    await getBadgesBatch([])
      .then((data) => {
        badgeList.value = data
      })
      .catch((e) => {
        console.error('배지 목록 가져오기 실패', e)
        window.$message.error('배지 목록 가져오기 실패')
      })
  }

  const userAvatarUpdated = ref(false)

  /**
   * 그룹 공지사항 가져오기
   * @roomId 그룹 ID
   * @reload 강제 새로고침 여부
   * @returns 그룹 공지사항 목록
   */
  const getGroupAnnouncementList = async (roomId: string, page: number, size: number) => {
    return await getAnnouncementList(roomId, page, size)
  }

  const updateMyRoomInfo = async (data: any) => {
    const result = await invokeSilently(TauriCommand.UPDATE_MY_ROOM_INFO, {
      myRoomInfo: data
    })
    return result !== null
  }

  const syncRoomMembersToLocal = async (roomId: string) => {
    const result = await invokeSilently(TauriCommand.GET_ROOM_MEMBERS, {
      room_id: roomId,
      roomId
    })
    return result !== null
  }

  return {
    badgeById,
    badgeList,
    userAvatarUpdated,
    getGroupAnnouncementList,
    updateMyRoomInfo,
    syncRoomMembersToLocal,
    getAllBadgeList
  }
})
