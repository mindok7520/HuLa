import { ImUrlEnum, TauriCommand, type NotificationTypeEnum } from '@/enums'
import type { CacheBadgeReq, LoginUserReq, ModifyUserInfoType, RegisterUserReq, UserItem } from '@/services/types'
import { ErrorType, invokeSilently, invokeWithErrorHandler } from '@/utils/TauriInvokeHandler'
import { useChatStore } from '../stores/chat'
import { useGroupStore } from '../stores/group'

/**
 * IM 요청 매개변수 인터페이스
 */
interface ImRequestParams {
  /** API URL 열거형 */
  url: ImUrlEnum
  /** 요청 본문 데이터 */
  body?: any
  /** 쿼리 매개변수 */
  params?: Record<string, any>
}

/**
 * IM 요청 옵션 인터페이스
 */
interface ImRequestOptions {
  /** 오류 팁 표시 여부, 기본값 true */
  showError?: boolean
  /** 사용자 정의 오류 메시지 */
  customErrorMessage?: string
  /** 오류 유형, 기본값 Network */
  errorType?: ErrorType
  /** 조용한 호출 여부 (오류 표시 안 함), 기본값 false */
  silent?: boolean
  /** 재시도 옵션 */
  retry?: {
    /** 최대 재시도 횟수, 기본값 3 */
    maxRetries?: number
    /** 재시도 간격 (밀리초), 기본값 1000 */
    retryDelay?: number
  }
}

/**
 * 통합 IM API 요청 도구
 */
export async function imRequest<T = any>(
  requestParams: ImRequestParams,
  options?: Omit<ImRequestOptions, 'silent'>
): Promise<T> {
  const { retry, ...invokeOptions } = options || {}

  // 호출 인수 구성
  const args = {
    url: requestParams.url,
    body: requestParams.body || null,
    params: requestParams.params || null
  }

  // 재시도가 필요한 경우
  if (retry) {
    const { invokeWithRetry } = await import('@/utils/TauriInvokeHandler')
    return await invokeWithRetry<T>('im_request_command', args, {
      ...retry,
      showError: invokeOptions.showError,
      customErrorMessage: invokeOptions.customErrorMessage
    })
  }

  // 일반 호출
  return await invokeWithErrorHandler<T>('im_request_command', args, {
    ...invokeOptions,
    errorType: invokeOptions.errorType || ErrorType.Network
  })
}

/**
 * 조용한 IM 요청 (오류 팁 표시 안 함)
 *
 * @example
 * ```typescript
 * const result = await imRequestSilent({
 *   url: ImUrlEnum.NOTICE_UN_READ_COUNT
 * })
 * ```
 */
export async function imRequestSilent<T = any>(requestParams: ImRequestParams): Promise<T | null> {
  const args = {
    url: requestParams.url,
    body: requestParams.body || null,
    params: requestParams.params || null
  }
  return await invokeSilently<T>('im_request_command', args)
}

/**
 * 재시도 메커니즘이 포함된 IM 요청
 *
 * @example
 * ```typescript
 * const result = await imRequestWithRetry({
 *   url: ImUrlEnum.GET_CONTACT_LIST,
 *   params: { pageSize: 100 }
 * }, {
 *   maxRetries: 5,
 *   retryDelay: 2000
 * })
 * ```
 */
export async function imRequestWithRetry<T = any>(
  requestParams: ImRequestParams,
  retryOptions?: {
    maxRetries?: number
    retryDelay?: number
    showError?: boolean
    customErrorMessage?: string
  }
): Promise<T> {
  return await imRequest<T>(requestParams, {
    retry: retryOptions,
    showError: retryOptions?.showError,
    customErrorMessage: retryOptions?.customErrorMessage
  })
}

/**
 * 바로가기 메서드: 사용자 상세 정보 가져오기
 */
export async function getUserDetail() {
  return await imRequest({
    url: ImUrlEnum.GET_USER_INFO_DETAIL
  })
}

/**
 * 바로가기 메서드: 그룹 상세 정보 가져오기
 */
export async function getGroupDetail(roomId: string) {
  return await imRequest({
    url: ImUrlEnum.GROUP_DETAIL,
    params: { id: roomId }
  })
}

/**
 * 그룹 기본 정보 가져오기 [그룹에 가입하지 않은 사람, 논리적으로 삭제된 그룹도 조회 가능]
 */
