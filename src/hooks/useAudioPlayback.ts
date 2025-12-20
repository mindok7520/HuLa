import type { Ref } from 'vue'
import { audioManager } from '@/utils/AudioManager'

export type AudioPlaybackReturn = {
  // 상태
  isPlaying: Ref<boolean>
  loading: Ref<boolean>
  currentTime: Ref<number>
  playbackProgress: Ref<number>
  audioElement: Ref<HTMLAudioElement | null>

  // 재생 위치 기억
  lastPlayPosition: Ref<number>
  hasBeenPlayed: Ref<boolean>
  shouldResumeFromPosition: Ref<boolean>

  // 메서드
  togglePlayback: () => Promise<void>
  createAudioElement: (audioUrl: string, audioId: string, duration: number) => Promise<void>
  seekToTime: (time: number) => void
  cleanup: () => void
}

/**
 * 오디오 재생 제어 Hook
 * @param audioId 오디오 고유 식별자
 * @param onTimeUpdate 시간 업데이트 콜백
 * @returns 재생 제어 인터페이스
 */
export const useAudioPlayback = (
  audioId: string,
  onTimeUpdate?: (currentTime: number, progress: number) => void
): AudioPlaybackReturn => {
  const isPlaying = ref(false)
  const loading = ref(false)
  const currentTime = ref(0)
  const playbackProgress = ref(0)
  const audioElement = ref<HTMLAudioElement | null>(null)

  const lastPlayPosition = ref(0) // 마지막 재생 위치 (초)
  const hasBeenPlayed = ref(false) // 재생된 적 있는지 여부
  const shouldResumeFromPosition = ref(false) // 기억된 위치에서 재개해야 하는지 여부

  /**
   * 개선된 경계 처리
   */
  const enhancedClampTime = (time: number, maxTime: number = 0) => {
    if (!Number.isFinite(time) || isNaN(time)) {
      return 0
    }

    const max = Math.max(0, maxTime)
    return Math.max(0, Math.min(max, time))
  }

  /**
   * 오디오 상태 변경 리스너
   */
  const handleAudioStateChange = () => {
    const currentId = audioManager.getCurrentAudioId()
    // 현재 재생 중인 오디오가 본 컴포넌트의 오디오가 아니면 재생 상태 초기화
    if (currentId !== audioId && isPlaying.value) {
      // 전환 전 현재 위치 기억
      if (audioElement.value && audioElement.value.currentTime > 0) {
        lastPlayPosition.value = audioElement.value.currentTime
        shouldResumeFromPosition.value = true
      }

      isPlaying.value = false
    }
  }

  /**
   * 오디오 요소 생성 및 이벤트 리스너 설정
   * @param audioUrl 오디오 URL
   * @param id 오디오 ID
   * @param duration 오디오 길이
   */
  const createAudioElement = async (audioUrl: string, _id: string, duration: number) => {
    if (audioElement.value) return

    audioElement.value = new Audio(audioUrl)

    // 이벤트 리스너 설정
    audioElement.value.addEventListener('loadstart', () => {
      loading.value = true
    })

    audioElement.value.addEventListener('canplay', () => {
      loading.value = false

      // 오디오 준비 완료 후 재생 위치 복구 필요 여부 확인
      if (shouldResumeFromPosition.value && lastPlayPosition.value > 0) {
        try {
          const clampedPosition = enhancedClampTime(lastPlayPosition.value, duration)
          audioElement.value!.currentTime = clampedPosition
          currentTime.value = clampedPosition
          const progress = (clampedPosition / audioElement.value!.duration) * 100
          playbackProgress.value = progress || 0
          shouldResumeFromPosition.value = false // 플래그 초기화
        } catch (error) {
          console.warn('재생 위치 복구 실패:', error)
          // 복구 실패 시 상태 정리
          lastPlayPosition.value = 0
          shouldResumeFromPosition.value = false
        }
      }
    })

    audioElement.value.addEventListener('timeupdate', () => {
      if (audioElement.value) {
        currentTime.value = audioElement.value.currentTime
        const progress = (audioElement.value.currentTime / audioElement.value.duration) * 100
        playbackProgress.value = progress || 0

        // 실시간 재생 위치 기억 (정상 재생 중에만)
        if (isPlaying.value) {
          lastPlayPosition.value = audioElement.value.currentTime
          hasBeenPlayed.value = true
        }

        // 시간 업데이트 콜백 호출
        onTimeUpdate?.(currentTime.value, playbackProgress.value)
      }
    })

    audioElement.value.addEventListener('ended', () => {
      isPlaying.value = false
      currentTime.value = 0
      playbackProgress.value = 0

      // 재생 종료 시 위치 기억 초기화
      lastPlayPosition.value = 0
      hasBeenPlayed.value = false
      shouldResumeFromPosition.value = false

      // 외부로 재생 종료 알림
      onTimeUpdate?.(0, 0)
    })

    audioElement.value.addEventListener('error', () => {
      loading.value = false
      isPlaying.value = false
    })

    // 오디오 관리자 리스너 추가
    audioManager.addListener(handleAudioStateChange)
  }

  /**
   * 재생 상태 전환
   */
  const togglePlayback = async () => {
    if (loading.value || !audioElement.value) return

    try {
      // 현재 재생 중이면 일시 정지하고 위치 기억
      if (isPlaying.value) {
        // 현재 재생 위치 기억
        if (audioElement.value) {
          lastPlayPosition.value = audioElement.value.currentTime
          shouldResumeFromPosition.value = true
        }

        audioManager.pause()
        isPlaying.value = false
        return
      }

      // 재생 위치 복구 필요 여부 확인
      if (shouldResumeFromPosition.value && lastPlayPosition.value > 0) {
        const clampedPosition = enhancedClampTime(lastPlayPosition.value, audioElement.value.duration)
        audioElement.value.currentTime = clampedPosition
        currentTime.value = clampedPosition
        const progress = (clampedPosition / audioElement.value.duration) * 100
        playbackProgress.value = progress || 0
        shouldResumeFromPosition.value = false
      }

      // 재생 시작
      await audioManager.play(audioElement.value, audioId)
      isPlaying.value = true
      hasBeenPlayed.value = true
    } catch (error) {
      console.error('재생 제어 오류:', error)
      isPlaying.value = false
      loading.value = false

      // 오류 시 상태 정리
      lastPlayPosition.value = 0
      shouldResumeFromPosition.value = false
    }
  }

  /**
   * 특정 시간으로 이동
   * @param time 목표 시간 (초)
   */
  const seekToTime = (time: number) => {
    if (!audioElement.value) return

    const clampedTime = enhancedClampTime(time, audioElement.value.duration)

    if (Number.isFinite(clampedTime) && !isNaN(clampedTime)) {
      audioElement.value.currentTime = clampedTime
      currentTime.value = clampedTime
      const progress = (clampedTime / audioElement.value.duration) * 100
      playbackProgress.value = progress || 0

      // 재생 위치 기억 업데이트
      lastPlayPosition.value = clampedTime
    }
  }

  /**
   * 리소스 정리
   */
  const cleanup = () => {
    // 오디오 관리자 리스너 제거
    audioManager.removeListener(handleAudioStateChange)

    // 오디오 요소 정리
    if (audioElement.value) {
      try {
        audioElement.value.pause()
        audioElement.value.src = ''
        audioElement.value.load() // 오디오 요소 리셋
      } catch (error) {
        console.warn('오디오 요소 정리 중 오류 발생:', error)
      } finally {
        audioElement.value = null
      }
    }

    // 상태 초기화
    isPlaying.value = false
    loading.value = false
    currentTime.value = 0
    playbackProgress.value = 0
    lastPlayPosition.value = 0
    hasBeenPlayed.value = false
    shouldResumeFromPosition.value = false
  }

  return {
    // 상태
    isPlaying,
    loading,
    currentTime,
    playbackProgress,
    audioElement,

    // 재생 위치 기억
    lastPlayPosition,
    hasBeenPlayed,
    shouldResumeFromPosition,

    // 메서드
    togglePlayback,
    createAudioElement,
    seekToTime,
    cleanup
  }
}
