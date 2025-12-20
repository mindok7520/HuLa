import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { info } from '@tauri-apps/plugin-log'
import { defineStore } from 'pinia'
import { MittEnum, StoresEnum } from '@/enums'
import type { FriendItem, RequestFriendItem, SessionItem } from '@/services/types'
import { useChatStore } from '@/stores/chat'
import { useFeedStore } from '@/stores/feed'
import { clearQueue, readCountQueue } from '@/utils/ReadCountQueue.ts'
import { useMitt } from '@/hooks/useMitt.ts'
import { unreadCountManager } from '@/utils/UnreadCountManager'
import { markMsgRead } from '../utils/ImRequestUtils'

export const useGlobalStore = defineStore(
  StoresEnum.GLOBAL,
  () => {
    const chatStore = useChatStore()
    const feedStore = useFeedStore()

    // 읽지 않은 메시지 표시: 친구 요청 읽지 않음 수 및 새 메시지 읽지 않음 수
    const unReadMark = reactive<{
      newFriendUnreadCount: number
      newMsgUnreadCount: number
      newGroupUnreadCount: number
    }>({
      newFriendUnreadCount: 0,
      newGroupUnreadCount: 0,
      newMsgUnreadCount: 0
    })
    const unreadReady = ref<boolean>(true)

    // 현재 읽음/읽지 않음 목록 상태
    const currentReadUnreadList = reactive<{ show: boolean; msgId: number | null }>({
      show: false,
      msgId: null
    })

    const currentSessionRoomId = ref('')
    const lastKnownSession = ref<SessionItem | null>(null)
    type CurrentSessionView = Omit<SessionItem, 'roomId'>
    const stripRoomId = (session?: SessionItem | null): CurrentSessionView | null => {
      if (!session) return null
      const { roomId: _omit, ...rest } = session
      return rest
    }
    // 현재 세션 정보: roomId를 노출하지 않고 currentSessionRoomId에서 통일되게 읽음
    const currentSession = computed((): CurrentSessionView | null => {
      const cachedRoomId = currentSessionRoomId.value
      if (!cachedRoomId) {
        lastKnownSession.value = null
        return null
      }

      let session: SessionItem | undefined = chatStore.getSession(cachedRoomId)
      if (!session) {
        session = chatStore.sessionList.find((item) => item.roomId === cachedRoomId)
      }
      if (session) {
        lastKnownSession.value = session
        return stripRoomId(session)
      }

      return lastKnownSession.value && lastKnownSession.value.roomId === cachedRoomId
        ? stripRoomId(lastKnownSession.value)
        : null
    })

    /** 현재 선택된 연락처 정보 */
    const currentSelectedContact = ref<FriendItem | RequestFriendItem>()

    // 친구 추가 모달 정보 TODO: 가상 목록 친구 추가 시 해당 사용자 정보가 표시되지 않는 경우가 있음
    const addFriendModalInfo = ref<{ show: boolean; uid?: string }>({
      show: false,
      uid: void 0
    })

    // 그룹 채팅 추가 모달 정보
    const addGroupModalInfo = ref<{ show: boolean; name?: string; avatar?: string; account?: string }>({
      show: false,
      name: '',
      avatar: '',
      account: ''
    })

    // 그룹 채팅 생성 모달 정보
    const createGroupModalInfo = reactive<{
      show: boolean
      isInvite: boolean // 초대 모드 여부
      selectedUid: number[] // 선택된 사용자 ID 목록
    }>({
      show: false,
      isInvite: false,
      selectedUid: []
    })

    /** 팁 상자 표시 상태 */
    const tipVisible = ref<boolean>(false)
    /** 시스템 트레이 메뉴 표시 상태 */
    const isTrayMenuShow = ref<boolean>(false)

    // 팁 상자 표시 상태 설정
    const setTipVisible = (visible: boolean) => {
      tipVisible.value = visible
    }

    // 전역 읽지 않은 메시지 수 업데이트
    const updateGlobalUnreadCount = () => {
      info('[global]전역 읽지 않은 메시지 수 업데이트')
      // 통합 카운트 매니저 사용, 중복 로직 방지 (타임라인 읽지 않음 수 포함)
      unreadCountManager.calculateTotal(chatStore.sessionList, unReadMark, feedStore.unreadCount)
    }

    // Dock/배지 동기화, 읽지 않은 수와 배지가 동기화되지 않는 것을 방지
    watch(
      () => ({
        msg: unReadMark.newMsgUnreadCount,
        friend: unReadMark.newFriendUnreadCount,
        group: unReadMark.newGroupUnreadCount,
        feed: feedStore.unreadCount // 타임라인 읽지 않은 수 리스너 추가
      }),
      () => {
        if (!unreadReady.value) return
        unreadCountManager.refreshBadge(unReadMark, feedStore.unreadCount)
      }
    )

    // 현재 세션 변경 감지, 중복 트리거 방지 로직 추가
    watch(currentSessionRoomId, async (val, oldVal) => {
      if (!val || val === oldVal) {
        return
      }

      try {
        await chatStore.changeRoom()
      } catch (error) {
        console.error('[global] 세션 전환 중 메시지 로드 실패:', error)
        return
      }

      const webviewWindowLabel = WebviewWindow.getCurrent()
      if (webviewWindowLabel.label !== 'home' && webviewWindowLabel.label !== '/mobile/message') {
        useMitt.emit(MittEnum.SESSION_CHANGED, {
          roomId: val,
          oldRoomId: oldVal ?? null
        })
        return
      }

      const session = chatStore.getSession(val)
      if (session?.unreadCount) {
        info(`[global]현재 세션 실제 변경됨: ${oldVal} -> ${val}`)
        // 읽음 수 조회 큐 정리
        clearQueue()
        // 1초 후 읽음 수 조회 시작
        setTimeout(readCountQueue, 1000)
        // 로컬 읽지 않음 표시 먼저 지우기 (UI 즉시 업데이트), 그 후 비동기로 읽음 보고 (비차단)
        chatStore.markSessionRead(val)
        markMsgRead(val).catch((err) => console.error('[global] 읽음 보고 실패:', err))
      }

      useMitt.emit(MittEnum.SESSION_CHANGED, {
        roomId: val,
        oldRoomId: oldVal ?? null
      })
    })

    const updateCurrentSessionRoomId = (id: string) => {
      currentSessionRoomId.value = id
    }

    return {
      unReadMark,
      currentSession,
      addFriendModalInfo,
      addGroupModalInfo,
      currentSelectedContact,
      currentReadUnreadList,
      createGroupModalInfo,
      tipVisible,
      isTrayMenuShow,
      unreadReady,
      setTipVisible,
      updateGlobalUnreadCount,
      updateCurrentSessionRoomId,
      currentSessionRoomId
    }
  },
  {
    share: {
      enable: true,
      initialize: true
    }
  }
)
