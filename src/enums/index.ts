/**
 * 전역 열거형 파일
 * 열거형 값을 전역으로 사용해야 하는 경우 이 파일에 정의하십시오. 다른 열거형 값은 해당 파일에 정의하십시오.
 * 정의 규칙:
 *  열거형 이름: XxxEnum
 *  열거형 값: 모두 대문자, 단어 사이는 밑줄로 구분
 */

/** 요청 응답 코드 유형 */
export enum RCodeEnum {
  /** 요청 성공 */
  OK = '200',
  /** 요청 오류 */
  FAIL = '400',
  /** 서버 문제 발생 */
  SERVE_EXCEPTION = '500',
  /** 비즈니스 로직 문제 발생 */
  BUSINESS_EXCEPTION = '600'
}

/**URL*/
export enum URLEnum {
  /** 사용자 */
  USER = '/im/user',
  /**Token*/
  TOKEN = '/oauth',
  /** 채팅 */
  CHAT = '/im/chat',
  /** 방 */
  ROOM = '/im/room',
  /** 시스템 */
  SYSTEM = '/system',
  /** 인증 코드 */
  CAPTCHA = '/im/captcha',
  /** 메시지 푸시 서비스 접두사 */
  WEBSOCKET = '/ws'
}

/** tauri 네이티브 창 간 통신 시 전송 유형 */
export enum EventEnum {
  /** 창 닫기 */
  WIN_CLOSE = 'winClose',
  /** 창 표시 */
  WIN_SHOW = 'winShow',
  /** 프로그램 종료 */
  EXIT = 'exit',
  /** 로그아웃 */
  LOGOUT = 'logout',
  /** 독립 창 */
  ALONE = 'alone',
  /** 화면 공유 */
  SHARE_SCREEN = 'shareScreen',
  /** 화면 잠금 */
  LOCK_SCREEN = 'lockScreen',
  /** 다중 창 */
  MULTI_MSG = 'multiMsg'
}

/** Mitt 형제 컴포넌트 통신 */
export enum MittEnum {
  /** 메시지 수 업데이트 */
  UPDATE_MSG_TOTAL = 'updateMsgTotal',
  /** 메시지 상자 표시 */
  MSG_BOX_SHOW = 'msgBoxShow',
  /** 메시지 전송으로 이동 */
  TO_SEND_MSG = 'toSendMsg',
  /** 창 축소 */
  SHRINK_WINDOW = 'windowShrink',
  /** 상세 페이지 표시 */
  DETAILS_SHOW = 'detailsShow',
  /** 친구 신청 페이지 표시 */
  APPLY_SHOW = 'applyShow',
  /** 메시지 답장 */
  REPLY_MEG = 'replyMsg',
  /** InfoPopover 수동 트리거 */
  INFO_POPOVER = 'infoPopover',
  /** 개인 정보 편집 창 열기 */
  OPEN_EDIT_INFO = 'openEditInfo',
  /** 개인 정보 팝업 닫기 */
  CLOSE_INFO_SHOW = 'closeInfoShow',
  /** 그룹 닉네임 수정 팝업 열기 */
  OPEN_GROUP_NICKNAME_MODAL = 'openGroupNicknameModal',
  /** 왼쪽 메뉴 팝업 */
  LEFT_MODAL_SHOW = 'leftModalShow',
  /** 로그인 창 타지역 로그인 팝업 */
  LOGIN_REMOTE_MODAL = 'loginRemoteModal',
  /** home 창 이벤트 트리거 */
  HOME_WINDOW_RESIZE = 'homeWindowResize',
  /** @ AT */
  AT = 'at',
  /** 다시 편집 */
  RE_EDIT = 'reEdit',
  /** 세션 삭제 */
  DELETE_SESSION = 'deleteSession',
  /** 세션 숨기기 */
  HIDE_SESSION = 'hideSession',
  /** 세션 위치 찾기 */
  LOCATE_SESSION = 'locateSession',
  /** 채팅창 하단으로 스크롤 */
  CHAT_SCROLL_BOTTOM = 'chatScrollBottom',
  /** 그룹 채팅 생성 */
  CREATE_GROUP = 'createGroup',
  /** 업데이트 알림 */
  CHECK_UPDATE = 'checkUpdate',
  /** 강제 업데이트 */
  DO_UPDATE = 'doUpdate',
  /** 비디오 다운로드 상태 업데이트 */
  VIDEO_DOWNLOAD_STATUS_UPDATED = 'videoDownloadStatusUpdated',
  /** 언어 전환 페이지 */
  VOICE_RECORD_TOGGLE = 'voiceRecordToggle',
  /** 메시지 다중 선택 */
  MSG_MULTI_CHOOSE = 'msgMultiChoose',
  /** QR 스캔 이벤트 */
  QR_SCAN_EVENT = 'qrScanEvent',
  /** 모바일 통화 오버레이 요청 */
  MOBILE_RTC_CALL_REQUEST = 'mobileRtcCallRequest',
  /** 모바일 입력창 패널 닫기 */
  MOBILE_CLOSE_PANEL = 'mobileClosePanel',
  /** 세션 전환 */
  MSG_INIT = 'msg_init',
  /** 세션 전환 완료 */
  SESSION_CHANGED = 'sessionChanged',
  /** 세션 마지막 메시지 업데이트 */
  UPDATE_SESSION_LAST_MSG = 'updateSessionLastMsg'
}

