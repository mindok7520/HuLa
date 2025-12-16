/**
 * 전역 오디오 관리자
 * 동시에 하나의 오디오만 재생되도록 보장
 */
class AudioManager {
  private static instance: AudioManager
  private currentAudio: HTMLAudioElement | null = null
  private currentAudioId: string | null = null
  private listeners: Set<() => void> = new Set()

  private constructor() { }

  static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager()
    }
    return AudioManager.instance
  }

  /**
   * 오디오 재생
   * @param audio 오디오 요소
   * @param audioId 오디오 고유 식별자
   */
  async play(audio: HTMLAudioElement, audioId: string): Promise<void> {
    if (this.currentAudio) {
      if (this.currentAudioId !== audioId) {
        // 다른 오디오는 현재 재생을 직접 중지
        this.stop()
      } else {
        // 동일한 오디오는 병렬 재생을 피하기 위해 먼저 리셋
        if (!this.currentAudio.paused) {
          this.currentAudio.pause()
        }
        this.currentAudio.currentTime = 0
      }
    }

    this.currentAudio = audio
    this.currentAudioId = audioId

    try {
      await audio.play()
    } catch (error) {
      // 네트워크 재연결 또는 빠른 전환 시 audio.play가 중단되어 AbortError를 발생시킬 수 있으므로 여기서는 이러한 오류를 무시
      if (error instanceof DOMException && error.name === 'AbortError') {
        this.currentAudio = null
        this.currentAudioId = null
        return
      }
      console.error('오디오 재생 실패:', error)
      this.currentAudio = null
      this.currentAudioId = null
      throw error
    }
  }

  /**
   * 현재 오디오 일시 중지
   */
  pause(): void {
    if (this.currentAudio) {
      try {
        if (!this.currentAudio.paused) {
          this.currentAudio.pause()
        }
      } catch (error) {
        // 오디오 요소가 이미 파괴되었거나 상태 이상인 오류 무시
        console.warn('오디오 일시 중지 시 오류 발생:', error)
        this.currentAudio = null
        this.currentAudioId = null
      }
    }
  }

  /**
   * 현재 오디오 중지 및 리셋
   */
  stop(): void {
    if (this.currentAudio) {
      try {
        if (!this.currentAudio.paused) {
          this.currentAudio.pause()
        }
        this.currentAudio.currentTime = 0
      } catch (error) {
        // 오디오 요소가 이미 파괴되었거나 상태 이상인 오류 무시
        console.warn('오디오 중지 시 오류 발생:', error)
      } finally {
        this.currentAudio = null
        this.currentAudioId = null
        this.notifyListeners()
      }
    }
  }

  /**
   * 모든 오디오 중지 (세션 전환 등의 시나리오에 사용)
   */
  stopAll(): void {
    // 현재 관리 중인 오디오 중지
    this.stop()

    // 페이지의 모든 다른 오디오 요소 중지
    document.querySelectorAll('audio').forEach((audio) => {
      try {
        if (!audio.paused) {
          audio.pause()
          audio.currentTime = 0
        }
      } catch (error) {
        // 오디오 요소가 이미 파괴되었거나 상태 이상인 오류 무시
        console.warn('페이지 오디오 중지 시 오류 발생:', error)
      }
    })

    this.notifyListeners()
  }

  /**
   * 지정된 오디오가 재생 중인지 확인
   * @param audioId 오디오 고유 식별자
   */
  isPlaying(audioId: string): boolean {
    return !!(this.currentAudioId === audioId && this.currentAudio && !this.currentAudio.paused)
  }

  /**
   * 현재 재생 중인 오디오 ID 가져오기
   */
  getCurrentAudioId(): string | null {
    return this.currentAudioId
  }

  /**
   * 상태 변경 리스너 추가
   */
  addListener(callback: () => void): void {
    this.listeners.add(callback)
  }

  /**
   * 상태 변경 리스너 제거
   */
  removeListener(callback: () => void): void {
    this.listeners.delete(callback)
  }

  /**
   * 모든 리스너에게 상태 변경 알림
   */
  private notifyListeners(): void {
    this.listeners.forEach((callback) => callback())
  }
}

export const audioManager = AudioManager.getInstance()
