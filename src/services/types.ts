/**
 * 타입 정의 파일
 * 참고: 사용 시 좋은 힌트를 얻을 수 있도록 TSDoc 표준에 따라 주석을 작성하십시오.
 * @see TSDoc 표준 https://tsdoc.org/
 **/
import type {
  ActEnum,
  IsYesEnum,
  MarkEnum,
  MessageStatusEnum,
  MsgEnum,
  NotificationTypeEnum,
  OnlineEnum,
  RoomTypeEnum,
  SessionOperateEnum,
  SexEnum
} from '@/enums'

/** 응답 요청 본문 */
export type ServiceResponse = {
  /** 성공 여부 true or false */
  success: boolean
  /** 상태 코드 */
  code: number
  /** 오류 메시지 */
  msg: string
  /** 데이터 */
  data: any
  /** 버전 번호 */
  version: string
}

export type PageInfo<T> = {
  total: number
  size: number
  current: number
  records: T[]
}

/* ======================================================== */

export type LoginUserReq = {
  /** 계정 */
  account: string
  /** 비밀번호 */
  password: string
  /** 로그인 방식 PC/MOBILE */
  deviceType: 'PC' | 'MOBILE'
  systemType: number
  grantType: 'CAPTCHA' | 'REFRESH_TOKEN' | 'PASSWORD' | 'MOBILE'
  key?: string
  code?: string
}

export type RegisterUserReq = {
  /** 기본 랜덤 아바타 */
  avatar: string
  /** 닉네임 */
  nickName: string
  /** 이메일 */
  email: string
  /** 비밀번호 */
  password: string
  /** 이메일 인증 코드 */
  code: string
  /** 식별 코드 */
  uuid: string
  key?: string
  confirmPassword: string
  systemType: number
}

/** 페이지 매김 */
export type PageResponse<T> = {
  /** 총계 */
  total: string
  /** 총 페이지 수 */
  pages: string
  /** 현재 페이지 */
  current: string
  /** 페이지 크기 */
  size: string
  /** 데이터 */
  records: T[]
}

/** 커서 페이지 매김 */
export type ListResponse<T> = {
  /** 커서 (다음 페이지 요청 시 이 매개변수 포함) */
  cursor: string
  /** 현재 페이지 번호 */
  pageNo?: number
  /** 마지막 페이지 여부 */
  isLast: boolean
  list: T[]
}

export type CacheBadgeReq = {
  /** 마지막 업데이트 시간, 10분 이상 경과 시 비동기 업데이트. */
  lastModifyTime?: number
  /** 배지 ID */
  itemId: string
}

export type GroupDetailReq = {
  /** 그룹 아바타 */
  avatar: string
  /** 그룹 이름 */
  groupName: string
  /** 온라인 인원 수 */
  onlineNum: number
  /** 멤버 역할 1그룹 소유자 2관리자 3일반 멤버 4추방됨 */
  roleId: number
  /** 방 id */
  roomId: string
  /** 그룹 번호 */
  account: string
  /** 그룹 멤버 수 */
  memberNum: number
  /** 그룹 비고 */
  remark: string
  /** 내 그룹 닉네임 */
  myName: string
  allowScanEnter: boolean
}

export type GroupListReq = {
  /** 그룹 채팅 id */
  groupId: string
  /** 방 id */
  roomId: string
  /** 그룹 이름 */
  roomName: string
  /** 그룹 아바타 */
  avatar: string
  /** 그룹 비고 */
  remark?: string
}

export type CacheBadgeItem = {
  /** 데이터 소스 업데이트 필요 여부. */
  needRefresh?: boolean
  /** 마지막 업데이트 시간, 10분 이상 경과 시 비동기 업데이트. */
  lastModifyTime: number
  /** 배지 설명 */
  describe: string
  /** 배지 아이콘 */
  img: string
  /** 배지 ID */
  itemId: string
}

export type CacheUserReq = {
  /** 마지막 업데이트 시간, 10분 이상 경과 시 비동기 업데이트. */
  lastModifyTime?: number
  /** uid */
  uid: string
}