/** 테마 유형 */
export enum ThemeEnum {
  /** 라이트 모드 */
  LIGHT = 'light',
  /** 다크 모드 */
  DARK = 'dark',
  /** 시스템 설정 따름 */
  OS = 'os'
}

/** pinia 저장소 이름 */
export enum StoresEnum {
  /** 상단 고정 */
  ALWAYS_ON_TOP = 'alwaysOnTop',
  /** 설정 */
  SETTING = 'setting',
  /** 기록 내용 */
  HISTORY = 'history',
  /** 채팅 목록 */
  CHAT_LIST = 'chatList',
  /** 플러그인 목록 */
  PLUGINS = 'plugins',
  /** 사이드바 상단 메뉴바 */
  MENUTOP = 'menuTop',
  /** 계정 로그인 기록 목록 */
  LOGIN_HISTORY = 'loginHistory',
  /** 친구 목록 */
  NOTICE = 'notice',
  /** 이미지 뷰어 데이터 */
  IMAGEVIEWER = 'imageViewer',
  /** 사용자 상태 */
  USER_STATE = 'userState',
  /** 사용자 */
  USER = 'user',
  /** 그룹 */
  GROUP = 'group',
  /** 공지사항 */
  ANNOUNCEMENT = 'announcement',
  /** 전역 */
  GLOBAL = 'global',
  /** 이모티콘 */
  EMOJI = 'emoji',
  /** 연락처 */
  CONTACTS = 'contacts',
  /** 채팅 */
  CHAT = 'chat',
  /** 세션 읽지 않음 캐시 */
  SESSION_UNREAD = 'sessionUnread',
  /** 캐시 */
  CACHED = 'cached',
  /** 구성 */
  CONFIG = 'config',
  /** 비디오 뷰어 데이터 */
  VIDEOVIEWER = 'videoViewer',
  /** 파일 다운로드 관리 */
  FILE_DOWNLOAD = 'fileDownload',
  /** 모바일 상태 */
  MOBILE = 'mobile',
  /** 디렉토리 스캐너 */
  SCANNER = 'scanner',
  /** 가이드 상태 */
  GUIDE = 'guide',
  /** 피드/모멘트 */
  FEED = 'feed',
  /** 모멘트 알림 */
  FEED_NOTIFICATION = 'feedNotification',
  /** 봇 뷰 상태 */
  BOT = 'bot',
  /** 파일 관리 */
  FILE = 'file',
  /** 썸네일 캐시 */
  THUMBNAIL_CACHE = 'thumbnailCache',
  /** 초기 동기화 상태 */
  INITIAL_SYNC = 'initialSync'
}

/**
 * 메시지 유형
 * todo: 추후 보완 필요
 */
export enum MsgEnum {
  /** 알 수 없음 0 */
  UNKNOWN,
  /** 텍스트 1 */
  TEXT,
  /** 철회 2 */
  RECALL,
  /** 이미지 3 */
  IMAGE,
  /** 파일 4 */
  FILE,
  /** 음성 5 */
  VOICE,
  /** 비디오 6 */
  VIDEO,
  /** 이모티콘 팩 7 */
  EMOJI,
  /** 시스템 메시지 8 */
  SYSTEM,
  /** 채팅 기록 9 */
  MERGE,
  /** 공지사항 10 */
  NOTICE,
  /** 로봇 11 */
  BOT,
  /** 영상 통화 12 */
  VIDEO_CALL,
  /** 음성 통화 13 */
  AUDIO_CALL,
  /** 혼합 14 */
  MIXED,
  /** 멘션 15 */
  AIT,
  /** 답장 16 */
  REPLY,
  /** AI 17*/
  AI,
  /** 위치 18 */
  LOCATION
}

