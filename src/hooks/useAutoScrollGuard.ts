import { onUnmounted, ref } from 'vue'

/**
 * 자동 스크롤 보호 창 관리, 프로그램 스크롤 중 사용자 스크롤로 오판되는 것을 방지.
 * requestAnimationFrame을 사용하여 길이를 제어하며 setTimeout에 의존하지 않음.
 */
export const useAutoScrollGuard = () => {
  const isAutoScrolling = ref(false)
  let autoScrollRafId: number | null = null
  let autoScrollUntil = 0

  const stopGuard = () => {
    if (autoScrollRafId) {
      cancelAnimationFrame(autoScrollRafId)
      autoScrollRafId = null
    }
    autoScrollUntil = 0
    isAutoScrolling.value = false
  }

  const enableAutoScroll = (duration = 500) => {
    const now = performance.now()
    autoScrollUntil = Math.max(autoScrollUntil, now + duration)
    if (!isAutoScrolling.value) {
      isAutoScrolling.value = true
    }

    const step = (timestamp: number) => {
      if (timestamp >= autoScrollUntil) {
        stopGuard()
        return
      }
      autoScrollRafId = requestAnimationFrame(step)
    }

    if (!autoScrollRafId) {
      autoScrollRafId = requestAnimationFrame(step)
    }
  }

  onUnmounted(stopGuard)

  return {
    isAutoScrolling,
    enableAutoScroll,
    stopAutoScrollGuard: stopGuard
  }
}
