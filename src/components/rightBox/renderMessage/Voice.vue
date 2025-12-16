<template>
  <div
    class="voice-container select-none cursor-pointer"
    :class="{ playing: audioPlayback.isPlaying.value, loading: audioPlayback.loading.value }"
    @click="audioPlayback.togglePlayback">
    <!-- 음성 아이콘 -->
    <div class="voice-icon select-none cursor-pointer">
      <img
        v-if="audioPlayback.loading.value"
        class="loading-icon"
        :style="{ color: voiceIconColor }"
        src="@/assets/img/loading.svg"
        alt="loading" />
      <svg v-else-if="audioPlayback.isPlaying.value" :style="{ color: voiceIconColor }">
        <use href="#pause-one"></use>
      </svg>
      <svg v-else :style="{ color: voiceIconColor }">
        <use href="#play"></use>
      </svg>
    </div>

    <!-- 음파 파형 -->
    <div
      class="waveform-container select-none cursor-pointer"
      :style="{ width: `${waveformRenderer.waveformWidth.value}px` }">
      <canvas
        ref="waveformCanvas"
        class="waveform-canvas"
        :style="{ color: voiceIconColor }"
        :width="waveformRenderer.waveformWidth.value"
        height="24"
        @click.stop="handleSeekToPosition"
        @mousedown.stop="dragControl.handleDragStart"
        @touchstart.stop="dragControl.handleDragStart"
        @pointerdown.stop></canvas>
      <div
        class="scan-line"
        :class="{ active: audioPlayback.isPlaying.value, dragging: dragControl.isDragging.value }"
        :style="{
          left: `${waveformRenderer.scanLinePosition.value}px`,
          background: `linear-gradient(to bottom, transparent, ${voiceIconColor}, transparent)`,
          boxShadow:
            audioPlayback.isPlaying.value || dragControl.isDragging.value ? `0 0 8px ${voiceIconColor}50` : 'none'
        }"></div>

      <!-- 시간 미리보기 팁 -->
      <div
        v-if="dragControl.showTimePreview.value"
        class="time-preview"
        :style="{
          left: `${waveformRenderer.scanLinePosition.value}px`,
          color: isCurrentUser ? '#fff' : isDarkMode ? '#fff' : '#000',
          backgroundColor: isCurrentUser ? '#303030' : isDarkMode ? '#303030' : '#fff',
          border: isCurrentUser ? 'none' : isDarkMode ? '1px solid #505050' : '1px solid #d0d0d0'
        }">
        {{ formatTime(dragControl.previewTime.value) }}
      </div>
    </div>

    <!-- 음성 길이 -->
    <div class="voice-second select-none cursor-pointer" :style="{ color: voiceIconColor }">
      {{ formatTime(second) }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { ThemeEnum } from '@/enums'
import { useAudioFileManager } from '@/hooks/useAudioFileManager'
import { useAudioPlayback } from '@/hooks/useAudioPlayback'
import { useVoiceDragControl } from '@/hooks/useVoiceDragControl'
import { useWaveformRenderer } from '@/hooks/useWaveformRenderer'
import type { VoiceBody } from '@/services/types'
import { useSettingStore } from '@/stores/setting'
import { useUserStore } from '@/stores/user'

const props = defineProps<{
  body: VoiceBody
  fromUserUid: string
}>()

const settingStore = useSettingStore()
const userStore = useUserStore()
const { themes } = storeToRefs(settingStore)

// messageId를 오디오 ID로 사용하여 고유성 보장
const audioId = props.body.url
const waveformCanvas = ref<HTMLCanvasElement | null>(null)

// 다크 모드 여부 확인
const isDarkMode = computed(() => {
  return themes.value.content === ThemeEnum.DARK
})

// 현재 사용자가 보낸 메시지인지 확인
const isCurrentUser = computed(() => {
  return props.fromUserUid === userStore.userInfo?.uid
})

// 음성 아이콘 색상 계산
const voiceIconColor = computed(() => {
  if (isCurrentUser.value) {
    return '#fff'
  } else {
    return isDarkMode.value ? '#fff' : '#000'
  }
})

// 오디오 길이
const second = computed(() => props.body.second || 0)
// 오디오 파일 관리
const fileManager = useAudioFileManager(userStore.userInfo?.uid as string)
// 오디오 재생 제어
const audioPlayback = useAudioPlayback(audioId, (_currentTime: number, _progress: number) => {
  // 시간 업데이트 콜백, 파형 다시 그리기용
  waveformRenderer.drawWaveformThrottled()
})

// 드래그 제어
const dragControl = useVoiceDragControl(
  waveformCanvas,
  second,
  audioPlayback.isPlaying,
  (time: number) => {
    audioPlayback.seekToTime(time)
    waveformRenderer.drawWaveformImmediate()
  },
  async (shouldPlay: boolean) => {
    if (shouldPlay) {
      await audioPlayback.togglePlayback()
    } else {
      if (audioPlayback.audioElement.value) {
        audioPlayback.audioElement.value.pause()
        audioPlayback.isPlaying.value = false
      }
    }
  }
)

// 파형 렌더링
const waveformRenderer = useWaveformRenderer(
  second,
  audioPlayback.playbackProgress,
  dragControl.isDragging,
  dragControl.previewTime,
  () => getWaveformColors()
)

// 파형 색상 상태 계산
const getWaveformColors = () => {
  const baseColor = isCurrentUser.value ? '#ffffff' : isDarkMode.value ? '#ffffff' : '#000000'

  // 재생된 영역 색상 (항상 완전 불투명)
  const playedColor = baseColor

  // 미재생 영역 색상 (재생 상태에 따라 투명도 조정)
  let unplayedOpacity: number
  if (audioPlayback.isPlaying.value || dragControl.isDragging.value) {
    unplayedOpacity = 0.3
  } else {
    unplayedOpacity = 1.0
  }

  const unplayedColor = `${baseColor}${Math.round(unplayedOpacity * 255)
    .toString(16)
    .padStart(2, '0')}`

  return { playedColor, unplayedColor }
}

// 시간 형식화
const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// 파형 클릭 시 지정된 위치로 이동
const handleSeekToPosition = (event: MouseEvent) => {
  if (!audioPlayback.audioElement.value || !waveformCanvas.value || dragControl.isDragging.value) return

  const rect = waveformCanvas.value.getBoundingClientRect()
  const clickX = event.clientX - rect.left
  const progress = Math.max(0, Math.min(1, clickX / rect.width))
  const targetTime = progress * audioPlayback.audioElement.value.duration

  audioPlayback.seekToTime(targetTime)
  waveformRenderer.drawWaveformImmediate()
}

watch(isDarkMode, () => {
  waveformRenderer.shouldUpdateCache.value = true
  waveformRenderer.drawWaveform()
})

watch(audioPlayback.isPlaying, () => {
  waveformRenderer.shouldUpdateCache.value = true
  waveformRenderer.drawWaveform()
})

// 컴포넌트 마운트
onMounted(async () => {
  try {
    // Canvas 참조 설정
    waveformRenderer.waveformCanvas.value = waveformCanvas.value

    // 오디오 파형 데이터 로드
    const audioBuffer = await fileManager.loadAudioWaveform(props.body.url)
    await waveformRenderer.generateWaveformData(audioBuffer)

    // 오디오 요소 생성
    const audioUrl = await fileManager.getAudioUrl(props.body.url)
    await audioPlayback.createAudioElement(audioUrl, audioId, second.value)
  } catch (error) {
    console.error('컴포넌트 초기화 실패:', error)
  }
})
onUnmounted(() => {
  audioPlayback.cleanup()
  dragControl.cleanup()
  fileManager.cleanup()
})
</script>

<style scoped lang="scss">
.voice-container {
  display: flex;
  align-items: center;
  gap: 12px;
  border-radius: 18px;
  cursor: pointer;
  transition: all 0.2s ease;
  &.loading {
    cursor: wait;
    opacity: 0.7;
  }
}

.voice-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-color, #333);

  svg {
    width: 18px;
    height: 18px;

    &.loading-icon {
      animation: spin 1s linear infinite;
    }
  }
}