/**
 * AI 메시지 콘텐츠 유형 열거형
 * AI 생성 메시지 콘텐츠 유형 식별에 사용 (텍스트, 이미지, 비디오, 오디오)
 */
export enum AiMsgContentTypeEnum {
  /** 텍스트 1 */
  TEXT = 1,
  /** 이미지 2 */
  IMAGE = 2,
  /** 비디오 3 */
  VIDEO = 3,
  /** 오디오 4 */
  AUDIO = 4
}

/**
 * 온라인 상태
 */
export enum OnlineEnum {
  /** 온라인 */
  ONLINE = 1,
  /** 오프라인 */
  OFFLINE
}

/**
 * 작업 유형
 */
export enum ActEnum {
  /** 확인 */
  Confirm = 1,
  /** 취소 */
  Cancel
}

/** 성별 */
export enum SexEnum {
  /** 남 */
  MAN = 1,
  /** 여 */
  REMALE
}

/** 권한 상태 */
export enum PowerEnum {
  /** 사용자 */
  USER,
  /** 관리자 */
  ADMIN
}

/** 여부 상태 */
export enum IsYesEnum {
  /** 아니요 */
  NO,
  /** 예 */
  YES
}

export enum MarkEnum {
  /** 좋아요 */
  LIKE = 1,
  /** 싫어요 */
  DISLIKE,
  /** 하트 */
  HEART,
  /** 화남 */
  ANGRY,
  /** 폭죽 */
  CELEBRATE,
  /** 로켓 */
  ROCKET,
  /** 웃픈 */
  LOL,
  /** 박수 */
  APPLAUSE,
  /** 꽃 */
  FLOWER,
  /** 폭탄 */
  BOMB,
  /** 의문 */
  CONFUSED,
  /** 승리 */
  VICTORY,
  /** 조명 */
  LIGHT,
  /** 홍바오 */
  MONEY
}

// 멤버 역할 1그룹 소유자 2관리자 3일반 멤버 4강제 퇴장
export enum RoleEnum {
  /** 1그룹 소유자 */
  LORD = 1,
  /** 2관리자 */
  ADMIN,
  /** 3일반 멤버 */
  NORMAL,
  /** 4강제 퇴장 */
  REMOVED
}

/** 방 유형 1그룹 채팅 21:1 채팅 */
export enum RoomTypeEnum {
  /** 1그룹 채팅 */
  GROUP = 1,
  /** 21:1 채팅 */
  SINGLE = 2
}

/** 방 작업 */
export enum RoomActEnum {
  /** 그룹 채팅 나가기 */
  EXIT_GROUP,
  /** 그룹 채팅 해산 */
  DISSOLUTION_GROUP,
  /** 친구 삭제 */
  DELETE_FRIEND,
  /** 기록 삭제 */
  DELETE_RECORD,
  /** 친구 차단 */
  BLOCK_FRIEND,
  /** 그룹 이름 수정 */
  UPDATE_GROUP_NAME,
  /** 그룹 정보 수정 */
  UPDATE_GROUP_INFO
}

/** 변경 유형 1 그룹 가입, 2: 그룹 제거 */
export enum ChangeTypeEnum {
  /** 1 그룹 가입 */
  JOIN = 1,
  /** 2 그룹 제거 */
  REMOVE,
  /** 3 그룹 나가기 */
  EXIT_GROUP
}

/** 창 닫기 동작 */
export enum CloseBxEnum {
  /** 숨기기 */
  HIDE = 'hide',
  /** 닫기 */
  CLOSE = 'close'
}

/** 업로드 제한 */
export enum LimitEnum {
  /** 일반 제한 수량 */
  COM_COUNT = 5
}

