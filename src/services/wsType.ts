import type { UserInfoType } from '@/services/types.ts'

// 1. 로그인 QR 코드 반환 2. 사용자 스캔 성공, 승인 대기 3. 사용자 로그인 성공, 사용자 정보 반환 4. 메시지 수신 5. 접속/접속 종료 푸시 6. 프론트엔드 토큰 만료
export enum WsResponseMessageType {
  /** 인터넷 연결 없음 */
  NO_INTERNET = 'noInternet',
  /** 사용자 로그인 성공, 사용자 정보 반환 */
  LOGIN_SUCCESS = 'loginSuccess',
  /** 메시지 수신 */
  RECEIVE_MESSAGE = 'receiveMessage',
  /** 접속 푸시 */
  ONLINE = 'online',
  /** 프론트엔드 토큰 만료 */
  TOKEN_EXPIRED = 'tokenExpired',
  /** 비활성화된 사용자 */
  INVALID_USER = 'invalidUser',
  /** 좋아요/싫어요 업데이트 알림 */
  MSG_MARK_ITEM = 'msgMarkItem',
  /** 메시지 철회 */
  MSG_RECALL = 'msgRecall',
  /** 새로운 친구 신청 */
  REQUEST_NEW_FRIEND = 'requestNewFriend',
  /** 그룹 멤버 변경 */
  WS_MEMBER_CHANGE = 'ws-member-change',
  /** 그룹 관리자 설정 */
  GROUP_SET_ADMIN_SUCCESS = 'groupSetAdmin',
  /** 접속 종료 알림 */
  OFFLINE = 'offline',
  /** 친구 요청 수락 */
  REQUEST_APPROVAL_FRIEND = 'requestApprovalFriend',
  /** 알림 이벤트 */
  NOTIFY_EVENT = 'notifyEvent',
  /** 사용자 상태 변경 */
  USER_STATE_CHANGE = 'userStateChange',
  /** 방장이 그룹 정보 수정 */
  ROOM_INFO_CHANGE = 'roomInfoChange',
  /** 내가 그룹 내 내 정보 수정 */
  MY_ROOM_INFO_CHANGE = 'myRoomInfoChange',
  /** 그룹 해산 */
  ROOM_DISSOLUTION = 'roomDissolution',
  /** 화상 회의 참여 */
  JoinVideo = 'JoinVideo',
  /** 그룹 공지 메시지 */
  ROOM_GROUP_NOTICE_MSG = 'roomGroupNoticeMsg',
  /** 그룹 공지 편집 */
  ROOM_EDIT_GROUP_NOTICE_MSG = 'roomEditGroupNoticeMsg',
  /** 그룹 공지 읽음 메시지 */
  ROOM_GROUP_NOTICE_READ_MSG = 'roomGroupNoticeReadMsg',
  /** 화상 통화 요청 시작 */
  VideoCallRequest = 'VideoCallRequest',
  /** 통화 연결됨 */
  CallAccepted = 'CallAccepted',
  /** 통화 거절됨 */
  CallRejected = 'CallRejected',
  /** 회의 종료됨 */
  RoomClosed = 'RoomClosed',
  /** 미디어 제어 변경 */
  MediaControl = 'MediaControl',
  /** 통화 시간 초과 */
  TIMEOUT = 'TIMEOUT',
  /** 끊기 */
  DROPPED = 'DROPPED',
  /** 화상 회의 나가기 */
  LeaveVideo = 'LeaveVideo',
  /** 화면 공유 시작 */
  ScreenSharingStarted = 'ScreenSharingStarted',
  /** 화면 공유 중지 */
  ScreenSharingStopped = 'ScreenSharingStopped',
  /** 네트워크 상태 나쁨 */
  NetworkPoor = 'NetworkPoor',
  /** 사용자 강제 퇴장 */
  UserKicked = 'UserKicked',
  /** 시그널링 메시지 */
  WEBRTC_SIGNAL = 'WEBRTC_SIGNAL',
  /** 전체 음소거 */
  AllMuted = 'AllMuted',
  CANCEL = 'CANCEL',
  /** 친구 타임라인 메시지 푸시 */
  FEED_SEND_MSG = 'feedSendMsg',
  /** 친구 타임라인 알림 (좋아요/댓글, comment 필드로 판단) */
  FEED_NOTIFY = 'feedNotify'
}

export enum NoticeTypeEnum {
  /** 그룹 관리자 설정 */
  GROUP_SET_ADMIN = 8,
  /** 그룹 관리자 해제 */
  GROUP_RECALL_ADMIN = 9
}

/**
 * ws 요청 메시지 유형 1. 로그인 QR 코드 요청, 2. 하트비트 감지 3. 사용자 인증
 */
