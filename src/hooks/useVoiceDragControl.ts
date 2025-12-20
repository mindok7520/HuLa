import { useThrottleFn } from '@vueuse/core'
import type { Ref } from 'vue'
import { isMobile } from '@/utils/PlatformConstants'

/**
 * 드래그 컨트롤러 반환 인터페이스
 */
export type VoiceDragControlReturn = {
  // 상태
  isDragging: Ref<boolean>
  previewTime: Ref<number>
  showTimePreview: Ref<boolean>

  // 내부 상태 (디버깅 및 모니터링용)
  dragStartX: Ref<number>
  wasPlayingBeforeDrag: Ref<boolean>

  // 메서드
  handleDragStart: (event: MouseEvent | TouchEvent) => void
  calculateTimeFromPosition: (clientX: number) => number
  cleanup: () => void

  // 이벤트 바인딩
  bindDragEvents: (canvasElement: HTMLCanvasElement) => void
}

/**
 * 음성 드래그 상호작용 처리 Hook
 * @param canvasElement Canvas 요소 참조
 * @param duration 오디오 길이
 * @param isPlaying 재생 상태
 * @param onDragSeek 드래그 점프 콜백
 * @param onPlayToggle 재생 전환 콜백
 * @returns 드래그 제어 인터페이스
 */