/** ws 응답 유형 */
export enum WorkerMsgEnum {
  /** open */
  OPEN = 'open',
  /** message */
  MESSAGE = 'message',
  /** close */
  CLOSE = 'close',
  /** error */
  ERROR = 'error',
  /** ws_error */
  WS_ERROR = 'wsError'
}

/** 왼쪽 메뉴 팝업 유형 */
export enum ModalEnum {
  /** 화면 잠금 팝업 */
  LOCK_SCREEN,
  /** 업데이트 확인 팝업 */
  CHECK_UPDATE
}

/** MacOS 키보드 매핑 */
export enum MacOsKeyEnum {
  '⌘' = '⌘',
  '⌥' = '⌥',
  '⇧' = '⇧',
  '^' = '^'
}

/** Windows 키보드 매핑 */
export enum WinKeyEnum {
  CTRL = 'Ctrl',
  WIN = 'Win',
  ALT = 'Alt',
  SHIFT = 'Shift'
}

/** 플러그인 상태 */
export enum PluginEnum {
  /** 내장됨 */
  BUILTIN,
  /** 설치됨 */
  INSTALLED,
  /** 다운로드 중 */
  DOWNLOADING,
  /** 설치되지 않음 */
  NOT_INSTALLED,
  /** 제거 중 */
  UNINSTALLING,
  /** 업데이트 가능 */
  CAN_UPDATE
}

/** 메뉴 표시 모드 */
export enum ShowModeEnum {
  /** 아이콘 방식 */
  ICON,
  /** 텍스트 방식 */
  TEXT
}

/**
 * 메시지 전송 상태
 */
export enum MessageStatusEnum {
  PENDING = 'pending',
  SENDING = 'sending',
  SUCCESS = 'success',
  FAILED = 'failed'
}

/** 트리거 유형 열거형 */
export enum TriggerEnum {
  MENTION = '@',
  AI = '/',
  TOPIC = '#'
}

/** 연결 상태 열거형 */
export enum ConnectionState {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  RECONNECTING = 'reconnecting'
}

/** 업로드 scene 값 상태 */
export enum UploadSceneEnum {
  /** 채팅 */
  CHAT = 'chat',
  /** 이모티콘 */
  EMOJI = 'emoji',
  /** 프로필 사진 */
  AVATAR = 'avatar'
}

/** 모바일 패널 상태 열거형 */
export enum MobilePanelStateEnum {
  /** 패널 없음 */
  NONE = 'none',
  /** 이모티콘 패널 */
  EMOJI = 'emoji',
  /** 음성 패널 */
  VOICE = 'voice',
  /** 더보기 패널 */
  MORE = 'more',
  /** 입력창 포커스 */
  FOCUS = 'focus'
}

/** 세션 작업 */
export enum SessionOperateEnum {
  /** 친구 삭제 */
  DELETE_FRIEND = 0,
  /** 그룹 채팅 해산 */
  DISSOLUTION_GROUP = 1,
  /** 그룹 채팅 나가기 */
  EXIT_GROUP = 2 | 3
}

/**
 * 알림 유형 0 -> 메시지 수신 허용 1 -> 수신하지만 알림 없음[방해 금지] 2 -> 메시지 차단
 */
export enum NotificationTypeEnum {
  /** 메시지 수신 허용 */
  RECEPTION = 0,
  /** 수신하지만 알림 없음[방해 금지] */
  NOT_DISTURB = 1
}

