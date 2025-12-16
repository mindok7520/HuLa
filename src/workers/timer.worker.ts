/// <reference lib="webworker" />

/** 문자열과 숫자 타입의 key를 지원하도록 타입 정의 수정 */
type TimerId = number | string
type TimerInfo = {
  timerId: NodeJS.Timeout
  debugId: NodeJS.Timeout | null
}

/** 타이머 ID와 디버그 타이머 ID 저장 */
const timerIds = new Map<TimerId, TimerInfo>()

/** 활성 타이머 수를 추적하기 위한 카운터 추가 */
let activeTimers = 0

/** 주기적 하트비트 타이머 ID */
let periodicHeartbeatId: NodeJS.Timeout | null = null

/** 로그 제어 스위치, 기본적으로 로그를 출력하지 않음 */
let ENABLE_LOGGING = false

/** 실행 간격 시간 */
const DEBUG_INTERVAL = 1000

// 모든 타이머가 완료되었는지 확인하고 알림
const checkAllTimersCompleted = () => {
  if (activeTimers === 0) {
    self.postMessage({ type: 'allTimersCompleted' })
  }
}

// 최적화된 디버그 정보 출력 함수 - 로그가 활성화된 경우에만 메시지를 전송하여 불필요한 postMessage 오버헤드 방지
const logDebugInfo = (msgId: TimerId, remainingTime: number) => {
  // 로그 기능이 활성화된 경우에만 debug 메시지 전송 및 로그 출력
  if (!ENABLE_LOGGING) return

  self.postMessage({
    type: 'debug',
    msgId,
    remainingTime,
    timestamp: Date.now()
  })

  // 중요한 시점에만 로그 출력 (마지막 5초 또는 10초마다)
  if (remainingTime <= 5000 || remainingTime % 10000 < 1000) {
    console.log(`[Worker Debug] 메시지 ID: ${msgId}, 남은 시간: ${(remainingTime / 1000).toFixed(1)}초`)
  }
}

// 안전한 로그 함수
/**
 * @description 로그 출력을 활성화하는 방법
 * @example timerWorker.postMessage({ type: 'setLogging', logging: true })
 */
const safeLog = (message: string, ...args: any[]) => {
  if (ENABLE_LOGGING) {
    console.log(message, ...args)
  }
}

self.onmessage = (e) => {
  const { type, msgId, duration, reconnectCount, interval, logging } = e.data

  // 로그 제어 파라미터를 받으면 로그 상태 업데이트
  if (type === 'setLogging') {
    ENABLE_LOGGING = !!logging
    safeLog(`[Worker] 로그 상태가 ${ENABLE_LOGGING ? '활성화' : '비활성화'}되었습니다`)
    return
  }

  switch (type) {
    case 'startReconnectTimer': {
      // 메인 스레드에서 타이머 재시작 이벤트 전송, 지연 후 reconnectTimeout 이벤트를 메인 스레드로 반환
      console.log('[Timer Worker] 재연결 타이머 시작.....')
      const timerId = setTimeout(() => {
        self.postMessage({
          type: 'reconnectTimeout',
          reconnectCount
        })
      }, e.data.value.delay)

      // 이제 문자열을 key로 사용할 수 있음
      timerIds.set('reconnect', { timerId, debugId: null })
      safeLog('[Worker] 재연결 타이머 시작')
      break
    }

    case 'clearReconnectTimer': {
      if (timerIds.has('reconnect')) {
        const { timerId } = timerIds.get('reconnect')!
        clearTimeout(timerId)
        timerIds.delete('reconnect')
        safeLog('[Worker] 재연결 타이머 제거')
      }
      break
    }

    case 'startTimer': {
      activeTimers++
      safeLog(`[Worker] 타이머 시작: ${msgId}, 시간: ${duration}ms`)
      // 숫자 타입의 msgId 사용
      if (timerIds.has(msgId)) {
        const { timerId, debugId } = timerIds.get(msgId)!
        clearTimeout(timerId)
        if (debugId) clearInterval(debugId)
        timerIds.delete(msgId)
        safeLog(`[Worker] 기존 타이머 교체: ${msgId}`)
      }

      // 로그가 활성화된 경우에만 디버그 타이머 생성, 불필요한 성능 오버헤드 방지
      let debugId: NodeJS.Timeout | null = null

      if (ENABLE_LOGGING) {
        const startTime = Date.now()
        // 초기 상태를 즉시 출력
        logDebugInfo(msgId, duration)

        debugId = setInterval(() => {
          const elapsed = Date.now() - startTime
          const remaining = duration - elapsed
          if (remaining > 0) {
            logDebugInfo(msgId, remaining)
          } else {
            if (debugId) clearInterval(debugId)
          }
        }, DEBUG_INTERVAL)
      }

      const timerId = setTimeout(() => {
        if (debugId) clearInterval(debugId)
        safeLog('[Worker] 타이머 만료:', msgId)
        self.postMessage({ type: 'timeout', msgId })
        timerIds.delete(msgId)

        activeTimers--
        checkAllTimersCompleted()
      }, duration)

      timerIds.set(msgId, { timerId, debugId })
      break
    }

    case 'clearTimer': {
      safeLog('[Worker] 타이머 정리:', msgId)
      if (timerIds.has(msgId)) {
        const { timerId, debugId } = timerIds.get(msgId)!
        clearTimeout(timerId)
        if (debugId) clearInterval(debugId)
        timerIds.delete(msgId)
        activeTimers--
        checkAllTimersCompleted()
      }
      break
    }

    // 하트비트 주기적 타이머 관련 기능
    case 'startPeriodicHeartbeat': {
      // 이전 타이머가 존재하면 먼저 제거
      if (periodicHeartbeatId) {
        clearInterval(periodicHeartbeatId)
        periodicHeartbeatId = null
      }

      // 새로운 주기적 하트비트 타이머 생성
      periodicHeartbeatId = setInterval(() => {
        safeLog('[Worker] 하트비트 전송')
        self.postMessage({ type: 'periodicHeartbeat' })
      }, interval || 9900) as any

      safeLog('[Worker] 하트비트 타이머 시작됨, 간격:', interval, 'ms')
      break
    }

    case 'stopPeriodicHeartbeat': {
      if (periodicHeartbeatId) {
        clearInterval(periodicHeartbeatId)
        periodicHeartbeatId = null
        safeLog('[Worker] 하트비트 타이머 중지됨')
      }
      break
    }
  }
}
