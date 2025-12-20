<template>
  <div class="h-100vh w-100vw">
    <NaiveProvider :message-max="3" :notific-max="3" class="h-full">
      <div v-if="!isLock" class="h-full">
        <router-view />
      </div>
      <!-- 잠금 화면 페이지 -->
      <LockScreen v-else />
    </NaiveProvider>
  </div>
  <component :is="mobileRtcCallFloatCell" v-if="mobileRtcCallFloatCell" />
</template>
<script setup lang="ts">
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { info } from '@tauri-apps/plugin-log'
import { exit } from '@tauri-apps/plugin-process'
import { loadLanguage } from '@/services/i18n'
import {
  CallTypeEnum,
  EventEnum,
  StoresEnum,
  ThemeEnum,
  ChangeTypeEnum,
  MittEnum,
  OnlineEnum,
  RoomTypeEnum
} from '@/enums'
import { useGlobalShortcut } from '@/hooks/useGlobalShortcut.ts'
import { useMitt } from '@/hooks/useMitt.ts'
import { useWindow } from '@/hooks/useWindow.ts'
import { useGlobalStore } from '@/stores/global'
import { useSettingStore } from '@/stores/setting.ts'
import { isDesktop, isIOS, isMobile, isWindows10 } from '@/utils/PlatformConstants'
import LockScreen from '@/views/LockScreen.vue'
import { unreadCountManager } from '@/utils/UnreadCountManager'
import {
  type LoginSuccessResType,
  type OnStatusChangeType,
  WsResponseMessageType,
  type WsTokenExpire
} from '@/services/wsType.ts'
import { useContactStore } from '@/stores/contacts.ts'
import { useGroupStore } from '@/stores/group'
import { useUserStore } from '@/stores/user'
import { useChatStore } from '@/stores/chat'
import { useAnnouncementStore } from '@/stores/announcement'
import { useFeedStore } from '@/stores/feed'
import { useFeedNotificationStore } from '@/stores/feedNotification'
import type { MarkItemType, RevokedMsgType, UserItem } from '@/services/types.ts'
import * as ImRequestUtils from '@/utils/ImRequestUtils'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useTauriListener } from '@/hooks/useTauriListener'
const mobileRtcCallFloatCell = isMobile()
  ? defineAsyncComponent(() => import('@/mobile/components/RtcCallFloatCell.vue'))
  : null

const userStore = useUserStore()
const contactStore = useContactStore()
const announcementStore = useAnnouncementStore()
const feedStore = useFeedStore()
const feedNotificationStore = useFeedNotificationStore()
const userUid = computed(() => userStore.userInfo!.uid)
const groupStore = useGroupStore()
const chatStore = useChatStore()
const appWindow = WebviewWindow.getCurrent()
const { createRtcCallWindow, sendWindowPayload } = useWindow()
const globalStore = useGlobalStore()
const router = useRouter()
const { addListener } = useTauriListener()
// 데스크톱에서만 창 관리 기능 초기화
const { createWebviewWindow } = isDesktop() ? useWindow() : { createWebviewWindow: () => {} }
const settingStore = useSettingStore()
const { themes, lockScreen, page, login } = storeToRefs(settingStore)
// 전역 단축키 관리
const { initializeGlobalShortcut, cleanupGlobalShortcut } = useGlobalShortcut()

/** 잠금 화면이 필요 없는 페이지 */
const LockExclusion = new Set(['/login', '/tray', '/qrCode', '/about', '/onlineStatus', '/capture'])
const isLock = computed(() => {
  return !LockExclusion.has(router.currentRoute.value.path) && lockScreen.value.enable
})

/** 이미지 및 입력창 드래그 금지 */
const preventDrag = (e: MouseEvent) => {
  const event = e.target as HTMLElement
  // 대상 요소가 <img> 요소인지 확인
  if (event.nodeName.toLowerCase() === 'img' || event.nodeName.toLowerCase() === 'input') {
    e.preventDefault()
  }
}
const preventGlobalContextMenu = (event: MouseEvent) => event.preventDefault()

useMitt.on(WsResponseMessageType.VideoCallRequest, (event) => {
  info(`통화 요청 수신: ${JSON.stringify(event)}`)
  const remoteUid = event.callerUid
  const callType = event.isVideo ? CallTypeEnum.VIDEO : CallTypeEnum.AUDIO

  if (isMobile()) {
    useMitt.emit(MittEnum.MOBILE_RTC_CALL_REQUEST, {
      ...event,
      callerUid: remoteUid
    })
    return
  }

  handleVideoCall(remoteUid, callType)
})