/** Tauri 명령 */
export enum TauriCommand {
  /** 내 그룹 채팅 정보 업데이트 */
  UPDATE_MY_ROOM_INFO = 'update_my_room_info',
  /** 방 멤버 가져오기 */
  GET_ROOM_MEMBERS = 'get_room_members',
  /** 모든 방 페이징 조회 */
  PAGE_ROOM = 'page_room',
  /** 방 멤버 페이징 조회 */
  CURSOR_PAGE_ROOM_MEMBERS = 'cursor_page_room_members',
  /** 모든 세션 목록 나열 */
  LIST_CONTACTS = 'list_contacts_command',
  /** 세션 메시지 페이징 조회 */
  PAGE_MSG = 'page_msg',
  /** 사용자 정보 저장 */
  SAVE_USER_INFO = 'save_user_info',
  /** 사용자 마지막 작업 시간 업데이트 */
  UPDATE_USER_LAST_OPT_TIME = 'update_user_last_opt_time',
  /** 메시지 전송 */
  SEND_MSG = 'send_msg',
  /** 메시지 저장 */
  SAVE_MSG = 'save_msg',
  /** 메시지 마크 저장 */
  SAVE_MESSAGE_MARK = 'save_message_mark',
  /** 단일 채팅 메시지 삭제 */
  DELETE_MESSAGE = 'delete_message',
  /** 방 내 모든 채팅 기록 삭제 */
  DELETE_ROOM_MESSAGES = 'delete_room_messages',
  /** 메시지 철회 상태 업데이트 */
  UPDATE_MESSAGE_RECALL_STATUS = 'update_message_recall_status',
  /** 사용자 토큰 가져오기 */
  GET_USER_TOKENS = 'get_user_tokens',
  /** 토큰 업데이트 */
  UPDATE_TOKEN = 'update_token',
  /** 토큰 제거 */
  REMOVE_TOKENS = 'remove_tokens',
  /** 채팅 기록 조회 */
  QUERY_CHAT_HISTORY = 'query_chat_history',
  /** AI 메시지 스트리밍 전송 */
  AI_MESSAGE_SEND_STREAM = 'ai_message_send_stream',
  /** MinIO 미리 서명된 URL 생성 */
  GENERATE_MINIO_PRESIGNED_URL = 'generate_minio_presigned_url'
}

// 통화 상태 열거형
export enum RTCCallStatus {
  CALLING = 1, // 호출
  ACCEPT = 2, // 수락
  END = 3, // 종료
  REJECT = 4, // 거절
  ERROR = 5, // 오류 중단
  BUSY = 6, // 통화 중
  CANCEL = 7 // 취소
}

// 통화 유형 열거형
export enum CallTypeEnum {
  AUDIO = 1, // 음성 통화
  VIDEO = 2 // 영상 통화
}

export enum ImUrlEnum {
  // Token 관련
  /** 로그인 */
  LOGIN = 'login',
  /** 토큰 갱신 */
  REFRESH_TOKEN = 'refreshToken',
  /** 비밀번호 찾기 */
  FORGET_PASSWORD = 'forgetPassword',
  /** 토큰 확인 */
  CHECK_TOKEN = 'checkToken',
  /** 로그아웃 */
  LOGOUT = 'logout',
  /** 회원가입 */
  REGISTER = 'register',

  // 시스템 관련
  /** Qiniu 클라우드 토큰 가져오기 */
  GET_QINIU_TOKEN = 'getQiniuToken',
  /** 구성 초기화 */
  INIT_CONFIG = 'initConfig',
  /** 기본 스토리지 공급자 가져오기 */
  STORAGE_PROVIDER = 'storageProvider',
  /** 모델 목록 가져오기 */
  GET_ASSISTANT_MODEL_LIST = 'getAssistantModelList',
  /** 좌표 변환 */
  MAP_COORD_TRANSLATE = 'mapCoordTranslate',
  /** 역 지오코딩 */
  MAP_REVERSE_GEOCODE = 'mapReverseGeocode',
  /** 주소 정적 이미지 */
  MAP_STATIC = 'mapStatic',

  // 인증 코드 관련
  /** 인증 코드 전송 */
  SEND_CAPTCHA = 'sendCaptcha',
  /** 인증 코드 가져오기 */
  GET_CAPTCHA = 'getCaptcha',

  // 그룹 공지 관련
  /** 그룹 공지 보기 */
  ANNOUNCEMENT = 'announcement',
  /** 그룹 공지 편집 */
  EDIT_ANNOUNCEMENT = 'editAnnouncement',
  /** 그룹 공지 삭제 */
  DELETE_ANNOUNCEMENT = 'deleteAnnouncement',
  /** 그룹 공지 게시 */
  PUSH_ANNOUNCEMENT = 'pushAnnouncement',
  /** 그룹 공지 목록 가져오기 */
  GET_ANNOUNCEMENT_LIST = 'getAnnouncementList',

  // 그룹 가입 신청 관련
  /** 그룹 가입 신청 */
  APPLY_GROUP = 'applyGroup',

  // 그룹 검색 및 관리
  /** 그룹 검색 */
  SEARCH_GROUP = 'searchGroup',
  /** 내 그룹 정보 수정 */
  UPDATE_MY_ROOM_INFO = 'updateMyRoomInfo',
  /** 그룹 정보 수정 */
  UPDATE_ROOM_INFO = 'updateRoomInfo',
  /** 그룹 목록 */
  GROUP_LIST = 'groupList',
  /** 그룹 상세 */
  GROUP_DETAIL = 'groupDetail',
  /** 그룹 정보 */
  GROUP_INFO = 'groupInfo',

