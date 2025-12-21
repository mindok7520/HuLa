import { computed } from 'vue'
import { MessageStatusEnum } from '@/enums'
import type { MessageType } from '@/services/types'
import { useGlobalStore } from '@/stores/global'
import { useGroupStore } from '@/stores/group'

/**
 * Mock 메시지 Hook
 */
export const useMockMessage = () => {
  const globalStore = useGlobalStore()
  // 로컬 스토리지에서 사용자 정보 가져오기
  const userInfo = computed(() => JSON.parse(localStorage.getItem('user') || '{}'))

  /**
   * 모의 메시지 생성
   * @param type 메시지 유형
   * @param body 메시지 본문
   * @param messageMarks 상호작용 정보
   * @returns 서버 형식 메시지
   */
  const mockMessage = (type: number, body: any, messageMarks?: any): MessageType => {
    const currentTimeStamp: number = Date.now()
    const random: number = Math.floor(Math.random() * 15)
    // 고유 id: 뒤 5자리 타임스탬프 + 랜덤 숫자
    const uniqueId: string = String(currentTimeStamp + random).slice(-7)
    const { uid = 0, name: username = '', avatar = '' } = userInfo.value || {}
    const groupStore = useGroupStore()

    return {
      fromUser: {
        username,
        uid,
        avatar,
        locPlace: groupStore.getUserInfo(uid)?.locPlace || 'xx'
      },
      message: {
        id: uniqueId,
        roomId: globalStore.currentSessionRoomId,
        sendTime: Number(currentTimeStamp),
        type: type,
        body,
        messageMarks: {
          likeCount: 0,
          userLike: 0,
          dislikeCount: 0,
          userDislike: 0,
          ...messageMarks
        },
        status: MessageStatusEnum.PENDING
      },
      sendTime: currentTimeStamp,
      loading: true
    }
  }

  return {
    mockMessage
  }
}