useMitt.on(WsResponseMessageType.LOGIN_SUCCESS, async (data: LoginSuccessResType) => {
  const { ...rest } = data
  // 자신을 온라인으로 업데이트
  groupStore.updateOnlineNum({
    uid: rest.uid,
    isAdd: true
  })
  groupStore.updateUserItem(rest.uid, {
    activeStatus: OnlineEnum.ONLINE,
    avatar: rest.avatar,
    account: rest.account,
    lastOptTime: Date.now(),
    name: rest.name,
    uid: rest.uid
  })
  // 로그인 성공 시 현재/첫 번째 그룹 채팅의 멤버 정보를 동기화하여 메시지에 "알 수 없는 사용자"가 표시되지 않도록 함
  await refreshActiveGroupMembers()
})

useMitt.on(WsResponseMessageType.MSG_RECALL, (data: RevokedMsgType) => {
  chatStore.updateRecallMsg(data)
})

useMitt.on(WsResponseMessageType.MY_ROOM_INFO_CHANGE, (data: { myName: string; roomId: string; uid: string }) => {
  // 그룹 채팅에서 사용자의 닉네임 업데이트
  groupStore.updateUserItem(data.uid, { myName: data.myName }, data.roomId)
})

useMitt.on(
  WsResponseMessageType.REQUEST_NEW_FRIEND,
  async (data: { uid: number; unReadCount4Friend: number; unReadCount4Group: number }) => {
    console.log('친구 신청 수신')
    // 읽지 않은 수 업데이트
    globalStore.unReadMark.newFriendUnreadCount = data.unReadCount4Friend || 0
    globalStore.unReadMark.newGroupUnreadCount = data.unReadCount4Group || 0

    unreadCountManager.refreshBadge(globalStore.unReadMark, feedStore.unreadCount)

    // 친구 신청 목록 새로고침
    await contactStore.getApplyPage('friend', true)
  }
)

useMitt.on(WsResponseMessageType.NOTIFY_EVENT, async () => {
  await contactStore.getApplyUnReadCount()
  await Promise.all([contactStore.getApplyPage('friend', true), contactStore.getApplyPage('group', true)])
})

// 자신이 제거된 경우 처리
const handleSelfRemove = async (roomId: string) => {
  info('그룹 채팅 퇴장, 세션 데이터 삭제')

  // 세션 및 그룹 멤버 데이터 삭제
  chatStore.removeSession(roomId)
  groupStore.removeAllUsers(roomId)

  // 현재 세션이 제거된 그룹 채팅인 경우 다른 세션으로 전환
  if (globalStore.currentSessionRoomId === roomId) {
    globalStore.updateCurrentSessionRoomId(chatStore.sessionList[0].roomId)
  }
}

// 다른 멤버가 제거된 경우 처리
const handleOtherMemberRemove = async (uid: string, roomId: string) => {
  info('그룹 멤버 그룹 채팅 퇴장, 그룹 내 멤버 데이터 삭제')
  groupStore.removeUserItem(uid, roomId)
}

// 그룹 멤버 제거 처리
const handleMemberRemove = async (userList: UserItem[], roomId: string) => {
  for (const user of userList) {
    if (isSelfUser(user.uid)) {
      await handleSelfRemove(roomId)
    } else {
      await handleOtherMemberRemove(user.uid, roomId)
    }
  }
}

// 다른 멤버의 그룹 채팅 참여 처리
const handleOtherMemberAdd = async (user: UserItem, roomId: string) => {
  info('그룹 멤버 그룹 채팅 참여, 그룹 멤버 데이터 추가')
  groupStore.addUserItem(user, roomId)
}

// 현재 사용자인지 확인
const isSelfUser = (uid: string): boolean => {
  return uid === userStore.userInfo!.uid
}

// 자신의 그룹 채팅 참여 처리
const handleSelfAdd = async (roomId: string) => {
  info('그룹 채팅 참여, 해당 그룹 채팅의 세션 데이터 로드')
  await chatStore.addSession(roomId)
  try {
    await groupStore.getGroupUserList(roomId, true)
  } catch (error) {
    console.error('그룹 멤버 초기화 실패:', error)
  }
}

