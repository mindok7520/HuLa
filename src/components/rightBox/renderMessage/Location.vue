<template>
  <main class="location-message" @dblclick.stop="handleLocationClick">
    <!-- 위치 아이콘 및 제목 -->
    <n-flex align="center" justify="space-between" class="pb-8px">
      <div class="flex-y-center gap-8px">
        <svg class="size-14px color-#13987f">
          <use href="#local"></use>
        </svg>
        <p class="text-14px font-medium color-[--text-color]">위치</p>
      </div>

      <div class="text-(10px #13987f) p-4px rounded-4px border-(1px solid #13987f)">
        <p v-if="body?.precision">{{ body.precision }}</p>
      </div>
    </n-flex>

    <!-- 주소 정보 -->
    <div class="text-(12px [--chat-text-color]) pb-8px leading-5 line-clamp-2">
      {{ body?.address || '위치 오류' }}
    </div>

    <!-- 지도 미리보기 영역 -->
    <div class="relative rounded-6px overflow-hidden bg-gray-100 dark:bg-#202020 h-120px flex-center">
      <StaticProxyMap
        v-if="body"
        :location="locationData"
        :zoom="18"
        :height="120"
        :draggable="false"
        :controls="false" />
      <div v-else class="flex-col-center gap-8px">
        <svg class="size-32px color-[--text-color-3]">
          <use href="#cloudError"></use>
        </svg>
        <span class="text-12px color-[--text-color-3]">표시할 수 없음</span>
      </div>
    </div>
  </main>

  <!-- 위치 상세 팝업 -->
  <LocationModal v-model:visible="modalVisible" />
</template>

<script setup lang="ts">
import StaticProxyMap from '../location/StaticProxyMap.vue'
import type { LocationBody } from '@/services/types'
import { isWindows } from '@/utils/PlatformConstants'
import LocationModal from '../location/LocationModal.vue'

defineOptions({
  inheritAttrs: false
})

const props = withDefaults(
  defineProps<{
    body?: LocationBody
  }>(),
  {
    body: undefined
  }
)

// 반응형 상태
const modalVisible = ref(false)

// 계산된 속성
const locationData = computed(() => ({
  latitude: Number(props.body?.latitude),
  longitude: Number(props.body?.longitude),
  address: props.body?.address,
  timestamp: Number(props.body?.timestamp) || Date.now()
}))

// 위치 메시지 클릭
const handleLocationClick = () => {
  if (!isWindows()) return
  modalVisible.value = true
}

// 컴포넌트 마운트 시 키 로드 불필요 (백엔드 정적 지도 프록시)

watch(
  () => props.body,
  () => {},
  { immediate: false }
)
</script>

<style scoped lang="scss">
.location-message {
  cursor: default;
  user-select: none;
  @apply: w-260px flex flex-col h-fit bg-[--group-notice-bg]
  border-(1px solid #e3e3e3) dark:border-(1px solid #404040)
  hover:bg-#fefefe99 dark:hover:bg-#60606040 rounded-8px p-8px box-border
  custom-shadow transition-colors duration-200;
}
</style>