  // 그룹 관리자
  /** 관리자 해제 */
  REVOKE_ADMIN = 'revokeAdmin',
  /** 관리자 추가 */
  ADD_ADMIN = 'addAdmin',

  // 그룹 멤버 관리
  /** 그룹 채팅 나가기 */
  EXIT_GROUP = 'exitGroup',
  /** 초대 수락 */
  ACCEPT_INVITE = 'acceptInvite',
  /** 초대 목록 */
  INVITE_LIST = 'inviteList',
  /** 그룹 멤버 초대 */
  INVITE_GROUP_MEMBER = 'inviteGroupMember',
  /** 그룹 채팅 생성 */
  CREATE_GROUP = 'createGroup',

  // 채팅 세션 관련
  /** 메시지 차단 */
  SHIELD = 'shield',
  /** 알림 설정 */
  NOTIFICATION = 'notification',
  /** 세션 삭제 */
  DELETE_SESSION = 'deleteSession',
  /** 세션 상단 고정 설정 */
  SET_SESSION_TOP = 'setSessionTop',
  /** 세션 상세 (연락처) */
  SESSION_DETAIL_WITH_FRIENDS = 'sessionDetailWithFriends',
  /** 세션 상세 */
  SESSION_DETAIL = 'sessionDetail',

  // 메시지 읽음/안 읽음
  /** 메시지 읽은 수 가져오기 */
  GET_MSG_READ_COUNT = 'getMsgReadCount',
  /** 메시지 읽은 목록 가져오기 */
  GET_MSG_READ_LIST = 'getMsgReadList',

  // 친구 관련
  /** 친구 메모 수정 */
  MODIFY_FRIEND_REMARK = 'modifyFriendRemark',
  /** 친구 삭제 */
  DELETE_FRIEND = 'deleteFriend',
  /** 친구 추가 요청 전송 */
  SEND_ADD_FRIEND_REQUEST = 'sendAddFriendRequest',
  /** 초대 처리 */
  HANDLE_INVITE = 'handleInvite',
  /** 읽지 않은 알림 수 */
  NOTICE_UN_READ_COUNT = 'noticeUnReadCount',
  /** 알림 페이지 요청 */
  REQUEST_NOTICE_PAGE = 'requestNoticePage',
  /** 알림 읽음 */
  REQUEST_NOTICE_READ = 'RequestNoticeRead',
  /** 연락처 목록 가져오기 */
  GET_CONTACT_LIST = 'getContactList',
  /** 친구 검색 */
  SEARCH_FRIEND = 'searchFriend',

  // 사용자 상태 관련
  /** 사용자 상태 변경 */
  CHANGE_USER_STATE = 'changeUserState',
  /** 모든 사용자 상태 가져오기 */
  GET_ALL_USER_STATE = 'getAllUserState',

  // QR 코드 관련
  /** QR 코드 생성 */
  GENERATE_QR_CODE = 'generateQRCode',
  /** QR 코드 상태 확인 */
  CHECK_QR_STATUS = 'checkQRStatus',
  /** QR 코드 스캔 */
  SCAN_QR_CODE = 'scanQRCode',
  /** 로그인 확인 */
  CONFIRM_QR_CODE = 'confirmQRCode',

  // 사용자 정보 관련
  /** 프로필 사진 업로드 */
  UPLOAD_AVATAR = 'uploadAvatar',
  /** 이모티콘 가져오기 */
  GET_EMOJI = 'getEmoji',
  /** 이모티콘 삭제 */
  DELETE_EMOJI = 'deleteEmoji',
  /** 이모티콘 추가 */
  ADD_EMOJI = 'addEmoji',
  /** 사용자 배지 설정 */
  SET_USER_BADGE = 'setUserBadge',
  /** 사용자 기본 정보 수정 */
  MODIFY_USER_INFO = 'ModifyUserInfo',
  /** 사용자 정보 상세 가져오기 */
  GET_USER_INFO_DETAIL = 'getUserInfoDetail',
  /** 배지 일괄 가져오기 */
  GET_BADGES_BATCH = 'getBadgesBatch',
  /** 배지 목록 가져오기 */
  GET_BADGE_LIST = 'getBadgeList',
  /** 사용자 차단 */
  BLOCK_USER = 'blockUser',