// 그룹 멤버 추가 처리
const handleMemberAdd = async (userList: UserItem[], roomId: string) => {
  for (const user of userList) {
    if (isSelfUser(user.uid)) {
      await handleSelfAdd(roomId)
    } else {
      await handleOtherMemberAdd(user, roomId)
    }
  }
}

useMitt.on(
  WsResponseMessageType.WS_MEMBER_CHANGE,
  async (param: {
    roomId: string
    changeType: ChangeTypeEnum
    userList: UserItem[]
    totalNum: number
    onlineNum: number
  }) => {
    info('그룹 멤버 변경 메시지 감지')
    const isRemoveAction = param.changeType === ChangeTypeEnum.REMOVE || param.changeType === ChangeTypeEnum.EXIT_GROUP
    if (isRemoveAction) {
      await handleMemberRemove(param.userList, param.roomId)
    } else {
      await handleMemberAdd(param.userList, param.roomId)
    }

    groupStore.addGroupDetail(param.roomId)
    // 그룹 내 총 인원수 업데이트
    groupStore.updateGroupNumber(param.roomId, param.totalNum, param.onlineNum)
  }
)

useMitt.on(WsResponseMessageType.MSG_MARK_ITEM, async (data: { markList: MarkItemType[] }) => {
  console.log('메시지 마크 업데이트 수신:', data)

  // data.markList가 배열인지 확인 후 updateMarkCount에 전달
  if (data && data.markList && Array.isArray(data.markList)) {
    await chatStore.updateMarkCount(data.markList)
  } else if (data && !Array.isArray(data)) {
    // 호환성 처리: 단일 MarkItemType 객체를 직접 받은 경우
    await chatStore.updateMarkCount([data as unknown as MarkItemType])
  }
})

useMitt.on(WsResponseMessageType.REQUEST_APPROVAL_FRIEND, async () => {
  // 최신 상태를 가져오기 위해 친구 목록 새로고침
  await contactStore.getContactList(true)
  await contactStore.getApplyUnReadCount()
  unreadCountManager.refreshBadge(globalStore.unReadMark, feedStore.unreadCount)
})

useMitt.on(WsResponseMessageType.ROOM_INFO_CHANGE, async (data: { roomId: string; name: string; avatar: string }) => {
  // roomId에 따라 해당 방의 그룹 이름과 그룹 아바타 수정
  const { roomId, name, avatar } = data

  // chatStore의 세션 정보 업데이트
  chatStore.updateSession(roomId, {
    name,
    avatar
  })
})

useMitt.on(WsResponseMessageType.TOKEN_EXPIRED, async (wsTokenExpire: WsTokenExpire) => {
  if (Number(userUid.value) === Number(wsTokenExpire.uid) && userStore.userInfo!.client === wsTokenExpire.client) {
    const { useLogin } = await import('@/hooks/useLogin')
    const { resetLoginState, logout } = useLogin()
    if (isMobile()) {
      try {
        // 1. 먼저 로그인 상태 초기화 (인터페이스 요청 없이 로컬만 정리)
        await resetLoginState()
        // 2. 로그아웃 메서드 호출
        await logout()

        settingStore.toggleLogin(false, false)
        info('계정이 다른 기기에서 로그인됨')

        // 3. 즉시 로그인 페이지로 이동, replace를 사용하여 현재 라우트 교체
        const router = await import('@/router')
        await router.default.replace('/mobile/login')

        // 4. 이동 후 팝업 알림 표시
        const { showDialog } = await import('vant')
        await import('vant/es/dialog/style')

        showDialog({
          title: '로그인 만료',
          message: '계정이 다른 기기에서 로그인되었습니다. 다시 로그인해 주세요.',
          confirmButtonText: '확인',
          showCancelButton: false,
          closeOnClickOverlay: false,
          closeOnPopstate: false,
          allowHtml: false
        })
      } catch (error) {
        console.error('토큰 만료 처리 실패:', error)
      }
    } else {
      // 데스크톱 처리: 메인 창 포커스 및 원격 로그인 팝업 표시
      const home = await WebviewWindow.getByLabel('home')
      await home?.setFocus()
      const remoteIp = wsTokenExpire.ip || '알 수 없는 IP'
      await sendWindowPayload('login', {
        remoteLogin: {
          ip: remoteIp,
          timestamp: Date.now()
        }
      })
      await ImRequestUtils.logout({ autoLogin: login.value.autoLogin })
      await resetLoginState()
      await logout()
    }
  }
})

