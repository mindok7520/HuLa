import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { info } from '@tauri-apps/plugin-log'
import { sendNotification } from '@tauri-apps/plugin-notification'
import { orderBy, uniqBy } from 'es-toolkit'
import pLimit from 'p-limit'
import { defineStore } from 'pinia'
import { useRoute } from 'vue-router'
import { ErrorType } from '@/common/exception'
import { MittEnum, type MessageStatusEnum, MsgEnum, RoomTypeEnum, StoresEnum, TauriCommand } from '@/enums'
import type { MarkItemType, MessageType, RevokedMsgType, SessionItem } from '@/services/types'
import { useGlobalStore } from '@/stores/global.ts'
import { useFeedStore } from '@/stores/feed.ts'
import { useGroupStore } from '@/stores/group.ts'
import { useUserStore } from '@/stores/user.ts'
import { getSessionDetail, markMsgRead } from '@/utils/ImRequestUtils'
import { renderReplyContent } from '@/utils/RenderReplyContent.ts'
import { invokeWithErrorHandler } from '@/utils/TauriInvokeHandler'
import { useSessionUnreadStore } from '@/stores/sessionUnread'
import { unreadCountManager } from '@/utils/UnreadCountManager'
import { useMitt } from '@/hooks/useMitt'

type RecalledMessage = {
  messageId: string
  content: string
  recallTime: number
  originalType: MsgEnum
}

// 페이지당 로드할 메시지 수 정의
export const pageSize = 20

// 단일 대화의 메모리 내 메시지 보존 상한, 백그라운드 대화의 무한 증가 방지
const ROOM_MESSAGE_CACHE_LIMIT = 40

// 메시지 철회 만료 시간
const RECALL_EXPIRATION_TIME = 2 * 60 * 1000 // 2분, 단위 밀리초

// src/workers/timer.worker.ts 생성
const timerWorker = new Worker(new URL('../workers/timer.worker.ts', import.meta.url))

// 오류 처리 추가
timerWorker.onerror = (error) => {
  console.error('[Worker Error]', error)
}

