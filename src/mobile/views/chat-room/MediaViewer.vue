<template>
  <div class="flex flex-col h-full">
    <!-- 헤더 -->
    <div class="flex justify-between items-center p-4">
      <div @click="() => router.back()">
        <svg class="iconpark-icon w-24px h-24px"><use href="#fanhui"></use></svg>
      </div>
      <div>
        <n-dropdown trigger="click" :options="options" :show-arrow="true">
          <n-button>유형 선택</n-button>
        </n-dropdown>
      </div>
      <n-button text type="primary">선택</n-button>
    </div>
    <!-- 내용 -->
    <div class="flex-1 p-4 overflow-auto">
      <!-- 이미지 그리드 -->
      <div class="grid grid-cols-4 gap-1">
        <div
          v-for="(image, index) in imageList"
          :key="index"
          class="overflow-hidden bg-gray-100 aspect-square"
          @click="
            () => {
              activeImage = image
              showImagePreviewRef = true
            }
          ">
          <img :src="image.url" class="w-full h-full" />
        </div>
      </div>
    </div>

    <!-- 이미지 미리보기 컴포넌트 -->
    <component
      :is="ImagePreview"
      v-if="ImagePreview"
      v-model:visible="showImagePreviewRef"
      :image-url="activeImage?.url || ''" />
  </div>
</template>

<script setup lang="ts">
import { useFileStore } from '@/stores/file'
import { useGlobalStore } from '@/stores/global'
import { isMobile } from '@/utils/PlatformConstants'

const ImagePreview = isMobile() ? defineAsyncComponent(() => import('@/mobile/components/ImagePreview.vue')) : void 0

const router = useRouter()
const fileStore = useFileStore()
const globalStore = useGlobalStore()

// 이미지 미리보기 상태
const showImagePreviewRef = ref(false)
const activeImage = ref<{ url: string }>()

const options = [
  {
    label: '이미지 및 동영상',
    key: 'image_video',
    disabled: false
  },
  {
    label: '이미지',
    key: 'image',
    disabled: false
  },
  {
    label: '동영상',
    key: 'video',
    disabled: false
  }
]

// fileDownload store에서 이미지 데이터 가져오기
const imageList = ref<
  {
    url: string
  }[]
>([])

const getImageList = async () => {
  const data = await fileStore.getRoomFilesForDisplay(globalStore.currentSessionRoomId)
  const filteredImages = data.filter((item) => item.type === 'image')
  imageList.value = filteredImages.map((item) => ({ url: item.displayUrl }))
}

onMounted(() => {
  getImageList()
})
</script>
