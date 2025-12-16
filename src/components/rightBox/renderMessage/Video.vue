<template>
  <div ref="videoContainerRef" :style="containerStyle" @dblclick="handleOpenVideoViewer">
    <n-image
      v-if="body?.thumbUrl"
      class="video-thumbnail"
      object-fit="cover"
      show-toolbar-tooltip
      preview-disabled
      :img-props="{
        style: {
          ...imageStyle
        }
      }"
      :src="displayThumbSrc"
      @load="handleImageLoad"
      @error="handleImageError">
      <template #placeholder>
        <n-flex
          v-if="!isError"
          align="center"
          justify="center"
          :style="{
            width: `${imageStyle.width}`,
            height: `${imageStyle.height}`,
            backgroundColor: '#c8c8c833'
          }"
          class="rounded-10px">
          <img class="size-24px select-none" src="@/assets/img/loading.svg" alt="loading" />
        </n-flex>
      </template>
      <template #error>
        <n-flex v-if="isError" align="center" justify="center" class="w-200px h-150px bg-#c8c8c833 rounded-10px">
          <svg class="size-34px color-[--chat-text-color]"><use href="#error-picture"></use></svg>
        </n-flex>
      </template>
    </n-image>

    <!-- 비디오 오버레이 -->
    <div class="video-overlay">
      <!-- 재생/다운로드 버튼 -->
      <div
        class="play-button"
        @click="handlePlayButtonClick"
        :class="{ loading: isOpening || isDownloading || isUploading }">
        <!-- 업로드 중 진행률 표시 -->
        <div v-if="isUploading" class="upload-progress">
          <div class="progress-circle">
            <svg class="progress-ring" width="44" height="44">
              <circle
                class="progress-ring-circle"
                stroke="rgba(255,255,255,0.3)"
                stroke-width="3"
                fill="transparent"
                r="18"
                cx="22"
                cy="22" />
              <circle
                class="progress-ring-circle progress-ring-fill"
                stroke="#13987f"
                stroke-width="3"
                fill="transparent"
                r="18"
                cx="22"
                cy="22"
                :stroke-dasharray="`${2 * Math.PI * 18}`"
                :stroke-dashoffset="`${2 * Math.PI * 18 * (1 - uploadProgress / 100)}`" />
            </svg>
            <svg class="upload-icon"><use href="#Importing"></use></svg>
          </div>
        </div>
        <!-- 다운로드 중 진행률 표시 -->
        <div v-else-if="isDownloading" class="download-progress">
          <div class="progress-circle">
            <svg class="progress-ring" width="44" height="44">
              <circle
                class="progress-ring-circle"
                stroke="rgba(255,255,255,0.3)"
                stroke-width="3"
                fill="transparent"
                r="18"
                cx="22"
                cy="22" />
              <circle
                class="progress-ring-circle progress-ring-fill"
                stroke="white"
                stroke-width="3"
                fill="transparent"
                r="18"
                cx="22"
                cy="22"
                :stroke-dasharray="`${2 * Math.PI * 18}`"
                :stroke-dashoffset="`${2 * Math.PI * 18 * (1 - process / 100)}`" />
            </svg>
            <svg class="download-icon"><use href="#arrow-down"></use></svg>
          </div>
        </div>
        <!-- 여는 중 로딩 애니메이션 표시 -->
        <div v-else-if="isOpening" class="loading-spinner"></div>
        <!-- 미확인 상태 또는 미다운로드 시 다운로드 아이콘 표시 -->
        <svg v-else-if="isVideoDownloaded === null || !isVideoDownloaded" class="size-32px color-white">
          <use href="#Importing"></use>
        </svg>
        <!-- 다운로드 완료 시 재생 아이콘 표시 -->
        <svg v-else class="size-full color-white"><use href="#play"></use></svg>
      </div>

      <!-- 비디오 정보 -->
      <div class="video-info">
        <div class="video-filename">{{ body?.filename || fallbackVideoName }}</div>
        <div class="video-filesize">{{ formatBytes(body?.size) }}</div>
      </div>

      <!-- 로딩 팁 -->
      <transition name="fade">
        <div v-if="isUploading" class="loading-tip upload-tip">
          <div class="loading-text">{{ uploadingTip }}</div>
        </div>
        <div v-else-if="isOpening" class="loading-tip">
          <div class="loading-text">{{ openingTip }}</div>
        </div>
      </transition>
    </div>

    <!-- 모바일 비디오 미리보기 -->
    <component
      :is="VideoPreview"
      v-if="VideoPreview"
      v-model:visible="showVideoPreviewRef"
      :video-url="mobileVideoUrl"
      :message="message" />
  </div>
