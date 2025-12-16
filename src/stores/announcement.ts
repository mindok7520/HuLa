import { defineStore } from 'pinia'
import { StoresEnum } from '@/enums'
import { useCachedStore } from '@/stores/cached'
import { useGlobalStore } from '@/stores/global'
import { useGroupStore } from '@/stores/group'
import { useUserStore } from '@/stores/user'

export const useAnnouncementStore = defineStore(StoresEnum.ANNOUNCEMENT, () => {
  const globalStore = useGlobalStore()
  const groupStore = useGroupStore()
  const userStore = useUserStore()
  const cachedStore = useCachedStore()

  // 공지사항 관련 상태
  const announList = ref<any[]>([])
  const announNum = ref(0)
  const announError = ref(false)
  const isAddAnnoun = ref(false)

  const announcementContent = computed(() => (announList.value.length > 0 ? (announList.value[0]?.content ?? '') : ''))

  // 현재 사용자에게 공지사항 추가 권한이 있는지 확인
  const canAddAnnouncement = computed(() => {
    if (!userStore.userInfo?.uid) return false

    const isLord = groupStore.isCurrentLord(userStore.userInfo.uid) ?? false
    const isAdmin = groupStore.isAdmin(userStore.userInfo.uid) ?? false

    // 현재 사용자가 ID 6인 배지를 가지고 있고 채널인지 확인
    const hasBadge6 = () => {
      if (globalStore.currentSessionRoomId !== '1') return false

      const currentUser = groupStore.getUserInfo(userStore.userInfo!.uid)
      return currentUser?.itemIds?.includes('6') ?? false
    }

    return isLord || isAdmin || hasBadge6()
  })

  /**
   * 공지사항 비우기
   */
  const clearAnnouncements = () => {
    announList.value = []
    announNum.value = 0
    announError.value = false
  }

  const formatRecords = (records: any[]) => {
    if (!records || records.length === 0) return []
    const topAnnouncement = records.find((item) => item.top)
    if (!topAnnouncement) return records
    return [topAnnouncement, ...records.filter((item) => !item.top)]
  }

  const loadGroupAnnouncements = async (roomId?: string) => {
    const targetRoomId = roomId ?? globalStore.currentSessionRoomId
    if (!targetRoomId) {
      console.error('현재 세션에 roomId가 없습니다')
      return
    }

    try {
      // 공지사항 추가 가능 여부 확인
      isAddAnnoun.value = canAddAnnouncement.value

      // 그룹 공지사항 목록 가져오기
      const data = await cachedStore.getGroupAnnouncementList(targetRoomId, 1, 10)

      // 세션이 전환됨, 다른 방의 데이터 덮어쓰기 방지
      if (targetRoomId !== globalStore.currentSessionRoomId) {
        return
      }

      if (data) {
        announList.value = formatRecords([...(data.records ?? [])])
        announNum.value = parseInt(data.total, 10)
        announError.value = false
      } else {
        announList.value = []
        announNum.value = 0
        announError.value = false
      }
    } catch (error) {
      console.error('그룹 공지사항 로드 실패:', error)
      if (targetRoomId === globalStore.currentSessionRoomId) {
        announError.value = true
      }
    }
  }

  return {
    announNum,
    announError,
    isAddAnnoun,
    announcementContent,
    canAddAnnouncement,
    loadGroupAnnouncements,
    clearAnnouncements
  }
})
