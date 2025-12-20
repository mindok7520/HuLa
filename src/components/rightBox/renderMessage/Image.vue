<template>
  <div>
    <n-image
      v-if="body?.url"
      class="select-none cursor-pointer"
      :img-props="{
        style: {
          ...imageStyle
        }
      }"
      object-fit="cover"
      show-toolbar-tooltip
      preview-disabled
      style="border-radius: 8px; cursor: pointer !important"
      :src="displayImageSrc"
      @dblclick="handleOpenImageViewer"
      @click="handleOpenImage"
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
          <svg class="size-34px color-[--chat-text-color]">
            <use href="#error-picture"></use>
          </svg>
        </n-flex>
      </template>
    </n-image>

    <!-- 이미지 미리보기 컴포넌트 -->
    <component
      :is="ImagePreview"
      v-if="ImagePreview"
      v-model:visible="showImagePreviewRef"
      :image-url="body?.url || ''"
      :message="message" />
  </div>
</template>

<script setup lang="ts">
import { convertFileSrc } from '@tauri-apps/api/core'
import { exists } from '@tauri-apps/plugin-fs'
import { MsgEnum } from '@/enums'
import { useImageViewer } from '@/hooks/useImageViewer'
import type { ImageBody, MsgType } from '@/services/types'
import { isMobile } from '@/utils/PlatformConstants'
import { useThumbnailCacheStore } from '@/stores/thumbnailCache'
import { buildQiniuThumbnailUrl, getPreferredQiniuFormat } from '@/utils/QiniuImageUtils'

const ImagePreview = isMobile() ? defineAsyncComponent(() => import('@/mobile/components/ImagePreview.vue')) : void 0

const props = defineProps<{
  body: ImageBody
  onImageClick?: (url: string) => void
  message: MsgType
}>()
// 이미지 표시 관련 상수
const MOBILE_MAX_WIDTH_RATIO = 0.7
const MAX_WIDTH = isMobile()
  ? Math.round((typeof window !== 'undefined' ? window.innerWidth : 0) * MOBILE_MAX_WIDTH_RATIO) || 240
  : 320
const MAX_HEIGHT = 240
const MIN_WIDTH = 60
const MIN_HEIGHT = 60
const THUMB_QUALITY = 60
// 에러 상태 제어
const isError = ref(false)
// 이미지 뷰어 hook 사용
const { openImageViewer } = useImageViewer()
const showImagePreviewRef = ref(false)
const imagesRef = ref<string[]>([])
const thumbnailStore = useThumbnailCacheStore()
const localThumbnailSrc = ref<string | null>(null)

// 이미지 로드 오류 처리
const handleImageError = () => {
  isError.value = true
}

const handleOpenImage = () => {
  if (!isMobile()) return // 모바일이 아니면 바로 반환

  if (props.body?.url) {
    imagesRef.value = [props.body.url]
    showImagePreviewRef.value = true
  }
}

// 이미지 뷰어 열기 처리
const handleOpenImageViewer = () => {
  if (isMobile()) {
    return
  }

  if (props.body?.url) {
    // 사용자 정의 클릭 처리 함수가 있으면 사용하고, 없으면 기본 로직 사용
    if (props.onImageClick) {
      props.onImageClick(props.body.url)
    } else {
      openImageViewer(props.body.url, [MsgEnum.IMAGE, MsgEnum.EMOJI])
    }
  }
}

/**
 * 이미지 스타일 계산
 */
const remoteThumbnailSrc = computed(() => {
  const originalUrl = props.body?.url
  if (!originalUrl) return ''
  const deviceRatio = typeof window !== 'undefined' ? Math.max(window.devicePixelRatio || 1, 1) : 1
  const thumbnailWidth = Math.ceil(MAX_WIDTH * Math.min(deviceRatio, 2))
  const format = getPreferredQiniuFormat()

  return (
    buildQiniuThumbnailUrl(originalUrl, {
      width: thumbnailWidth,
      quality: THUMB_QUALITY,
      format
    }) ?? originalUrl
  )
})

const downloadKey = computed(() => remoteThumbnailSrc.value || props.body?.url || '')

const displayImageSrc = computed(() => localThumbnailSrc.value || remoteThumbnailSrc.value)

const requestThumbnailDownload = () => {
  if (!downloadKey.value || !props.message) return
  void thumbnailStore
    .enqueueThumbnail({ url: downloadKey.value, msgId: props.message.id, roomId: props.message.roomId, kind: 'image' })
    .then((path) => {
      if (!path) return
      localThumbnailSrc.value = convertFileSrc(path)
    })
}

const ensureLocalThumbnail = async () => {
  const localPath = props.body?.thumbnailPath
  if (!localPath) {
    localThumbnailSrc.value = null
    return
  }
  try {
    const existsFlag = await exists(localPath)
    if (existsFlag) {
      localThumbnailSrc.value = convertFileSrc(localPath)
      return
    }
  } catch (error) {
    console.warn('[Image] 썸네일 파일 확인 실패:', error)
  }
  localThumbnailSrc.value = null
  thumbnailStore.invalidate(downloadKey.value)
  requestThumbnailDownload()
}

watch(
  () => props.body?.thumbnailPath,
  () => {
    void ensureLocalThumbnail()
  },
  { immediate: true }
)

watch(
  () => downloadKey.value,
  () => {
    if (!props.body?.thumbnailPath) {
      requestThumbnailDownload()
    }
  }
)

const imageStyle = computed(() => {
  // 원본 크기가 있으면 원본 크기로 계산
  let width = props.body?.width
  let height = props.body?.height

  // 원본 크기가 없으면 기본 크기 사용
  if (!width || !height) {
    width = MAX_WIDTH
    height = MAX_HEIGHT
  }

  const aspectRatio = width / height
  let finalWidth = width
  let finalHeight = height

  // 이미지가 너무 크면 비율에 맞춰 축소
  if (width > MAX_WIDTH || height > MAX_HEIGHT) {
    if (width / height > MAX_WIDTH / MAX_HEIGHT) {
      // 너비가 더 많이 초과된 경우, 최대 너비를 기준으로 축소
      finalWidth = MAX_WIDTH
      finalHeight = MAX_WIDTH / aspectRatio
    } else {
      // 높이가 더 많이 초과된 경우, 최대 높이를 기준으로 축소
      finalHeight = MAX_HEIGHT
      finalWidth = MAX_HEIGHT * aspectRatio
    }
  }

  // 최소 크기보다 작지 않도록 설정
  finalWidth = Math.max(finalWidth, MIN_WIDTH)
  finalHeight = Math.max(finalHeight, MIN_HEIGHT)

  // 소수점으로 인한 떨림 방지를 위해 올림 처리
  return {
    width: `${Math.ceil(finalWidth)}px`,
    height: `${Math.ceil(finalHeight)}px`
  }
})

onMounted(() => {
  if (props.body?.url && !props.body?.thumbnailPath) {
    requestThumbnailDownload()
  }
})
</script>

<style scoped></style>