</template>

<script setup lang="ts">
import { convertFileSrc } from '@tauri-apps/api/core'
import { appDataDir, join, resourceDir } from '@tauri-apps/api/path'
import { BaseDirectory, exists } from '@tauri-apps/plugin-fs'
import { computed, defineAsyncComponent, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { MessageStatusEnum, TauriCommand } from '@/enums'
import { MittEnum, MsgEnum } from '@/enums/index'
import { useDownload } from '@/hooks/useDownload'
import { useIntersectionTaskQueue } from '@/hooks/useIntersectionTaskQueue'
import { useMitt } from '@/hooks/useMitt'
import { useVideoViewer } from '@/hooks/useVideoViewer'
import type { MsgType, VideoBody } from '@/services/types'
import { useVideoViewer as useVideoViewerStore } from '@/stores/videoViewer'
import { useThumbnailCacheStore } from '@/stores/thumbnailCache'
import { useChatStore } from '@/stores/chat'
import { formatBytes } from '@/utils/Formatting.ts'
import { isMobile } from '@/utils/PlatformConstants'
import { invokeSilently } from '@/utils/TauriInvokeHandler'
import { useI18n } from 'vue-i18n'

const { openVideoViewer, getLocalVideoPath, checkVideoDownloaded } = useVideoViewer()
const VideoPreview = isMobile() ? defineAsyncComponent(() => import('@/mobile/components/VideoPreview.vue')) : void 0
const videoViewerStore = useVideoViewerStore()
const chatStore = useChatStore()
const { downloadFile, isDownloading, process } = useDownload()
const { t } = useI18n()
const props = defineProps<{
  body: VideoBody
  messageStatus?: MessageStatusEnum
  uploadProgress?: number
  onVideoClick?: (url: string) => void
  message?: MsgType
}>()

// 비디오 컨테이너 참조
const videoContainerRef = ref<HTMLElement | null>(null)
const MOBILE_MAX_WIDTH_RATIO = 0.7
const MAX_WIDTH = isMobile()
  ? Math.round((typeof window !== 'undefined' ? window.innerWidth : 0) * MOBILE_MAX_WIDTH_RATIO) || 320
  : 400
// 오류 상태 제어
const isError = ref(false)
// 비디오 열기 상태
const isOpening = ref(false)
// 비디오 다운로드 상태 (지연 로딩, 필요할 때만 확인)
const isVideoDownloaded = ref<boolean | null>(null)
// 다운로드 상태 확인 여부
const hasCheckedDownloadStatus = ref(false)
// 비디오 업로드 상태
const isUploading = computed(() => props.messageStatus === MessageStatusEnum.SENDING)
const uploadProgress = computed(() => {
  return props.uploadProgress || 0
})
const fallbackVideoName = computed(() => t('message.video.unknown_video'))
const uploadingTip = computed(() => t('message.video.uploading', { progress: uploadProgress.value }))
const openingTip = computed(() => t('message.video.opening'))
const thumbnailStore = useThumbnailCacheStore()
const { observe: observeVideoVisibility, disconnect: disconnectVideoVisibility } = useIntersectionTaskQueue({
  threshold: 0.5
})
const showVideoPreviewRef = ref(false)
const mobileVideoUrl = ref('')

const persistVideoLocalPath = async (absolutePath: string) => {
  if (!props.message?.id || !absolutePath) return
  const target = chatStore.getMessage(props.message.id)
  if (!target) return

  const nextBody = { ...(target.message.body || {}), localPath: absolutePath }
  if (target.message.body?.localPath === absolutePath) return

  chatStore.updateMsg({ msgId: target.message.id, status: target.message.status, body: nextBody })
  const updated = { ...target, message: { ...target.message, body: nextBody } }
  await invokeSilently(TauriCommand.SAVE_MSG, { data: updated as any })
}
const localVideoThumbSrc = ref<string | null>(null)

// 실제 로드된 비디오 썸네일 크기 (props에 너비/높이가 없는 경우 사용)
const loadedThumbWidth = ref(0)
const loadedThumbHeight = ref(0)

const imageStyle = computed(() => {
  // 로드된 이미지 크기 우선 사용 (더 정확함), 없으면 props의 원본 크기 사용
  let width = loadedThumbWidth.value || props.body?.thumbWidth
  let height = loadedThumbHeight.value || props.body?.thumbHeight

  // 기본 최대 크기 설정
  const BASE_MAX_WIDTH = MAX_WIDTH
  // 세로 비디오 고정 크기 (PC 높이에서 30px 차감)
  const VERTICAL_MAX_WIDTH = isMobile() ? 170 : 150
  const VERTICAL_MAX_HEIGHT = isMobile() ? 300 : 290
  // 가로 비디오 고정 크기 (가로 유지, 정사각형이나 세로로 변하지 않음)
  const HORIZONTAL_FIXED_WIDTH = isMobile() ? 350 : 320
  const HORIZONTAL_FIXED_HEIGHT = isMobile() ? 160 : 170

  // 원본 크기가 없으면 기본 크기 사용
  if (!width || !height) {
    width = HORIZONTAL_FIXED_WIDTH
    height = HORIZONTAL_FIXED_HEIGHT
  }

  const isVertical = height > width

  // 고정 크기: 세로와 가로 각각 너비/높이 고정, 가로가 정사각형이나 세로로 변하는 것 방지
  const limitedHorizontalWidth = Math.min(HORIZONTAL_FIXED_WIDTH, BASE_MAX_WIDTH)
  const limitedVerticalWidth = Math.min(VERTICAL_MAX_WIDTH, BASE_MAX_WIDTH)
  const finalWidth = isVertical ? limitedVerticalWidth : limitedHorizontalWidth
  const finalHeight = isVertical ? VERTICAL_MAX_HEIGHT : HORIZONTAL_FIXED_HEIGHT
  // 소수점으로 인한 떨림 방지를 위해 올림 처리
  return {
    width: `${Math.ceil(finalWidth)}px`,
    height: `${Math.ceil(finalHeight)}px`
  }
})

// 이미지 로드 완료 처리, 실제 너비/높이 가져오기
const handleImageLoad = (e: Event) => {
  const target = e.target as HTMLImageElement
  if (target) {
    loadedThumbWidth.value = target.naturalWidth
    loadedThumbHeight.value = target.naturalHeight
  }
}

const containerStyle = computed(() => {
  const style = imageStyle.value
  return `width: ${style.width}; height: ${style.height}; position: relative; border-radius: 8px; overflow: hidden; cursor: pointer;`
})

const remoteThumbSrc = computed(() => props.body?.thumbUrl || '')
const downloadKey = computed(() => remoteThumbSrc.value || '')
const displayThumbSrc = computed(() => localVideoThumbSrc.value || remoteThumbSrc.value || '')

const requestVideoThumbnailDownload = () => {
  if (!downloadKey.value || !props.message) return
  void thumbnailStore
    .enqueueThumbnail({ url: downloadKey.value, msgId: props.message.id, roomId: props.message.roomId, kind: 'video' })
    .then((path) => {
      if (!path) return
      localVideoThumbSrc.value = convertFileSrc(path)
    })
}

const ensureLocalVideoThumbnail = async () => {
  const localPath = props.body?.thumbnailPath
  if (!localPath) {
    localVideoThumbSrc.value = null
    return
  }

  try {
    const existsFlag = await exists(localPath)
    if (existsFlag) {
      localVideoThumbSrc.value = convertFileSrc(localPath)
      return
    }
  } catch (error) {
    console.warn('[Video] 썸네일 파일 확인 실패:', error)
  }

  localVideoThumbSrc.value = null
  thumbnailStore.invalidate(downloadKey.value)
  requestVideoThumbnailDownload()
}

watch(
  () => props.body?.thumbnailPath,
  () => {
    void ensureLocalVideoThumbnail()
  },
  { immediate: true }
)

watch(
  () => props.body?.localPath,
  async (path) => {
    if (!path) return
    try {
      const existsFlag = await exists(path)
      if (existsFlag) {
        isVideoDownloaded.value = true
        if (isMobile()) {
          mobileVideoUrl.value = convertFileSrc(path)
        }
      }
    } catch (error) {
      console.warn('[Video] 로컬 비디오 검증 실패:', error)
    }
  },
  { immediate: true }
)

watch(
  () => downloadKey.value,
  () => {
    if (!props.body?.thumbnailPath) {
      requestVideoThumbnailDownload()
    }
  }
)

// 비디오 다운로드 상태 확인 (지연 로딩)
const checkDownloadStatusLazy = async () => {
  if (!props.body?.url || hasCheckedDownloadStatus.value) return
  hasCheckedDownloadStatus.value = true
  isVideoDownloaded.value = await checkVideoDownloaded(props.body.url)
}

// IntersectionObserver를 사용하여 비디오가 뷰포트에 들어올 때 다운로드 상태 확인
const setupIntersectionObserver = () => {
  if (!videoContainerRef.value || hasCheckedDownloadStatus.value) return

  observeVideoVisibility(videoContainerRef.value, () => {
    void checkDownloadStatusLazy()
  })
}

// 이미지 로드 오류 처리
const handleImageError = () => {
  isError.value = true
}

// 비디오 다운로드
const downloadVideo = async () => {
  if (!props.body?.url || isDownloading.value) return

  try {
    const localPath = await getLocalVideoPath(props.body?.url)
    if (localPath) {
      const baseDir = isMobile() ? BaseDirectory.AppData : BaseDirectory.Resource
      await downloadFile(props.body.url, localPath, baseDir)
      isVideoDownloaded.value = await checkVideoDownloaded(props.body.url)

      // 다운로드 완료 후 videoViewer store의 비디오 경로 업데이트
      if (isVideoDownloaded.value) {
        const baseDirPath = isMobile() ? await appDataDir() : await resourceDir()
        const path = await join(baseDirPath, localPath)
        videoViewerStore.updateVideoPath(props.body.url, path)
        void persistVideoLocalPath(path)
      }
    }
  } catch (error) {
    console.error('비디오 다운로드 실패:', error)
  }
}

const resolveMobilePlayableUrl = async () => {
  if (!props.body?.url) return ''
  const url = props.body.localPath || ''
  if (url) {
    return convertFileSrc(url)
  }
  const downloaded = await checkVideoDownloaded(props.body.url)
  if (!downloaded) return ''
  const relative = await getLocalVideoPath(props.body.url)
  const baseDirPath = await appDataDir()
  const absolute = await join(baseDirPath, relative)
  return convertFileSrc(absolute)
}

// 재생 버튼 클릭 처리
const handlePlayButtonClick = async () => {
  if (!props.body?.url) return

  // 업로드 중이면 클릭 허용 안 함
  if (isUploading.value) return

  // 첫 클릭 시 다운로드 상태 확인
  if (!hasCheckedDownloadStatus.value) {
    await checkDownloadStatusLazy()
  }

  // 비디오가 다운로드되지 않았으면 먼저 다운로드
  if (!isVideoDownloaded.value) {
    await downloadVideo()
    isVideoDownloaded.value = await checkVideoDownloaded(props.body.url)
    if (!isVideoDownloaded.value) return
  }

  // 이미 다운로드되었으면 바로 재생
  await handleOpenVideoViewer()
}

// 비디오 뷰어 열기 처리
const handleOpenVideoViewer = async () => {
  if (props.body?.url && !isOpening.value) {
    // 사용자 정의 비디오 클릭 처리 함수가 있으면 사용
    if (props.onVideoClick) {
      props.onVideoClick(props.body.url)
      return
    }

    try {
      isOpening.value = true

      // 비디오 다운로드 여부 확인
      const isDownloaded = await checkVideoDownloaded(props.body.url)
      isVideoDownloaded.value = isDownloaded

      // 비디오가 다운로드되지 않았으면 먼저 다운로드
      if (!isDownloaded) {
        await downloadVideo()
        // 다운로드 완료 후 상태 다시 확인
        isVideoDownloaded.value = await checkVideoDownloaded(props.body.url)

        // 다운로드 실패 시 비디오 열기 중단
        if (!isVideoDownloaded.value) {
          console.error('비디오 다운로드 실패, 열 수 없음')
          return
        }
      }

      if (isMobile()) {
        const playableUrl = await resolveMobilePlayableUrl()
        if (!playableUrl) {
          console.error('재생 가능한 비디오 주소를 찾을 수 없음')
          return
        }
        mobileVideoUrl.value = playableUrl
        showVideoPreviewRef.value = true
        return
      }

      await openVideoViewer(props.body.url, [MsgEnum.VIDEO])
    } catch (error) {
      console.error('비디오 열기 실패:', error)
    } finally {
      isOpening.value = false
    }
  }
}

// 비디오 다운로드 상태 업데이트 이벤트 수신
const handleVideoDownloadStatusUpdate = (data: { url: string; downloaded: boolean }) => {
  if (data.url === props.body?.url) {
    isVideoDownloaded.value = data.downloaded
  }
}

onMounted(() => {
  // 비디오 다운로드 상태 업데이트 이벤트 수신
  useMitt.on(MittEnum.VIDEO_DOWNLOAD_STATUS_UPDATED, handleVideoDownloadStatusUpdate)

  // 뷰포트 옵저버 설정
  nextTick(() => {
    setupIntersectionObserver()
  })

  if (!props.body?.thumbnailPath) {
    requestVideoThumbnailDownload()
  }
})

onUnmounted(() => {
  // 이벤트 리스너 정리
  useMitt.off(MittEnum.VIDEO_DOWNLOAD_STATUS_UPDATED, handleVideoDownloadStatusUpdate)

  disconnectVideoVisibility()
})
</script>

<style scoped lang="scss">
@use '@/styles/scss/renderMessage/video.scss';
</style>