export async function getGroupInfo(roomId: string) {
  return await imRequest({
    url: ImUrlEnum.GROUP_INFO,
    params: { id: roomId }
  })
}

/**
 * 바로가기 메서드: 연락처 목록 가져오기
 */
export async function getContactList(options?: { pageSize?: number; cursor?: string }) {
  return await imRequest({
    url: ImUrlEnum.GET_CONTACT_LIST,
    params: {
      pageSize: options?.pageSize || 100,
      cursor: options?.cursor || ''
    }
  })
}

/**
 * 알림 읽지 않은 수 가져오기
 */
export async function getNoticeUnreadCount() {
  return await imRequestSilent({
    url: ImUrlEnum.NOTICE_UN_READ_COUNT
  })
}

/**
 * 바로가기 메서드: 그룹 공지 목록 가져오기
 */
export async function getAnnouncementList(roomId: string, page: number, pageSize: number = 10) {
  return await imRequest({
    url: ImUrlEnum.GET_ANNOUNCEMENT_LIST,
    params: {
      roomId,
      current: page,
      size: pageSize
    }
  })
}

export async function getMsgReadCount(msgIds: number[]) {
  return await imRequest({
    url: ImUrlEnum.GET_MSG_READ_COUNT,
    params: {
      msgIds
    }
  })
}

export async function markMsgRead(roomId: string) {
  return await imRequest({
    url: ImUrlEnum.MARK_MSG_READ,
    body: {
      roomId
    }
  })
}

export async function getFriendPage(options?: { pageSize?: number; cursor?: string }) {
  return await imRequest({
    url: ImUrlEnum.GET_FRIEND_PAGE,
    params: {
      pageSize: options?.pageSize || 100,
      cursor: options?.cursor || ''
    }
  })
}

export async function getBadgeList() {
  return await imRequest({
    url: ImUrlEnum.GET_BADGE_LIST
  })
}

export async function getBadgesBatch(body: CacheBadgeReq[]) {
  return await imRequest({
    url: ImUrlEnum.GET_BADGES_BATCH,
    body: {
      reqList: body
    }
  })
}

export async function groupListMember(roomId: string) {
  const args: Record<string, any> = { roomId, room_id: roomId }
  return await invokeWithErrorHandler(TauriCommand.GET_ROOM_MEMBERS, args, { errorType: ErrorType.Network })
}

export async function getMsgList(body: { msgIds?: string[]; async?: boolean }) {
  return await imRequest({
    url: ImUrlEnum.GET_MSG_LIST,
    body
  })
}

export async function ModifyUserInfo(body: ModifyUserInfoType) {
  return await imRequest({
    url: ImUrlEnum.MODIFY_USER_INFO,
    body
  })
}

export async function setUserBadge(body: { badgeId: string }) {
  return await imRequest({
    url: ImUrlEnum.SET_USER_BADGE,
    body
  })
}

export async function markMsg(body: { msgId: string; markType: number; actType: number }) {
  return await imRequest({
    url: ImUrlEnum.MARK_MSG,
    body
  })
}

export async function blockUser(body: { uid: string; deadline: string }) {
  return await imRequest({
    url: ImUrlEnum.BLOCK_USER,
    body
  })
}

export async function recallMsg(body: { msgId: string; roomId: string }) {
  return await imRequest({
    url: ImUrlEnum.RECALL_MSG,
    body
  })
}

export async function addEmoji(body: { expressionUrl: string }) {
  return await imRequest({
    url: ImUrlEnum.ADD_EMOJI,
    body
  })
}

export async function deleteEmoji(body: { id: string }) {
  return await imRequest({
    url: ImUrlEnum.DELETE_EMOJI,
    body
  })
}

export async function getEmoji() {
  return await imRequest({
    url: ImUrlEnum.GET_EMOJI
  })
}

export async function uploadAvatar(body: { avatar: string }) {
  return await imRequest({
    url: ImUrlEnum.UPLOAD_AVATAR,
    body
  })
}

export async function getAllUserState() {
  return await imRequest({
    url: ImUrlEnum.GET_ALL_USER_STATE
  })
}

export async function changeUserState(params: { id: string }) {
  return await imRequest({
    url: ImUrlEnum.CHANGE_USER_STATE,
    params
  })
}

export async function searchFriend(params: { key: string }) {
  return await imRequest({
    url: ImUrlEnum.SEARCH_FRIEND,
    params
  })
}