.waveform-container {
  position: relative;
  height: 24px;
  display: flex;
  align-items: center;
  cursor: pointer;
  // 터치 영역 확장 (모바일 최적화)
  padding: 4px 0;
  margin: -4px 0;

  .waveform-canvas {
    width: 100%;
    height: 100%;
    border-radius: 4px;
    user-select: none;
    -webkit-user-select: none;
  }

  .scan-line {
    position: absolute;
    top: 0;
    width: 2px;
    height: 100%;
    border-radius: 1px;
    opacity: 0;
    transition: all 0.1s ease;
    pointer-events: none;
    z-index: 1;

    &.active {
      opacity: 0.8;
    }

    &.dragging {
      opacity: 1;
      width: 4px; // 드래그 시 넓게
      transition: none; // 전환 효과 비활성화, 즉각적인 반응 구현
    }
  }

  .time-preview {
    position: absolute;
    top: -28px;
    transform: translateX(-50%);
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    white-space: nowrap;
    pointer-events: none;
    z-index: 2;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    animation: fadeIn 0.2s ease;
  }
}

.voice-second {
  font-size: 12px;
  white-space: nowrap;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@keyframes fadeIn {
  0% {
    opacity: 0;
    transform: translateX(-50%) translateY(-4px);
  }
  100% {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}
</style>
