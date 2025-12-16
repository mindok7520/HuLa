<template>
  <div
    ref="containerRef"
    class="virtual-list-container"
    :class="{ 'hide-scrollbar': hideScrollbar }"
    @scroll.passive="handleScroll"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave">
    <n-flex v-if="!isLoadingMore && isLast" justify="center" class="box-border absolute-x-center pt-10px">
      <span class="text-(12px #909090)">모든 메시지 내용을 표시했습니다</span>
    </n-flex>
    <n-flex v-if="isLoadingMore && !isLast" justify="center" class="box-border absolute-x-center pt-10px">
      <img class="size-16px" src="@/assets/img/loading.svg" alt="" />
      <span class="text-(14px #909090)">로딩 중</span>
    </n-flex>
    <div ref="phantomRef" class="virtual-list-phantom"></div>
    <div ref="contentRef" class="virtual-list-content">
      <div
        v-for="item in visibleData"
        :key="item.message?.id"
        :id="`item-${item.message?.id}`"
        :data-item-index="item._index">
        <slot :item="item" :index="item._index"></slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'

const props = defineProps<{
  items: any[]
  estimatedItemHeight?: number
  buffer?: number
  isLoadingMore?: boolean
  isLast?: boolean
  listKey?: string | number
}>()

const emit = defineEmits<{
  scroll: [event: Event]
  scrollDirectionChange: [direction: 'up' | 'down']
  loadMore: []
  mouseenter: []
  mouseleave: []
  visibleItemsChange: [ids: string[]]
}>()

// 상수 정의
const DEFAULT_ESTIMATED_HEIGHT = 80 // 항목당 예상 높이 기본값
const BUFFER_SIZE = props.buffer || 5 // 상하 버퍼 영역 수량
const OVERSCAN_SIZE = 1000 // 스크롤 시 공백 방지를 위한 사전 렌더링 영역 픽셀 높이
const MAX_CACHE_SIZE = 100 // 높이 캐시 최대 수량
const LOADING_OFFSET = 26 // 로딩 중 필요한 오프셋 (26px는 로딩 애니메이션 높이)
const ESTIMATED_ITEM_HEIGHT = props.estimatedItemHeight || DEFAULT_ESTIMATED_HEIGHT // 항목당 예상 높이
const SCROLL_THRESHOLD = 26 // 상단 스크롤 임계값, 더 불러오기 트리거용
const DOM_CLEANUP_INTERVAL = 60000 // DOM 정리 간격, 기본 1분

// 반응형 참조
const containerRef = ref<HTMLElement | null>(null) // 컨테이너 요소 참조
const phantomRef = ref<HTMLElement | null>(null) // phantom 요소 참조
const contentRef = ref<HTMLElement | null>(null) // content 요소 참조
// 일반 변수 (반응형 불필요)
let offset = 0 // 콘텐츠 영역 오프셋
let rafId: number | null = null // requestAnimationFrame ID
let lastScrollTop = 0 // 마지막 스크롤 위치
let consecutiveStaticFrames = 0 // 연속 정지 프레임 카운트
let needsHeightRecalculation = true // 높이 캐시 재계산 필요 여부 플래그
let cleanupTimerId: number | null = null // DOM 정리 타이머 ID
let resizeObserver: ResizeObserver | null = null // ResizeObserver 인스턴스
let bottomLockRafId: number | null = null // 하단 고정 안정화 잠금 RAF ID

// 반응형 변수 (반응형 필요)
const heights = ref<Map<string, number>>(new Map()) // 각 항목의 실제 높이 저장, 키는 메시지 ID
const visibleRange = ref({ start: 0, end: 0 }) // 현재 가시 영역의 시작 및 종료 인덱스
const isScrolling = ref(false) // 스크롤 중 여부
const accumulatedHeights = ref<number[]>([]) // 누적 높이 캐시, 이진 탐색 최적화
const hideScrollbar = ref(true) // 스크롤바 표시/숨김
const previousVisibleIds = ref<Set<string>>(new Set()) // 이전 가시 항목 ID 집합