export type CacheUserItem = {
  /** 데이터 소스 업데이트 필요 여부. */
  needRefresh?: boolean
  /** 마지막 업데이트 시간, 10분 이상 경과 시 비동기 업데이트. */
  lastModifyTime: number
  /** 획득한 배지 */
  itemIds: string[]
  /** 착용 중인 배지 */
  wearingItemId: string
  /** 지역 */
  locPlace: string
  /** 아바타 */
  avatar: string
  /** 마지막 로그인/로그아웃 시간 */
  lastOptTime: number
  /** 사용자 이름 */
  name: string
  /** uid */
  uid: string
  /** 사용자 상태 */
  userStateId: string
  /** 계정 */
  account: string
}

export type UserItem = {
  /** 온라인 상태 */
  activeStatus: OnlineEnum
  /** 아바타 */
  avatar: string
  /** 마지막 로그인/로그아웃 시간 */
  lastOptTime: number
  /** 사용자 이름 */
  name: string
  /** uid */
  uid: string
  /** 지역 */
  locPlace?: string
  /** 역할 ID */
  roleId?: number
  /** 계정 */
  account: string
  /** 내 그룹 닉네임 */
  myName?: string
  /** 현재 착용 중인 배지 */
  wearingItemId?: string
  /** 배지 집합 */
  itemIds?: string[]
  /** 사용자 상태 */
  userStateId?: string
}

export type GroupStatisticType = {
  /** 온라인 인원 수 */
  onlineNum: number
  /** 총 인원 수 */
  totalNum: number
}

export type MessageReplyType = {
  /** 메시지 점프 가능 여부 0아니오 1예 */
  canCallback: number
  /** 메시지 점프 가능 여부 0아니오 1예 */
  content: string
  /** 점프 간격 메시지 수 */
  gapCount: number
  /** 메시지 id */
  id: string
  /** 사용자 이름 */
  username: string
}

export type MarkMsgReq = {
  // actType	동작 유형 1확인 2취소
  actType: ActEnum
  // 표시 유형 1좋아요 2신고
  markType: MarkEnum
  // 메시지 ID
  msgId: string
}

export type UserInfoType = {
  /** 사용자 고유 식별자 */
  uid: string
  /** 사용자 계정 */
  account: string
  /** 이메일 */
  email: string
  /** 비밀번호 */
  password?: string
  /** 사용자 아바타 */
  avatar: string
  /** 사용자 이름 */
  name: string
  /** 남은 이름 변경 횟수 */
  modifyNameChance: number
  /** 성별 1은 남성, 2는 여성 */
  sex: SexEnum
  /** 권한 */
  power?: number
  /** 휴대폰 번호 */
  phone?: string
  /** 착용 중인 배지 */
  wearingItemId?: string
  /** 배지 집합 */
  itemIds?: string[]
  /** 사용자 상태 id */
  userStateId: string
  /** 아바타 업데이트 시간 */
  avatarUpdateTime: number
  /** 클라이언트 */
  client: string
  /** 자기 소개 */
  resume: string
}

export type BadgeType = {
  // 배지 설명
  describe: string
  // 배지 id
  id: string
  // 배지 아이콘
  img: string
  // 보유 여부 0아니오 1예
  obtain: IsYesEnum
  // 착용 여부 0아니오 1예
  wearing: IsYesEnum
}

export type MarkItemType = {
  /** 작업 사용자 */
  uid: string
  /** 메시지 id */
  msgId: string
  /** 작업 유형 */
  markType: MarkEnum
  /** 수량 */
  markCount: number
  /** 동작 유형 1확인 2취소 */
  actType: ActEnum
}

export type RevokedMsgType = {
  /** 메시지 ID */
  msgId: string
  /** 세션 ID */
  roomId?: string
  /** 회수한 사람 ID */
  recallUid?: string
}

export type EmojiItem = {
  expressionUrl: string
  id: string
  /** 로컬 캐시 경로, 존재 시 렌더링 표시에 사용 */
  localUrl?: string
}

// -------------------- ⬇메시지 본문 유형 정의⬇ ----------------

/**
 * 메시지 반환 본문
 */
export type MessageType = {
  /** 발신자 정보 */
  fromUser: MsgUserType
  /** 메시지 본체 */
  message: MsgType
  /** 전송 시간 */
  sendTime: number
  /** 시간 블록 (선택 사항) */
  timeBlock?: number
  /** 로딩 중 여부 */
  loading?: boolean
  uploadProgress?: number
  isCheck?: boolean
}