export async function sendAddFriendRequest(body: { targetUid: string; msg: string }) {
  return await imRequest({
    url: ImUrlEnum.SEND_ADD_FRIEND_REQUEST,
    body
  })
}

export async function requestNoticePage(params: {
  pageSize: number
  pageNo: number
  cursor: string
  click: boolean
  applyType: string
}) {
  return await imRequest({
    url: ImUrlEnum.REQUEST_NOTICE_PAGE,
    params
  })
}

export async function requestNoticeRead(body: { noticeIdList: string[] }) {
  return await imRequest({
    url: ImUrlEnum.REQUEST_NOTICE_READ,
    body
  })
}

export async function handleInvite(body: { applyId: string; state: number }) {
  return await imRequest({
    url: ImUrlEnum.HANDLE_INVITE,
    body
  })
}

export async function deleteFriend(body: { targetUid: string }) {
  return await imRequest({
    url: ImUrlEnum.DELETE_FRIEND,
    body
  })
}

export async function modifyFriendRemark(body: { targetUid: string; remark: string }) {
  return await imRequest({
    url: ImUrlEnum.MODIFY_FRIEND_REMARK,
    body
  })
}

export async function createGroup(body: { uidList: string[] }) {
  return await imRequest({
    url: ImUrlEnum.CREATE_GROUP,
    body
  })
}

export async function inviteGroupMember(body: { roomId: string; uidList: string[] }) {
  return await imRequest({
    url: ImUrlEnum.INVITE_GROUP_MEMBER,
    body
  })
}

export async function removeGroupMember(body: { roomId: string; uidList: string[] }) {
  return await imRequest({
    url: ImUrlEnum.REMOVE_GROUP_MEMBER,
    body
  })
}

export async function getSessionDetail(params: { id: string }) {
  return await imRequest({
    url: ImUrlEnum.SESSION_DETAIL,
    params
  })
}

export async function getSessionDetailWithFriends(params: { id: string; roomType: number }) {
  return await imRequest({
    url: ImUrlEnum.SESSION_DETAIL_WITH_FRIENDS,
    params
  })
}

export async function setSessionTop(body: { roomId: string; top: boolean }) {
  return await imRequest({
    url: ImUrlEnum.SET_SESSION_TOP,
    body
  })
}

export async function deleteSession(body: { roomId: string }) {
  return await imRequest({
    url: ImUrlEnum.DELETE_SESSION,
    body
  })
}

export async function notification(body: { roomId: string; type: NotificationTypeEnum }) {
  return await imRequest({
    url: ImUrlEnum.NOTIFICATION,
    body
  })
}

export async function shield(body: { roomId: string; state: boolean }) {
  return await imRequest({
    url: ImUrlEnum.SHIELD,
    body
  })
}

export async function exitGroup(body: { roomId: string }) {
  return await imRequest({
    url: ImUrlEnum.EXIT_GROUP,
    body
  })
}

export async function addAdmin(body: { roomId: string; uidList: string[] }) {
  return await imRequest({
    url: ImUrlEnum.ADD_ADMIN,
    body
  })
}

export async function revokeAdmin(body: { roomId: string; uidList: string[] }) {
  return await imRequest({
    url: ImUrlEnum.REVOKE_ADMIN,
    body
  })
}

export async function groupList() {
  return await imRequest({
    url: ImUrlEnum.GROUP_LIST
  })
}

export async function updateRoomInfo(body: { id: string; name?: string; avatar?: string; allowScanEnter?: boolean }) {
  const chatStore = useChatStore()
  const groupStore = useGroupStore()

  body.name = body.name ?? groupStore.countInfo!.groupName
  body.avatar = body.avatar ?? groupStore.countInfo!.avatar
  body.allowScanEnter = body.allowScanEnter ?? groupStore.countInfo!.allowScanEnter

  await imRequest({
    url: ImUrlEnum.UPDATE_ROOM_INFO,
    body
  })

  chatStore.updateSession(body.id, body)
  groupStore.updateGroupDetail(body.id, body)

  window.$message.success('업데이트 성공')
}

export async function updateMyRoomInfo(body: { id: string; myName: string; remark: string }) {
  return await imRequest({
    url: ImUrlEnum.UPDATE_MY_ROOM_INFO,
    body
  })
}