// phantom 요소 높이 직접 업데이트 함수
const updatePhantomHeight = (height: number) => {
  if (phantomRef.value) {
    phantomRef.value.style.height = `${height}px`
  }
}

// content 요소 오프셋 직접 업데이트 함수
const updateContentOffset = (offsetValue: number) => {
  if (contentRef.value) {
    contentRef.value.style.transform = `translateY(${offsetValue}px)`
  }
}

// 하단 고정 취소
const cancelBottomLock = () => {
  if (bottomLockRafId !== null) {
    cancelAnimationFrame(bottomLockRafId)
    bottomLockRafId = null
  }
}

// 높이와 위치가 안정될 때까지 하단 고정 시작
const lockBottomUntilStable = (timeoutMs = 450, stableFrames = 3) => {
  const container = containerRef.value
  if (!container) return

  cancelBottomLock()

  let lastHeight = container.scrollHeight
  let stable = 0
  const start = performance.now()

  const tick = () => {
    if (!containerRef.value) {
      cancelBottomLock()
      return
    }

    const el = containerRef.value
    const now = performance.now()
    if (now - start > timeoutMs) {
      cancelBottomLock()
      return
    }

    // 강제 하단 고정
    const target = Math.max(0, el.scrollHeight - el.clientHeight)
    if (el.scrollTop !== target) {
      el.scrollTop = target
    }

    // 높이와 위치가 안정적인지 판단
    const currentHeight = el.scrollHeight
    const heightDelta = Math.abs(currentHeight - lastHeight)
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight

    if (heightDelta <= 1 && distanceFromBottom <= 1) {
      stable++
    } else {
      stable = 0
    }

    lastHeight = currentHeight

    if (stable >= stableFrames) {
      cancelBottomLock()
      return
    }

    bottomLockRafId = requestAnimationFrame(tick)
  }

  bottomLockRafId = requestAnimationFrame(tick)
}

const handleMouseEnter = () => {
  emit('mouseenter')
  hideScrollbar.value = false
}

const handleMouseLeave = () => {
  emit('mouseleave')
  hideScrollbar.value = true
}

// 만료된 높이 캐시 정리
const cleanupHeightCache = () => {
  if (heights.value.size > MAX_CACHE_SIZE) {
    // 모든 키를 가져와 최근 사용 시간순으로 정렬
    const keys = Array.from(heights.value.keys())
    const visibleKeys = new Set(
      props.items
        .slice(Math.max(0, visibleRange.value.start - BUFFER_SIZE), visibleRange.value.end + BUFFER_SIZE + 1)
        .map((item) => item.message?.id?.toString())
        .filter(Boolean)
    )

    // 가시 영역 캐시 유지
    const keysToDelete = keys.filter((key) => !visibleKeys.has(key))
    const deleteCount = keysToDelete.length - MAX_CACHE_SIZE / 2

    if (deleteCount > 0) {
      for (const key of keysToDelete.slice(0, deleteCount)) {
        heights.value.delete(key)
      }
      // 높이 캐시 재계산 필요 표시
      needsHeightRecalculation = true
    }
  }
}

// 가시 항목 계산
const visibleData = computed(() => {
  // 가시 범위에 따라 슬라이스하고 인덱스 정보 추가
  return props.items.slice(visibleRange.value.start, visibleRange.value.end + 1).map((item, index) => ({
    ...item,
    _index: visibleRange.value.start + index // 렌더링용 실제 인덱스 추가
  }))
})

// 목록 총 높이 계산 - 메모이제이션 캐시로 성능 최적화
const totalHeight = computed(() => {
  // 누적 높이 재계산이 필요한 경우 캐시 재설정
  if (needsHeightRecalculation) {
    updateAccumulatedHeights()
    needsHeightRecalculation = false
  }

  // 누적 높이 캐시가 있는 경우 마지막 값 직접 사용
  if (accumulatedHeights.value.length > 0 && accumulatedHeights.value.length === props.items.length) {
    return accumulatedHeights.value[accumulatedHeights.value.length - 1]
  }

  // 원래 계산 방법으로 대체
  return props.items.reduce((total, item) => {
    return total + (heights.value.get(item.message?.id?.toString()) || ESTIMATED_ITEM_HEIGHT)
  }, 0)
})