useMitt.on(WsResponseMessageType.INVALID_USER, (param: { uid: string }) => {
  console.log('유효하지 않은 사용자')
  const data = param
  // 메시지 목록에서 차단된 발언 삭제
  // chatStore.filterUser(data.uid)
  // 그룹 멤버 목록에서 차단된 사용자 삭제
  groupStore.removeUserItem(data.uid)
})

useMitt.on(WsResponseMessageType.ONLINE, async (onStatusChangeType: OnStatusChangeType) => {
  console.log('사용자 온라인 알림 수신')
  // 그룹 채팅
  if (onStatusChangeType.type === 1) {
    groupStore.updateOnlineNum({
      roomId: onStatusChangeType.roomId,
      onlineNum: onStatusChangeType.onlineNum,
      isAdd: true
    })
    groupStore.updateUserItem(
      onStatusChangeType.uid,
      {
        activeStatus: OnlineEnum.ONLINE,
        lastOptTime: onStatusChangeType.lastOptTime
      },
      onStatusChangeType.roomId
    )
  }
})

useMitt.on(WsResponseMessageType.ROOM_DISSOLUTION, async (roomId: string) => {
  console.log('그룹 해산 알림 수신', roomId)
  // 그룹 채팅 세션 삭제
  chatStore.removeSession(roomId)
  // 그룹 채팅 상세 정보 삭제
  groupStore.removeGroupDetail(roomId)
  // 현재 세션이 해산된 그룹 채팅인 경우 첫 번째 세션으로 전환
  if (globalStore.currentSessionRoomId === roomId) {
    globalStore.currentSessionRoomId = chatStore.sessionList[0].roomId
  }
})

useMitt.on(WsResponseMessageType.USER_STATE_CHANGE, async (data: { uid: string; userStateId: string }) => {
  console.log('사용자 상태 변경 수신', data)
  groupStore.updateUserItem(data.uid, {
    userStateId: data.userStateId
  })
})

useMitt.on(WsResponseMessageType.FEED_SEND_MSG, (data: { uid: string }) => {
  if (data.uid !== userStore.userInfo!.uid) {
    feedStore.increaseUnreadCount()
    // 同步更新角标（包含朋友圈未读数）
    unreadCountManager.refreshBadge(globalStore.unReadMark, feedStore.unreadCount)
  } else {
    console.log('[App.vue] 자신이 게시한 것이므로 읽지 않은 수를 늘리지 않음')
  }
})

// 모멘트 알림 리스너 (전역) - 좋아요 및 댓글 알림 처리
useMitt.on(WsResponseMessageType.FEED_NOTIFY, async (data: any) => {
  try {
    console.log('모멘트 알림 수신:', JSON.stringify(data, null, 2))
    console.log('알림 유형 판단 - isUnlike:', data.isUnlike, 'hasComment:', !!data.comment)

    // 알림 표시를 위한 모멘트 내용 가져오기
    const feed = feedStore.feedList.find((f) => f.id === data.feedId)
    const feedContent = feed?.content || data.feedContent || '모멘트'

    if (data.isUnlike) {
      // 좋아요 취소 시 읽지 않은 수 감소
      feedStore.decreaseUnreadCount(1)
      const likeListResult = await feedStore.getLikeList(data.feedId)
      if (likeListResult) {
        const feed = feedStore.feedList.find((f) => f.id === data.feedId)
        if (feed) {
          feed.likeList = likeListResult
          feed.likeCount = likeListResult.length
        }
      }
    }
    // 좋아요 알림인 경우
    else if (!data.comment) {
      console.log('좋아요 알림 처리')
      feedStore.increaseUnreadCount(1)
      const likeListResult = await feedStore.getLikeList(data.feedId)
      if (likeListResult) {
        const feed = feedStore.feedList.find((f) => f.id === data.feedId)
        if (feed) {
          feed.likeList = likeListResult
          feed.likeCount = likeListResult.length
        }
      }
      // 로컬 저장소에 좋아요 알림 추가
      const likeNotification = {
        id: `${data.feedId}_${data.operatorUid}_like_${Date.now()}`,
        type: 'like' as const,
        feedId: String(data.feedId),
        feedContent: feedContent,
        operatorUid: String(data.operatorUid),
        operatorName: data.operatorName || '알 수 없는 사용자',
        operatorAvatar: data.operatorAvatar || '',
        createTime: Date.now(),
        isRead: false
      }
      feedNotificationStore.addNotification(likeNotification)
    } else {
      feedStore.increaseUnreadCount(1)
      try {
        const commentListResult = await feedStore.getCommentList(data.feedId)
        if (Array.isArray(commentListResult)) {
          const feed = feedStore.feedList.find((f) => f.id === data.feedId)
          if (feed) {
            feed.commentList = commentListResult
            feed.commentCount = commentListResult.length
          }
        }
      } catch (error) {
        console.error('댓글 목록 가져오기 실패:', error)
      }
      // 로컬 저장소에 댓글 알림 추가
      const commentNotification = {
        id: `${data.feedId}_${data.operatorUid}_comment_${Date.now()}`,
        type: 'comment' as const,
        feedId: String(data.feedId),
        feedContent: feedContent,
        operatorUid: String(data.operatorUid),
        operatorName: data.operatorName || '알 수 없는 사용자',
        operatorAvatar: data.operatorAvatar || '',
        commentContent: data.comment?.content || '',
        createTime: Date.now(),
        isRead: false
      }
      feedNotificationStore.addNotification(commentNotification)
    }
    // 모멘트 읽지 않은 수 변경 후, 독 아이콘 동기화 업데이트 (모멘트 읽지 않은 수 포함)
    unreadCountManager.refreshBadge(globalStore.unReadMark, feedStore.unreadCount)
  } catch (error) {
    console.error('모멘트 알림 처리 실패:', error)
  }
})

