interface ViewTransition {
  ready: Promise<void>
}

interface Document {
  startViewTransition?: (callback: () => Promise<void> | void) => ViewTransition
}

/** 공통 타입 */
declare namespace Common {
  /**
   * 전략 패턴
   * [상태, true일 때 실행할 콜백 함수]
   */
  type StrategyAction = [boolean, () => void]

  /** 옵션 데이터 */
  type OptionWithKey<K> = { value: K; label: string }
}

/** 빌드 시간 */
declare const PROJECT_BUILD_TIME: string

export type ProxySettings = {
  apiType: string
  apiIp: string
  apiPort: string
  apiSuffix: string
  wsType: string
  wsIp: string
  wsPort: string
  wsSuffix: string
}

export type MsgId = {
  msgId: string
  fromUid: string
}
