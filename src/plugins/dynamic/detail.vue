<template>
  <div class="dynamic-detail-page h-full flex flex-col bg-gradient-to-br from-#f8f9fa to-#e9ecef">
    <ActionBar :shrink="false" :max-w="false"></ActionBar>
    <!-- 상단 네비게이션 바 -->
    <div
      data-tauri-drag-region
      class="flex items-center justify-between px-24px py-16px bg-white/80 backdrop-blur-md border-b border-#e5e5e5 shadow-sm">
      <div class="flex items-center gap-16px">
        <div
          class="cursor-pointer hover:bg-#13987F/10 p-8px rounded-8px transition-all duration-200 active:scale-95"
          @click="goBack">
          <svg class="w-20px h-20px text-#13987F">
            <use href="#arrow-left"></use>
          </svg>
        </div>
        <div class="flex items-center gap-10px">
          <div class="w-4px h-20px bg-#13987F rounded-full"></div>
          <span class="text-18px font-700 text-#333">{{ t('dynamic.page.detail.title') }}</span>
        </div>
      </div>
    </div>

    <!-- 게시물 상세 내용 -->
    <div v-if="feedId" class="flex-1 detail-scroll-container px-24px py-24px">
      <div class="max-w-900px mx-auto">
        <DynamicDetail :feed-id="feedId" mode="pc" @preview-image="previewImage" @video-play="handleVideoPlay" />
      </div>
    </div>
    <div v-else class="flex-1 flex items-center justify-center">
      <div class="text-center">
        <div class="relative inline-block mb-16px">
          <div
            class="w-80px h-80px rounded-full bg-gradient-to-br from-#13987F/20 to-#13987F/5 flex items-center justify-center animate-pulse">
            <div class="text-40px">⏳</div>
          </div>
        </div>
        <div class="text-15px text-#666 font-500">{{ t('dynamic.common.loading_title') }}</div>
        <div class="text-12px text-#999 mt-6px">{{ t('dynamic.common.loading_desc') }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { listen } from '@tauri-apps/api/event'
import { useI18n } from 'vue-i18n'
import DynamicDetail from '@/components/common/DynamicDetail.vue'
import { useWindow } from '@/hooks/useWindow'
import { useRoute } from 'vue-router'
import { useTauriListener } from '@/hooks/useTauriListener'

const { getWindowPayload } = useWindow()
const route = useRoute()
const { addListener } = useTauriListener()
const { t } = useI18n()

// 게시물 ID
const feedId = ref<string>('')

// 윈도우 전달 파라미터 가져오기
onMounted(async () => {
  const currentWindow = WebviewWindow.getCurrent()

  if (route.params.id) {
    feedId.value = route.params.id as string
  } else {
    const payload = (await getWindowPayload(currentWindow.label, false)) as any
    if (payload && payload.feedId) {
      feedId.value = payload.feedId
    } else {
      setTimeout(async () => {
        await currentWindow.emit('window-payload-updated', { feedId: feedId.value })
      }, 1000)
    }
  }

  // payload 업데이트 이벤트 수신, 윈도우 재사용 시 내용 업데이트용
  await addListener(
    listen('window-payload-updated', async (event: any) => {
      const payload = event.payload
      if (payload && payload.feedId) {
        feedId.value = payload.feedId
      }
    }),
    'window-payload-updated'
  )

  // 윈도우 표시
  await currentWindow.show()
})

// 윈도우 닫기
const goBack = async () => {
  const currentWindow = WebviewWindow.getCurrent()
  await currentWindow.close()
}

// 이미지 미리보기
const previewImage = (images: string[], index: number) => {
  console.log('이미지 미리보기:', images, index)
  // TODO: 이미지 미리보기 기능 구현
}

// 동영상 재생
const handleVideoPlay = (url: string) => {
  console.log('동영상 재생:', url)
  // TODO: 동영상 재생 기능 구현
}
</script>

<style scoped lang="scss">
.dynamic-detail-page {
  width: 100%;
  height: 100%;
}

/* 커스텀 스크롤바 스타일 */
.detail-scroll-container {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;

  &::-webkit-scrollbar {
    width: 6px;
    transition-property: opacity;
    transition-duration: 0.3s;
    transition-timing-function: ease;
  }

  &::-webkit-scrollbar-thumb {
    background-color: rgba(144, 144, 144, 0.3);
    border-radius: 3px;
    transition-property: opacity, background-color;
    transition-duration: 0.3s;
    transition-timing-function: ease;
  }

  &::-webkit-scrollbar-thumb:hover {
    background-color: rgba(144, 144, 144, 0.5);
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }
}
</style>