  // 메시지 관련
  /** 메시지 철회 */
  RECALL_MSG = 'recallMsg',
  /** 메시지 마크 */
  MARK_MSG = 'markMsg',
  /** 메시지 목록 가져오기 */
  GET_MSG_LIST = 'getMsgList',
  /** 멤버 통계 가져오기 */
  GET_MEMBER_STATISTIC = 'getMemberStatistic',

  /** 모멘트 상세 가져오기 */
  FEED_DETAIL = 'feedDetail',
  /** 모멘트 목록 가져오기 */
  FEED_LIST = 'feedList',
  /** 모멘트 게시 */
  PUSH_FEED = 'pushFeed',
  /** 모멘트 삭제 */
  DEL_FEED = 'delFeed',
  /** 모멘트 편집 */
  EDIT_FEED = 'editFeed',
  /** 모멘트 권한 가져오기 */
  GET_FEED_PERMISSION = 'getFeedPermission',

  // 모멘트 좋아요 관련
  /** 좋아요 또는 좋아요 취소 */
  FEED_LIKE_TOGGLE = 'feedLikeToggle',
  /** 좋아요 목록 가져오기 */
  FEED_LIKE_LIST = 'feedLikeList',
  /** 좋아요 수 가져오기 */
  FEED_LIKE_COUNT = 'feedLikeCount',
  /** 좋아요 여부 확인 */
  FEED_LIKE_HAS_LIKED = 'feedLikeHasLiked',

  // 모멘트 댓글 관련
  /** 댓글 게시 */
  FEED_COMMENT_ADD = 'feedCommentAdd',
  /** 댓글 삭제 */
  FEED_COMMENT_DELETE = 'feedCommentDelete',
  /** 댓글 목록 가져오기 */
  FEED_COMMENT_LIST = 'feedCommentList',
  /** 모든 댓글 목록 가져오기 (페이징 없음) */
  FEED_COMMENT_ALL = 'feedCommentAll',
  /** 댓글 수 가져오기 */
  FEED_COMMENT_COUNT = 'feedCommentCount',

  // 그룹 멤버 정보
  /** 모든 사용자 기본 정보 가져오기 */
  GET_ALL_USER_BASE_INFO = 'getAllUserBaseInfo',

  GROUP_LIST_MEMBER = 'groupListMember',
  SEND_MSG = 'sendMsg',
  SET_HIDE = 'setHide',
  GET_FRIEND_PAGE = 'getFriendPage',
  MARK_MSG_READ = 'markMsgRead',
  /** 그룹 멤버 내보내기 */
  REMOVE_GROUP_MEMBER = 'removeGroupMember',
  CHECK_EMAIL = 'checkEmail',

  MERGE_MSG = 'mergeMsg',
  GET_USER_BY_IDS = 'getUserByIds',

  /** AI 메시지 전송 */
  MESSAGE_SEND_STREAM = 'messageSendStream',
  /** 생성된 콘텐츠 메시지 저장 (오디오, 이미지, 비디오 등 생성 기능에 사용) */
  MESSAGE_SAVE_GENERATED_CONTENT = 'messageSaveGeneratedContent',
  /** 지정된 세션 메시지 목록 가져오기 */
  MESSAGE_LIST_BY_CONVERSATION_ID = 'messageListByConversationId',
  /** 단일 메시지 삭제 */
  MESSAGE_DELETE = 'messageDelete',
  /** 지정된 대화의 메시지 삭제 */
  MESSAGE_DELETE_BY_CONVERSATION_ID = 'messageDeleteByConversationId',
  /** 세션 메시지 목록 가져오기 */
  CONVERSATION_PAGE = 'conversationPage',
  /** [내] 채팅 대화 가져오기 */
  CONVERSATION_GET_MY = 'conversationGetMy',
  /** 세션 생성 */
  CONVERSATION_CREATE_MY = 'conversationCreateMy',
  /** 세션 업데이트 */
  CONVERSATION_UPDATE_MY = 'conversationUpdateMy',
  /** 세션 삭제 */
  CONVERSATION_DELETE_MY = 'conversationDeleteMy',
  /** 모델 페이지 */
  MODEL_PAGE = 'modelPage',
  /** 모델 생성 */
  MODEL_CREATE = 'modelCreate',
  /** 모델 업데이트 */
  MODEL_UPDATE = 'modelUpdate',
  /** 모델 삭제 */
  MODEL_DELETE = 'modelDelete',