export async function searchGroup(params: { account: string }) {
  return await imRequest({
    url: ImUrlEnum.SEARCH_GROUP,
    params
  })
}

export async function applyGroup(body: { account: string; msg: string; type: number }) {
  return await imRequest({
    url: ImUrlEnum.APPLY_GROUP,
    body
  })
}

export async function pushAnnouncement(body: { roomId: string; content: string; top: boolean }) {
  return await imRequest({
    url: ImUrlEnum.PUSH_ANNOUNCEMENT,
    body
  })
}

export async function deleteAnnouncement(params: { id: string }) {
  return await imRequest({
    url: ImUrlEnum.DELETE_ANNOUNCEMENT,
    params
  })
}

export async function editAnnouncement(body: { id: string; roomId: string; content: string; top: boolean }) {
  return await imRequest({
    url: ImUrlEnum.EDIT_ANNOUNCEMENT,
    body
  })
}

export async function getAnnouncementDetail(params: { roomId: string; announcementId: string }) {
  return await imRequest({
    url: ImUrlEnum.ANNOUNCEMENT,
    params
  })
}

export async function getCaptcha() {
  return await imRequest({
    url: ImUrlEnum.GET_CAPTCHA
  })
}

export async function sendCaptcha(body: {
  email: string
  uuid?: string
  operationType?: 'register' | 'forgot'
  templateCode: 'REGISTER_EMAIL' | 'REGISTER_SMS' | 'MOBILE_LOGIN' | 'MOBILE_EDIT' | 'EMAIL_EDIT' | 'PASSWORD_EDIT'
}) {
  return await imRequest({
    url: ImUrlEnum.SEND_CAPTCHA,
    body
  })
}

export async function initConfig() {
  return await imRequest({
    url: ImUrlEnum.INIT_CONFIG
  })
}

export async function getQiniuToken(params?: { scene?: string; fileName?: string }) {
  return await imRequest({
    url: ImUrlEnum.GET_QINIU_TOKEN,
    params: params || undefined
  })
}

/** 기본 업로드 제공자 가져오기 */
let __uploadProviderCache: { provider: 'qiniu' | 'minio' } | null = null
let __uploadProviderPending: Promise<{ provider: 'qiniu' | 'minio' }> | null = null

export async function getUploadProvider(): Promise<{ provider: 'qiniu' | 'minio' }> {
  if (__uploadProviderCache) return __uploadProviderCache
  if (__uploadProviderPending) return await __uploadProviderPending
  __uploadProviderPending = imRequest<{ provider: 'qiniu' | 'minio' }>({
    url: ImUrlEnum.STORAGE_PROVIDER
  }).then((res) => {
    __uploadProviderCache = res
    __uploadProviderPending = null
    return res
  })
  return await __uploadProviderPending
}

export async function register(body: RegisterUserReq) {
  return await imRequest({
    url: ImUrlEnum.REGISTER,
    body
  })
}

export async function login(body: LoginUserReq) {
  return await imRequest({
    url: ImUrlEnum.LOGIN,
    body
  })
}

export async function logout(body: { autoLogin: boolean }) {
  return await imRequest({
    url: ImUrlEnum.LOGOUT,
    body
  })
}

export async function forgetPassword(body: {
  email: string
  code: string
  uuid: string
  password: string
  confirmPassword: string
  key: string
}) {
  return await imRequest({
    url: ImUrlEnum.FORGET_PASSWORD,
    body
  })
}

export async function mergeMsg(body: { fromRoomId: string; type: number; roomIds: string[]; messageIds: string[] }) {
  return await imRequest({
    url: ImUrlEnum.MERGE_MSG,
    body
  })
}

export async function getUserByIds(uidList: string[]): Promise<UserItem[]> {
  return await imRequest({
    url: ImUrlEnum.GET_USER_BY_IDS,
    body: { uidList }
  })
}

export async function generateQRCode(): Promise<UserItem[]> {
  return await imRequest({
    url: ImUrlEnum.GENERATE_QR_CODE
  })
}

export async function checkQRStatus(params: {
  qrId: string
  clientId: string
  deviceHash: string
  deviceType: string
}): Promise<UserItem[]> {
  return await imRequest(
    {
      url: ImUrlEnum.CHECK_QR_STATUS,
      params
    },
    {
      showError: false
    }
  )
}

