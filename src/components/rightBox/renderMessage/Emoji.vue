<template>
  <div v-bind="$attrs">
    <n-image
      v-if="body?.url"
      class="select-none cursor-pointer"
      :img-props="{
        style: {
          maxWidth: '120px',
          maxHeight: '120px',
          objectFit: 'contain'
        }
      }"
      show-toolbar-tooltip
      preview-disabled
      style="border-radius: 8px; cursor: pointer !important"
      :src="displayEmojiSrc"
      @click="handleOpenImage"
      @dblclick="handleOpenImageViewer"
      @error="handleImageError">
      <template #placeholder>
        <n-flex
          v-if="!isError"
          align="center"
          justify="center"
          :style="{
            width: '120px',
            height: '120px',
            backgroundColor: '#c8c8c833'
          }"
          class="rounded-10px">
          <img class="size-24px select-none" src="@/assets/img/loading.svg" alt="loading" />
        </n-flex>
      </template>
      <template #error>
        <n-flex v-if="isError" align="center" justify="center" class="w-150px h-150px bg-#c8c8c833 rounded-10px">
          <svg class="size-34px color-[--chat-text-color]"><use href="#error-picture"></use></svg>
        </n-flex>
      </template>
    </n-image>

    <!-- 모바일 이모티콘 미리보기 -->
    <component
      :is="ImagePreview"
      v-if="ImagePreview"
      v-model:visible="showImagePreviewRef"
      :image-url="displayEmojiSrc"
      :message="message" />
  </div>
</template>

<script setup lang="ts">
import { convertFileSrc } from '@tauri-apps/api/core'
import { exists } from '@tauri-apps/plugin-fs'
import { MsgEnum } from '@/enums/index'
import { useImageViewer } from '@/hooks/useImageViewer'
import { useThumbnailCacheStore } from '@/stores/thumbnailCache'
import type { EmojiBody, MsgType } from '@/services/types'
import { getRemoteFileSize } from '@/utils/PathUtil'
import { isMobile } from '@/utils/PlatformConstants'

const props = defineProps<{
  body: EmojiBody
  onImageClick?: (url: string) => void
  message?: MsgType
}>()
// 부모 컴포넌트에서 class / data-* 등을 div로 전달할 수 있도록 설정하며, Fragment로 인한 Props 경고를 방지합니다.
defineOptions({
  inheritAttrs: false
})
const isError = ref(false)
const localEmojiSrc = ref<string | null>(null)
const showImagePreviewRef = ref(false)
const thumbnailStore = useThumbnailCacheStore()
const { openImageViewer } = useImageViewer()
const EMOJI_AUTO_DOWNLOAD_LIMIT = 1024 * 1024 // 1MB
const ImagePreview = isMobile() ? defineAsyncComponent(() => import('@/mobile/components/ImagePreview.vue')) : void 0

const displayEmojiSrc = computed(() => localEmojiSrc.value || props.body?.url || '')

const handleImageError = () => {
  isError.value = true
  console.error('이모티콘 로드 실패:', props.body.url)
}

const handleOpenImage = () => {
  if (!isMobile()) return
  if (props.body?.url) {
    showImagePreviewRef.value = true
  }
}

const handleOpenImageViewer = () => {
  if (isMobile()) {
    return
  }
  if (!props.body?.url) return
  if (props.onImageClick) {
    props.onImageClick(displayEmojiSrc.value)
  } else {
    openImageViewer(props.body.url, [MsgEnum.IMAGE, MsgEnum.EMOJI])
  }
}

const ensureLocalEmoji = async () => {
  const localPath = props.body?.localPath
  if (!localPath) {
    localEmojiSrc.value = null
    await maybeDownloadEmoji()
    return
  }
  try {
    const existsFlag = await exists(localPath)
    if (existsFlag) {
      localEmojiSrc.value = convertFileSrc(localPath)
      return
    }
  } catch (error) {
    console.warn('[Emoji] 로컬 이모티콘 확인 실패:', error)
  }
  localEmojiSrc.value = null
  await maybeDownloadEmoji()
}

const maybeDownloadEmoji = async () => {
  if (!props.body?.url || !props.message) return
  try {
    const size = await getRemoteFileSize(props.body.url)
    if (size === null || size > EMOJI_AUTO_DOWNLOAD_LIMIT) {
      return
    }
    const path = await thumbnailStore.enqueueThumbnail({
      url: props.body.url,
      msgId: props.message.id,
      roomId: props.message.roomId,
      kind: 'emoji'
    })
    if (path) {
      localEmojiSrc.value = convertFileSrc(path)
    }
  } catch (error) {
    console.warn('[Emoji] 자동 다운로드 실패:', error)
  }
}

watch(
  () => props.body?.localPath,
  () => {
    void ensureLocalEmoji()
  },
  { immediate: true }
)

watch(
  () => props.message?.id,
  () => {
    if (!props.body?.localPath) {
      void maybeDownloadEmoji()
    }
  }
)
</script>
