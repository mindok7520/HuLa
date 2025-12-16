import { useThrottleFn } from '@vueuse/core'
import type { Ref } from 'vue'

/**
 * 파형 색상 구성 인터페이스
 */
export type WaveformColors = {
  playedColor: string
  unplayedColor: string
}

/**
 * 파형 렌더러 반환 인터페이스
 */
export type WaveformRendererReturn = {
  // 상태
  waveformData: Ref<number[]>
  waveformCanvas: Ref<HTMLCanvasElement | null>
  waveformWidth: Ref<number>
  scanLinePosition: Ref<number>

  // 캐시 관리
  waveformImageCache: Ref<ImageData | null>
  shouldUpdateCache: Ref<boolean>

  // 메서드
  generateWaveformData: (audioBuffer: ArrayBuffer | Uint8Array | SharedArrayBuffer) => Promise<void>
  drawWaveform: () => void
  drawWaveformThrottled: () => void
  drawWaveformImmediate: () => void
  updateColors: (colors: WaveformColors) => void

  // 구성
  setDimensions: (width: number, height: number) => void
}

/**
 * 파형 시각화 렌더링 Hook
 * @param duration 오디오 길이 (초)
 * @param playbackProgress 재생 진행률 백분율
 * @param isDragging 드래그 중 여부
 * @param previewTime 미리보기 시간 (드래그 시 사용)
 * @param getColors 색상 구성 가져오기 함수
 * @returns 파형 렌더링 인터페이스
 */