// QR 코드 스캔
export async function scanQRCodeAPI(data: { qrId: string }) {
  return await imRequest({
    url: ImUrlEnum.SCAN_QR_CODE,
    body: data
  })
}

// 로그인 확인
export async function confirmQRCodeAPI(data: { qrId: string }) {
  return await imRequest({
    url: ImUrlEnum.CONFIRM_QR_CODE,
    body: data
  })
}

// 단일 모멘트 보기
export async function feedDetail(params: { feedId: string }) {
  return await imRequest({
    url: ImUrlEnum.FEED_DETAIL,
    params
  })
}

export async function feedList(data: { pageSize?: number; cursor?: string }) {
  return await imRequest({
    url: ImUrlEnum.FEED_LIST,
    body: data
  })
}

export async function pushFeed(data: {
  content: string // 모멘트 내용
  mediaType: 0 | 1 | 2 // 미디어 유형, 0-일반 텍스트, 1-이미지+내용, 2-비디오+내용
  urls?: string[] // 이미지 URL 목록
  videoUrl?: string // 비디오 URL
  permission: 'privacy' | 'open' | 'partVisible' | 'notAnyone' // 공개 권한
  uidList?: number[] // 권한 제한 사용자 ID 목록
  targetIds?: number[] // 권한 제한 태그 ID 목록
}) {
  return await imRequest({
    url: ImUrlEnum.PUSH_FEED,
    body: data
  })
}

export async function delFeed(data: { feedId: string }) {
  return await imRequest({
    url: ImUrlEnum.DEL_FEED,
    body: data
  })
}

export async function editFeed(data: {
  id: number // 모멘트 ID
  content: string // 모멘트 내용
  mediaType: 0 | 1 | 2 // 미디어 유형
  urls?: string[] // 이미지 URL 목록
  videoUrl?: string // 비디오 URL
  permission: 'privacy' | 'open' | 'partVisible' | 'notAnyone' // 공개 권한
  uidList?: number[] // 권한 제한 사용자 ID 목록
  targetIds?: number[] // 권한 제한 태그 ID 목록
}) {
  return await imRequest({
    url: ImUrlEnum.EDIT_FEED,
    body: data
  })
}

export async function getFeedPermission(params: { feedId: string }) {
  return await imRequest({
    url: ImUrlEnum.GET_FEED_PERMISSION,
    params
  })
}

// ==================== 모멘트 좋아요 관련 ====================

export async function feedLikeToggle(data: { feedId: string; actType: number }) {
  return await imRequest({
    url: ImUrlEnum.FEED_LIKE_TOGGLE,
    body: data
  })
}

export async function feedLikeList(params: { feedId: string }) {
  return await imRequest({
    url: ImUrlEnum.FEED_LIKE_LIST,
    params
  })
}

export async function feedLikeCount(params: { feedId: string }) {
  return await imRequest({
    url: ImUrlEnum.FEED_LIKE_COUNT,
    params
  })
}

export async function feedLikeHasLiked(params: { feedId: string }) {
  return await imRequest({
    url: ImUrlEnum.FEED_LIKE_HAS_LIKED,
    params
  })
}

// ==================== 모멘트 댓글 관련 ====================

export async function feedCommentAdd(data: {
  feedId: string
  content: string
  replyCommentId?: string
  replyUid?: string
}) {
  return await imRequest({
    url: ImUrlEnum.FEED_COMMENT_ADD,
    body: data
  })
}

export async function feedCommentDelete(data: { commentId: string }) {
  return await imRequest({
    url: ImUrlEnum.FEED_COMMENT_DELETE,
    body: data
  })
}

export async function feedCommentList(data: { feedId: string; pageSize?: number; cursor?: string }) {
  return await imRequest({
    url: ImUrlEnum.FEED_COMMENT_LIST,
    body: data
  })
}

export async function feedCommentCount(params: { feedId: string }) {
  return await imRequest({
    url: ImUrlEnum.FEED_COMMENT_COUNT,
    params
  })
}

export async function feedCommentAll(params: { feedId: string }) {
  return await imRequest({
    url: ImUrlEnum.FEED_COMMENT_ALL,
    params
  })
}

/**
 * SSE 스트림 데이터 이벤트 유형
 */
interface SseStreamEvent {
  eventType: 'chunk' | 'done' | 'error'
  data?: string
  error?: string
  requestId: string
}