// 누적 높이 캐시 업데이트
const updateAccumulatedHeights = () => {
  accumulatedHeights.value = []
  let totalHeight = 0

  props.items.forEach((item) => {
    totalHeight += heights.value.get(item.message?.id?.toString()) || ESTIMATED_ITEM_HEIGHT
    accumulatedHeights.value.push(totalHeight)
  })
}

// 목록 데이터 변경 감지
watch(
  () => props.items,
  (newItems, oldItems) => {
    // 목록이 완전히 재설정되면 높이 캐시 지우기
    if (newItems.length === 0 || oldItems.length === 0) {
      heights.value.clear()
      accumulatedHeights.value = []
      previousVisibleIds.value.clear()
    }

    // 높이 캐시 재계산 필요 표시
    needsHeightRecalculation = true

    // 데이터 변경 시 가시 범위 재계산 및 높이 업데이트
    updateVisibleRange()
    nextTick(() => {
      updateItemHeight()
    })
  },
  { deep: false }
)

// 가시 데이터 변경 감지, 가시 항목 ID 집합 업데이트
watch(
  () => visibleData.value,
  (newVisibleData) => {
    // 현재 가시 항목 ID 집합 업데이트
    const currentVisibleIds = new Set(newVisibleData.map((item) => item.message?.id?.toString()).filter(Boolean))
    previousVisibleIds.value = currentVisibleIds
  },
  { deep: false }
)

// totalHeight 변경 감지, phantom 요소 높이 직접 업데이트
watch(
  () => totalHeight.value,
  (newHeight) => {
    updatePhantomHeight(newHeight)
  },
  { immediate: true }
)

// 보이지 않는 DOM 노드 정리
const cleanupInvisibleDOMNodes = () => {
  if (!containerRef.value) return
  if (!containerRef.value) return

  // 현재 가시 항목 ID 집합 가져오기
  const currentVisibleIds = new Set(visibleData.value.map((item) => item.message?.id?.toString()).filter(Boolean))

  // 더 이상 보이지 않는 항목 ID 찾기
  const invisibleIds = Array.from(previousVisibleIds.value).filter((id) => !currentVisibleIds.has(id))

  // 이전 가시 항목 ID 집합 업데이트
  previousVisibleIds.value = currentVisibleIds

  // 보이지 않는 항목이 없으면 바로 반환
  if (invisibleIds.length === 0) return

  // 가상 목록 콘텐츠 영역 가져오기
  const contentEl = containerRef.value.querySelector('.virtual-list-content')
  if (!contentEl) return

  // 보이지 않는 DOM 노드 정리
  let removedCount = 0
  for (const id of invisibleIds) {
    const el = document.getElementById(`item-${id}`)
    if (el && !el.hasAttribute('data-preserved')) {
      // DOM 노드 제거
      el.remove()
      removedCount++
    }
  }

  // 노드가 제거된 경우 가비지 컬렉션 트리거
  if (removedCount > 0 && window.gc) {
    try {
      window.gc()
    } catch (e) {
      // 오류 무시, gc를 사용하지 못할 수 있음
    }
  }
}

// DOM 노드 정리 타이머
const startDOMCleanupTimer = () => {
  if (cleanupTimerId !== null) {
    clearInterval(cleanupTimerId)
  }

  cleanupTimerId = window.setInterval(() => {
    cleanupInvisibleDOMNodes()
  }, DOM_CLEANUP_INTERVAL)
}

