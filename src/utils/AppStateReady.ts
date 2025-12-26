import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'

/**
 * 백엔드 상태의 사용 가능 여부를 통합 관리하여 AppData가 로드되기 전에 tauri 명령을 호출하는 것을 방지합니다.
 * 먼저 `is_app_state_ready`를 통해 한 번 쿼리하고, 아직 준비되지 않은 경우 `app-state-ready` 이벤트를 리스닝한 후 계속합니다.
 */
let isReady = false
let pendingPromise: Promise<void> | null = null

/**
 * 백엔드에서 브로드캐스트하는 ready 이벤트를 한 번 기다립니다. 이벤트가 발생하면 리스닝을 해제하고 이후 호출 시 캐시된 결과를 직접 읽을 수 있도록 허용합니다.
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
 * 백엔드 상태에 의존하는 명령을 호출하기 전에 Rust 측 초기화가 완료되었는지 확인합니다.
 * 대기 중에 프론트엔드가 여러 번 호출되는 경우 동일한 Promise를 재사용하여 중복 리스닝을 방지합니다.
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