/**
 * 메시지 내 사용자 정보
 */
export type MsgUserType = {
  /** 사용자 ID */
  uid: string
  /** 사용자 이름 */
  username: string
  /** 아바타 */
  avatar: string
  /** 지역 */
  locPlace: string
  /** 배지 */
  badge?: {
    /** 배지 주소 */
    img: string
    /** 설명 */
    describe: string // 설명
  }
}

/**
 * 메시지 상호작용 정보
 */
export type MessageMarkType = Record<
  string,
  {
    /** 해당 이모티콘 카운트 */
    count: number
    /** 현재 사용자가 해당 이모티콘을 표시했는지 여부 */
    userMarked: boolean
  }
>

/** 이미지 메시지 본문 */
export type ImageBody = {
  size: number
  url: string
  width: number
  height: number
  thumbnailPath?: string
}
/** 음성 메시지 본문 */
export type VoiceBody = {
  size: number
  second: number
  url: string
}

export type MergeBodyBody = {
  messageId: string
  uid: string
}

export type MergeBody = {
  body: MergeBodyBody[]
  content: string[]
}
/** 비디오 */
export type VideoBody = {
  size: number
  url: string
  filename: string
  thumbSize?: number
  thumbWidth?: number
  thumbHeight?: number
  thumbUrl?: string
  thumbnailPath?: string
  localPath?: string
}
/** 파일 메시지 본문 */
export type FileBody = {
  size: number
  fileName: string
  url: string
  localPath?: string
}
/** 텍스트 메시지 본문 */
export type TextBody = {
  /** 메시지 내용 */
  content: string
  /** 답장 */
  reply: ReplyType
  /** @사용자 uid 목록, 정밀 렌더링 하이라이트에 사용 */
  atUidList?: string[] | null
  /**
   * 메시지 링크 매핑
   */
  urlContentMap: Record<
    string,
    {
      title: string
      description: string
      image: string
    }
  >
}
/** 공지 메시지 본문 */
export type AnnouncementBody = TextBody & {
  /** 공지 ID */
  id: string
  /** 생성 시간 */
  createTime: number
  /** 업데이트 시간 */
  updateTime: number
}
/** 이모티콘 메시지 */
export type EmojiBody = {
  url: string
  localPath?: string
}

/** 위치 메시지 본문 */
export type LocationBody = {
  /** 위도 */
  latitude: string
  /** 경도 */
  longitude: string
  /** 주소 설명 */
  address: string
  /** 정밀도 설명 */
  precision: string
  /** 타임스탬프 */
  timestamp: string
}

/**
 * 메시지 내용
 */
export type MessageBody = TextBody | ImageBody | VoiceBody | VideoBody | FileBody | EmojiBody | LocationBody | any
export type MsgType = {
  /** 메시지 ID */
  id: string
  /**  방 ID */
  roomId: string
  /** 메시지 유형 */
  type: MsgEnum
  /** 동적 메시지 본문 - `메시지 유형에 따라 변경됨` */
  body: MessageBody
  /** 전송 타임스탬프 */
  sendTime: number
  /** 메시지 상호작용 정보 */
  messageMarks: MessageMarkType
  /** 메시지 전송 상태 */
  status: MessageStatusEnum
}

export type ReplyType = {
  id: string
  username: string
  type: MsgEnum
  /** 유형에 따라 답장 메시지 표시가 다름 - `과도기 버전` */
  body: any
  /**
   * 메시지 점프 가능 여부
   * @enum {number}  `0`아니오 `1`예
   */
  canCallback: number
  /** 점프 간격 메시지 수  */
  gapCount: number
}

/**
 * 메시지 전송 캐리어
 */
export type MessageReq = {
  /** 세션 id */
  roomId: string
  /** 메시지 유형 */
  msgType: MsgEnum
  /** 메시지 본문 */
  body: {
    /** 텍스트 메시지 내용 */
    content?: string
    /** 답장할 메시지 id */
    replyMsgId?: number
    /** 임의 */
    [key: string]: any
  }
}

/** 알림 상태 */
export enum RequestNoticeAgreeStatus {
  /** 승인 대기 */
  UNTREATED = 0,
  /** 동의 */
  ACCEPTED,
  /** 거절 */
  REJECTED,
  /** 무시 */
  IGNORE
}

