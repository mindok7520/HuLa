<template>
  <div
    ref="containerRef"
    class="pull-refresh relative overflow-auto"
    @touchstart="handleTouchStart"
    @touchmove="handleTouchMove"
    @touchend="handleTouchEnd">
    <!-- 아래로 당김 표시기 -->
    <div
      class="refresh-indicator absolute left-0 right-0 z-30 w-full flex-center transform bg-transparent backdrop-blur-sm"
      :class="[
        isRefreshing ? 'text-primary-500' : 'text-gray-400',
        { 'opacity-0': distance === 0 },
        { 'transition-transform duration-300': !isDragging }
      ]"
      :style="{
        top: '0',
        height: `${indicatorHeight}px`,
        transform: `translate3d(0, -${Math.max(indicatorHeight - distance, 0)}px, 0)`,
        'will-change': isDragging ? 'transform' : ''
      }">
      <template v-if="isRefreshing">
        <img class="size-18px" src="@/assets/img/loading.svg" alt="" />
        <span class="ml-2 text-sm color-#333">새로 고침 중...</span>
      </template>
      <template v-else>
        <div class="flex-center flex-col">
          <svg
            :class="[
              'color-#333 size-14px transition-transform duration-300',
              { 'rotate-180': distance >= threshold }
            ]">
            <use href="#arrow-down"></use>
          </svg>

          <span class="text-xs mt-1">
            {{ distance >= threshold ? '놓으면 새로 고침' : '당겨서 새로 고침' }}
          </span>
        </div>
      </template>
    </div>

    <!-- 콘텐츠 영역 -->
    <div
      ref="contentRef"
      :class="['transform', { 'transition-transform duration-300': !isDragging }]"
      :style="{
        transform: `translate3d(0, ${distance}px, 0)`,
        minHeight: '100%',
        'will-change': isDragging ? 'transform' : ''
      }">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useEventListener } from '@vueuse/core'

type Props = {
  threshold?: number // 새로 고침 트리거 임계값
  indicatorHeight?: number // 표시기 높이
  disabled?: boolean // 아래로 당겨 새로 고침 비활성화 여부
}

const props = withDefaults(defineProps<Props>(), {
  threshold: 60,
  indicatorHeight: 50,
  disabled: false
})

const emit = defineEmits<(e: 'refresh') => void>()

const containerRef = ref<HTMLElement>()
const contentRef = ref<HTMLElement>()
const distance = ref(0)
const startY = ref(0)
const isRefreshing = ref(false)
const isDragging = ref(false)

// rAF 빈도 감소 업데이트, 고빈도 트리거로 인한 떨림 방지
let rafId: number | null = null
let pendingDistance: number | null = null

// 새로 고침 거리
const flushDistance = () => {
  if (pendingDistance === null) return
  distance.value = pendingDistance
  pendingDistance = null
  rafId = null
}

// 거리 업데이트 스로틀링
const scheduleDistanceUpdate = (val: number) => {
  pendingDistance = val
  if (rafId == null) {
    rafId = requestAnimationFrame(flushDistance)
  }
}

// 터치 시작 처리
const handleTouchStart = (e: TouchEvent) => {
  if (props.disabled || isRefreshing.value) return

  const scrollTop = containerRef.value?.scrollTop ?? 0
  // 상단에 있을 때만 당기기 가능
  if (scrollTop <= 0) {
    startY.value = e.touches[0].clientY
    isDragging.value = true
  }
}

// 터치 이동 처리
const handleTouchMove = (e: TouchEvent) => {
  if (props.disabled || !startY.value || isRefreshing.value) return

  const scrollTop = containerRef.value?.scrollTop ?? 0
  if (scrollTop > 0) return

  const currentY = e.touches[0].clientY
  const diff = currentY - startY.value

  if (diff > 0 && e.cancelable) {
    e.preventDefault()
    // 감쇠 계수를 사용하여 당길수록 어렵게 만듦
    const next = Math.round(Math.min(diff * 0.4, props.threshold * 1.5))
    scheduleDistanceUpdate(next)
  }
}

// 터치 종료 처리
const handleTouchEnd = () => {
  if (props.disabled || !startY.value) return

  if (distance.value >= props.threshold) {
    isRefreshing.value = true
    distance.value = props.indicatorHeight
    emit('refresh')
  } else {
    // 초기 위치로 반동
    distance.value = 0
  }
  startY.value = 0
  isDragging.value = false
  // 완료되지 않은 rAF 취소
  if (rafId != null) {
    cancelAnimationFrame(rafId)
    rafId = null
    pendingDistance = null
  }
}

// 새로 고침 완료
const finishRefresh = () => {
  isRefreshing.value = false
  distance.value = 0
}

// 부모 컴포넌트에 메서드 노출
defineExpose({
  finishRefresh
})

// iOS 고무줄 효과 방지
onMounted(() => {
  useEventListener(
    containerRef.value,
    'touchmove',
    (e: TouchEvent) => {
      if (!containerRef.value) return
      if (e.cancelable && containerRef.value?.scrollTop <= 0 && e.touches[0].clientY > startY.value) {
        e.preventDefault()
      }
    },
    { passive: false }
  )
})
</script>

<style scoped>
.pull-refresh {
  overscroll-behavior-y: contain;
  -webkit-overflow-scrolling: touch;
}

.flex-center {
  @apply flex items-center justify-center;
}

.refresh-indicator {
  pointer-events: none;
}
</style>
