<template>
  <div class="size-full bg-#000 relative flex flex-col select-none">
    <!-- 상단 작업 표시줄 -->
    <ActionBar class="bg-#000 z-9999" :shrink="false" :current-label="currentLabel" />

    <!-- 본문 내용 영역 -->
    <div class="flex-1 overflow-auto">
      <!-- 비디오 표시 영역 -->
      <div style="min-height: calc(100vh / var(--page-scale, 1) - 124px)" class="flex-center w-full h-full">
        <video
          ref="videoRef"
          :src="currentVideo"
          controls
          :class="videoClass"
          :style="videoStyle"
          @loadeddata="onVideoLoaded"
          @ended="onVideoEnded"
          @pause="onVideoPaused"
          @play="onVideoPlay"
          alt="preview" />

        <!-- 팁 텍스트 -->
        <transition name="viewer-tip">
          <div
            v-if="showTip"
            class="fixed z-10 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/60 px-24px py-12px rounded-8px text-(white 14px) transition-all duration-300 backdrop-blur-sm select-none flex items-center gap-8px">
            <svg class="size-16px"><use href="#info"></use></svg>
            {{ tipText }}
          </div>
        </transition>
      </div>
    </div>

    <!-- 하단 툴바 -->
    <div data-tauri-drag-region class="z-9999 h-50px bg-#000 flex justify-center items-center gap-20px">
      <!-- 이전 동영상 -->
      <n-tooltip placement="top">
        <template #trigger>
          <div
            @click="previousVideo"
            class="bottom-operation"
            :class="canGoPrevious ? 'cursor-pointer hover:bg-gray-600/50' : 'cursor-not-allowed'">
            <svg
              class="size-20px rotate-180"
              :class="canGoPrevious ? 'color-white' : 'color-gray-500 cursor-not-allowed'">
              <use href="#right"></use>
            </svg>
          </div>
        </template>
        {{ t('message.video_viewer.previous_video') }}
      </n-tooltip>

      <n-tooltip placement="top">
        <template #trigger>
          <div @click="playPause" class="bottom-operation">
            <svg class="size-20px color-white">
              <use :href="isPlaying ? '#pause-one' : '#play'"></use>
            </svg>
          </div>
        </template>
        {{ isPlaying ? t('message.video_viewer.pause') : t('message.video_viewer.play') }}
      </n-tooltip>

      <n-tooltip placement="top">
        <template #trigger>
          <div @click="muteUnmute" class="bottom-operation">
            <svg class="size-20px color-white">
              <use :href="isMuted ? '#volume-mute' : '#volume-notice'"></use>
            </svg>
          </div>
        </template>
        {{ isMuted ? t('message.video_viewer.unmute') : t('message.video_viewer.mute') }}
      </n-tooltip>

      <!-- 다음 동영상 -->
      <n-tooltip placement="top">
        <template #trigger>
          <div @click="nextVideo" class="bottom-operation">
            <svg class="size-20px" :class="canGoNext ? 'color-white' : 'color-gray-500 cursor-not-allowed'">
              <use href="#right"></use>
            </svg>
          </div>
        </template>
        {{ t('message.video_viewer.next_video') }}
      </n-tooltip>
    </div>
  </div>
</template>