/** 알림 이벤트 */
export enum NoticeType {
  /** 친구 신청 */
  FRIEND_APPLY = 1,
  /** 친구 신청 받음 */
  ADD_ME = 6,
  /** 그룹 가입 신청 */
  GROUP_APPLY = 2,
  /** 그룹 초대 */
  GROUP_INVITE = 3,
  /** 그룹 초대 받음 */
  GROUP_INVITE_ME = 7,
  /** 그룹 멤버 제거 */
  GROUP_MEMBER_DELETE = 5,
  /** 그룹 관리자 설정 */
  GROUP_SET_ADMIN = 8,
  /** 그룹 관리자 취소 */
  GROUP_RECALL_ADMIN = 9
}

/** 친구 추가 요청 목록 항목 */
export type RequestFriendItem = {
  /** 신청 id */
  applyId: string
  /** 신청 정보 */
  msg: string
  /** 신청 상태 1승인 대기 2동의 3거절 4무시 */
  status: RequestNoticeAgreeStatus
  /** 신청 유형 1친구 추가 */
  type: number
  /** 신청자 uid */
  uid: string
  /** 피신청자 id */
  targetId: string
  /** 신청 시간 */
  createTime: number
  /** 세션 ID */
  roomId: string
}

export interface NoticeItem {
  /** 엔티티 ID */
  id?: string
  /** 알림 유형: 1-친구 신청; 2-그룹 신청; 3-그룹 초대; 5-그룹 멤버 제거; 6-친구 신청 받음; 7-그룹 초대 받음 */
  eventType: number
  /** 알림 유형 1그룹 채팅 2친구 추가 */
  type: number
  /** 발신자 UID */
  senderId: string
  /** 수신자 UID */
  receiverId: string
  /** 신청 ID */
  applyId: string
  /** 방 ID */
  roomId: string
  /** 작업 대상 */
  operateId?: string
  /** 알림 내용 (신청 시 작성한 내용) */
  content: string
  /** 처리 상태: 0-미처리; 1-동의함; 2-거절함; 3-무시함 */
  status: number
  /** 읽음 여부 */
  isRead: boolean
  /** 생성 시간 */
  createTime?: number
}

/** 연락처 목록 항목 */
export type FriendItem = {
  /** 친구 id */
  uid: string
  /** 친구 비고 */
  remark: string
  /** 온라인 상태 1온라인 2오프라인 */
  activeStatus: OnlineEnum
  /** 마지막 로그인/로그아웃 시간 */
  lastOptTime: number
  /** 내 게시물 보지 못하게 하기 (0-허용, 1-금지) */
  hideMyPosts: boolean
  /** 그들의 게시물 보지 않기 (0-허용, 1-금지) */
  hideTheirPosts: boolean
}

/** 전체 사용자에게 표시되는 세션 여부 0아니오 1예 */
export enum IsAllUserEnum {
  /** 0아니오 */
  Not,
  /** 1예 */
  Yes
}

/** 세션 목록 항목 */
export type SessionItem = {
  /** hula 번호 */
  account: string
  /** 방 마지막 활성 시간 (정렬용) */
  activeTime: number
  /** 세션 아바타 */
  avatar: string
  /** 세션 id */
  id: string
  /** 1:1 채팅인 경우 상대방 uid, 그룹 채팅인 경우 그룹 id */
  detailId: string
  /** 전체 사용자에게 표시되는 세션 여부 0아니오 1예 */
  hotFlag: IsAllUserEnum
  /** 세션 이름 */
  name: string
  /** 방 id */
  roomId: string
  /** 최신 메시지 */
  text: string
  /** 방 유형 1그룹 채팅 2단일 채팅 */
  type: RoomTypeEnum
  /** 읽지 않음 수 */
  unreadCount: number
  /** 상단 고정 여부 0아니오 1예 */
  top: boolean
  /** 세션 작업 */
  operate: SessionOperateEnum
  /** 온라인 상태 1온라인 2오프라인 */
  activeStatus?: OnlineEnum
  /** 세션 숨기기 */
  hide: boolean
  /** 방해 금지 유형 */
  muteNotification: NotificationTypeEnum
  /** 메시지 차단 */
  shield: boolean
  /** 그룹 멤버 수 */
  memberNum?: number
  /** 그룹 비고 */
  remark?: string
  /** 내 그룹 닉네임 */
  myName?: string
  /** 선택 여부 (백엔드 아님) */
  isCheck?: boolean
  allowScanEnter: boolean
}

