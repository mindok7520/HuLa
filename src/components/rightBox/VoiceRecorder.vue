<template>
  <div class="voice-recorder-container">
    <!-- 녹음 상태 표시 -->
    <div class="voice-recorder-main">
      <!-- 녹음 상태 텍스트 -->
      <div class="voice-status">
        <div v-if="!isRecording && !audioBlob && !isProcessing">
          <span class="text-#909090 flex-y-center gap-6px select-none">
            {{ t('message.voice_recorder.tap_prefix') }}
            <svg class="size-14px color-#13987f"><use href="#voice"></use></svg>
            {{ t('message.voice_recorder.tap_suffix') }}
          </span>
        </div>

        <div v-if="isRecording" class="status-recording">
          <div class="recording-animation">
            <div class="pulse-dot"></div>
          </div>
          <span>{{ formatTime(recordingTime) }} {{ t('message.voice_recorder.recording') }}</span>
        </div>

        <div v-if="!isRecording && isProcessing" class="status-processing">
          <div class="processing-animation">
            <div class="loading-spinner"></div>
          </div>
          <span>{{ t('message.voice_recorder.processing') }}</span>
        </div>

        <div v-if="!isRecording && audioBlob && !isProcessing" class="status-completed">
          <div class="playback-controls">
            <button @click="togglePlayback" class="play-btn">
              <svg v-if="!isPlaying" viewBox="0 0 24 24">
                <path fill="currentColor" d="M8,5.14V19.14L19,12.14L8,5.14Z" />
              </svg>
              <svg v-else viewBox="0 0 24 24">
                <path fill="currentColor" d="M14,19H18V5H14M6,19H10V5H6V19Z" />
              </svg>
            </button>
            <span>{{ formatTime(recordingDuration) }}</span>
          </div>
        </div>
      </div>

      <!-- 녹음 제어 버튼 -->
      <div class="voice-controls">
        <!-- 녹음 대기 상태 -->
        <div v-if="!isRecording && !audioBlob && !isProcessing" class="controls-idle">
          <div
            @mousedown="startRecording"
            @mouseup="stopRecording"
            @mouseleave="stopRecording"
            @touchstart="startRecording"
            @touchend="stopRecording"
            class="record-btn">
            <svg><use href="#voice"></use></svg>
          </div>
          <div @click="handleCancel" class="cancel-btn">
            <svg><use href="#close"></use></svg>
          </div>
        </div>

        <!-- 녹음 중 상태 -->
        <div v-if="isRecording" class="controls-recording">
          <div @click="stopRecording" class="stop-btn">
            <svg viewBox="0 0 24 24">
              <path fill="currentColor" d="M18,18H6V6H18V18Z" />
            </svg>
          </div>
          <div @click="cancelRecording" class="cancel-record-btn">
            <svg><use href="#close"></use></svg>
          </div>
        </div>

        <!-- 처리 중 상태 -->
        <div v-if="!isRecording && isProcessing" class="controls-processing">
          <!-- <div @click="handleCancel" class="cancel-btn">
            <svg><use href="#close"></use></svg>
          </div> -->
        </div>

        <!-- 녹음 완료 상태 -->
        <div v-if="!isRecording && audioBlob && !isProcessing" class="controls-completed">
          <div @click="reRecord" class="refresh-btn">
            <svg><use href="#refresh"></use></svg>
          </div>
          <div @click="handleSend" class="send-btn" :disabled="sending">
            <svg v-if="!sending"><use href="#send"></use></svg>
            <div v-else class="loading-spinner"></div>
          </div>
          <div @click="handleCancel" class="cancel-btn">
            <svg><use href="#close"></use></svg>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useVoiceRecordRust } from '@/hooks/useVoiceRecordRust'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

// 이벤트 정의
const emit = defineEmits<{
  cancel: []
  send: [voiceData: any]
}>()

// 녹음 상태
const audioBlob = ref<Blob | null>(null)
const recordingDuration = ref(0)
const sending = ref(false)
const localAudioPath = ref<string>('')

// 재생 상태
const isPlaying = ref(false)
const isProcessing = ref(false)
const audioElement = ref<HTMLAudioElement | null>(null)

// 음성 녹음 기능
const {
  isRecording,
  recordingTime,
  startRecording: startRecord,
  stopRecording: stopRecord,
  cancelRecording: cancelRecord,
  formatTime
} = useVoiceRecordRust({
  onStart: () => {
    console.log('녹음 시작')
  },
  onStop: (blob, duration, localPath) => {
    console.log('녹음 종료', duration, '로컬 경로:', localPath)
    audioBlob.value = blob
    recordingDuration.value = duration
    localAudioPath.value = localPath
    isProcessing.value = false
    createAudioElement()
  },
  onError: () => {
    window.$message?.error(t('message.voice_recorder.error'))
    isProcessing.value = false
  }
})

// 녹음 시작
const startRecording = async () => {
  await startRecord()
}

// 녹음 중지
const stopRecording = async () => {
  if (isRecording.value) {
    isProcessing.value = true
  }
  await stopRecord()
}