// 항목 실제 높이 업데이트
const updateItemHeight = () => {
  if (!containerRef.value) return

  // 가시 항목 순회, 실제 높이 측정 및 캐시
  for (const item of visibleData.value) {
    const id = item.message?.id?.toString()
    if (!id) continue

    const el = document.getElementById(`item-${id}`)
    if (el) {
      const height = el.getBoundingClientRect().height
      const oldHeight = heights.value.get(id)

      // 높이가 변경된 경우에만 캐시 업데이트 및 재계산 필요 표시
      if (oldHeight !== height) {
        heights.value.set(id, height)
        needsHeightRecalculation = true
      }
    }
  }

  // 만료된 캐시 정리
  cleanupHeightCache()

  // 비스크롤 상태에서 가시 범위 업데이트
  if (!isScrolling.value) {
    updateVisibleRange()
  }
}

// 스크롤 위치에 따른 시작 인덱스 계산 - 캐시를 사용하여 이진 탐색 최적화
const getStartIndex = (scrollTop: number) => {
  // 누적 높이 재계산이 필요한 경우 캐시 업데이트
  if (needsHeightRecalculation) {
    updateAccumulatedHeights()
    needsHeightRecalculation = false
  }

  // 이진 탐색 O(log n)
  let left = 0
  let right = accumulatedHeights.value.length - 1
  const target = scrollTop - OVERSCAN_SIZE

  while (left <= right) {
    const mid = Math.floor((left + right) / 2)
    if (accumulatedHeights.value[mid] < target) {
      left = mid + 1
    } else {
      right = mid - 1
    }
  }

  return Math.max(0, left - BUFFER_SIZE)
}

// 지정된 인덱스의 오프셋 계산 - 누적 높이 캐시 최적화 사용
const getOffsetForIndex = (index: number) => {
  // 누적 높이 재계산이 필요한 경우 캐시 업데이트
  if (needsHeightRecalculation) {
    updateAccumulatedHeights()
    needsHeightRecalculation = false
  }

  // 인덱스가 캐시 범위 내에 있으면 캐시 값 직접 사용
  if (index > 0 && index < accumulatedHeights.value.length) {
    return accumulatedHeights.value[index - 1]
  }

  // 원래 계산 방법으로 대체
  let total = 0
  for (let i = 0; i < index; i++) {
    const itemHeight = heights.value.get(props.items[i].message?.id?.toString()) || ESTIMATED_ITEM_HEIGHT
    total += itemHeight
  }
  return total
}

// 가시 범위 업데이트
const updateVisibleRange = () => {
  if (!containerRef.value) return

  const scrollTop = containerRef.value.scrollTop
  const clientHeight = containerRef.value.clientHeight

  // 시작 인덱스 계산
  const start = getStartIndex(scrollTop)
  let total = 0
  let end = start

  // 가시 영역 + 사전 렌더링 영역을 초과할 때까지 높이 누적
  while (total < clientHeight + OVERSCAN_SIZE * 2 && end < props.items.length) {
    const itemHeight = heights.value.get(props.items[end].message?.id?.toString()) || ESTIMATED_ITEM_HEIGHT
    total += itemHeight
    end++
  }

  // 종료 인덱스가 범위를 벗어나지 않도록 하고 버퍼 추가
  end = Math.min(props.items.length - 1, end + BUFFER_SIZE)

  // 가시 범위 및 오프셋 업데이트
  visibleRange.value = { start, end }
  // 오프셋 계산, 상단 팁을 위한 32px 공간 예약 (표시될 때)
  const topOffset = (!props.isLoadingMore && props.isLast) || (props.isLoadingMore && !props.isLast) ? 32 : 0
  const newOffset = getOffsetForIndex(start) + (props.isLoadingMore && !props.isLast ? LOADING_OFFSET : 0) + topOffset
  offset = newOffset
  updateContentOffset(newOffset)
}