/** 메시지 읽음/읽지 않음 수 목록 항목 */
export type MsgReadUnReadCountType = {
  /** 메시지 ID */
  msgId: string
  /** 읽음 수 */
  readCount: number
  /** 읽지 않음 수 */
  unReadCount: number | null
}

/** 지원되는 번역 서비스 제공업체 유형  */
export type TranslateProvider = 'youdao' | 'tencent'

/** AI 모델 */
export type AIModel = {
  uid: string
  type: 'Ollama' | 'OpenAI'
  name: string
  value: string
  avatar: string
}

/** 사용자 기본 정보 수정 유형 */
export type ModifyUserInfoType = {
  name: string
  avatar: string
  sex?: number
  phone?: string
  resume?: string
  /** 닉네임 변경 횟수 */
  modifyNameChance: number
}

/** 로그인 */
export type Login = {
  /** 토큰 */
  token: string
  /** 리프레시 토큰 */
  refreshToken: string
  /** 클라이언트 */
  client: string
}

/** 사용자 상태 */
export type UserState = {
  /** id */
  id: string
  /** 제목 */
  title: string
  /** 링크 */
  url: string
  /** 배경 색상 */
  bgColor?: string
}

/** 친구 검색 */
export type SearchFriend = {
  /** 사용자 ID */
  uid: string
  /** 사용자 이름 */
  name: string
  /** 아바타 */
  avatar: string
  /** 계정 */
  account: string
}

/** 그룹 검색 */
export type SearchGroup = {
  /** 그룹 ID */
  roomId: string
  /** 그룹 이름 */
  name: string
  /** 아바타 */
  avatar: string
  /** 계정 */
  account: string
  /** 추가 정보 */
  extJson: string
  /** 삭제 여부 */
  deleteStatus: IsYesEnum
}

/** 구성 */
export type ConfigType = {
  /** 로고 */
  logo: string
  /** 시스템 이름 */
  name: string
  /** QiNiu */
  qiNiu: {
    /** oss 도메인 */
    ossDomain: string
    /** 조각 크기 */
    fragmentSize: string
    /** 몇 MB 초과 시 조각 업로드 활성화 */
    turnSharSize: string
  }
  /** 대규모 그룹 ID */
  roomGroupId: string
}

/** 그룹 공지 */
export type AnnouncementItem = {
  /** 공지 ID */
  id: string
  /** 방 ID */
  roomId: string
  /** 게시자 ID */
  uid: string
  /** 공지 내용 */
  content: string
  /** 생성 시간 */
  createdTime: number
  /** 상단 고정 여부 */
  top: boolean
}

/* ======================================================== */
/**! 모의 정보 데이터 유형 */
export type MockItem = {
  key: number
  type: RoomTypeEnum
  avatar: string
  accountId: number
  accountName: string
}

export type FilesMeta = {
  name: string
  path: string
  file_type: string
  mime_type: string
  exists: boolean
}[]

export type RightMouseMessageItem = {
  createId: string | null
  updateId: string | null
  fromUser: {
    uid: string
    nickname: string | null
  }
  message: {
    id: string
    roomId: string
    sendTime: number
    type: number
    body: {
      size: string
      url: string
      fileName: string
      replyMsgId: string | null
      atUidList: string[] | null
      reply: any | null // 可进一步细化
    }
    messageMarks: {
      [key: string]: {
        count: number
        userMarked: boolean
      }
    }
  }
  createTime: number | null
  updateTime: number | null
  _index: number
}

export type DetailsContent = {
  type: 'apply'
  applyType: 'friend' | 'group'
}

/**
 * 媒体类型枚举
 */
export enum MediaType {
  TEXT = 0, // 纯文本
  IMAGE = 1, // 图片
  VIDEO = 2 // 视频
}

/**
 * 朋友圈权限枚举
 */
export enum FeedPermission {
  PRIVACY = 'privacy', // 私密
  OPEN = 'open', // 公开
  PART_VISIBLE = 'partVisible', // 部分可见
  NOT_ANYONE = 'notAnyone' // 不给谁看
}
