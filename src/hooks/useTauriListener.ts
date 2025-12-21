import type { UnlistenFn } from '@tauri-apps/api/event'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { error, info } from '@tauri-apps/plugin-log'
import { getCurrentInstance, onUnmounted } from 'vue'

// 전역 리스너 관리
const globalListeners = new Map<string, Promise<UnlistenFn>[]>()
const windowCloseListenerSetup = new Map<string, UnlistenFn>()
const listenerIdMap = new Map<string, Promise<UnlistenFn>>()
// 동일한 unlisten 함수에 대해 반복 호출하여 기본 listeners[eventId]가 존재하지 않게 되는 것을 방지
const calledUnlisteners = new WeakSet<UnlistenFn>()

const safeUnlisten = (unlisten: UnlistenFn) => {
  try {
    if (calledUnlisteners.has(unlisten)) return
    unlisten()
    calledUnlisteners.add(unlisten)
  } catch (e) {
    console.warn('safeUnlisten error:', e)
  }
}

/** tauri Listener 이벤트 리스너를 자동으로 관리하는 훅 */
export const useTauriListener = () => {
  const listeners: Promise<UnlistenFn>[] = []
  const listenerIds: string[] = []
  const instance = getCurrentInstance()
  const windowLabel = WebviewWindow.getCurrent().label
  let isComponentMounted = true

  /**
   * 이벤트 리스너 추가
   * @param listener Promise<UnlistenFn>
   */
  const addListener = async (listener: Promise<UnlistenFn>, id?: string) => {
    const listenerId = id || `listener_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    if (listenerIdMap.has(listenerId)) {
      try {
        const unlisten = await listener
        safeUnlisten(unlisten)
      } catch (e) {
        error(`[추적] 새 리스너 취소 실패:${listenerId}, 오류:${e}`)
      }
    } else {
      // 새 리스너 추가
      listenerIdMap.set(listenerId, listener)
      listeners.push(listener)
      listenerIds.push(listenerId)
      // 전역 리스너 관리에도 추가
      if (!globalListeners.has(windowLabel)) {
        globalListeners.set(windowLabel, [])
      }
      globalListeners.get(windowLabel)!.push(listener)
    }
  }

  /**
   * 이벤트 리스너 일괄 추가
   * @param listenerPromises Promise<UnlistenFn> 배열
   */
  const pushListeners = (listenerPromises: Promise<UnlistenFn>[]) => {
    listeners.push(...listenerPromises)

    // 전역 리스너 관리에도 추가
    if (!globalListeners.has(windowLabel)) {
      globalListeners.set(windowLabel, [])
    }
    globalListeners.get(windowLabel)!.push(...listenerPromises)

    return listenerPromises
  }

  /**
   * 현재 컴포넌트의 리스너 정리
   */
  const cleanup = async () => {
    // 컴포넌트를 마운트 해제 상태로 표시
    isComponentMounted = false

    // 리스너가 존재할 때만 로그 출력 및 정리 실행
    if (listeners.length > 0) {
      const componentName = instance?.type?.name || instance?.type?.__name || '알 수 없는 컴포넌트'
      info(`[useTauriListener]컴포넌트 [${componentName}]의 Tauri 리스너 정리, 리스너 수:[${listeners.length}]`)
      try {
        // 모든 unlisten 함수가 resolve될 때까지 대기
        const unlistenFns = await Promise.all(listeners)
        // 모든 unlisten 함수 실행
        unlistenFns.forEach((unlisten) => safeUnlisten(unlisten))

        // 전역 참조 제거, Promise 메모리 누수 방지
        const windowListeners = globalListeners.get(windowLabel)
        if (windowListeners?.length) {
          const removable = new Set(listeners)
          const filtered = windowListeners.filter((item) => !removable.has(item))
          if (filtered.length === 0) {
            globalListeners.delete(windowLabel)
          } else {
            globalListeners.set(windowLabel, filtered)
          }
        }

        // 해당 리스너 ID 기록 삭제
        listenerIds.forEach((id) => listenerIdMap.delete(id))
        listenerIds.length = 0
        listeners.length = 0
      } catch (error) {
        console.error('리스너 정리 실패:', error)
      }
    }
  }

  /**
   * 지정된 창의 모든 리스너 정리 (전역 정리)
   */
  const cleanupAllListenersForWindow = async (windowLabel: string) => {
    const windowListeners = globalListeners.get(windowLabel)
    if (!windowListeners) return

    info(`[useTauriListener]창 [${windowLabel}]의 모든 Tauri 리스너 정리, 리스너 수:[${windowListeners.length}]`)
    try {
      // 모든 unlisten 함수가 resolve될 때까지 대기
      const unlistenFns = await Promise.all(windowListeners)
      // 모든 unlisten 함수 실행
      unlistenFns.forEach((unlisten) => safeUnlisten(unlisten))

      // 글로벌 상태 정리
      globalListeners.delete(windowLabel)

      // listenerIdMap의 해당 Promise 참조 동기 정리
      for (const [id, promise] of Array.from(listenerIdMap.entries())) {
        if (windowListeners.includes(promise)) {
          listenerIdMap.delete(id)
        }
      }
    } catch (error) {
      console.error('리스너 정리 실패:', error)
    }
  }

  // 창 닫기 이벤트를 감지하여 리스너 자동 정리
  const setupWindowCloseListener = async () => {
    try {
      const appWindow = WebviewWindow.getCurrent()
      const currentWindowLabel = appWindow.label

      // 해당 창에 대해 이미 리스너가 설정되었는지 확인
      if (windowCloseListenerSetup.has(currentWindowLabel)) {
        return
      }

      // 창 닫기 요청 이벤트 수신
      if (currentWindowLabel !== 'home') {
        info(`[useTauriListener]현재 창 닫기 리스너 설정: ${currentWindowLabel}`)
        const closeUnlisten = await appWindow.onCloseRequested(async () => {
          info(`[useTauriListener] [${currentWindowLabel}] 창 닫기 이벤트 수신 - 모든 리스너 정리`)
          // 해당 창의 모든 리스너 정리
          await cleanupAllListenersForWindow(currentWindowLabel)
          // 창 닫기 리스너 정리
          windowCloseListenerSetup.delete(currentWindowLabel)
        })

        // 창 닫기 리스너 저장
        windowCloseListenerSetup.set(currentWindowLabel, closeUnlisten)
      }
    } catch (error) {
      console.warn('창 닫기 리스너 설정 실패:', error)
    }
  }

  // 창 닫기 리스너 설정
  setupWindowCloseListener()

  // 컴포넌트 인스턴스가 존재할 때만 onUnmounted 훅 등록
  if (instance) {
    onUnmounted(() => {
      // 컴포넌트가 여전히 마운트되어 있는지 확인하여 중복 정리 방지
      if (isComponentMounted) {
        cleanup()
      }
    })
  }

  return {
    addListener,
    pushListeners,
    // 비 컴포넌트 환경에서 수동으로 정리할 수 있도록 cleanup 메서드 노출
    cleanup
  }
}