export const useWaveformRenderer = (
  duration: Ref<number>,
  playbackProgress: Ref<number>,
  isDragging: Ref<boolean>,
  previewTime: Ref<number>,
  getColors: () => WaveformColors
): WaveformRendererReturn => {
  const waveformData = ref<number[]>([])
  const waveformCanvas = ref<HTMLCanvasElement | null>(null)
  const audioContext = ref<AudioContext | null>(null)

  const waveformImageCache = ref<ImageData | null>(null)
  const shouldUpdateCache = ref(true)
  const lastCacheKey = ref('')

  /**
   * 오디오 길이에 따라 파형 너비 계산 (최소 10px, 최대 100px)
   */
  const waveformWidth = computed(() => {
    const dur = duration.value
    const baseWidth = 10 // 기본 너비
    const maxWidth = 100 // 최대 너비
    const pixelsPerSecond = 4 // 초당 픽셀 수

    const calculatedWidth = baseWidth + dur * pixelsPerSecond
    return Math.min(maxWidth, Math.max(baseWidth, calculatedWidth))
  })

  /**
   * 너비에 따라 파형 막대 수 계산 (2픽셀당 1개)
   */
  const waveformSamples = computed(() => {
    return Math.floor(waveformWidth.value / 2)
  })

  /**
   * 스캔 라인의 정확한 위치 계산 (픽셀 위치)
   */
  const scanLinePosition = computed(() => {
    if (!waveformCanvas.value || waveformData.value.length === 0) return 0

    const canvasWidth = waveformWidth.value

    // 드래그 상태에서는 미리보기 위치 표시, 그렇지 않으면 재생 진행 위치 표시
    if (isDragging.value) {
      const progress = previewTime.value / (duration.value || 1)
      return progress * canvasWidth
    } else {
      const progress = playbackProgress.value / 100
      return progress * canvasWidth
    }
  })

  /**
   * 캐시 키 생성, 캐시 재생성 필요 여부 감지용
   */
  const generateCacheKey = (colors: WaveformColors) => {
    const playbackState = isDragging.value ? 'dragging' : 'normal'
    return `${colors.playedColor}-${colors.unplayedColor}-${playbackState}-${waveformWidth.value}-${waveformData.value.length}`
  }

  /**
   * 오디오 파형 데이터 생성
   * @param input ArrayBuffer, Uint8Array 또는 SharedArrayBuffer
   */
  const generateWaveformData = async (input: ArrayBuffer | Uint8Array | SharedArrayBuffer) => {
    try {
      // AudioContext 생성
      if (!audioContext.value) {
        audioContext.value = new (window.AudioContext || window.AudioContext)()
      }

      // arrayBuffer가 ArrayBuffer 유형인지 확인
      let arrayBuffer: ArrayBuffer
      if (input instanceof Uint8Array) {
        // buffer가 ArrayBuffer인 경우 직접 사용, 그렇지 않으면 새 ArrayBuffer 생성
        if (input.buffer instanceof ArrayBuffer) {
          arrayBuffer = input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength)
        } else {
          // SharedArrayBuffer인 경우 ArrayBuffer로 변환
          arrayBuffer = new ArrayBuffer(input.byteLength)
          new Uint8Array(arrayBuffer).set(input)
        }
      } else if (input instanceof ArrayBuffer) {
        arrayBuffer = input
      } else {
        // SharedArrayBuffer인 경우 ArrayBuffer로 변환
        arrayBuffer = new ArrayBuffer(input.byteLength)
        new Uint8Array(arrayBuffer).set(new Uint8Array(input))
      }

      // 오디오 데이터 디코딩
      const buffer = await audioContext.value.decodeAudioData(arrayBuffer)
      const channelData = buffer.getChannelData(0)
      const samples = waveformSamples.value
      const blockSize = Math.floor(channelData.length / samples)
      const waveform: number[] = []

      for (let i = 0; i < samples; i++) {
        const start = i * blockSize
        const end = start + blockSize
        let sum = 0
        let max = 0

        for (let j = start; j < end && j < channelData.length; j++) {
          const value = Math.abs(channelData[j])
          sum += value
          max = Math.max(max, value)
        }

        const rms = Math.sqrt(sum / blockSize)
        const intensity = Math.min(1, (rms + max) / 2)
        waveform.push(intensity)
      }

      waveformData.value = waveform
      shouldUpdateCache.value = true
      drawWaveform()
    } catch (error) {
      console.error('파형 데이터 생성 실패:', error)
      // 기본 파형 생성
      waveformData.value = Array.from({ length: waveformSamples.value }, () => Math.random() * 0.8 + 0.2)
      shouldUpdateCache.value = true
      drawWaveform()
    }
  }

  /**
   * 파형 그리기
   */
  const drawWaveform = () => {
    if (!waveformCanvas.value || waveformData.value.length === 0) return

    const canvas = waveformCanvas.value
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = waveformWidth.value
    const height = canvas.height
    const barWidth = width / waveformData.value.length

    // 캔버스 지우기
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // 색상 상태 가져오기
    const colors = getColors()

    // 캐시 업데이트 필요 여부 확인
    const currentCacheKey = generateCacheKey(colors)
    const needUpdateCache =
      shouldUpdateCache.value || !waveformImageCache.value || lastCacheKey.value !== currentCacheKey

    // 업데이트가 필요하거나 캐시가 없는 경우에만 정적 파형 재생성
    if (needUpdateCache) {
      // 오프스크린 캔버스를 생성하여 정적 파형 렌더링
      const offscreenCanvas = new OffscreenCanvas(width, height)
      const offscreenCtx = offscreenCanvas.getContext('2d')

      if (offscreenCtx) {
        waveformData.value.forEach((intensity, index) => {
          const x = index * barWidth
          const barHeight = Math.max(2, intensity * height * 0.8)
          const y = (height - barHeight) / 2

          offscreenCtx.fillStyle = colors.unplayedColor
          offscreenCtx.fillRect(x, y, Math.max(1, barWidth - 1), barHeight)
        })

        // 정적 파형 이미지 캐싱
        waveformImageCache.value = offscreenCtx.getImageData(0, 0, width, height)
        lastCacheKey.value = currentCacheKey
        shouldUpdateCache.value = false
      }
    }

    // 캐시된 정적 파형 그리기
    if (waveformImageCache.value) {
      ctx.putImageData(waveformImageCache.value, 0, 0)
    }

    // 재생 진행률에 따라 재생된 부분 그리기 (동적 레이어)
    const progress = isDragging.value ? previewTime.value / (duration.value || 1) : playbackProgress.value / 100
    const progressX = progress * width

    if (progressX > 0) {
      try {
        const startBarIndex = 0
        const endBarIndex = Math.ceil(progressX / barWidth)

        for (let index = startBarIndex; index < endBarIndex && index < waveformData.value.length; index++) {
          const intensity = waveformData.value[index]
          const x = index * barWidth

          // 진행 라인 왼쪽에 있는 부분만 그리기
          const barRight = x + Math.max(1, barWidth - 1)
          if (barRight <= progressX) {
            const barHeight = Math.max(2, intensity * height * 0.8)
            const y = (height - barHeight) / 2

            ctx.fillStyle = colors.playedColor
            ctx.fillRect(x, y, Math.max(1, barWidth - 1), barHeight)
          } else if (x < progressX) {
            // 일부가 진행 라인 왼쪽에 있는 막대
            const barHeight = Math.max(2, intensity * height * 0.8)
            const y = (height - barHeight) / 2
            const clippedWidth = progressX - x

            ctx.fillStyle = colors.playedColor
            ctx.fillRect(x, y, clippedWidth, barHeight)
          }
        }
      } catch (error) {
        console.error('재생 진행률 그리기 실패:', error)
      }
    }
  }

  /**
   * 스로틀링된 파형 그리기 (재생 진행률 업데이트용)
   */
  const drawWaveformThrottled = useThrottleFn(() => {
    if (!isDragging.value) {
      drawWaveform()
    }
  }, 16)

  /**
   * 즉시 파형 그리기 (드래그 시 실시간 응답용)
   */
  const drawWaveformImmediate = () => {
    drawWaveform()
  }

  /**
   * 색상 구성 업데이트 및 다시 그리기
   * @param colors 새 색상 구성
   */
  const updateColors = (_colors: WaveformColors) => {
    shouldUpdateCache.value = true
    drawWaveform()
  }

  /**
   * Canvas 크기 설정
   * @param width 너비
   * @param height 높이
   */
  const setDimensions = (width: number, height: number) => {
    if (waveformCanvas.value) {
      waveformCanvas.value.width = width
      waveformCanvas.value.height = height
      shouldUpdateCache.value = true
      drawWaveform()
    }
  }

  // 재생 진행률 변화 감지하여 파형 다시 그리기 (스로틀링 처리)
  watch(playbackProgress, () => {
    drawWaveformThrottled()
  })

  // 드래그 상태 변화 감지하여 파형 다시 그리기
  watch(isDragging, () => {
    shouldUpdateCache.value = true
    drawWaveform()
  })

  // 파형 데이터 변화 감지
  watch(waveformData, () => {
    shouldUpdateCache.value = true
    drawWaveform()
  })

  // 크기 변화 감지
  watch(waveformWidth, () => {
    shouldUpdateCache.value = true
    if (waveformCanvas.value) {
      waveformCanvas.value.width = waveformWidth.value
      drawWaveform()
    }
  })

  return {
    // 상태
    waveformData,
    waveformCanvas,
    waveformWidth,
    scanLinePosition,

    // 캐시 관리
    waveformImageCache,
    shouldUpdateCache,

    // 메서드
    generateWaveformData,
    drawWaveform,
    drawWaveformThrottled,
    drawWaveformImmediate,
    updateColors,

    // 구성
    setDimensions
  }
}