export enum WsRequestMsgType {
  /** 1. 로그인 QR 코드 요청 */
  RequestLoginQrCode = 1,
  /** 2. 메시지 하트비트 감지 */
  HeartBeatDetection,
  /** 3. 사용자 인증 */
  Authorization,
  /** 4. 비디오 하트비트 */
  VIDEO_HEARTBEAT,
  /** 5. 화상 통화 요청 */
  VIDEO_CALL_REQUEST,
  /** 6. 화상 통화 응답 */
  VIDEO_CALL_RESPONSE,
  /** 7. 미디어 오디오 음소거 */
  MEDIA_MUTE_AUDIO,
  /** 8. 비디오 음소거 */
  MEDIA_MUTE_VIDEO,
  /** 9. 모든 사용자 음소거 */
  MEDIA_MUTE_ALL,
  /** 10. 화면 공유 */
  SCREEN_SHARING,
  /** 11. 방 닫기 */
  CLOSE_ROOM,
  /** 12. 사용자 강제 퇴장 */
  KICK_USER,
  /** 13. 통화 품질 모니터링 */
  NETWORK_REPORT,
  /** 14. 시그널링 메시지 */
  WEBRTC_SIGNAL
}

export type WsReqMsgContentType = {
  type: WsRequestMsgType
  data?: Record<string, unknown>
}
export type LoginInitResType = { loginUrl: string }

export type LoginSuccessResType = Pick<UserInfoType, 'avatar' | 'name' | 'uid' | 'account'> & {
  /** 사용자 로그인 자격 증명, 매 요청 시 전달 */
  token: string
}

/** 사용자 온라인 상태 변경 */
export type OnStatusChangeType = {
  uid: string
  type: number
  roomId: string
  onlineNum: number
  lastOptTime: number
}

/** 토큰 만료 */
export type WsTokenExpire = {
  uid: string
  ip: string
  client: string
}

/** 사용자 상태 */
export type UserStateType = {
  id: string
  title: string
  url: string
}

// 통화 요청 데이터 유형
export interface VideoCallRequestData {
  targetUid: string
  roomId: string
  mediaType: 'AudioSignal' | 'VideoSignal' // 통화 유형
}

// 통화 응답 데이터 유형
export interface CallResponseData {
  callerUid: string
  targetUid: string
  roomId: string
  accepted: boolean
}

// 시그널 데이터 유형
export interface SignalData {
  roomId: string
  signal: any // WebRTC 시그널
  mediaType: 'AudioSignal' | 'VideoSignal' // 음성 통화, 화상 통화
}

export interface SignalSdp {
  /** SDP 세션 설명 문자열 */
  sdp: string
  /** SDP 메시지 유형 (예: offer/answer) */
  type: string
}

/** 통화 시그널링 메시지 전체 유형 */
export interface CallSignalMessage {
  /** 발신자 사용자 ID */
  callerUid: string
  /** 방 ID */
  roomId: string
  /** 시그널 내용 (JSON 문자열 형식의 SDP 정보) */
  signal: string
  /** 시그널 유형 (예: offer/answer/candidate 등) */
  signalType: string
  /** 수신자 사용자 ID */
  targetUid: string
  /** 화상 통화 여부 */
  video: boolean
}

// 방 참여/퇴장 데이터 유형
export interface RoomActionData {
  roomId: string
  uid: string
}

export enum CallResponseStatus {
  /** 시간 초과 미응답 */
  TIMEOUT = -1,
  /** 거절됨 */
  REJECTED = 0,
  /** 수락됨 */
  ACCEPTED = 1,
  /** 끊김 */
  DROPPED = 2,
  /** 취소됨 */
  CANCEL = 3
}

/**
 * 통화 상태 설명 매핑
 */
export const CallResponseStatusDesc: Record<CallResponseStatus, string> = {
  [CallResponseStatus.TIMEOUT]: '응답 시간 초과',
  [CallResponseStatus.REJECTED]: '거절됨',
  [CallResponseStatus.ACCEPTED]: '수락됨',
  [CallResponseStatus.DROPPED]: '종료됨',
  [CallResponseStatus.CANCEL]: '취소됨'
}

/**
 * 상태 코드로 통화 상태 가져오기
 * @param code 상태 코드
 * @returns 해당하는 통화 상태
 */
export function getCallResponseStatus(code: number): CallResponseStatus | undefined {
  return Object.values(CallResponseStatus).includes(code) ? (code as CallResponseStatus) : undefined
}

/**
 * 상태 코드로 상태 설명 가져오기
 * @param code 상태 코드
 * @returns 해당하는 상태 설명 텍스트
 */
export function getCallResponseStatusDesc(code: number): string {
  const status = getCallResponseStatus(code)
  return status !== undefined ? CallResponseStatusDesc[status] : '알 수 없는 상태'
}
