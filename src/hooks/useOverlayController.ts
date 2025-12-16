import type { ComputedRef, Ref } from 'vue'

type OverlayControllerOptions = {
  /** 최초 로그인 여부 (첫 화면 차단 필요) */
  isInitialSync: ComputedRef<boolean>
  /** 진행률 값 (준비 완료 시 이 도구에 의해 자동으로 100으로 설정됨) */
  progress: Ref<number>
  /** 비동기 하위 모듈 총 개수, 기본값 3 */
  asyncTotal?: number
  /** 최소 표시 시간, 기본값 600ms */
  minDisplayMs?: number
}

/**
 * 최초 로그인 오버레이 및 LoadingSpinner 제어:
 * - isInitialSync가 true일 때만 오버레이 표시
 * - 비동기 하위 모듈이 모두 로드될 때까지 기다린 후 진행률을 100%로 설정하고 minDisplayMs 대기 후 숨김
 * - 최초 로그인이 아닌 경우 오버레이 표시 안 함
 */
export const useOverlayController = (options: OverlayControllerOptions) => {
  const asyncTarget = options.asyncTotal ?? 3
  const minDisplayMs = options.minDisplayMs ?? 600

  // "최초 로그인 오버레이" 로직이 이미 트리거되었는지 여부. 한 번 트리거되면 프로세스가 끝날 때까지 숨겨지지 않음.
  const activated = ref(options.isInitialSync.value)
  const overlayVisible = ref(activated.value)
  const asyncLoadedCount = ref(0)
  const asyncComponentsReady = computed(() => asyncLoadedCount.value >= asyncTarget)

  let hideTimer: number | null = null

  const clearHideTimer = () => {
    if (hideTimer) {
      clearTimeout(hideTimer)
      hideTimer = null
    }
  }

  const scheduleHide = () => {
    clearHideTimer()
    hideTimer = window.setTimeout(() => {
      overlayVisible.value = false
      hideTimer = null
    }, minDisplayMs)
  }

  const evaluateOverlay = () => {
    // 최초 로그인 오버레이가 트리거되지 않음: 즉시 숨김
    if (!activated.value) {
      overlayVisible.value = false
      clearHideTimer()
      return
    }

    // 최초 로그인: 표시 유지, 비동기 준비 완료 대기
    overlayVisible.value = true
    if (!asyncComponentsReady.value) {
      clearHideTimer()
      return
    }

    // 비동기 준비 완료, 진행률을 100%로 설정하고 최소 표시 시간 대기 후 숨김
    if (options.progress.value < 100) {
      options.progress.value = 100
    }
    scheduleHide()
  }

  // isInitialSync가 처음 true일 때만 오버레이 활성화, 이후 isInitialSync가 false로 변경되어도 미리 숨기지 않음
  watch(
    options.isInitialSync,
    (val) => {
      if (val) {
        activated.value = true
        overlayVisible.value = true
        clearHideTimer()
      }
      evaluateOverlay()
    },
    { immediate: true }
  )

  watch(asyncComponentsReady, evaluateOverlay)

  const markAsyncLoaded = () => {
    asyncLoadedCount.value = Math.min(asyncLoadedCount.value + 1, asyncTarget)
    evaluateOverlay()
  }

  const resetOverlay = () => {
    asyncLoadedCount.value = 0
    activated.value = options.isInitialSync.value
    overlayVisible.value = activated.value
    clearHideTimer()
  }

  return {
    overlayVisible,
    asyncComponentsReady,
    markAsyncLoaded,
    resetOverlay
  }
}