<script setup lang="ts">
import { convertFileSrc } from '@tauri-apps/api/core'
import { dirname, join } from '@tauri-apps/api/path'
import { getCurrentWebviewWindow, WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { readDir } from '@tauri-apps/plugin-fs'
import ActionBar from '@/components/windows/ActionBar.vue'
import { useTauriListener } from '@/hooks/useTauriListener'
import { useVideoViewer } from '@/stores/videoViewer.ts'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const { addListener } = useTauriListener()
const videoViewerStore = useVideoViewer()
const appWindow = WebviewWindow.getCurrent()
// 지원되는 비디오 파일 확장자
const supportedVideoExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv', '.webm', '.m4v']

// 데이터 초기화
const videoList = ref<string[]>([])

const currentLabel = WebviewWindow.getCurrent().label
const currentIndex = ref(0)
const isPlaying = ref(false)
const isMuted = ref(false)
const videoRef = ref<HTMLVideoElement>()
const showTip = ref(false)
const tipText = ref('')
const videoWidth = ref(0)
const videoHeight = ref(0)

// 현재 표시되는 비디오 URL (목록 모드 통일 사용)
const currentVideo = computed(() => {
  const videoUrl = videoList.value[currentIndex.value] || ''

  // 로컬 파일 경로인 경우 Tauri의 convertFileSrc를 사용하여 변환
  if (videoUrl && !videoUrl.startsWith('http')) {
    return convertFileSrc(videoUrl)
  }
  return videoUrl
})

// 비디오 스타일 클래스
const videoClass = computed(() => 'w-full h-full object-contain')

const videoStyle = computed(() => {
  const style: Record<string, string> = {
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain'
  }
  if (videoWidth.value > 0 && videoHeight.value > 0) {
    style.width = `${videoWidth.value}px`
    style.height = `${videoHeight.value}px`
  }
  return style
})

// 이전 동영상으로 전환 가능 여부
const canGoPrevious = computed(() => {
  if (videoList.value.length <= 1) return false

  const currentVideoPath = videoList.value[currentIndex.value]
  if (!currentVideoPath || currentVideoPath.startsWith('http')) {
    // 네트워크 비디오: 첫 번째가 아닌지 확인
    return currentIndex.value > 0
  }

  // 로컬 비디오: 항상 true 반환, 구체적인 판단은 클릭 시 수행
  return true
})

// 다음 동영상으로 전환 가능 여부
const canGoNext = computed(() => {
  if (videoList.value.length <= 1) return false

  const currentVideoPath = videoList.value[currentIndex.value]
  if (!currentVideoPath || currentVideoPath.startsWith('http')) {
    // 네트워크 비디오: 마지막이 아닌지 확인
    return currentIndex.value < videoList.value.length - 1
  }

  // 로컬 비디오: 항상 true 반환, 구체적인 판단은 클릭 시 수행
  return true
})

// 파일이 비디오 파일인지 확인
const isVideoFile = (filename: string) => {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'))
  return supportedVideoExtensions.includes(ext)
}

// 현재 비디오가 있는 폴더의 모든 비디오 파일 가져오기
const getVideosFromCurrentFolder = async (currentVideoPath: string) => {
  try {
    if (!currentVideoPath || currentVideoPath.startsWith('http')) {
      return []
    }

    const folderPath = await dirname(currentVideoPath)

    // 절대 경로를 사용하여 디렉토리 읽기
    const entries = await readDir(folderPath)

    const videoFiles = await Promise.all(
      entries
        .filter((entry) => entry.isFile && isVideoFile(entry.name))
        .map(async (entry) => await join(folderPath, entry.name))
    )

    return videoFiles.sort() // 파일명으로 정렬
  } catch (error) {
    console.warn('폴더 비디오 파일 가져오기 실패:', error)
    return []
  }
}

// 비디오 재생/일시정지
const playPause = () => {
  if (videoRef.value) {
    if (videoRef.value.paused) {
      videoRef.value
        .play()
        .then(() => {
          isPlaying.value = true
        })
        .catch((error) => {
          console.warn('비디오 재생 실패:', error)
          isPlaying.value = false
        })
    } else {
      videoRef.value.pause()
      isPlaying.value = false
    }
  }
}

// 음소거/음소거 해제
const muteUnmute = () => {
  if (videoRef.value) {
    videoRef.value.muted = !videoRef.value.muted
    isMuted.value = videoRef.value.muted
  }
}

// 비디오 자동 재생
const onVideoLoaded = () => {
  if (videoRef.value) {
    // 비디오 원본 크기 가져오기
    videoWidth.value = videoRef.value.videoWidth
    videoHeight.value = videoRef.value.videoHeight

    videoRef.value
      .play()
      .then(() => {
        isPlaying.value = true
      })
      .catch((error) => {
        console.warn('자동 재생 실패, 사용자 상호 작용이 필요할 수 있음:', error)
        isPlaying.value = false
      })
  }
}

// 비디오 재생 종료 이벤트
const onVideoEnded = () => {
  isPlaying.value = false
  // 재생 종료 시 자동으로 다음으로 넘어가지 않음
  if (videoRef.value) {
    videoRef.value.currentTime = videoRef.value.duration
  }
}

// 비디오 일시정지 이벤트
const onVideoPaused = () => {
  isPlaying.value = false
}

// 비디오 재생 이벤트
const onVideoPlay = () => {
  isPlaying.value = true
}

// 이전 동영상으로 전환
const previousVideo = async () => {
  if (!canGoPrevious.value) return

  const currentVideoPath = videoList.value[currentIndex.value]
  if (!currentVideoPath || currentVideoPath.startsWith('http')) {
    // 네트워크 비디오인 경우 기존 로직 사용
    currentIndex.value--
    showVideoTip(t('message.video_viewer.tip_playing_index', { index: currentIndex.value + 1 }))
  } else {
    // 로컬 비디오인 경우 폴더에서 비디오 목록 가져오기
    const folderVideos = await getVideosFromCurrentFolder(currentVideoPath)
    if (folderVideos.length > 0) {
      const currentVideoIndex = folderVideos.indexOf(currentVideoPath)
      if (currentVideoIndex > 0) {
        const previousVideoPath = folderVideos[currentVideoIndex - 1]
        videoList.value[currentIndex.value] = previousVideoPath
        showVideoTip(t('message.video_viewer.tip_playing_previous'))
      } else {
        showVideoTip(t('message.video_viewer.tip_first'))
        return
      }
    } else {
      // 폴더 비디오 가져오기 실패 시 기존 로직 사용
      currentIndex.value--
      showVideoTip(t('message.video_viewer.tip_playing_index', { index: currentIndex.value + 1 }))
    }
  }

  nextTick(() => {
    if (videoRef.value) {
      videoRef.value.load()
      videoRef.value
        .play()
        .then(() => {
          isPlaying.value = true
        })
        .catch((error) => {
          console.warn('비디오 재생 실패:', error)
          isPlaying.value = false
        })
    }
  })
}

// 다음 동영상으로 전환
const nextVideo = async () => {
  if (!canGoNext.value) return

  const currentVideoPath = videoList.value[currentIndex.value]
  if (!currentVideoPath || currentVideoPath.startsWith('http')) {
    // 네트워크 비디오인 경우 기존 로직 사용
    currentIndex.value++
    showVideoTip(t('message.video_viewer.tip_playing_index', { index: currentIndex.value + 1 }))
  } else {
    // 로컬 비디오인 경우 폴더에서 비디오 목록 가져오기
    const folderVideos = await getVideosFromCurrentFolder(currentVideoPath)
    if (folderVideos.length > 0) {
      const currentVideoIndex = folderVideos.indexOf(currentVideoPath)
      if (currentVideoIndex < folderVideos.length - 1) {
        const nextVideoPath = folderVideos[currentVideoIndex + 1]
        videoList.value[currentIndex.value] = nextVideoPath
        showVideoTip(t('message.video_viewer.tip_playing_next'))
      } else {
        showVideoTip(t('message.video_viewer.tip_last'))
        return
      }
    } else {
      // 폴더 비디오 가져오기 실패 시 기존 로직 사용
      currentIndex.value++
      showVideoTip(t('message.video_viewer.tip_playing_index', { index: currentIndex.value + 1 }))
    }
  }

  nextTick(() => {
    if (videoRef.value) {
      videoRef.value.load()
      videoRef.value
        .play()
        .then(() => {
          isPlaying.value = true
        })
        .catch((error) => {
          console.warn('비디오 재생 실패:', error)
          isPlaying.value = false
        })
    }
  })
}

// 팁 메시지 표시
const showVideoTip = (message: string) => {
  tipText.value = message
  showTip.value = true
  setTimeout(() => {
    showTip.value = false
  }, 2000)
}

onMounted(async () => {
  await getCurrentWebviewWindow().show()

  // 이벤트 이름을 발신 측과 일치하도록 수정
  await addListener(
    appWindow.listen('video-updated', (event: any) => {
      const { list, index } = event.payload
      videoList.value = list
      currentIndex.value = index
      nextTick(() => {
        if (videoRef.value) {
          videoRef.value.load()
          videoRef.value.play().catch((error) => {
            console.warn('비디오 재생 실패:', error)
            isPlaying.value = false
          })
        }
      })
    }),
    'video-updated'
  )

  // 목록 모드로 통일하여 초기화
  const validIndex = Math.min(Math.max(videoViewerStore.currentVideoIndex, 0), videoViewerStore.videoList.length - 1)
  videoList.value = [...videoViewerStore.videoList]
  currentIndex.value = validIndex
})
</script>

<style scoped>
.bottom-operation {
  @apply flex-center px-8px py-7px rounded-8px cursor-pointer hover:bg-gray-600/50 transition-colors duration-300;
}

/* 사용자 정의 스크롤바 스타일 */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

/* ActionBar의 svg 색상을 수정하려면 다음 스타일을 추가하세요 */
:deep(.action-close),
:deep(.hover-box) {
  svg {
    color: #fff !important;
  }
}
</style>