// 가시 범위 업데이트 프레임 애니메이션 처리
const updateFrame = () => {
  if (!containerRef.value) return

  const currentScrollTop = containerRef.value.scrollTop

  // 더 불러오기 필요 여부 확인
  if (currentScrollTop < SCROLL_THRESHOLD && !props.isLoadingMore && !props.isLast) {
    emit('loadMore')
  }

  // 스크롤 위치 변경 확인
  if (currentScrollTop !== lastScrollTop) {
    // 스크롤 발생, 정지 프레임 카운트 재설정
    consecutiveStaticFrames = 0
    // 스크롤 방향 변경 이벤트 발생
    if (currentScrollTop < lastScrollTop) {
      emit('scrollDirectionChange', 'up')
    } else if (currentScrollTop > lastScrollTop) {
      emit('scrollDirectionChange', 'down')
    }
    updateVisibleRange()
    lastScrollTop = currentScrollTop
  } else {
    // 스크롤 위치 변경 없음, 정지 프레임 카운트 증가
    consecutiveStaticFrames++

    // 연속 3프레임 동안 스크롤이 없으면 스크롤 종료로 간주
    if (consecutiveStaticFrames >= 3) {
      // 스크롤 종료, 높이 업데이트 및 애니메이션 중지
      isScrolling.value = false
      updateItemHeight()
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
      return
    }
  }

  // 다음 프레임 계속
  rafId = requestAnimationFrame(updateFrame)
}

// 디바운스를 사용하여 스크롤 이벤트 처리
const debouncedEmitScroll = useDebounceFn((event: Event) => {
  emit('scroll', event)
  emitVisibleItems()
}, 16) // 약 60fps 빈도

// 스크롤 이벤트 처리
const handleScroll = (event: Event) => {
  // 디바운스를 사용하여 스크롤 이벤트 발생
  debouncedEmitScroll(event)

  // 스크롤 상태 표시 및 프레임 애니메이션 시작
  if (!isScrolling.value) {
    isScrolling.value = true
    consecutiveStaticFrames = 0
    if (rafId === null) {
      rafId = requestAnimationFrame(updateFrame)
    }
  }
}

const emitVisibleItems = () => {
  const visibleIds = visibleData.value.map((item) => item.message?.id?.toString()).filter(Boolean) as string[]

  emit('visibleItemsChange', visibleIds)
}

onMounted(() => {
  // 가시 범위 초기화
  updateVisibleRange()

  // DOM 스타일 초기화
  nextTick(() => {
    updatePhantomHeight(totalHeight.value)
    updateContentOffset(offset)
  })

  // ResizeObserver를 사용하여 컨테이너 크기 변경 감지
  if (containerRef.value) {
    // 디바운스를 사용하여 ResizeObserver 콜백 최적화
    const debouncedResize = useDebounceFn(() => {
      updateVisibleRange()
      nextTick(() => {
        updateItemHeight()
      })
    }, 100)

    resizeObserver = new ResizeObserver(() => {
      debouncedResize()
    })
    resizeObserver.observe(containerRef.value)
  }

  // 높이 계산 초기화
  nextTick(() => {
    updateItemHeight()
    // 누적 높이 캐시 초기화
    updateAccumulatedHeights()
  })

  // DOM 정리 타이머 시작
  startDOMCleanupTimer()
})

onUnmounted(() => {
  // 애니메이션 정리
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }

  // 하단 고정 애니메이션 정리
  if (bottomLockRafId !== null) {
    cancelAnimationFrame(bottomLockRafId)
    bottomLockRafId = null
  }

  // ResizeObserver 정리
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }

  // 타이머 정리
  if (cleanupTimerId !== null) {
    clearInterval(cleanupTimerId)
    cleanupTimerId = null
  }

  // 캐시 정리
  heights.value.clear()
  accumulatedHeights.value = []
  previousVisibleIds.value.clear()
})

// 타입 정의
export type VirtualListExpose = {
  scrollTo: (options: { index?: number; position?: 'top' | 'bottom'; behavior?: ScrollBehavior }) => void
  getContainer: () => HTMLElement | null
}

