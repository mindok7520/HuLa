<template>
  <MobileLayout :safeAreaTop="true" :safeAreaBottom="true">
    <div class="flex flex-col h-full bg-gradient-to-b from-#f8f9fa to-#ffffff">
      <!-- 상단 네비게이션 바 -->
      <HeaderBar
        :isOfficial="false"
        class="bg-white"
        :enable-shadow="false"
        :hidden-right="true"
        room-name="게시물 상세" />

      <!-- 게시물 상세 내용 -->
      <div class="flex-1 overflow-y-auto overflow-x-hidden w-full">
        <DynamicDetail :feed-id="feedId" mode="mobile" @preview-image="previewImage" @video-play="handleVideoPlay" />
      </div>
    </div>
  </MobileLayout>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import DynamicDetail from '@/components/common/DynamicDetail.vue'

const route = useRoute()

// 게시물 ID 가져오기 (computed 사용하여 반응형 처리)
const feedId = computed(() => route.params.id as string)

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

<style scoped>
/* 빈 스타일, 모두 UnoCSS 사용 */
</style>