export const useVoiceDragControl = (
  canvasElement: Ref<HTMLCanvasElement | null>,
  duration: Ref<number>,
  isPlaying: Ref<boolean>,
  onDragSeek: (time: number) => void,
  onPlayToggle: (shouldPlay: boolean) => Promise<void>
): VoiceDragControlReturn => {
  const isDragging = ref(false)
  const previewTime = ref(0)
  const showTimePreview = ref(false)
  const dragStartX = ref(0)
  const wasPlayingBeforeDrag = ref(false)

  const dragThreshold = 5 // 드래그 트리거 최소 이동 거리 (픽셀)
  const isMobileDevice = isMobile()

  /**
   * 향상된 경계 처리
   */
  const enhancedClampTime = (time: number) => {
    if (!Number.isFinite(time) || isNaN(time)) {
      return 0
    }

    const maxTime = Math.max(0, duration.value || 0)
    return Math.max(0, Math.min(maxTime, time))
  }

  /**
   * 모바일 페이지 상태 복원
   */
  const restoreMobilePageState = () => {
    if (isMobileDevice) {
      const scrollY = parseInt(document.body.dataset.scrollY || '0', 10)

      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''

      // 스크롤 위치 복원
      window.scrollTo(0, scrollY)

      // 데이터 속성 정리
      delete document.body.dataset.scrollY
    }
  }

  /**
   * 위치 계산 알고리즘
   * @param clientX 마우스/터치 포인트의 X 좌표
   * @returns 해당 시간 (초)
   */
  const calculateTimeFromPosition = (clientX: number): number => {
    if (!canvasElement.value) return 0

    const rect = canvasElement.value.getBoundingClientRect()
    const relativeX = clientX - rect.left
    const progress = Math.max(0, Math.min(1, relativeX / rect.width))
    return progress * duration.value
  }

  /**
   * 드래그 시작 처리
   * @param event 마우스 또는 터치 이벤트
   */
  const handleDragStart = (event: MouseEvent | TouchEvent) => {
    if (!canvasElement.value) return

    try {
      event.preventDefault()
      event.stopPropagation()

      // 모바일에서 페이지 스크롤 방지
      if (isMobileDevice) {
        const currentScrollY = window.scrollY

        document.body.style.overflow = 'hidden'
        document.body.style.position = 'fixed'
        document.body.style.top = `-${currentScrollY}px`
        document.body.style.width = '100%'

        // 복원을 위해 스크롤 위치 저장
        document.body.dataset.scrollY = currentScrollY.toString()
      }

      // 시작 위치 가져오기
      const clientX = 'touches' in event ? event.touches[0]?.clientX : event.clientX
      if (clientX === undefined) {
        return
      }

      dragStartX.value = clientX

      // 드래그 전 재생 상태 저장
      wasPlayingBeforeDrag.value = isPlaying.value

      // 이동 및 종료 이벤트 바인딩
      if (isMobileDevice || 'ontouchstart' in window) {
        document.addEventListener('touchmove', handleDragMove, { passive: false })
        document.addEventListener('touchend', handleDragEnd, { passive: false })
        document.addEventListener('touchcancel', handleDragEnd, { passive: false })
      } else {
        document.addEventListener('mousemove', handleDragMove)
        document.addEventListener('mouseup', handleDragEnd)
        document.addEventListener('mouseleave', handleDragEnd)
      }
    } catch (error) {
      console.error('드래그 시작 처리 오류:', error)
      // 오류 시 페이지 상태 복원
      restoreMobilePageState()
    }
  }

  /**
   * 드래그 이동 처리 (스로틀 처리)
   */
  const handleDragMove = useThrottleFn((event: MouseEvent | TouchEvent) => {
    try {
      if (!isDragging.value) {
        // 드래그 임계값 초과 여부 확인
        const clientX = 'touches' in event ? event.touches[0]?.clientX : event.clientX
        if (clientX === undefined) {
          console.warn('이동 위치를 가져올 수 없음')
          return
        }

        const moveDistance = Math.abs(clientX - dragStartX.value)

        if (moveDistance >= dragThreshold) {
          // 드래그 시작
          isDragging.value = true
          showTimePreview.value = true

          // 재생 중지 (재생 중인 경우)
          if (isPlaying.value) {
            try {
              onPlayToggle(false)
            } catch (pauseError) {
              console.warn('재생 일시 중지 실패:', pauseError)
            }
          }
        } else {
          return
        }
      }

      // 페이지 스크롤 방지 (모바일)
      event.preventDefault()

      // 현재 위치 계산
      const clientX = 'touches' in event ? event.touches[0]?.clientX : event.clientX
      if (clientX === undefined) {
        console.warn('드래그 위치를 가져올 수 없음')
        return
      }

      const targetTime = calculateTimeFromPosition(clientX)
      previewTime.value = enhancedClampTime(targetTime)
    } catch (error) {
      console.error('드래그 이동 처리 오류:', error)
      // 오류 시 드래그 종료
      handleDragEnd()
    }
  }, 16)

  /**
   * 드래그 종료 처리
   */
  const handleDragEnd = () => {
    try {
      restoreMobilePageState()

      // 전역 이벤트 리스너 정리
      document.removeEventListener('mousemove', handleDragMove)
      document.removeEventListener('mouseup', handleDragEnd)
      document.removeEventListener('mouseleave', handleDragEnd)
      document.removeEventListener('touchmove', handleDragMove)
      document.removeEventListener('touchend', handleDragEnd)
      document.removeEventListener('touchcancel', handleDragEnd)

      if (isDragging.value) {
        try {
          const clampedTime = enhancedClampTime(previewTime.value)

          // 외부로 이동 알림
          onDragSeek(clampedTime)

          // 드래그 전 재생 중이었으면 재생 재개
          if (wasPlayingBeforeDrag.value) {
            onPlayToggle(true).catch((playError) => {
              console.error('재생 재개 실패:', playError)
            })
          }
        } catch (seekError) {
          console.error('재생 위치 설정 실패:', seekError)
        }
      }
    } catch (error) {
      console.error('드래그 종료 처리 오류:', error)
      // 오류 상황에서도 페이지 상태 복원 보장
      restoreMobilePageState()
    } finally {
      // 항상 드래그 상태 초기화
      isDragging.value = false
      showTimePreview.value = false
      wasPlayingBeforeDrag.value = false
      dragStartX.value = 0
      previewTime.value = 0
    }
  }

  /**
   * Canvas 요소의 드래그 이벤트 바인딩
   * @param canvas Canvas 요소
   */
  const bindDragEvents = (canvas: HTMLCanvasElement) => {
    canvas.addEventListener('mousedown', handleDragStart)
    canvas.addEventListener('touchstart', handleDragStart)
  }

  /**
   * 리소스 및 이벤트 리스너 정리
   */
  const cleanup = () => {
    // 전역 이벤트 리스너 정리
    document.removeEventListener('mousemove', handleDragMove)
    document.removeEventListener('mouseup', handleDragEnd)
    document.removeEventListener('mouseleave', handleDragEnd)
    document.removeEventListener('touchmove', handleDragMove)
    document.removeEventListener('touchend', handleDragEnd)
    document.removeEventListener('touchcancel', handleDragEnd)

    // 페이지 상태 복원
    restoreMobilePageState()

    // 重置状态
    isDragging.value = false
    showTimePreview.value = false
    wasPlayingBeforeDrag.value = false
    dragStartX.value = 0
    previewTime.value = 0
  }

  return {
    // 状态
    isDragging,
    previewTime,
    showTimePreview,

    // 内部状态
    dragStartX,
    wasPlayingBeforeDrag,

    // 方法
    handleDragStart,
    calculateTimeFromPosition,
    cleanup,

    // 事件绑定
    bindDragEvents
  }
}