  // ==================== AI 이미지 생성 ====================
  /** [내] 이미지 생성 페이징 가져오기 */
  IMAGE_MY_PAGE = 'imageMyPage',
  /** [내] 이미지 생성 기록 가져오기 */
  IMAGE_GET = 'imageGet',
  /** ID 목록으로 [내] 이미지 기록 가져오기 */
  IMAGE_MY_LIST_BY_IDS = 'imageMyListByIds',
  /** 이미지 생성 */
  IMAGE_DRAW = 'imageDraw',
  /** [내] 이미지 기록 삭제 */
  IMAGE_DELETE_MY = 'imageDeleteMy',

  // ==================== AI 비디오 생성 ====================
  /** [내] 비디오 생성 페이징 가져오기 */
  VIDEO_MY_PAGE = 'videoMyPage',
  /** [내] 비디오 생성 기록 가져오기 */
  VIDEO_GET = 'videoGet',
  /** ID 목록으로 [내] 비디오 기록 가져오기 */
  VIDEO_MY_LIST_BY_IDS = 'videoMyListByIds',
  /** 비디오 생성 */
  VIDEO_GENERATE = 'videoGenerate',
  /** [내] 비디오 기록 삭제 */
  VIDEO_DELETE_MY = 'videoDeleteMy',

  // ==================== AI 오디오 생성 ====================
  /** [내] 오디오 생성 페이징 가져오기 */
  AUDIO_MY_PAGE = 'audioMyPage',
  /** [내] 오디오 생성 기록 가져오기 */
  AUDIO_GET_MY = 'audioGetMy',
  /** ID 목록으로 [내] 오디오 기록 가져오기 */
  AUDIO_MY_LIST_BY_IDS = 'audioMyListByIds',
  /** 오디오 생성 */
  AUDIO_GENERATE = 'audioGenerate',
  /** [내] 오디오 기록 삭제 */
  AUDIO_DELETE_MY = 'audioDeleteMy',
  /** 지정된 모델이 지원하는 음성 목록 가져오기 */
  AUDIO_VOICES = 'audioVoices',

  /** API 키 페이징 */
  API_KEY_PAGE = 'apiKeyPage',
  /** API 키 간단 목록 */
  API_KEY_SIMPLE_LIST = 'apiKeySimpleList',
  /** API 키 생성 */
  API_KEY_CREATE = 'apiKeyCreate',
  /** API 키 업데이트 */
  API_KEY_UPDATE = 'apiKeyUpdate',
  /** API 키 삭제 */
  API_KEY_DELETE = 'apiKeyDelete',
  /** API 키 잔액 조회 */
  API_KEY_BALANCE = 'apiKeyBalance',
  /** 플랫폼 목록 가져오기 */
  PLATFORM_LIST = 'platformList',
  /** 플랫폼 모델 추가 */
  PLATFORM_ADD_MODEL = 'platformAddModel',
  /** 채팅 역할 페이징 */
  CHAT_ROLE_PAGE = 'chatRolePage',
  /** 채팅 역할 카테고리 목록 */
  CHAT_ROLE_CATEGORY_LIST = 'chatRoleCategoryList',
  /** 채팅 역할 생성 */
  CHAT_ROLE_CREATE = 'chatRoleCreate',
  /** 채팅 역할 업데이트 */
  CHAT_ROLE_UPDATE = 'chatRoleUpdate',
  /** 채팅 역할 삭제 */
  CHAT_ROLE_DELETE = 'chatRoleDelete'
}

// 스크롤 의도 관리 열거형
export enum ScrollIntentEnum {
  NONE = 'none',
  INITIAL = 'initial', // 초기화 또는 방 전환
  NEW_MESSAGE = 'new_message', // 새 메시지 도착
  LOAD_MORE = 'load_more' // 더 많은 기록 메시지 로드
}

export enum MergeMessageType {
  SINGLE = 1,
  MERGE = 2
}

// 사용자 유형
export enum UserType {
  BOT = 'bot'
}