/**
 * 스트림 데이터 콜백 함수
 */
export interface StreamCallbacks {
  onChunk?: (chunk: string) => void
  onDone?: (fullContent: string) => void
  onError?: (error: string) => void
}

/**
 * AI 메시지 전송 (스트림)
 * Promise로 SSE 흐름 전체를 래핑, Tauri 이벤트를 수신하여 스트림 데이터 수신
 *
 * @param body 요청 파라미터
 * @param callbacks 스트림 데이터 콜백 함수
 * @returns Promise, 스트림 종료 후 전체 내용을 resolve
 */
export async function messageSendStream(
  body: { conversationId: string; content: string; useContext?: boolean; reasoningEnabled?: boolean },
  callbacks?: StreamCallbacks
): Promise<string> {
  const { invoke, Channel } = await import('@tauri-apps/api/core')
  const { TauriCommand } = await import('@/enums')

  // 고유한 요청 ID 생성
  const requestId = `ai-stream-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

  return new Promise<string>((resolve, reject) => {
    let fullContent = ''
    let isResolved = false

    // 스트림 이벤트를 수신하기 위한 Channel 생성
    const onEvent = new Channel<SseStreamEvent>()
    onEvent.onmessage = (event: SseStreamEvent) => {
      const { eventType, data, error, requestId: eventRequestId } = event

      // 현재 요청의 이벤트만 처리
      if (eventRequestId !== requestId) {
        return
      }

      switch (eventType) {
        case 'chunk':
          if (data) {
            fullContent += data
            callbacks?.onChunk?.(data)
          }
          break

        case 'done':
          if (!isResolved) {
            isResolved = true
            const finalContent = data || fullContent
            callbacks?.onDone?.(finalContent)
            resolve(finalContent)
          }
          break

        case 'error':
          if (!isResolved) {
            isResolved = true
            const errorMsg = error || '알 수 없는 오류'
            callbacks?.onError?.(errorMsg)
            reject(new Error(errorMsg))
          }
          break
      }
    }

    // Rust 백엔드 명령을 호출하여 요청 전송
    invoke(TauriCommand.AI_MESSAGE_SEND_STREAM, {
      body,
      requestId,
      onEvent
    }).catch((error) => {
      if (!isResolved) {
        isResolved = true
        const errorMsg = error instanceof Error ? error.message : String(error)
        callbacks?.onError?.(errorMsg)
        reject(error)
      }
    })
  })
}

// 지정된 대화의 메시지 목록 가져오기
export async function messageListByConversationId(params: {
  conversationId: string
  pageNo?: number
  pageSize?: number
}) {
  return await imRequest({
    url: ImUrlEnum.MESSAGE_LIST_BY_CONVERSATION_ID,
    params
  })
}

// 단일 메시지 삭제
export async function messageDelete(params: { id: string }) {
  return await imRequest({
    url: ImUrlEnum.MESSAGE_DELETE,
    params
  })
}

// 지정된 대화의 메시지 삭제
export async function messageDeleteByConversationId(body: { conversationIdList: string[] }) {
  return await imRequest({
    url: ImUrlEnum.MESSAGE_DELETE_BY_CONVERSATION_ID,
    body
  })
}

// 대화 목록 가져오기 (내 대화)
export async function conversationPage(params?: { pageNo?: number; pageSize?: number }) {
  return await imRequest({
    url: ImUrlEnum.CONVERSATION_PAGE,
    params
  })
}

// [내 대화] 채팅 대화 가져오기
export async function conversationGetMy(params?: { id: string }) {
  return await imRequest({
    url: ImUrlEnum.CONVERSATION_GET_MY,
    params
  })
}

// 대화 생성 (내 대화)
export async function conversationCreateMy(body: {
  roleId?: string
  knowledgeId?: string
  title?: string
  modelId?: string
  systemMessage?: string
  temperature?: number
  maxTokens?: number
  maxContexts?: number
}) {
  return await imRequest({
    url: ImUrlEnum.CONVERSATION_CREATE_MY,
    body
  })
}

// 대화 업데이트 (내 대화)
export async function conversationUpdateMy(body: {
  id: string
  title?: string
  pinned?: boolean
  roleId?: string
  modelId?: string
  knowledgeId?: string
  systemMessage?: string
  temperature?: number
  maxTokens?: number
  maxContexts?: number
}) {
  return await imRequest({
    url: ImUrlEnum.CONVERSATION_UPDATE_MY,
    body
  })
}

// 대화 삭제 (내 대화) - 일괄 삭제 지원
export async function conversationDeleteMy(body: { conversationIdList: string[] }) {
  return await imRequest({
    url: ImUrlEnum.CONVERSATION_DELETE_MY,
    body
  })
}

// 모델 페이지
export async function modelPage(params?: { pageNo?: number; pageSize?: number }) {
  return await imRequest({
    url: ImUrlEnum.MODEL_PAGE,
    params
  })
}

// 모델 업데이트
export async function modelUpdate(body: {
  id?: string
  keyId: string
  name: string
  avatar?: string
  model: string
  platform: string
  type: number
  sort: number
  status: number
  temperature?: number
  maxTokens?: number
  maxContexts?: number
  publicStatus?: number
}) {
  return await imRequest({
    url: body.id ? ImUrlEnum.MODEL_UPDATE : ImUrlEnum.MODEL_CREATE,
    body
  })
}

// 모델 삭제
export async function modelDelete(params: { id: string }) {
  return await imRequest({
    url: ImUrlEnum.MODEL_DELETE,
    params
  })
}

// ==================== AI 이미지 생성 ====================

export async function imageMyPage(params?: { pageNo?: number; pageSize?: number; prompt?: string; status?: number }) {
  return await imRequest({
    url: ImUrlEnum.IMAGE_MY_PAGE,
    params
  })
}

export async function imageGet(params: { id: string }) {
  return await imRequest({
    url: ImUrlEnum.IMAGE_GET,
    params
  })
}

// 이미지 생성
export async function imageDraw(body: {
  modelId: string
  prompt: string
  width?: number
  height?: number
  conversationId?: string
  options?: Record<string, any>
}) {
  return await imRequest({
    url: ImUrlEnum.IMAGE_DRAW,
    body
  })
}

// ID 목록으로 [내] 이미지 기록 가져오기
export async function imageMyListByIds(params: { ids: string }) {
  return await imRequest({
    url: ImUrlEnum.IMAGE_MY_LIST_BY_IDS,
    params
  })
}

// [내] 이미지 기록 삭제
export async function imageDeleteMy(params: { id: string }) {
  return await imRequest({
    url: ImUrlEnum.IMAGE_DELETE_MY,
    params
  })
}

// ==================== AI 비디오 생성 ====================

// [내] 비디오 생성 페이지 가져오기
export async function videoMyPage(params?: { pageNo?: number; pageSize?: number; prompt?: string; status?: number }) {
  return await imRequest({
    url: ImUrlEnum.VIDEO_MY_PAGE,
    params
  })
}

// [내] 비디오 생성 기록 가져오기
export async function videoGet(params: { id: string }) {
  return await imRequest({
    url: ImUrlEnum.VIDEO_GET,
    params
  })
}

// ID 목록으로 [내] 비디오 기록 가져오기
export async function videoMyListByIds(params: { ids: string }) {
  return await imRequest({
    url: ImUrlEnum.VIDEO_MY_LIST_BY_IDS,
    params
  })
}

// 비디오 생성
export async function videoGenerate(body: {
  modelId: string
  prompt: string
  width?: number
  height?: number
  duration?: number
  options?: Record<string, any>
}) {
  return await imRequest({
    url: ImUrlEnum.VIDEO_GENERATE,
    body
  })
}

// [내] 비디오 기록 삭제
export async function videoDeleteMy(params: { id: string }) {
  return await imRequest({
    url: ImUrlEnum.VIDEO_DELETE_MY,
    params
  })
}

// ==================== API 키 관리 ====================

// API 키 페이지 목록
export async function apiKeyPage(params?: { pageNo?: number; pageSize?: number }) {
  return await imRequest({
    url: ImUrlEnum.API_KEY_PAGE,
    params
  })
}

// API 키 간단 목록 (드롭다운 선택용)
export async function apiKeySimpleList() {
  return await imRequest({
    url: ImUrlEnum.API_KEY_SIMPLE_LIST
  })
}

// API 키 생성
export async function apiKeyCreate(body: {
  name: string
  apiKey: string
  platform: string
  url?: string
  status: number
}) {
  return await imRequest({
    url: ImUrlEnum.API_KEY_CREATE,
    body
  })
}

// API 키 업데이트
export async function apiKeyUpdate(body: {
  id: string
  name: string
  apiKey: string
  platform: string
  url?: string
  status: number
}) {
  return await imRequest({
    url: ImUrlEnum.API_KEY_UPDATE,
    body
  })
}

// API 키 삭제
export async function apiKeyDelete(params: { id: string }) {
  return await imRequest({
    url: ImUrlEnum.API_KEY_DELETE,
    params
  })
}

// 플랫폼 목록 가져오기
export async function platformList() {
  return await imRequest({
    url: ImUrlEnum.PLATFORM_LIST
  })
}

// 플랫폼 모델을 예제 목록에 추가
export async function platformAddModel(platform: string, model: string) {
  return await imRequest({
    url: ImUrlEnum.PLATFORM_ADD_MODEL,
    body: { platform, model }
  })
}

// API 키 잔액 조회
export async function apiKeyBalance(params: { id: string }) {
  return await imRequest({
    url: ImUrlEnum.API_KEY_BALANCE,
    params
  })
}

// ==================== 채팅 역할 관리 ====================

// 채팅 역할 페이지 목록
export async function chatRolePage(params?: { pageNo?: number; pageSize?: number }) {
  return await imRequest({
    url: ImUrlEnum.CHAT_ROLE_PAGE,
    params
  })
}

// 채팅 역할 카테고리 목록
export async function chatRoleCategoryList() {
  return await imRequest({
    url: ImUrlEnum.CHAT_ROLE_CATEGORY_LIST
  })
}

// 채팅 역할 생성
export async function chatRoleCreate(body: {
  modelId?: string
  name: string
  avatar: string
  category: string
  sort: number
  description: string
  systemMessage: string
  knowledgeIds?: string[]
  toolIds?: string[]
  publicStatus: boolean
  status: number
}) {
  return await imRequest({
    url: ImUrlEnum.CHAT_ROLE_CREATE,
    body
  })
}

// 채팅 역할 업데이트
export async function chatRoleUpdate(body: {
  id: string
  modelId?: string
  name: string
  avatar: string
  category: string
  sort: number
  description: string
  systemMessage: string
  knowledgeIds?: string[]
  toolIds?: string[]
  publicStatus: boolean
  status: number
}) {
  return await imRequest({
    url: ImUrlEnum.CHAT_ROLE_UPDATE,
    body
  })
}

// 채팅 역할 삭제
export async function chatRoleDelete(params: { id: string }) {
  return await imRequest({
    url: ImUrlEnum.CHAT_ROLE_DELETE,
    params
  })
}

// ==================== AI 오디오 생성 ====================

// 오디오 생성
export async function audioGenerate(body: {
  modelId: number
  prompt: string
  conversationId?: string
  options?: Record<string, string>
}) {
  return await imRequest({
    url: ImUrlEnum.AUDIO_GENERATE,
    body
  })
}

// 내 오디오 목록 가져오기 (ID 목록 기준)
export async function audioMyListByIds(params: { ids: string }) {
  return await imRequest({
    url: ImUrlEnum.AUDIO_MY_LIST_BY_IDS,
    params
  })
}

// 내 오디오 페이지 가져오기
export async function audioMyPage(params?: { pageNo?: number; pageSize?: number }) {
  return await imRequest({
    url: ImUrlEnum.AUDIO_MY_PAGE,
    params
  })
}

// 내 단일 오디오 가져오기
export async function audioGetMy(params: { id: string }) {
  return await imRequest({
    url: ImUrlEnum.AUDIO_GET_MY,
    params
  })
}

// 내 오디오 삭제
export async function audioDeleteMy(params: { id: string }) {
  return await imRequest({
    url: ImUrlEnum.AUDIO_DELETE_MY,
    params
  })
}

// 지정된 모델이 지원하는 음성 목록 가져오기
export async function audioGetVoices(params: { model: string }): Promise<string[]> {
  return await imRequest({
    url: ImUrlEnum.AUDIO_VOICES,
    params
  })
}

// 생성된 콘텐츠 메시지 저장 (오디오, 이미지, 비디오 등 생성 기능용)
export async function messageSaveGeneratedContent(params: {
  conversationId: string
  prompt: string
  generatedContent: string
}) {
  return await imRequest({
    url: ImUrlEnum.MESSAGE_SAVE_GENERATED_CONTENT,
    params
  })
}