useMitt.on(WsResponseMessageType.GROUP_SET_ADMIN_SUCCESS, (event) => {
  console.log('그룹 관리자 설정---> ', event)
  groupStore.updateAdminStatus(event.roomId, event.uids, event.status)
})

useMitt.on(WsResponseMessageType.OFFLINE, async (onStatusChangeType: OnStatusChangeType) => {
  console.log('사용자 오프라인 알림 수신', onStatusChangeType)
  // 그룹 채팅
  if (onStatusChangeType.type === 1) {
    groupStore.updateOnlineNum({
      roomId: onStatusChangeType.roomId,
      onlineNum: onStatusChangeType.onlineNum,
      isAdd: false
    })
    groupStore.updateUserItem(
      onStatusChangeType.uid,
      {
        activeStatus: OnlineEnum.OFFLINE,
        lastOptTime: onStatusChangeType.lastOptTime
      },
      onStatusChangeType.roomId
    )
  }
})

const handleVideoCall = async (remotedUid: string, callType: CallTypeEnum) => {
  info(`비디오 통화 호출 감지, remotedUid: ${remotedUid}, callType: ${callType}`)
  const currentSession = globalStore.currentSession
  const targetUid = remotedUid || currentSession?.detailId
  if (!targetUid) {
    console.warn('[App] 현재 세션이 준비되지 않았거나 상대 사용자를 확인할 수 없어 통화 이벤트를 무시합니다.')
    return
  }
  if (isMobile()) {
    router.push({
      path: '/mobile/rtcCall',
      query: {
        remoteUserId: targetUid,
        roomId: globalStore.currentSessionRoomId,
        callType: callType,
        // 수신자
        isIncoming: 'true'
      }
    })
  } else {
    await createRtcCallWindow(true, targetUid, globalStore.currentSessionRoomId, callType)
  }
}

const listenMobileReLogin = async () => {
  if (isMobile()) {
    const { useLogin } = await import('@/hooks/useLogin')

    const { resetLoginState, logout } = useLogin()
    addListener(
      listen('relogin', async () => {
        info('재로그인 이벤트 수신')
        await resetLoginState()
        await logout()
      }),
      'mobile-relogin'
    )
  }
}

// 로그인/재연결 후 리프레시: 현재 (또는 첫 번째) 그룹 채팅 멤버만 새로고침하여 메시지가 "알 수 없는 사용자"로 렌더링되지 않도록 함
const refreshActiveGroupMembers = async () => {
  const tasks: Promise<unknown>[] = []
  try {
    const isCurrentGroup = globalStore.currentSession?.type === RoomTypeEnum.GROUP
    const activeRoomId =
      (isCurrentGroup && globalStore.currentSessionRoomId) ||
      chatStore.sessionList.find((item) => item.type === RoomTypeEnum.GROUP)?.roomId

    if (activeRoomId) {
      tasks.push(groupStore.getGroupUserList(activeRoomId, true))
    }
    await Promise.allSettled(tasks)
  } catch (error) {
    console.error('[Network] 그룹 멤버 새로고침 실패:', error)
  }
}