// 메서드 및 참조 노출
defineExpose<VirtualListExpose>({
  scrollTo: (options: { index?: number; position?: 'top' | 'bottom'; behavior?: ScrollBehavior }) => {
    if (!containerRef.value) return

    const executeScroll = () => {
      if (!containerRef.value) return

      if (options.position === 'bottom') {
        // 하단으로 스크롤하기 전에 높이가 업데이트되었는지 확인
        nextTick(() => {
          updateItemHeight()
          // 누적 높이가 업데이트되었는지 확인
          if (needsHeightRecalculation) {
            updateAccumulatedHeights()
            needsHeightRecalculation = false
          }
          nextTick(() => {
            if (containerRef.value) {
              // 올바른 스크롤 위치 계산: scrollHeight - clientHeight
              const scrollHeight = containerRef.value.scrollHeight
              const clientHeight = containerRef.value.clientHeight
              const targetScrollTop = Math.max(0, scrollHeight - clientHeight)

              containerRef.value.scrollTo({
                top: targetScrollTop,
                behavior: options.behavior || 'auto'
              })

              // 높이가 안정될 때까지 하단 고정 활성화
              lockBottomUntilStable()
            }
          })
        })
      } else if (options.position === 'top') {
        // 상단으로 스크롤
        containerRef.value.scrollTo({
          top: 0,
          behavior: options.behavior || 'auto'
        })
      } else if (typeof options.index === 'number') {
        // 지정된 인덱스 위치로 스크롤
        // 누적 높이가 업데이트되었는지 확인
        if (needsHeightRecalculation) {
          updateAccumulatedHeights()
          needsHeightRecalculation = false
        }
        const offset = getOffsetForIndex(options.index)
        containerRef.value.scrollTo({
          top: offset,
          behavior: options.behavior || 'auto'
        })
      }
    }

    // 즉시 한 번 실행; 부드러운 스크롤 시에만 한 번 더 보정
    executeScroll()
    if (options.behavior === 'smooth') {
      setTimeout(executeScroll, 100)
    }
  },
  getContainer: () => containerRef.value
})
</script>

<style scoped lang="scss">
.virtual-list-container {
  position: relative;
  overflow-y: auto;
  height: 100%;
  -webkit-overflow-scrolling: touch; /* iOS에서 부드러운 스크롤 제공 */
  overscroll-behavior: contain; /* 스크롤이 부모 요소로 전파되는 것을 방지 */
  box-sizing: border-box;
  /* 항상 스크롤바 공간 유지 */
  scrollbar-gutter: stable;
  /* 스크롤바 공간 예약 */
  padding-right: 6px;
  /* 호환성 작성법, 다양한 브라우저에서 일관된 스크롤바 공간 확보 */
  overflow-y: scroll;
  overscroll-behavior: none; /* mac의 "바운스" 효과 비활성화 */

  /* 스크롤바 스타일 */
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
    min-height: 75px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background-color: rgba(144, 144, 144, 0.5);
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  /* WebKit 호환 방식으로 스크롤바 숨기기 */
  &.hide-scrollbar {
    /* 스크롤 기능은 유지하되 스크롤바는 숨김 */
    &::-webkit-scrollbar {
      background: transparent;
    }
    &::-webkit-scrollbar-thumb {
      background: transparent;
    }
    /* 레이아웃 안정성 유지 */
    margin-right: 0;
    padding-right: 12px; /* 6px 원본 + 6px 보정 */
  }

  &.show-scrollbar {
    scrollbar-gutter: auto;
  }
}

.virtual-list-phantom {
  position: absolute;
  left: 0;
  top: 0;
  right: 6px; /* 스크롤바 공간 예약 */
  z-index: -1;
}

.virtual-list-content {
  position: absolute;
  left: 0;
  right: 6px; /* 스크롤바 공간 예약 */
  top: 0;
  will-change: transform;
  transform: translateZ(0); /* GPU 가속 활성화 */
  backface-visibility: hidden; /* 깜박임 방지 */
  perspective: 1000; /* 3D 효과 강화 */
  z-index: 1; /* 콘텐츠가 힌트 텍스트 위에 오도록 함 */
}
</style>
