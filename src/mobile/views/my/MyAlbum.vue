<template>
  <div>
    <AutoFixHeightPage :show-footer="false">
      <template #header>
        <HeaderBar
          :isOfficial="false"
          class="bg-white"
          style="border-bottom: 1px solid; border-color: #dfdfdf"
          :hidden-right="true"
          room-name="내 앨범" />
      </template>

      <template #container>
        <div class="flex flex-col bg-#fefefe overflow-auto h-full">
          <div class="flex flex-col p-20px gap-20px">
            <!-- 로딩 상태 -->
            <div v-if="loading" class="flex justify-center items-center py-40px">
              <n-spin size="medium" />
            </div>

            <!-- 빈 상태 -->
            <div v-else-if="allImages.length === 0" class="flex flex-col justify-center items-center py-40px gap-10px">
              <svg class="iconpark-icon w-60px h-60px text-gray">
                <use href="#xiangce"></use>
              </svg>
              <div class="text-gray text-14px">이미지 없음</div>
            </div>

            <!-- 이미지 그리드 -->
            <div v-else class="grid grid-cols-4 gap-1">
              <div
                v-for="(image, index) in allImages"
                :key="index"
                class="overflow-hidden bg-gray-100 aspect-square cursor-pointer"
                @click="handleImageClick(image)">
                <img :src="image.displayUrl" class="w-full h-full object-cover" alt="앨범 이미지" />
              </div>
            </div>
          </div>
        </div>
      </template>
    </AutoFixHeightPage>

    <!-- 이미지 미리보기 컴포넌트 -->
    <ImagePreview
      v-model:visible="showImagePreviewRef"
      :image-url="activeImageUrl"
      :show-forward="false"
      :show-save="false"
      :show-more="false" />
  </div>
</template>

<script setup lang="ts">
import { useFileStore } from '@/stores/file'
import { useGlobalStore } from '@/stores/global'
import ImagePreview from '@/mobile/components/ImagePreview.vue'

const fileStore = useFileStore()
const globalStore = useGlobalStore()

// 이미지 미리보기 상태
const showImagePreviewRef = ref(false)
const activeImageUrl = ref('')
const loading = ref(true)

// 모든 이미지 목록
const allImages = ref<Array<{ displayUrl: string; originalUrl: string; id: string; roomId: string }>>([])

/**
 * 모든 방의 이미지 가져오기
 */
const getAllImages = async () => {
  loading.value = true
  try {
    // roomFilesMap이 비어 있는지 확인하고, 비어 있으면 로컬 파일 스캔
    if (Object.keys(fileStore.roomFilesMap).length === 0) {
      if (globalStore.currentSessionRoomId) {
        console.log('[MyAlbum Debug] 로컬 파일 스캔, roomId:', globalStore.currentSessionRoomId)
        await fileStore.scanLocalFiles(globalStore.currentSessionRoomId)
      }
    }

    const roomFilesMap = fileStore.roomFilesMap
    console.log('[MyAlbum Debug] roomFilesMap:', roomFilesMap)
    const imagesList: Array<{ displayUrl: string; originalUrl: string; id: string; roomId: string }> = []

    // 모든 방 순회
    for (const roomId in roomFilesMap) {
      const files = await fileStore.getRoomFilesForDisplay(roomId)
      console.log('[MyAlbum Debug] roomId:', roomId, 'files:', files)

      // 이미지 유형의 파일만 가져오기
      const images = files.filter((file) => file.type === 'image')
      console.log('[MyAlbum Debug] roomId:', roomId, 'images:', images)

      imagesList.push(
        ...images.map((img) => ({
          displayUrl: img.displayUrl,
          originalUrl: img.originalUrl,
          id: img.id,
          roomId: img.roomId
        }))
      )
    }

    console.log('[MyAlbum Debug] 최종 이미지 목록:', imagesList)
    allImages.value = imagesList
  } catch (error) {
    console.error('이미지 가져오기 실패:', error)
    if (window.$message) {
      window.$message.error('이미지 가져오기 실패')
    }
  } finally {
    loading.value = false
  }
}

/**
 * 이미지 클릭 처리
 */
const handleImageClick = (image: { displayUrl: string; originalUrl: string; id: string; roomId: string }) => {
  console.log('[MyAlbum Debug] 이미지 클릭:', image)
  activeImageUrl.value = image.displayUrl
  showImagePreviewRef.value = true
}

onMounted(() => {
  console.log('[MyAlbum Debug] MyAlbum 컴포넌트 마운트됨')
  getAllImages()
})
</script>

<style scoped>
/* 사용자 정의 스타일 추가 가능 */
</style>