export const useChatStore = defineStore(
  StoresEnum.CHAT,
  () => {
    const route = useRoute()
    const userStore = useUserStore()
    const globalStore = useGlobalStore()
    const feedStore = useFeedStore()
    const groupStore = useGroupStore()
    const sessionUnreadStore = useSessionUnreadStore()

    // 대화 목록
    const sessionList = ref<SessionItem[]>([])
    // 대화 목록 빠른 검색 Map, roomId를 통한 O(1) 검색
    const sessionMap = ref<Record<string, SessionItem>>({})
    // 대화 목록 로딩 상태
    const sessionOptions = reactive({ isLast: false, isLoading: false, cursor: '' })
    // 메시지 동기화 로딩 상태 (동기화 중 힌트 표시에 사용)
    const syncLoading = ref(false)

    // 지속된 읽지 않은 수를 메모리의 대화 객체로 동기화하여 새로 고침 또는 계정 전환 후에도 이전 읽지 않은 상태를 볼 수 있도록 함
    const syncPersistedUnreadCounts = (targetSessions: SessionItem[] = sessionList.value) => {
      if (!targetSessions.length) {
        return
      }
      sessionUnreadStore.apply(userStore.userInfo?.uid, targetSessions)
    }

    // 로컬 캐시의 특정 대화 읽지 않은 수 업데이트
    const persistUnreadCount = (roomId: string, count: number) => {
      if (!roomId) {
        return
      }
      sessionUnreadStore.set(userStore.userInfo?.uid, roomId, count)
    }

    // 대화 삭제 또는 데이터 정리 시 캐시 동기화 제거, 오래된 데이터 오염 방지
    const removeUnreadCountCache = (roomId: string) => {
      if (!roomId) {
        return
      }
      sessionUnreadStore.remove(userStore.userInfo?.uid, roomId)
    }

    // 기존 대화 목록을 sessionMap에 동기화하여 지속성 복구 또는 요청 실패 시 map이 비어 있는 문제 해결
    const rebuildSessionMap = () => {
      if (!sessionList.value.length) {
        return
      }
      sessionMap.value = sessionList.value.reduce(
        (map, session) => {
          map[session.roomId] = session
          return map
        },
        {} as Record<string, SessionItem>
      )
    }

    // 대화 가져오기 폴백, map 우선 사용, 없을 경우 목록에서 map으로 채움
    const resolveSessionByRoomId = (roomId: string) => {
      if (!roomId) return undefined

      let session = sessionMap.value[roomId]
      if (!session) {
        if (!Object.keys(sessionMap.value).length && sessionList.value.length) {
          rebuildSessionMap()
        }
        session = sessionMap.value[roomId] ?? sessionList.value.find((item) => item.roomId === roomId)
        if (session) {
          sessionMap.value[roomId] = session
        }
      }
      return session
    }

    // 최근 대화 읽음 표시 활성 시간 기록, 다음 로그인 시 "오래된 읽지 않음" 식별에 사용
    const lastReadActiveTime = ref<Record<string, number>>({})

    // 대화 목록 새로 고침 후 서버에서 반환된 "오래된 읽지 않음" 처리 - 로컬에서 이전에 읽음(읽지 않은 수 0), 활성 시간이 변경되지 않았지만 서버가 여전히 읽지 않음을 반환하는 경우
    const reconcileStaleUnread = async (prevSessions?: Record<string, SessionItem>) => {
      if (!prevSessions) return
      const promises: Promise<unknown>[] = []

      for (const session of sessionList.value) {
        const prev = prevSessions[session.roomId]
        if (!prev) continue

        const prevUnread = Math.max(0, prev.unreadCount || 0)
        const currentUnread = Math.max(0, session.unreadCount || 0)
        const hasValidActiveTime = !!prev.activeTime && !!session.activeTime

        // "로컬 이전 0, 현재 양수, 유효한 활성 시간이 존재하고 변경되지 않음"인 경우에만 오래된 읽지 않음으로 간주
        if (prevUnread === 0 && currentUnread > 0 && hasValidActiveTime && session.activeTime === prev.activeTime) {
          console.log('[Chat][reconcileStaleUnread] clear stale unread', session.roomId, {
            prevUnread,
            currentUnread,
            activeTime: session.activeTime
          })
          updateSession(session.roomId, { unreadCount: 0 })
          // 다음 새로 고침 시 다시 주입되는 것을 방지하기 위해 읽음 보고 추가
          promises.push(
            markMsgRead(session.roomId).catch((error) => {
              console.error('[chat] 보상 읽음 보고 실패:', error)
            })
          )
        }
      }

      if (promises.length) {
        await Promise.allSettled(promises)
        requestUnreadCountUpdate()
      }
    }

    // 로컬에 기록된 "마지막 읽음 활성 시간"을 사용하여 오래된 읽지 않음 정리, 재로그인 시 짧게 깜박이는 현상 방지
    const reconcileUnreadWithReadHistory = async () => {
      const promises: Promise<unknown>[] = []

      for (const session of sessionList.value) {
        const activeTime = session.activeTime || 0
        const lastReadTime = lastReadActiveTime.value[session.roomId] || 0
        const currentUnread = Math.max(0, session.unreadCount || 0)

        if (currentUnread > 0 && lastReadTime > 0 && (activeTime === 0 || activeTime <= lastReadTime)) {
          console.log('[Chat][reconcileUnreadWithReadHistory] clear by lastRead', session.roomId, {
            activeTime,
            lastReadTime,
            currentUnread
          })
          updateSession(session.roomId, { unreadCount: 0 })
          promises.push(
            markMsgRead(session.roomId).catch((error) => {
              console.error('[chat] 읽음 기록 기반 보상 보고 실패:', error)
            })
          )
        }
      }

      if (promises.length) {
        await Promise.allSettled(promises)
        requestUnreadCountUpdate()
      }
    }

    // 모든 메시지 Record 저장
    const messageMap = reactive<Record<string, Record<string, MessageType>>>({})
    // 메시지 로딩 상태
    const messageOptions = reactive<Record<string, { isLast: boolean; isLoading: boolean; cursor: string }>>({})

    // 답장 메시지 매핑 관계
    const replyMapping = reactive<Record<string, Record<string, string[]>>>({})
    // 철회된 메시지 내용 및 시간 저장
    const recalledMessages = reactive<Record<string, RecalledMessage>>({})
    // 각 철회 메시지의 만료 타이머 저장
    const expirationTimers: Record<string, boolean> = {}
    const isMsgMultiChoose = ref<boolean>(false)
    const msgMultiChooseMode = ref<'normal' | 'forward'>('normal')

    // 현재 채팅방 메시지 Map 계산 속성
    const currentMessageMap = computed(() => {
      return messageMap[globalStore.currentSessionRoomId] || {}
    })

    // 현재 채팅방 메시지 로딩 상태 계산 속성
    const currentMessageOptions = computed({
      get: () => {
        const roomId = globalStore.currentSessionRoomId
        const current = messageOptions[roomId]
        if (current === undefined) {
          messageOptions[roomId] = { isLast: false, isLoading: false, cursor: '' }
        }
        return messageOptions[roomId]
      },
      set: (val) => {
        const roomId = globalStore.currentSessionRoomId
        messageOptions[roomId] = val as { isLast: boolean; isLoading: boolean; cursor: string }
      }
    })

    // 현재 채팅방 답장 메시지 매핑 계산 속성
    const currentReplyMap = computed({
      get: () => {
        const roomId = globalStore.currentSessionRoomId
        const current = replyMapping[roomId]
        if (current === undefined) {
          replyMapping[roomId] = {}
        }
        return replyMapping[roomId]
      },
      set: (val) => {
        const roomId = globalStore.currentSessionRoomId
        replyMapping[roomId] = val as Record<string, string[]>
      }
    })

    // "더 이상 메시지 없음" 표시 여부 판단
    const shouldShowNoMoreMessage = computed(() => {
      return currentMessageOptions.value?.isLast
    })

    // 현재 그룹 채팅 여부 판단
    const isGroup = computed(() => globalStore.currentSession?.type === RoomTypeEnum.GROUP)

    // 현재 대화 정보 가져오기 계산 속성
    const currentSessionInfo = computed(() => {
      const roomId = globalStore.currentSessionRoomId
      if (!roomId) return undefined

      // sessionMap에서 직접 검색 (페이지 새로 고침 후 자동 복구)
      return resolveSessionByRoomId(roomId)
    })

    // 새 메시지 카운트 관련 반응형 데이터
    const newMsgCount = reactive<Record<string, { count: number; isStart: boolean }>>({})

    // 현재 채팅방 새 메시지 카운트 계산 속성
    const currentNewMsgCount = computed({
      get: () => {
        const roomId = globalStore.currentSessionRoomId
        const current = newMsgCount[roomId]
        if (current === undefined) {
          newMsgCount[roomId] = { count: 0, isStart: false }
        }
        return newMsgCount[roomId]
      },
      set: (val) => {
        const roomId = globalStore.currentSessionRoomId
        newMsgCount[roomId] = val as { count: number; isStart: boolean }
      }
    })

    /**
     * 현재 방이 아닌 메시지 캐시 정리
     * @description 방 전환 시 호출, 메모리 해제, 현재 방의 메시지만 유지
     * 주의: 메시지 내용만 지우고 key는 삭제하지 않아 반응형 의존성에 영향을 주지 않음
     */
    const clearOtherRoomsMessages = (currentRoomId: string) => {
      for (const roomId in messageMap) {
        if (roomId !== currentRoomId) {
          // 메시지 내용만 지우고 반응형 객체 구조 유지
          for (const msgId in messageMap[roomId]) {
            delete messageMap[roomId][msgId]
          }
        }
      }
    }

    /**
     * 채팅방 전환
     * @description
     * 사용자가 다른 채팅방으로 전환할 때 이 메서드를 호출하여 전체 방 전환 프로세스를 수행합니다.
     * 이 메서드는 이전 방의 메시지 데이터를 지우고 새 방의 메시지를 다시 로드하며 관련 상태 재설정을 처리합니다.
     */
    const changeRoom = async () => {
      const currentWindowLabel = WebviewWindow.getCurrent()
      if (currentWindowLabel.label !== 'home' && currentWindowLabel.label !== 'mobile-home') {
        return
      }

      // currentSession이 없으면 바로 반환
      if (!globalStore.currentSessionRoomId) {
        return
      }

      const roomId = globalStore.currentSessionRoomId

      // 다른 방의 메시지 캐시 정리, 메모리 해제
      clearOtherRoomsMessages(roomId)

      // 만료된 철회 메시지 캐시 정리
      cleanupExpiredRecalledMessages()

      // 1. 현재 방의 이전 메시지 데이터 지우기
      if (messageMap[roomId]) {
        messageMap[roomId] = {}
      }

      // 2. 메시지 로딩 상태 재설정
      currentMessageOptions.value = {
        isLast: false,
        isLoading: false,
        cursor: ''
      }

      // 3. 답장 매핑 지우기
      if (currentReplyMap.value) {
        for (const key in currentReplyMap.value) {
          delete currentReplyMap.value[key]
        }
      }

      try {
        // 서버에서 메시지 로드
        await getPageMsg(pageSize, roomId, '')
      } catch (error) {
        console.error('메시지를 로드할 수 없음:', error)
        currentMessageOptions.value = {
          isLast: false,
          isLoading: false,
          cursor: ''
        }
      }

      // 현재 대화 읽음 표시
      if (globalStore.currentSessionRoomId) {
        const session = resolveSessionByRoomId(globalStore.currentSessionRoomId)
        if (session?.unreadCount) {
          markSessionRead(globalStore.currentSessionRoomId)
        }
      }

      // 현재 답장 메시지 재설정
      currentMsgReply.value = {}
    }

    // 현재 메시지 답장
    const currentMsgReply = ref<Partial<MessageType>>({})

    // 메시지 목록을 배열로 변환하고 시간 간격 계산
    const chatMessageList = computed(() => {
      if (!currentMessageMap.value || Object.keys(currentMessageMap.value).length === 0) return []

      // Rust 백엔드에서 계산된 timeBlock 직접 사용, 프론트엔드 계산 안 함
      return Object.values(currentMessageMap.value).sort((a, b) => Number(a.message.id) - Number(b.message.id))
    })

    const chatMessageListByRoomId = computed(() => (roomId: string) => {
      if (!messageMap[roomId] || Object.keys(messageMap[roomId]).length === 0) return []

      return Object.values(messageMap[roomId]).sort((a, b) => Number(a.message.id) - Number(b.message.id))
    })

    const findRoomIdByMsgId = (msgId: string) => {
      if (!msgId) return ''
      for (const roomId of Object.keys(messageMap)) {
        const roomMessages = messageMap[roomId]
        if (roomMessages && msgId in roomMessages) {
          return roomId
        }
      }
      return ''
    }

    /**
     * 로그인 후 모든 대화의 메시지 한 번 로드
     * @description
     * 제어된 동시 로딩(p-limit) 사용, 대량의 대화 시 UI 차단 방지
     * - 최근 활성 대화 우선 로드
     * - 동시성 수를 5로 제한하여 성능과 서버 부하 균형 유지
     * - Promise.allSettled를 사용하여 일부 실패가 다른 대화에 영향을 주지 않도록 함
     */
    const setAllSessionMsgList = async (size = pageSize) => {
      await info('모든 대화 메시지 목록 초기 설정')

      if (sessionList.value.length === 0) return

      // 활성 시간순 정렬, 최근 대화 우선 로드
      const sortedSessions = [...sessionList.value].sort((a, b) => b.activeTime - a.activeTime)

      // 동시성 제한기 생성 (최대 5개 동시 요청)
      const limit = pLimit(5)

      // p-limit으로 작업 래핑 및 실행
      const tasks = sortedSessions.map((session) => limit(() => getPageMsg(size, session.roomId, '', true)))

      // 모든 작업 동시 실행
      const results = await Promise.allSettled(tasks)

      // 로드 결과 통계
      const successCount = results.filter((r) => r.status === 'fulfilled').length
      const failCount = results.filter((r) => r.status === 'rejected').length

      await info(`대화 메시지 로드 완료: 성공 ${successCount}/${sortedSessions.length}, 실패 ${failCount}`)

      // 실패한 대화 기록 (선택 사항)
      if (failCount > 0) {
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            console.warn(`대화 ${sortedSessions[index].roomId} 메시지 로드 실패:`, result.reason)
          }
        })
      }
    }

    // 메시지 목록 가져오기
    const getMsgList = async (size = pageSize, async?: boolean) => {
      await info('메시지 목록 가져오기')
      // 현재 방 ID 가져오기, 후속 비교용
      const requestRoomId = globalStore.currentSessionRoomId

      await getPageMsg(size, requestRoomId, currentMessageOptions.value?.cursor, async)
    }

    const getPageMsg = async (pageSize: number, roomId: string, cursor: string = '', async?: boolean) => {
      // 로컬 저장소 조회, 메시지 데이터 가져오기
      const data: any = await invokeWithErrorHandler(
        TauriCommand.PAGE_MSG,
        {
          param: {
            pageSize: pageSize,
            cursor: cursor,
            roomId: roomId,
            async: !!async
          }
        },
        {
          customErrorMessage: '메시지 목록 가져오기 실패',
          errorType: ErrorType.Network
        }
      )

      // messageOptions 업데이트
      messageOptions[roomId] = {
        isLast: data.isLast,
        isLoading: false,
        cursor: data.cursor
      }

      // messageMap[roomId] 초기화 확인
      if (!messageMap[roomId]) {
        messageMap[roomId] = {}
      }

      for (const msg of data.list) {
        messageMap[roomId][msg.message.id] = msg
      }
    }

    const remoteSyncLocks = new Set<string>()
    const fetchCurrentRoomRemoteOnce = async (size = pageSize) => {
      const roomId = globalStore.currentSessionRoomId
      if (!roomId) return
      if (remoteSyncLocks.has(roomId)) return
      remoteSyncLocks.add(roomId)
      try {
        const opts = messageOptions[roomId] || { isLast: false, isLoading: false, cursor: '' }
        opts.cursor = ''
        messageOptions[roomId] = opts
        await getPageMsg(size, roomId, '')
      } finally {
        remoteSyncLocks.delete(roomId)
      }
    }

    // 대화 목록 가져오기
    const getSessionList = async (_isFresh = false) => {
      try {
        if (sessionOptions.isLoading) return
        sessionOptions.isLoading = true
        // 이전 대화의 오래된 읽지 않음 표시 방지, 동기화 중 먼저 메시지 읽지 않음 0으로 초기화, 가져오기 완료 후 다시 계산
        globalStore.unreadReady = false
        globalStore.unReadMark.newMsgUnreadCount = 0
        unreadCountManager.refreshBadge(globalStore.unReadMark, feedStore.unreadCount)
        const prevSessions =
          sessionList.value.length > 0
            ? sessionList.value.reduce(
              (map, item) => {
                map[item.roomId] = { ...item }
                return map
              },
              {} as Record<string, SessionItem>
            )
            : undefined
        const data: any = await invokeWithErrorHandler(TauriCommand.LIST_CONTACTS, undefined, {
          customErrorMessage: '대화 목록 가져오기 실패',
          errorType: ErrorType.Network
        }).catch(() => {
          sessionOptions.isLoading = false
          return null
        })
        if (!data) {
          // 가져오기 실패 시에도 읽지 않은 배지 표시 복구, unreadReady가 false에 머무는 것 방지
          globalStore.unreadReady = true
          unreadCountManager.refreshBadge(globalStore.unReadMark, feedStore.unreadCount)
          return
        }

        // console.log(
        //   '[SessionDebug] 백엔드 반환 대화 목록:',
        //   data.map((item: SessionItem) => ({
        //     roomId: item.roomId,
        //     unreadCount: item.unreadCount,
        //     name: item.name
        //   }))
        // )

        sessionList.value = [...data]
        syncPersistedUnreadCounts()
        sessionOptions.isLoading = false

        // sessionMap 동기화 업데이트
        for (const session of sessionList.value) {
          sessionMap.value[session.roomId] = session
        }

        sortAndUniqueSessionList()

        // 오래된 읽지 않음 보상 후 다시 한 번 읽지 않은 배지 업데이트, 로딩 과정에서 이전 데이터 깜박임 방지
        await reconcileStaleUnread(prevSessions)
        await reconcileUnreadWithReadHistory()
        await clearCurrentSessionUnread()
        updateTotalUnreadCount()
        // 현재 대화가 서버에서 여전히 읽지 않음으로 표시된 경우, 능동적으로 보고하고 0으로 초기화하여 말풍선이 멈추는 것 방지
        const currentRoomId = globalStore.currentSessionRoomId
        if (currentRoomId) {
          const currentSession = resolveSessionByRoomId(currentRoomId)
          if (currentSession?.unreadCount) {
            try {
              await markMsgRead(currentRoomId)
            } catch (error) {
              console.error('[chat] 대화 목록 동기화 후 읽음 보고 실패:', error)
            }
            markSessionRead(currentRoomId)
            // 현재 대화 읽지 않음 지운 후 총 읽지 않은 수 다시 계산 필요, 독 아이콘 올바르게 업데이트 보장
            updateTotalUnreadCount()
          }
        }
        globalStore.unreadReady = true
        unreadCountManager.refreshBadge(globalStore.unReadMark, feedStore.unreadCount)
      } catch (e) {
        console.error('대화 목록 가져오기 실패11:', e)
        sessionOptions.isLoading = false
        // 오류 발생 시에도 읽지 않은 표시 복구, 배지가 오랫동안 숨겨지는 것 방지
        globalStore.unreadReady = true
        unreadCountManager.refreshBadge(globalStore.unReadMark, feedStore.unreadCount)
      } finally {
        sessionOptions.isLoading = false
      }
    }

    /** 대화 목록 중복 제거 및 정렬 */
    const sortAndUniqueSessionList = () => {
      // uniqBy를 사용하여 roomId로 중복 제거, orderBy를 사용하여 activeTime 내림차순 정렬
      const uniqueAndSorted = orderBy(
        uniqBy(sessionList.value, (item) => item.roomId),
        [(item) => item.activeTime],
        ['desc']
      )
      sessionList.value.splice(0, sessionList.value.length, ...uniqueAndSorted)
    }

    // 대화 업데이트
    const updateSession = (roomId: string, data: Partial<SessionItem>) => {
      const session = resolveSessionByRoomId(roomId)
      if (session) {
        const updatedSession = { ...session, ...data }

        // sessionList 동기화 업데이트
        const index = sessionList.value.findIndex((s) => s.roomId === roomId)
        if (index !== -1) {
          sessionList.value[index] = updatedSession
        }

        // sessionMap 동기화 업데이트
        sessionMap.value[roomId] = updatedSession

        if ('unreadCount' in data && typeof updatedSession.unreadCount === 'number') {
          persistUnreadCount(roomId, updatedSession.unreadCount)
          requestUnreadCountUpdate(roomId)
        }

        // 방해 금지 상태가 업데이트된 경우 전역 읽지 않은 수 다시 계산 필요
        if ('muteNotification' in data) {
          requestUnreadCountUpdate()
        }
      }
    }

    // 대화 마지막 활성 시간 업데이트, 업데이트 과정에서 대화가 존재하지 않으면 대화 새로 고침
    const updateSessionLastActiveTime = (roomId: string) => {
      // O(1) 검색
      const session = resolveSessionByRoomId(roomId)
      if (session) {
        Object.assign(session, { activeTime: Date.now() })
      } else {
        addSession(roomId)
      }
      return session
    }

    const addSession = async (roomId: string) => {
      const resp = await getSessionDetail({ id: roomId })
      syncPersistedUnreadCounts([resp])
      sessionList.value.unshift(resp)
      // sessionMap 동기화 업데이트
      sessionMap.value[roomId] = resp
      sortAndUniqueSessionList()
    }

    // 방 ID를 통해 대화 정보 가져오기
    const getSession = (roomId: string) => {
      if (!roomId) {
        return sessionList.value[0]
      }

      // O(1) 검색 (페이지 새로 고침 후 지속성에서 자동 복구)
      return resolveSessionByRoomId(roomId)
    }

    // 메시지 푸시
    const pushMsg = async (msg: MessageType, options: { isActiveChatView?: boolean; activeRoomId?: string } = {}) => {
      if (!msg.message.id) {
        msg.message.id = `${msg.message.roomId}_${msg.message.sendTime}_${msg.fromUser.uid}`
      }
      const messageKey = msg.message.id

      let roomMessages = messageMap[msg.message.roomId]
      if (!roomMessages) {
        roomMessages = {}
        messageMap[msg.message.roomId] = roomMessages
      }

      const existedMsg = roomMessages[messageKey]
      roomMessages[messageKey] = msg

      if (existedMsg) {
        return
      }

      const targetRoomId = options.activeRoomId ?? globalStore.currentSessionRoomId ?? ''
      let isActiveChatView = options.isActiveChatView
      if (isActiveChatView === undefined) {
        const currentPath = route?.path
        isActiveChatView =
          (currentPath === '/message' || currentPath?.startsWith('/mobile/chatRoom')) &&
          targetRoomId === msg.message.roomId
      }

      // 사용자 정보 캐시 가져오기
      const uid = msg.fromUser.uid
      const cacheUser = groupStore.getUserInfo(uid)

      // 대화의 텍스트 속성 및 읽지 않은 수 업데이트
      const session = updateSessionLastActiveTime(msg.message.roomId)
      if (session) {
        const lastMsgUserName = cacheUser?.name
        const formattedText =
          msg.message.type === MsgEnum.RECALL
            ? session.type === RoomTypeEnum.GROUP
              ? `${lastMsgUserName}:메시지를 철회했습니다`
              : msg.fromUser.uid === userStore.userInfo!.uid
                ? '메시지를 철회했습니다'
                : '상대방이 메시지를 철회했습니다'
            : renderReplyContent(
              lastMsgUserName,
              msg.message.type,
              msg.message.body?.content || msg.message.body,
              session.type
            )
        session.text = formattedText!
        // 읽지 않은 수 업데이트
        if (msg.fromUser.uid !== userStore.userInfo!.uid) {
          if (!isActiveChatView || msg.message.roomId !== targetRoomId) {
            session.unreadCount = (session.unreadCount || 0) + 1
            persistUnreadCount(session.roomId, session.unreadCount)
            // 디바운스 메커니즘 사용하여 업데이트, 동시 메시지 시나리오에 적합
            requestUnreadCountUpdate()
          }
        }
      }

      // 받은 메시지에 본인 멘션이 포함된 경우 시스템 알림 전송
      if (msg.message.body.atUidList?.includes(userStore.userInfo!.uid) && cacheUser) {
        sendNotification({
          title: cacheUser.name as string,
          body: msg.message.body.content,
          icon: cacheUser.avatar as string
        })
      }

      // 백그라운드 대화에 메시지가 장기간 누적되는 것을 방지, 상한 초과 시 자르기 (현재 대화 무결성 유지, 읽는 중 잘림 방지)
      if (!isActiveChatView || msg.message.roomId !== targetRoomId) {
        clearRedundantMessages(msg.message.roomId, ROOM_MESSAGE_CACHE_LIMIT)
      }
    }

    const checkMsgExist = (roomId: string, msgId: string) => {
      const current = messageMap[roomId]
      return current && msgId in current
    }

    const clearMsgCheck = () => {
      chatMessageList.value.forEach((msg) => (msg.isCheck = false))
    }

    // 차단된 사용자의 발언 필터링
    // const filterUser = (uid: string) => {
    //   for (const roomId in messageMap) {
    //     const messages = messageMap[roomId]
    //     for (const msgId in messages) {
    //       const msg = messages[msgId]
    //       if (msg.fromUser.uid === uid) {
    //         delete messages[msgId]
    //       }
    //     }
    //   }
    // }

    // 더 많은 메시지 로드
    const loadMore = async (size?: number) => {
      if (currentMessageOptions.value?.isLast) return
      await getMsgList(size, true)
    }

    /** 새 메시지 카운트 지우기 */
    const clearNewMsgCount = () => {
      currentNewMsgCount.value && (currentNewMsgCount.value.count = 0)
    }

    // 목록에서 메시지 인덱스 찾기
    const getMsgIndex = (msgId: string) => {
      if (!msgId) return -1
      const keys = currentMessageMap.value ? Object.keys(currentMessageMap.value) : []
      return keys.indexOf(msgId)
    }

    // 모든 마크 유형의 수량 업데이트
    const updateMarkCount = async (markList: MarkItemType[]) => {
      info('메시지 마크를 로컬 데이터베이스에 저장')
      for (const mark of markList) {
        const { msgId, markType, markCount, actType, uid } = mark

        await invokeWithErrorHandler(
          TauriCommand.SAVE_MESSAGE_MARK,
          {
            data: {
              msgId: msgId.toString(),
              markType,
              markCount,
              actType,
              uid: uid.toString()
            }
          },
          {
            customErrorMessage: '메시지 마크 저장',
            errorType: ErrorType.Client
          }
        )

        const msgItem = currentMessageMap.value?.[String(msgId)]
        if (msgItem && msgItem.message.messageMarks) {
          // 현재 마크 상태 가져오기, 없으면 초기화
          const currentMarkStat = msgItem.message.messageMarks[String(markType)] || {
            count: 0,
            userMarked: false
          }

          // 동작 유형에 따라 카운트 및 사용자 마크 상태 업데이트
          // actType: 1은 확인(마크 추가), 2는 취소(마크 제거)
          if (actType === 1) {
            // 마크 추가
            // 현재 사용자의 작업인 경우 userMarked를 true로 설정
            if (uid === userStore.userInfo!.uid) {
              currentMarkStat.userMarked = true
            }
            // 카운트 업데이트
            currentMarkStat.count = markCount
          } else if (actType === 2) {
            // 마크 취소
            // 현재 사용자의 작업인 경우 userMarked를 false로 설정
            if (uid === userStore.userInfo!.uid) {
              currentMarkStat.userMarked = false
            }
            // 카운트 업데이트
            currentMarkStat.count = markCount
          }

          // messageMark 객체 업데이트
          msgItem.message.messageMarks[String(markType)] = currentMarkStat
        }
      }
    }

    const recordRecallMsg = (data: {
      recallUid: string
      msg: MessageType
      originalType?: number
      originalContent?: string
    }) => {
      // 철회된 메시지 내용 및 시간 저장
      const recallTime = Date.now()
      // 전달된 originalType 및 originalContent 우선 사용, 경쟁 조건으로 인한 유형 수정 방지
      recalledMessages[data.msg.message.id] = {
        messageId: data.msg.message.id,
        content: data.originalContent ?? data.msg.message.body.content,
        recallTime,
        originalType: data.originalType ?? data.msg.message.type
      }

      if (data.recallUid === userStore.userInfo!.uid) {
        // Worker를 사용하여 타이머 처리
        timerWorker.postMessage({
          type: 'startTimer',
          msgId: data.msg.message.id,
          duration: RECALL_EXPIRATION_TIME
        })
      }

      // 이 메시지 ID에 이미 타이머가 있음을 기록
      expirationTimers[data.msg.message.id] = true
    }

    // 메시지 철회 상태 업데이트
    const updateRecallMsg = async (data: RevokedMsgType) => {
      const { msgId } = data
      const roomIdFromPayload = data.roomId || currentMessageMap.value?.[msgId]?.message?.roomId
      const resolvedRoomId = roomIdFromPayload || findRoomIdByMsgId(msgId)
      const session = resolvedRoomId ? resolveSessionByRoomId(resolvedRoomId) : undefined
      const sessionType = session?.type ?? RoomTypeEnum.SINGLE
      const roomMessages = resolvedRoomId ? messageMap[resolvedRoomId] : undefined
      const message = roomMessages?.[msgId] || currentMessageMap.value?.[msgId]
      let recallMessageBody = ''

      if (message && typeof data.recallUid === 'string') {
        const currentUid = userStore.userInfo!.uid
        // 철회된 메시지의 원래 발신자
        const senderUid = message.fromUser.uid

        const isRecallerCurrentUser = data.recallUid === currentUid
        const isSenderCurrentUser = senderUid === currentUid
        const recallerUser = groupStore.getUserInfo(data.recallUid, resolvedRoomId)
        const recallerName = recallerUser?.myName || recallerUser?.name || data.recallUid || ''
        const senderUser = groupStore.getUserInfo(senderUid, resolvedRoomId)
        const senderName = senderUser?.myName || senderUser?.name || message.fromUser.username || senderUid
        const isGroup = sessionType === RoomTypeEnum.GROUP

        if (isRecallerCurrentUser) {
          // 현재 사용자가 철회 작업 수행자임
          if (data.recallUid === senderUid) {
            // 자신의 관점
            recallMessageBody = '메시지를 철회했습니다'
          } else {
            // 타인의 메시지 철회
            recallMessageBody = `${senderName}님의 메시지를 철회했습니다`
          }
        } else {
          // 현재 사용자가 철회 작업 수행자가 아님
          if (isGroup) {
            // 그룹 채팅의 경우 철회자 닉네임 표시
            const recallerLabel = recallerName || '상대방'
            if (isSenderCurrentUser) {
              recallMessageBody = `${recallerLabel}님이 당신의 메시지를 철회했습니다`
            } else {
              recallMessageBody = `${recallerLabel}님이 메시지를 철회했습니다`
            }
          } else {
            // 비그룹 채팅은 기존 1:1 채팅 로직 유지
            if (isSenderCurrentUser) {
              // 현재 사용자가 철회된 메시지의 발신자임 (철회 당한 사람 관점)
              recallMessageBody = '상대방이 당신의 메시지를 철회했습니다'
            } else {
              // 현재 사용자는 관찰자임 (다른 멤버 관점)
              recallMessageBody = '상대방이 메시지를 철회했습니다'
            }
          }
        }

        // 프론트엔드 캐시 업데이트
        message.message.type = MsgEnum.RECALL
        message.message.body.content = recallMessageBody

        // SQLite 데이터베이스 동기화 업데이트
        try {
          await invokeWithErrorHandler(
            TauriCommand.UPDATE_MESSAGE_RECALL_STATUS,
            {
              messageId: message.message.id,
              messageType: MsgEnum.RECALL,
              messageBody: recallMessageBody
            },
            {
              customErrorMessage: '철회 메시지 상태 업데이트 실패',
              errorType: ErrorType.Client
            }
          )
          info(`[RECALL] Successfully updated message recall status in database, message_id: ${msgId}`)
        } catch (error) {
          console.error(`[RECALL] Failed to update message recall status in database:`, error)
        }
      }

      if (resolvedRoomId) {
        const session = resolveSessionByRoomId(resolvedRoomId)
        if (session && recallMessageBody) {
          session.text = recallMessageBody
        }
        useMitt.emit(MittEnum.UPDATE_SESSION_LAST_MSG, { roomId: resolvedRoomId })
      }

      // 이 철회 메시지와 관련된 메시지 업데이트
      const messageList = currentReplyMap.value?.[msgId]
      if (messageList) {
        for (const id of messageList) {
          const msg = currentMessageMap.value?.[id]
          if (msg) {
            msg.message.body.reply.body = '원본 메시지가 철회되었습니다'
          }
        }
      }
    }

    // 철회된 메시지 가져오기
    const getRecalledMessage = (msgId: string): RecalledMessage | undefined => {
      return recalledMessages[msgId]
    }

    // 메시지 삭제
    const deleteMsg = (msgId: string) => {
      if (currentMessageMap.value && msgId in currentMessageMap.value) {
        delete currentMessageMap.value[msgId]
      }
    }

    const clearRoomMessages = (roomId: string) => {
      if (!roomId) return

      if (messageMap[roomId]) {
        messageMap[roomId] = {}
      }

      if (replyMapping[roomId]) {
        replyMapping[roomId] = {}
      }

      const defaultOptions = {
        isLast: true,
        isLoading: false,
        cursor: ''
      }

      if (globalStore.currentSessionRoomId === roomId) {
        currentMessageOptions.value = defaultOptions
        currentReplyMap.value = {}
        currentMsgReply.value = {}
      } else {
        messageOptions[roomId] = defaultOptions
      }

      newMsgCount[roomId] = { count: 0, isStart: false }
    }

    // 메시지 업데이트
    const updateMsg = ({
      msgId,
      status,
      newMsgId,
      body,
      uploadProgress,
      timeBlock
    }: {
      msgId: string
      status: MessageStatusEnum
      newMsgId?: string
      body?: any
      uploadProgress?: number
      timeBlock?: number
    }) => {
      const msg = currentMessageMap.value?.[msgId]
      if (msg) {
        msg.message.status = status
        // timeBlock에 값이 있을 때만 업데이트하여 기존 값 덮어쓰기 방지
        if (timeBlock !== undefined) {
          msg.timeBlock = timeBlock
        }
        if (newMsgId) {
          msg.message.id = newMsgId
        }
        if (body) {
          msg.message.body = body
        }
        if (uploadProgress !== undefined) {
          console.log(`메시지 진행률 업데이트: ${uploadProgress}% (메시지 ID: ${msgId})`)
          // 반응형 업데이트 보장, 새 메시지 객체 생성
          const updatedMsg = { ...msg, uploadProgress }
          if (currentMessageMap.value) {
            currentMessageMap.value[msg.message.id] = updatedMsg
          }
          // 반응형 업데이트 강제 트리거
          messageMap[globalStore.currentSessionRoomId] = { ...currentMessageMap.value }
        } else {
          if (currentMessageMap.value) {
            currentMessageMap.value[msg.message.id] = msg
          }
        }
        if (newMsgId && msgId !== newMsgId && currentMessageMap.value) {
          delete currentMessageMap.value[msgId]
        }
      }
    }

    // 읽은 수를 0으로 표시
    const markSessionRead = (roomId: string) => {
      const session = resolveSessionByRoomId(roomId)
      if (!session) return
      if (session.unreadCount === 0) {
        requestUnreadCountUpdate(roomId)
        return
      }

      // 읽음 처리 시 활성 시간 기록, 재로그인 시 오래된 읽지 않음 식별에 사용
      const activeTime = session.activeTime || Date.now()
      lastReadActiveTime.value[roomId] = activeTime
      sessionUnreadStore.setLastRead(userStore.userInfo?.uid, roomId, activeTime)

      updateSession(roomId, { unreadCount: 0 })
      // 전역 읽지 않은 수 즉시 새로 고침, 디바운스 대기 방지
      updateTotalUnreadCount()
    }

    // 현재 대화의 읽지 않음 정리 (재연결/재로그인 후에도 해당 대화에 머물러 있을 때의 폴백)
    const clearCurrentSessionUnread = async () => {
      const roomId = globalStore.currentSessionRoomId
      if (!roomId) return
      const session = resolveSessionByRoomId(roomId)
      if (!session?.unreadCount) return

      try {
        await markMsgRead(roomId)
      } catch (error) {
        console.error('[chat] 보상 읽음 보고 실패:', error)
      }
      markSessionRead(roomId)
    }

    // 메시지 ID로 메시지 본문 가져오기
    const getMessage = (messageId: string) => {
      return currentMessageMap.value?.[messageId]
    }

    // 대화 삭제
    const removeSession = (roomId: string) => {
      const session = resolveSessionByRoomId(roomId)
      if (session) {
        // 배열에서 삭제
        const index = sessionList.value.findIndex((s) => s.roomId === roomId)
        if (index !== -1) {
          sessionList.value.splice(index, 1)
        }

        // map에서 삭제
        delete sessionMap.value[roomId]
        delete lastReadActiveTime.value[roomId]
        sessionUnreadStore.setLastRead(userStore.userInfo?.uid, roomId, 0)

        if (globalStore.currentSessionRoomId === roomId) {
          globalStore.updateCurrentSessionRoomId(sessionList.value[0].roomId)
        }

        // 대화 삭제 후 읽지 않은 카운트 업데이트
        requestUnreadCountUpdate()
      }
      removeUnreadCountCache(roomId)
    }

    // Worker 메시지 수신 대기
    timerWorker.onmessage = (e) => {
      const { type, msgId } = e.data

      if (type === 'timeout') {
        console.log(`[Timeout] 메시지 ID: ${msgId} 만료됨`)
        delete recalledMessages[msgId]
        delete expirationTimers[msgId]
      } else if (type === 'allTimersCompleted') {
        // 모든 타이머가 완료되었으므로 리소스를 안전하게 정리할 수 있음
        clearAllExpirationTimers()
        terminateWorker()
      }
    }

    // worker 종료
    const terminateWorker = () => {
      timerWorker.terminate()
    }

    // 모든 타이머 및 철회 메시지 캐시 정리
    const clearAllExpirationTimers = () => {
      for (const msgId in expirationTimers) {
        // worker에 해당 타이머 중지 알림
        timerWorker.postMessage({
          type: 'clearTimer',
          msgId
        })
      }
      // expirationTimers 정리
      for (const msgId in expirationTimers) {
        delete expirationTimers[msgId]
      }
      // recalledMessages도 정리하여 메모리 누적 방지
      for (const msgId in recalledMessages) {
        delete recalledMessages[msgId]
      }
    }

    // 만료된 철회 메시지 정리 (2분 초과)
    const cleanupExpiredRecalledMessages = () => {
      const now = Date.now()
      for (const msgId in recalledMessages) {
        const msg = recalledMessages[msgId]
        if (now - msg.recallTime > RECALL_EXPIRATION_TIME) {
          delete recalledMessages[msgId]
          if (expirationTimers[msgId]) {
            timerWorker.postMessage({ type: 'clearTimer', msgId })
            delete expirationTimers[msgId]
          }
        }
      }
    }

    // 읽지 않은 메시지 카운트 업데이트
    const updateTotalUnreadCount = () => {
      // 통합 카운트 관리자 사용 (타임라인 읽지 않은 수 포함)
      unreadCountManager.calculateTotal(sessionList.value, globalStore.unReadMark, feedStore.unreadCount)
    }

    // 카운트 관리자 업데이트 콜백 설정
    unreadCountManager.setUpdateCallback(() => {
      unreadCountManager.calculateTotal(sessionList.value, globalStore.unReadMark, feedStore.unreadCount)
    })

    // 디바운스 메커니즘을 사용하는 업데이트 함수
    const requestUnreadCountUpdate = (sessionId?: string) => {
      unreadCountManager.requestUpdate(sessionId)
    }

    // 모든 대화의 읽지 않은 수 지우기
    const clearUnreadCount = () => {
      sessionList.value.forEach((session) => {
        session.unreadCount = 0
        persistUnreadCount(session.roomId, 0)
      })
      // 전역 읽지 않은 수 업데이트
      requestUnreadCountUpdate()
    }

    const clearRedundantMessages = (roomId: string, limit: number = pageSize) => {
      const currentMessages = messageMap[roomId]
      if (!currentMessages) return

      // 메시지를 배열로 변환하고 메시지 ID 역순으로 정렬, 앞쪽 요소가 최신 메시지를 나타냄
      const sortedMessages = Object.values(currentMessages).sort((a, b) => Number(b.message.id) - Number(a.message.id))

      if (sortedMessages.length <= limit) {
        return
      }

      const keptMessages = sortedMessages.slice(0, limit)
      const keepMessageIds = new Set(keptMessages.map((msg) => msg.message.id))
      const fallbackCursor = keptMessages[keptMessages.length - 1]?.message.id || ''

      // 불필요한 메시지 삭제
      for (const msgId in currentMessages) {
        if (!keepMessageIds.has(msgId)) {
          delete currentMessages[msgId]
        }
      }

      if (!messageOptions[roomId]) {
        messageOptions[roomId] = { isLast: false, isLoading: false, cursor: '' }
      }

      // 커서를 현재 메모리에서 가장 오래된 메시지 ID로 업데이트하여 후속 '더 보기'가 데이터베이스에서 이전 메시지를 채울 수 있도록 함
      if (fallbackCursor) {
        messageOptions[roomId] = {
          ...messageOptions[roomId],
          cursor: fallbackCursor,
          isLast: false
        }
      }

      // 콘솔에 자르기 정보 힌트, 메모리 압축 트리거 지점 찾기 용이
      console.info(
        '[chat][trim]',
        `roomId=${roomId}`,
        `removed=${sortedMessages.length - keptMessages.length}`,
        `kept=${keptMessages.length}`,
        `limit=${limit}`
      )
    }

    /**
     * 현재 채팅방 메시지 목록 초기화 및 새로 고침
     * @description
     * 현재 채팅방의 모든 로컬 메시지 캐시를 지우고 서버에서 최신 메시지 목록을 다시 가져옵니다.
     * 주로 메시지 강제 새로 고침이 필요한 시나리오에 사용되어 최신 서버 데이터가 표시되도록 합니다.
     */
    const resetAndRefreshCurrentRoomMessages = async () => {
      if (!globalStore.currentSessionRoomId) return

      // 현재 방 ID 저장, 후속 비교용
      const requestRoomId = globalStore.currentSessionRoomId

      try {
        // 1. 메시지 데이터 지우기, 경쟁 조건 방지
        if (messageMap[requestRoomId]) {
          messageMap[requestRoomId] = {}
        }

        // 2. 메시지 로딩 상태 재설정, 최신 메시지를 가져오기 위해 cursor를 강제로 비움
        messageOptions[requestRoomId] = {
          isLast: false,
          isLoading: true,
          cursor: ''
        }

        // 3. 답장 매핑 지우기
        const currentReplyMapping = replyMapping[requestRoomId]
        if (currentReplyMapping) {
          for (const key in currentReplyMapping) {
            delete currentReplyMapping[key]
          }
        }

        // 4. getPageMsg를 직접 호출하여 최신 메시지 가져오기, 빈 cursor 강제 사용
        await getPageMsg(pageSize, requestRoomId, '')

        console.log('[Network] 현재 채팅방 메시지 목록이 초기화 및 새로 고침되었습니다')
      } catch (error) {
        console.error('[Network] 메시지 목록 초기화 및 새로 고침 실패:', error)
        // 가져오기 실패 시 로딩 상태 재설정 보장
        if (globalStore.currentSessionRoomId === requestRoomId) {
          messageOptions[requestRoomId] = {
            isLast: false,
            isLoading: false,
            cursor: ''
          }
        }
      }
    }

    // 모든 그룹 유형의 대화 가져오기
    const getGroupSessions = () => {
      return sessionList.value.filter((session) => session.type === RoomTypeEnum.GROUP)
    }

    const setMsgMultiChoose = (flag: boolean, mode: 'normal' | 'forward' = 'normal') => {
      isMsgMultiChoose.value = flag
      msgMultiChooseMode.value = flag ? mode : 'normal'
    }

    // 모든 대화 선택 상태 재설정
    const resetSessionSelection = () => {
      sessionList.value.forEach((session) => {
        session.isCheck = false
      })
    }

    return {
      getMsgIndex,
      chatMessageList,
      pushMsg,
      deleteMsg,
      clearRoomMessages,
      clearNewMsgCount,
      updateMarkCount,
      updateRecallMsg,
      recordRecallMsg,
      updateMsg,
      newMsgCount,
      messageMap,
      currentMessageMap,
      currentMessageOptions,
      currentReplyMap,
      currentNewMsgCount,
      loadMore,
      currentMsgReply,
      sessionList,
      sessionOptions,
      syncLoading,
      getSessionList,
      updateSession,
      updateSessionLastActiveTime,
      markSessionRead,
      getSession,
      isGroup,
      currentSessionInfo,
      getMessage,
      getRecalledMessage,
      recalledMessages,
      clearAllExpirationTimers,
      cleanupExpiredRecalledMessages,
      updateTotalUnreadCount,
      requestUnreadCountUpdate,
      clearUnreadCount,
      resetAndRefreshCurrentRoomMessages,
      fetchCurrentRoomRemoteOnce,
      getGroupSessions,
      removeSession,
      changeRoom,
      addSession,
      setAllSessionMsgList,
      chatMessageListByRoomId,
      shouldShowNoMoreMessage,
      isMsgMultiChoose,
      clearMsgCheck,
      setMsgMultiChoose,
      msgMultiChooseMode,
      resetSessionSelection,
      checkMsgExist,
      clearRedundantMessages
    }
  },
  {
    share: {
      enable: true,
      initialize: true
    }
  }
)
