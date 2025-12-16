<template>
  <div class="float-block-container select-none" ref="containerRef">
    <n-virtual-list
      ref="virtualListRef"
      :style="{ maxHeight: maxHeight }"
      :items="dataSource"
      :item-size="itemHeight"
      :item-resize-observer="true"
      :key-field="itemKey || 'index'"
      @scroll="handleScroll">
      <template #default="{ item, index }">
        <div
          class="float-block"
          :data-index="index"
          :style="{ height: `${itemHeight}px` }"
          @mouseenter="handleItemMouseEnter(index)">
          <slot name="item" :item="item" :index="index">
            <!-- 기본 렌더링 내용 -->
            <div class="p-[8px_10px] rounded-lg">{{ item }}</div>
          </slot>
        </div>
      </template>
    </n-virtual-list>
    <!-- 호버 효과 레이어 -->
    <div
      v-show="hoverPosition !== null"
      class="hover-effect"
      :style="{
        height: `${itemHeight}px`,
        opacity: props.hoverOpacity,
        top: `${hoverPosition}px`,
        display: isHoverPositionValid ? 'block' : 'none'
      }"></div>
  </div>
</template>

<script setup lang="ts">
// 컴포넌트 속성 정의
const props = defineProps({
  // 데이터 소스
  dataSource: {
    type: Array as () => any[],
    required: true
  },
  // 데이터 항목 고유 식별자 필드명
  itemKey: {
    type: String,
    default: ''
  },
  // 항목 높이
  itemHeight: {
    type: Number,
    default: 64
  },
  // 최대 높이
  maxHeight: {
    type: String,
    default: 'calc(100vh / var(--page-scale, 1) - 132px)'
  },
  // 호버 항목의 투명도
  hoverOpacity: {
    type: Number,
    default: 0.06
  }
})

// 참조 및 상태
const containerRef = ref<HTMLElement | null>(null)
const virtualListRef = ref<any>(null)
const hoverPosition = ref<number | null>(null)
const currentHoverIndex = ref<number | null>(null)
const containerHeight = ref<number>(0)

// 계산된 속성: 호버 위치가 유효한지 확인 (컨테이너 범위 내인지)
const isHoverPositionValid = computed(() => {
  if (hoverPosition.value === null) return false

  // 호버 위치 + 항목 높이가 컨테이너 높이를 초과하지 않도록 확인
  return hoverPosition.value >= 0 && hoverPosition.value + props.itemHeight <= containerHeight.value
})

// 컨테이너 높이 업데이트
const updateContainerHeight = () => {
  if (virtualListRef.value?.$el) {
    const pageScale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--page-scale') || '1')
    containerHeight.value = virtualListRef.value.$el.clientHeight / pageScale
  }
}

// 스크롤 이벤트 처리
const handleScroll = () => {
  // 컨테이너 높이 업데이트
  updateContainerHeight()

  // 현재 호버 항목이 있으면 위치 업데이트
  if (currentHoverIndex.value !== null) {
    updateHoverPositionByIndex(currentHoverIndex.value)
  }
}

// 목록 항목의 마우스 진입 이벤트 처리
const handleItemMouseEnter = (index: number) => {
  // 현재 호버 인덱스 설정
  currentHoverIndex.value = index

  // 현재 호버 항목의 DOM 요소 가져오기
  const item =
    (event?.target as HTMLElement)?.closest('.float-block') || document.activeElement?.closest('.float-block')

  if (item) {
    // 목록 컨테이너에 대한 요소의 상대 위치 가져오기
    const listEl = virtualListRef.value?.$el
    if (!listEl) return

    const itemRect = item.getBoundingClientRect()
    const listRect = listEl.getBoundingClientRect()

    // 호버 효과 위치 설정
    const pageScale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--page-scale') || '1')
    hoverPosition.value = (itemRect.top - listRect.top) / pageScale

    // 컨테이너 높이 업데이트
    updateContainerHeight()
  } else {
    // DOM 요소를 찾을 수 없는 경우 인덱스를 사용하여 위치 계산
    updateHoverPositionByIndex(index)
  }
}

// 인덱스에 따라 실제 렌더링된 DOM 요소를 가져오고 호버 효과 위치 업데이트
const updateHoverPositionByIndex = (index: number) => {
  if (!virtualListRef.value?.$el) return

  // 렌더링된 모든 목록 항목 요소 가져오기
  const items = virtualListRef.value.$el.querySelectorAll('.float-block')
  if (!items.length) return

  // 가상 목록의 시작 인덱스 가져오기
  const startIndex = virtualListRef.value?.getOffset?.() || 0

  // 현재 가시 영역에서 대상 항목의 상대 위치 계산
  const relativeIndex = index - startIndex

  // 인덱스가 가시 범위 내에 있는지 확인
  if (relativeIndex < 0 || relativeIndex >= items.length) {
    // 가시 범위 내에 없으면 호버 효과 숨기기
    hoverPosition.value = null
    return
  }

  // 대상 요소 가져오기
  const targetItem = items[relativeIndex]
  if (!targetItem) {
    hoverPosition.value = null
    return
  }

  // 가상 목록 컨테이너에 대한 대상 요소의 상대 위치 가져오기
  const listContainer = virtualListRef.value.$el
  const targetRect = targetItem.getBoundingClientRect()
  const listRect = listContainer.getBoundingClientRect()

  // 목록 컨테이너에 대한 대상 요소의 상단 오프셋 계산
  const pageScale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--page-scale') || '1')
  hoverPosition.value = (targetRect.top - listRect.top) / pageScale

  // 컨테이너 높이 업데이트
  updateContainerHeight()
}

// 컨테이너의 마우스 이탈 이벤트 처리
const handleMouseLeave = () => {
  hoverPosition.value = null
  currentHoverIndex.value = null
}

// 컴포넌트 마운트 시 이벤트 리스너 추가
onMounted(() => {
  if (containerRef.value) {
    containerRef.value.addEventListener('mouseleave', handleMouseLeave)
  }

  // 컨테이너 높이 초기화
  updateContainerHeight()

  // 창 크기 변경 감지
  window.addEventListener('resize', updateContainerHeight)
})

// 컴포넌트 언마운트 시 이벤트 리스너 제거
onUnmounted(() => {
  if (containerRef.value) {
    containerRef.value.removeEventListener('mouseleave', handleMouseLeave)
  }

  // 창 크기 변경 리스너 제거
  window.removeEventListener('resize', updateContainerHeight)
})

// 상단/하단으로 스크롤하는 메서드 노출
defineExpose({
  scrollToTop: () => {
    if (virtualListRef.value) {
      virtualListRef.value.scrollTo({ top: 0, behavior: 'smooth' })
    }
  },
  scrollToBottom: () => {
    if (virtualListRef.value && virtualListRef.value.$el) {
      const scrollContainer = virtualListRef.value.$el
      if (scrollContainer) {
        const scrollHeight = scrollContainer.scrollHeight
        virtualListRef.value.scrollTo({ top: scrollHeight, behavior: 'smooth' })
      }
    }
  }
})
</script>

<style scoped lang="scss">
.float-block-container {
  position: relative;
  width: 100%;
  height: 100%;
}

.float-block {
  width: 100%;
  cursor: pointer;
  box-sizing: border-box;
  position: relative;
  z-index: 1;
}

.hover-effect {
  position: absolute;
  left: 0;
  width: 100%;
  background: var(--float-block-hover-color, rgba(0, 0, 0, 0.1));
  pointer-events: none;
  transition: top 0.2s ease-in-out;
  z-index: 0;
}
</style>