// 녹음 상태 초기화
const resetRecordingState = () => {
  // 오디오 플레이어 정리
  if (audioElement.value) {
    audioElement.value.pause()
    if (audioElement.value.src) {
      URL.revokeObjectURL(audioElement.value.src)
    }
    audioElement.value = null
  }

  // 모든 상태 초기화
  audioBlob.value = null
  recordingDuration.value = 0
  localAudioPath.value = ''
  isPlaying.value = false
  isProcessing.value = false
}

// 녹음 취소
const cancelRecording = () => {
  cancelRecord()
  audioBlob.value = null
  recordingDuration.value = 0
  isProcessing.value = false
}

// 재녹음
const reRecord = () => {
  resetRecordingState()
}

// 재생용 오디오 요소 생성
const createAudioElement = () => {
  if (audioBlob.value) {
    const url = URL.createObjectURL(audioBlob.value)
    audioElement.value = new Audio(url)

    audioElement.value.addEventListener('ended', () => {
      isPlaying.value = false
    })
  }
}

// 재생 상태 전환
const togglePlayback = () => {
  if (audioElement.value) {
    if (isPlaying.value) {
      audioElement.value.pause()
    } else {
      audioElement.value.play()
    }
    isPlaying.value = !isPlaying.value
  }
}

// 음성 전송
const handleSend = async () => {
  if (!audioBlob.value || !localAudioPath.value) {
    console.log('🎤 오디오 데이터 없음, 전송 취소')
    return
  }

  try {
    sending.value = true

    // 로컬 경로를 직접 사용, 파일 재업로드 불필요
    // 다른 파일 전송 로직과 일관성 유지 (먼저 로컬에 캐시 후 처리)
    const voiceData = {
      localPath: localAudioPath.value,
      size: audioBlob.value.size,
      duration: recordingDuration.value,
      filename: `voice_${Date.now()}.mp3`,
      type: 'audio/mp3'
    }

    console.log('🎤 음성 데이터 전송:', voiceData)
    emit('send', voiceData)

    // 전송 후 즉시 상태 초기화하여 다음에 열 때 이 녹음이 표시되지 않도록 함
    resetRecordingState()
  } catch (error) {
    console.error('🎤 음성 전송 실패:', error)
  } finally {
    sending.value = false
  }
}

// 취소/닫기
const handleCancel = () => {
  // 리소스 정리
  if (audioElement.value) {
    audioElement.value.pause()
    URL.revokeObjectURL(audioElement.value.src)
  }

  emit('cancel')
}

// 라이프사이클
onUnmounted(() => {
  if (audioElement.value) {
    audioElement.value.pause()
    URL.revokeObjectURL(audioElement.value.src)
  }
})
</script>

<style scoped lang="scss">
@mixin base-control-button($dark-bg, $bg) {
  @apply flex-center size-36px text-#fff cursor-pointer rounded-full;
  background-color: $bg;
  [data-theme='dark'] & {
    background-color: $dark-bg;
  }
}

.voice-recorder-container {
  @apply flex flex-col relative w-full h-110px bg-[--bg-color] rounded-8px;
}

.voice-recorder-main {
  @apply flex flex-col items-center justify-center h-full gap-22px;
}

.voice-status {
  @apply text-(14px [--text-color] center) max-h-24px;

  .status-recording {
    @apply flex-y-center gap-8px text-#13987f select-none;

    .recording-animation {
      position: relative;
      .pulse-dot {
        @apply size-8px bg-#13987f rounded-full;
        animation: pulse 1.5s infinite;
      }
    }
  }

  .status-processing {
    @apply flex-y-center gap-8px text-[--chat-text-color] select-none;

    .processing-animation {
      position: relative;
      .loading-spinner {
        @apply size-12px rounded-full;
        border: 2px solid transparent;
        border-top: 2px solid var(--chat-text-color);
        animation: spin 1s linear infinite;
      }
    }
  }

  .status-completed {
    .playback-controls {
      @apply flex-y-center gap-8px;

      .play-btn {
        @apply flex-center size-30px bg-inherit border-none cursor-pointer text-#13987f;

        svg {
          @apply size-16px;
        }

        &:hover {
          opacity: 0.8;
        }
      }
    }
  }
}

.voice-controls {
  @apply flex-center gap-16px;

  .controls-idle,
  .controls-recording,
  .controls-processing,
  .controls-completed {
    @apply flex-y-center gap-12px;
  }

  svg {
    @apply size-18px;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .record-btn {
    @include base-control-button(#13987f80, #13987f);
  }

  .stop-btn {
    @include base-control-button(#e74c3c96, #e74c3c);
  }

  .refresh-btn {
    @include base-control-button(#f39c1280, #f39c12);
  }

  .send-btn {
    @include base-control-button(#13987f80, #13987f);

    .loading-spinner {
      @apply size-16px rounded-full;
      border: 2px solid transparent;
      border-top: 2px solid currentColor;
      animation: spin 1s linear infinite;
    }
  }

  .cancel-btn,
  .cancel-record-btn {
    @include base-control-button(#95a5a640, #95a5a690);
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(1.2);
  }
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