let lastWsConnectionState: string | null = null
let isReconnectInFlight = false

const handleWebsocketEvent = async (event: any) => {
  const payload: any = event.payload
  if (!payload || payload.type !== 'connectionStateChanged') return

  const previousState = (lastWsConnectionState || '').toUpperCase() || null
  const nextStateRaw = payload.state
  const nextState = typeof nextStateRaw === 'string' ? nextStateRaw.toUpperCase() : ''
  const isReconnectionFlag = payload.isReconnection ?? payload.is_reconnection
  const hasRecoveredFromDrop = Boolean(previousState && previousState !== 'CONNECTED' && nextState === 'CONNECTED')
  const shouldHandleReconnect = nextState === 'CONNECTED' && (isReconnectionFlag || hasRecoveredFromDrop)

  console.log('[WS] state change', {
    prev: previousState,
    next: nextState,
    isReconnectionFlag,
    hasRecoveredFromDrop,
    shouldHandleReconnect,
    raw: payload
  })

  lastWsConnectionState = nextState || previousState

  if (!shouldHandleReconnect) return
  // 병렬 재연결/동기화로 인해 syncLoading이 멈추는 것을 방지
  if (isReconnectInFlight || chatStore.syncLoading) return
  isReconnectInFlight = true

  // 동기화 시작, 로딩 상태 표시
  chatStore.syncLoading = true
  try {
    if (userStore.userInfo?.uid) {
      await invoke('sync_messages', { param: { asyncData: true, uid: userStore.userInfo.uid } })
    }
    await chatStore.getSessionList(true)
    await chatStore.setAllSessionMsgList(20)
    // 재연결 후 채널 및 현재/첫 번째 그룹 채팅 멤버 정보를 동기화하여 연결 끊기 전의 이전 데이터가 표시되지 않도록 함
    await refreshActiveGroupMembers()
    if (globalStore.currentSessionRoomId) {
      await chatStore.resetAndRefreshCurrentRoomMessages()
      await chatStore.fetchCurrentRoomRemoteOnce(20)
      const currentRoomId = globalStore.currentSessionRoomId
      const currentSession = chatStore.getSession(currentRoomId)
      // 재연결 후 현재 세션에 여전히 읽지 않은 메시지가 있는 경우, 읽음 보고 및 로컬 초기화를 수행하여 말풍선이 멈추지 않도록 함
      if (currentSession?.unreadCount) {
        try {
          await ImRequestUtils.markMsgRead(currentRoomId)
        } catch (error) {
          console.error('[Network] 재연결 후 읽음 보고 실패:', error)
        }
        chatStore.markSessionRead(currentRoomId)
      }
    }
    unreadCountManager.refreshBadge(globalStore.unReadMark, feedStore.unreadCount)
  } finally {
    // 동기화 완료, 로딩 상태 숨김
    chatStore.syncLoading = false
    isReconnectInFlight = false
  }
}

/**
 * iOS 네트워크 권한 사전 요청
 * 앱 시작 시 가벼운 네트워크 요청을 실행하여 iOS 네트워크 권한 팝업 호출
 */
const requestNetworkPermissionForIOS = async () => {
  await fetch('https://www.apple.com/favicon.ico', {
    method: 'HEAD',
    cache: 'no-cache'
  })
}

