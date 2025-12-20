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
 * 최초 로그인 마스크 및 로딩 스피너 제어:
 * - isInitialSync가 true일 때만 마스크 표시
 * - 모든 비동기 하위 모듈이 로드될 때까지 대기 후, 진행률을 100%로 설정하고 minDisplayMs만큼 기다린 후 숨김
 * - 최초 로그인이 아닌 경우 마스크를 표시하지 않음
 */
export const useOverlayController = (options: OverlayControllerOptions) => {
  const asyncTarget = options.asyncTotal ?? 3
  const minDisplayMs = options.minDisplayMs ?? 600

  /** "최초 로그인 마스크" 로직이 트리거되었는지 여부. 한 번 트리거되면 프로세스가 끝날 때까지 숨겨지지 않음. */
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
    // 최초 로그인 마스크가 트리거되지 않음: 즉시 숨김
    if (!activated.value) {
      overlayVisible.value = false
      clearHideTimer()
      return
    }

    // 최초 로그인: 표시 유지, 모든 비동기 작업 완료 대기
    overlayVisible.value = true
    if (!asyncComponentsReady.value) {
      clearHideTimer()
      return
    }

    // 비동기 작업이 모두 완료되면 진행률을 100%로 설정하고 최소 표시 시간만큼 기다린 후 숨김
    if (options.progress.value < 100) {
      options.progress.value = 100
    }
    scheduleHide()
  }

  // isInitialSync가 처음 true일 때만 마스크를 활성화하고, 이후 isInitialSync가 false로 변경되어도 미리 숨기지 않음
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
