/** pinia store의 네임스페이스 */
declare namespace STO {
  import { ShowModeEnum, ThemeEnum } from '@/enums'
  import { UserState } from '@/services/types'
  /**
   * 설정
   * @param themes 테마 설정
   * @param tips 닫기 알림
   * @param escClose ESC로 창 닫기 활성화 여부
   * @param lockScreen 잠금 화면 여부
   * @param login 사용자 로그인 설정
   * @param chat 채팅 설정
   * @param page 인터페이스 설정
   */
  type Setting = {
    /** 테마 설정 */
    themes: {
      content: ThemeEnum
      pattern: string
      versatile: string
    }
    /** 닫기 알림 */
    tips: {
      type: string
      /** 다시 알림 표시 안 함 */
      notTips: boolean
    }
    /** ESC로 창 닫기 활성화 여부 */
    escClose: boolean
    /** 메뉴 표시 모드 */
    showMode: ShowModeEnum
    /** 잠금 화면 여부 */
    lockScreen: {
      /** 잠금 화면 활성화 여부 */
      enable: boolean
      /** 잠금 화면 비밀번호 */
      password: string
    }
    /** 로그인 설정 */
    login: {
      /** 자동 로그인 활성화 여부 */
      autoLogin: boolean
      /** 시작 프로그램 등록 */
      autoStartup: boolean
    }
    /** 채팅 설정 */
    chat: {
      /** 전송 단축키 */
      sendKey: string
      /** 더블클릭으로 독립 대화 창 열기 여부 */
      isDouble: boolean
      /** 번역 제공업체 */
      translate: 'youdao' | 'tencent'
    }
    /** 단축키 설정 */
    shortcuts: {
      /** 스크린샷 단축키 */
      screenshot: string
      /** 메인 패널 열기 단축키 */
      openMainPanel: string
      /** 전역 단축키 활성화 */
      globalEnabled: boolean
    }
    /** 인터페이스 설정 */
    page: {
      /** 그림자 활성화 여부 */
      shadow: boolean
      /** 폰트 */
      fonts: string
      /** 가우시안 블러 */
      blur: boolean
      lang: string
    }
    /** 업데이트 설정 */
    update: {
      /** 무시할 업데이트 버전 */
      dismiss: string
    }
    /** 스크린샷 설정 */
    screenshot: {
      /** 스크린샷 시 창 숨기기 여부 */
      isConceal: boolean
    }
    /** 메시지 알림 설정 */
    notification: {
      /** 메시지 알림음 활성화 여부 */
      messageSound: boolean
    }
  }

  /**
   * 상단 고정 창 목록
   * @param key 창 이름
   */
  type AlwaysOnTop = {
    /** 창 상단 고정 여부 목록 */
    [key: string]: boolean
  }

  /**
   * 히스토리 콘텐츠
   * @param emoji 히스토리 메시지의 이모지 목록
   */
  type History = {
    /** 이모지 목록 */
    emoji: string[]
  }

  /**
   * 사용자 상태
   * @param {UserState} 공통 온라인 상태
   */
  type UserState = UserState

  /**
   * 플러그인 관리 팝업 데이터 타입
   * @param state 플러그인 상태
   * @param version 플러그인 버전
   * @param isAdd 사이드바 추가 여부
   * @param isAnimate 애니메이션 효과 여부
   * @param { OPT.L.Common } 공통 기본 사이드바
   */
  type Plugins<T> = {
    state: T
    version?: string
    isAdd: boolean
    dot?: boolean
    progress: number
    miniShow: boolean
  } & OPT.L.Common

  /**
   * 가이드 상태
   */
  type Guide = {
    /** 가이드 완료 상태 */
    isGuideCompleted: boolean
  }
}