onMounted(() => {
  // iOS 앱 시작 시 네트워크 권한 사전 요청 (반드시 처음에 실행)
  if (isIOS()) {
    requestNetworkPermissionForIOS()
  }

  if (isWindows10()) {
    void appWindow.setShadow(false).catch((error) => {
      console.warn('창 그림자 비활성화 실패:', error)
    })
  }
  // 데스크톱 여부 판단, 데스크톱은 스타일 조정 필요
  isDesktop() && import('@/styles/scss/global/desktop.scss')
  // 모바일 여부 판단, 모바일은 안전 영역 적응 스타일 로드 필요
  isMobile() && import('@/styles/scss/global/mobile.scss')
  import(`@/styles/scss/theme/${themes.value.versatile}.scss`)
  // localStorage에 테마 설정이 있는지 확인
  if (!localStorage.getItem(StoresEnum.SETTING)) {
    settingStore.initTheme(ThemeEnum.OS)
  }
  document.documentElement.dataset.theme = themes.value.content
  window.addEventListener('dragstart', preventDrag)

  addListener(listen('websocket-event', handleWebsocketEvent), 'websocket-event')

  // 데스크톱 메인 창에서만 전역 단축키 초기화
  if (isDesktop() && appWindow.label === 'home') {
    initializeGlobalShortcut()
  }
  /** 개발 환경에서는 금지하지 않음 */
  if (process.env.NODE_ENV !== 'development') {
    /** 브라우저 기본 단축키 비활성화 */
    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey && (e.key === 'f' || e.key === 'r' || e.key === 'g' || e.key === 'j')) {
        e.preventDefault()
      }
    })
    /** 우클릭 메뉴 금지 */
    window.addEventListener('contextmenu', preventGlobalContextMenu, false)
  }
  // 데스크톱에서만 창 관련 이벤트 처리
  if (isDesktop()) {
    useMitt.on(MittEnum.CHECK_UPDATE, async () => {
      const checkUpdateWindow = await WebviewWindow.getByLabel('checkupdate')
      await checkUpdateWindow?.show()
    })
    useMitt.on(MittEnum.DO_UPDATE, async (event) => {
      await createWebviewWindow('업데이트', 'update', 490, 335, '', false, 490, 335, false, true)
      const closeWindow = await WebviewWindow.getByLabel(event.close)
      closeWindow?.close()
    })
    addListener(
      appWindow.listen(EventEnum.EXIT, async () => {
        await exit(0)
      }),
      'app-exit'
    )
  }
  listenMobileReLogin()
})

onUnmounted(async () => {
  window.removeEventListener('contextmenu', preventGlobalContextMenu, false)
  window.removeEventListener('dragstart', preventDrag)

  // 데스크톱 메인 창에서만 전역 단축키 정리
  if (isDesktop() && appWindow.label === 'home') {
    await cleanupGlobalShortcut()
  }
})

/** 그림자 제어 */
watch(
  () => page.value.shadow,
  (val) => {
    // 모바일은 항상 그림자 비활성화
    if (isMobile()) {
      document.documentElement.style.setProperty('--shadow-enabled', '1')
    } else {
      document.documentElement.style.setProperty('--shadow-enabled', val ? '0' : '1')
    }
  },
  { immediate: true }
)

/** 가우시안 블러 제어 */
watch(
  () => page.value.blur,
  (val) => {
    document.documentElement.setAttribute('data-blur', val ? '1' : '0')
  },
  { immediate: true }
)

/** 폰트 스타일 제어 */
watch(
  () => page.value.fonts,
  (val) => {
    document.documentElement.style.setProperty('--font-family', val)
  },
  { immediate: true }
)

/**
 * 언어 변경
 */
watch(
  () => page.value.lang,
  (lang) => {
    lang = lang === 'AUTO' ? navigator.language : lang
    loadLanguage(lang)
  }
)

/** 테마 변경 제어 */
watch(
  () => themes.value.versatile,
  async (val, oldVal) => {
    await import(`@/styles/scss/theme/${val}.scss`)
    // 그리고 최상위 div에 val 클래스 스타일 설정
    const app = document.querySelector('#app')?.classList as DOMTokenList
    app.remove(oldVal as string)
    await nextTick(() => {
      app.add(val)
    })
  },
  { immediate: true }
)

/** 세션 변경 감지 */
useMitt.on(MittEnum.MSG_INIT, async () => {
  watchEffect(async () => {
    // 동기화 단계에서 모니터링이 필요한 속성을 명시적으로 추출
    const sessionRoomId = globalStore.currentSessionRoomId
    const sessionType = globalStore.currentSession?.type
    const currentSession = globalStore.currentSession

    if (!sessionRoomId || sessionType !== RoomTypeEnum.GROUP) {
      return
    }

    try {
      const result = await groupStore.switchSession(currentSession)
      if (result?.success) {
        await announcementStore.loadGroupAnnouncements()
      }
    } catch (error) {
      console.error('세션 전환 처리 실패:', error)
    }
  })
})
</script>
<style lang="scss">
/* naive-ui select 컴포넌트 스타일 수정 */
.n-base-selection,
.n-base-select-menu,
.n-base-select-menu .n-base-select-option .n-base-select-option__content,
.n-base-select-menu .n-base-select-option::before {
  border-radius: 8px;
  font-size: 12px;
}

img {
  user-select: none;
  -webkit-user-select: none;
}

input,
button,
a {
  user-select: auto;
  cursor: auto;
}
</style>
