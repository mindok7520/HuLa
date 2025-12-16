import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'

/**
 * 백엔드 상태가 사용 가능한지 통합 관리, AppData가 아직 주입되지 않았을 때 tauri command 호출 방지.
 * 먼저 `is_app_state_ready`로 한 번 조회하고, 아직 준비되지 않았으면 `app-state-ready` 이벤트를 수신한 후 계속 진행.
 */
let isReady = false
let pendingPromise: Promise<void> | null = null

/**
 * 백엔드가 브로드캐스트하는 ready 이벤트를 한 번 대기. 이벤트 트리거 후 리스너를 해제하고, 이후 호출은 캐시된 결과를 직접 읽도록 허용.
 */
const waitForReadyEvent = () =>
  new Promise<void>((resolve) => {
    let cleanup: (() => void) | null = null
    listen('app-state-ready', () => {
      isReady = true
      resolve()
      if (cleanup) {
        cleanup()
        cleanup = null
      }
      pendingPromise = null
    })
      .then((unlisten) => {
        cleanup = unlisten
      })
      .catch((error) => {
        console.warn('[appStateReady] Failed to register listener:', error)
        pendingPromise = null
        resolve()
      })
  })

/**
 * 백그라운드 상태에 의존하는 명령을 호출하기 전에 Rust 측이 초기화를 완료했는지 확인.
 * 프론트엔드가 대기 중에 여러 번 호출되면 동일한 Promise를 재사용하여 중복 리스닝 방지.
 */
export const ensureAppStateReady = async () => {
  if (isReady) {
    return
  }

  try {
    const readyFlag = await invoke<boolean>('is_app_state_ready')
    if (readyFlag) {
      isReady = true
      return
    }
  } catch (error) {
    console.warn('[appStateReady] is_app_state_ready invoke failed:', error)
  }

  if (!pendingPromise) {
    pendingPromise = waitForReadyEvent()
  }

  await pendingPromise
}
