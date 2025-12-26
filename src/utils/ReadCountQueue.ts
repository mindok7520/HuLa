import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useMitt } from '@/hooks/useMitt.ts'
import type { MsgReadUnReadCountType } from '@/services/types'
import { getMsgReadCount } from './ImRequestUtils'

/**
 * 메시지 읽음 수 큐 모듈
 * 큐와 타이머 메커니즘을 통해 요청 빈도를 최적화하여 메시지 읽음 상태를 일괄적으로 가져옵니다.
 */

// 타입 정의
type ReadCountQueue = Set<number> // 메시지 ID를 Set으로 저장하여 자동 중복 제거
interface AbortableRequest extends Promise<MsgReadUnReadCountType[]> {
  abort: () => void // 중단 가능한 요청 타입, Promise를 상속받음
}

// 상수 정의
const INTERVAL_DELAY = 10000 // 폴링 간격 시간: 10초

// 상태 변수
const queue: ReadCountQueue = new Set<number>() // 처리 대기 중인 메시지 ID 큐
let timerWorker: Worker | null = null // Web Worker 타이머
let request: AbortableRequest | null = null // 현재 진행 중인 요청
let isTimerActive = false // 타이머 활성 여부 표시

// 이벤트 타입 정의
interface ReadCountTaskEvent {
  msgId: number // 메시지 ID
}

/**
 * 메시지를 읽음 수 큐에 추가
 * @param msgId 메시지 ID
 */
const onAddReadCountTask = ({ msgId }: ReadCountTaskEvent) => {
  if (typeof msgId !== 'number') return
  queue.add(msgId)
}

/**
 * 메시지를 읽음 수 큐에서 제거
 * @param msgId 메시지 ID
 */
const onRemoveReadCountTask = ({ msgId }: ReadCountTaskEvent) => {
  if (typeof msgId !== 'number') return
  queue.delete(msgId)
}

/**
 * 사용자가 읽음 수 요청을 보낼 수 있는지 확인
 * 요청 가능 여부를 불리언 값으로 반환
 */
const checkUserAuthentication = () => {
  // 1. 현재 로그인 창인지 확인
  const currentWindow = WebviewWindow.getCurrent()
  if (currentWindow.label === 'login') {
    return false
  }
}

/**
 * 메시지 읽음 수 조회 작업 수행
 * 1. 이전 요청 중단 (있는 경우)
 * 2. 큐가 비어 있는지 확인
 * 3. 메시지 읽음 상태를 가져오기 위한 새 요청 시작
 * 4. 응답 데이터 처리 및 이벤트 발송
 */
const task = async () => {
  try {
    // 완료되지 않은 요청이 있으면 중단
    if (request) {
      request.abort()
      request = null
    }

    // 큐가 비어 있으면 요청을 보내지 않음
    if (queue.size === 0) return

    // 사용자가 요청을 보낼 수 있는지 확인
    const canSendRequest = checkUserAuthentication()
    if (!canSendRequest) {
      console.log('사용자가 로그인하지 않았거나 로그인 창에 있습니다. 메시지 읽음 수 요청을 건너뜁니다.')
      // 로그인 창인 경우, 큐를 비우고 타이머 중지
      clearQueue()
      return
    }

    // 새로운 일괄 조회 요청 시작
    // request = apis.getMsgReadCount({ msgIds: Array.from(queue) }) as AbortableRequest
    request = await getMsgReadCount(Array.from(queue))
    const res = await request

    // 응답 데이터 형식 검증
    if (!Array.isArray(res)) {
      console.error('Invalid response format:', res)
      return
    }

    // 조회가 쉽도록 응답 데이터를 Map 구조로 변환
    const result = new Map<string, MsgReadUnReadCountType>()
    for (const item of res) {
      if (typeof item.msgId === 'string') {
        result.set(item.msgId, item)
      }
    }

    // 읽음 수 업데이트 이벤트 발송
    useMitt.emit('onGetReadCount', result)
  } catch (error) {
    console.error('메시지 읽음 수를 가져올 수 없습니다:', error)
  } finally {
    request = null // 요청 참조 정리
  }
}

/**
 * 메시지 읽음 수 수신기 초기화
 * 메시지 추가 및 제거 이벤트 처리 함수 등록
 */
export const initListener = () => {
  useMitt.on('onAddReadCountTask', onAddReadCountTask)
  useMitt.on('onRemoveReadCountTask', onRemoveReadCountTask)
  clearQueue()
}

/**
 * 메시지 읽음 수 수신기 정리
 * 이벤트 모니터링 제거 및 타이머 중지
 */
export const clearListener = () => {
  useMitt.off('onAddReadCountTask', onAddReadCountTask)
  useMitt.off('onRemoveReadCountTask', onRemoveReadCountTask)
  // 현재 요청 취소
  if (request) {
    request.abort()
    request = null
  }
  stopTimer()
  // Worker 종료
  terminateWorker()
}

/**
 * 폴링 타이머 중지
 */
const stopTimer = () => {
  if (timerWorker && isTimerActive) {
    // 타이머 중지를 위해 worker에 메시지 전송
    timerWorker.postMessage({
      type: 'clearTimer',
      msgId: 'readCountQueue' // 고정 문자열을 타이머 ID로 사용
    })
    isTimerActive = false
  }
}

/**
 * 메시지 큐 비우기
 * 큐를 비우고 타이머 중지
 */
export const clearQueue = () => {
  queue.clear()
  stopTimer()
}

/**
 * Web Worker 초기화
 */
const initWorker = () => {
  if (!timerWorker) {
    timerWorker = new Worker(new URL('../workers/timer.worker.ts', import.meta.url))

    // Worker 메시지 수신 연동
    timerWorker.onmessage = (e) => {
      const { type, msgId } = e.data

      // timer.worker.ts에서 timeout 메시지를 보내면 task 작업 수행
      if (type === 'timeout' && msgId === 'readCountQueue') {
        void task()
        // 타이머 재시작
        startTimer()
      }
    }

    // 오류 처리 추가
    timerWorker.onerror = (error) => {
      console.error('[ReadCountQueue Worker Error]', error)
      isTimerActive = false
    }
  }
}

/**
 * 타이머 시작
 */
const startTimer = () => {
  if (!timerWorker) {
    initWorker()
  }

  // 명시적으로 기존 타이머 제거
  stopTimer()

  // timerWorker가 초기화되었는지 확인
  if (timerWorker) {
    // 새로운 타이머 시작
    timerWorker.postMessage({
      type: 'startTimer',
      msgId: 'readCountQueue', // 고정 문자열을 타이머 ID로 사용
      duration: INTERVAL_DELAY // 동일한 폴링 간격 시간 사용
    })

    isTimerActive = true
  } else {
    console.error('[ReadCountQueue] Web Worker 타이머를 초기화할 수 없습니다.')
  }
}

/**
 * Worker 종료
 */
const terminateWorker = () => {
  if (timerWorker) {
    stopTimer()
    timerWorker.terminate()
    timerWorker = null
  }
}

/**
 * 메시지 읽음 수 큐 시작
 * 1. 즉시 한 번 조회 작업 수행
 * 2. 정기 폴링 시작
 */
export const readCountQueue = () => {
  // Worker 초기화
  initWorker()

  // 작업을 즉시 한 번 수행
  void task()

  // 타이머 시작
  startTimer()
}
