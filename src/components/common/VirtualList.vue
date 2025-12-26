<template>
  <div
    ref="containerRef"
    class="virtual-list-container"
    :class="{ 'hide-scrollbar': hideScrollbar }"
    @scroll.passive="handleScroll"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave">
    <n-flex v-if="!isLoadingMore && isLast" justify="center" class="box-border absolute-x-center pt-10px">
      <span class="text-(12px #909090)">모든 메시지 내용을 불러왔습니다</span>
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
const DEFAULT_ESTIMATED_HEIGHT = 80 // 기본 예상 항목 높이
const BUFFER_SIZE = props.buffer || 5 // 상하 버퍼 영역의 수
const OVERSCAN_SIZE = 1000 // 사전 렌더링 영역의 픽셀 높이, 스크롤 시 빈 공간 방지
const MAX_CACHE_SIZE = 100 // 높이 캐시의 최대 수
const LOADING_OFFSET = 26 // 로딩 중 필요한 오프셋(26px은 로딩 애니메이션 높이)
const ESTIMATED_ITEM_HEIGHT = props.estimatedItemHeight || DEFAULT_ESTIMATED_HEIGHT // 항목별 예상 높이
const SCROLL_THRESHOLD = 26 // 상단 스크롤 임계값, 추가 로드 트리거용
const DOM_CLEANUP_INTERVAL = 60000 // DOM 정리 간격, 기본 1분

// 반응형 참조
const containerRef = ref<HTMLElement | null>(null) // 컨테이너 요소 참조
const phantomRef = ref<HTMLElement | null>(null) // phantom 요소 참조
const contentRef = ref<HTMLElement | null>(null) // content 요소 참조
// 일반 변수 (반응형 불필요)
let offset = 0 // 내용 영역의 오프셋
let rafId: number | null = null // requestAnimationFrame의 ID
let lastScrollTop = 0 // 이전 스크롤 위치
let consecutiveStaticFrames = 0 // 연속 정지 프레임 카운트
let needsHeightRecalculation = true // 높이 캐시 재계산 필요 여부 마킹
let cleanupTimerId: number | null = null // DOM 정기 정리 타이머 ID
let resizeObserver: ResizeObserver | null = null // ResizeObserver 인스턴스
let bottomLockRafId: number | null = null // 하단 고정 안정화 RAF ID

// 반응형 변수 (반응형 필요)
const heights = ref<Map<string, number>>(new Map()) // 각 항목의 실제 높이 저장, 키는 메시지 ID
const visibleRange = ref({ start: 0, end: 0 }) // 현재 가시 영역의 시작 및 종료 인덱스
const isScrolling = ref(false) // 스크롤 중 여부
const accumulatedHeights = ref<number[]>([]) // 누적 높이 캐시, 이진 탐색 최적화용
const hideScrollbar = ref(true) // 스크롤바 표시/숨김
const previousVisibleIds = ref<Set<string>>(new Set()) // 이전 가시 항목 ID 집합

// phantom 요소 높이를 직접 업데이트하는 함수
const updatePhantomHeight = (height: number) => {
  if (phantomRef.value) {
    phantomRef.value.style.height = `${height}px`
  }
}

// content 요소 오프셋을 직접 업데이트하는 함수
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

    // 가시 영역의 캐시 유지
    const keysToDelete = keys.filter((key) => !visibleKeys.has(key))
    const deleteCount = keysToDelete.length - MAX_CACHE_SIZE / 2

    if (deleteCount > 0) {
      for (const key of keysToDelete.slice(0, deleteCount)) {
        heights.value.delete(key)
      }
      // 높이 캐시 재계산 표시
      needsHeightRecalculation = true
    }
  }
}

// 가시 항목 계산
const visibleData = computed(() => {
  // 가시 범위에 따라 슬라이스하고 인덱스 정보 추가
  return props.items.slice(visibleRange.value.start, visibleRange.value.end + 1).map((item, index) => ({
    ...item,
    _index: visibleRange.value.start + index // 렌더링을 위한 실제 인덱스 추가
  }))
})

// 리스트 총 높이 계산 - 메모이제이션 캐시를 사용한 성능 최적화
const totalHeight = computed(() => {
  // 누적 높이 재계산이 필요한 경우 캐시 업데이트
  if (needsHeightRecalculation) {
    updateAccumulatedHeights()
    needsHeightRecalculation = false
  }

  // 누적 높이 캐시가 있으면 마지막 값 사용
  if (accumulatedHeights.value.length > 0 && accumulatedHeights.value.length === props.items.length) {
    return accumulatedHeights.value[accumulatedHeights.value.length - 1]
  }

  // 기존 계산 방식으로 폴백
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

// 리스트 데이터 변경 감지
watch(
  () => props.items,
  (newItems, oldItems) => {
    // 리스트가 완전히 초기화되면 높이 캐시 삭제
    if (newItems.length === 0 || oldItems.length === 0) {
      heights.value.clear()
      accumulatedHeights.value = []
      previousVisibleIds.value.clear()
    }

    // 높이 캐시 재계산 표시
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
    // 현재 가시 항목의 ID 집합 업데이트
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

// 가시적이지 않은 DOM 노드 정리
const cleanupInvisibleDOMNodes = () => {
  if (!containerRef.value) return
  if (!containerRef.value) return

  // 현재 가시 항목의 ID 집합 가져오기
  const currentVisibleIds = new Set(visibleData.value.map((item) => item.message?.id?.toString()).filter(Boolean))

  // 더 이상 가시적이지 않은 항목 ID 찾기
  const invisibleIds = Array.from(previousVisibleIds.value).filter((id) => !currentVisibleIds.has(id))

  // 이전 가시 항목 ID 집합 업데이트
  previousVisibleIds.value = currentVisibleIds

  // 가시적이지 않은 항목이 없으면 즉시 반환
  if (invisibleIds.length === 0) return

  // 가상 리스트 컨텐츠 영역 가져오기
  const contentEl = containerRef.value.querySelector('.virtual-list-content')
  if (!contentEl) return

  // 가시적이지 않은 DOM 노드 정리
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
      // 오류 무시, gc가 사용 불가능할 수 있음
    }
  }
}

// DOM 노드 정기 정리 시작
const startDOMCleanupTimer = () => {
  if (cleanupTimerId !== null) {
    clearInterval(cleanupTimerId)
  }

  cleanupTimerId = window.setInterval(() => {
    cleanupInvisibleDOMNodes()
  }, DOM_CLEANUP_INTERVAL)
}

// 항목의 실제 높이 업데이트
const updateItemHeight = () => {
  if (!containerRef.value) return

  // 가시 항목을 순회하며 실제 높이 측정 및 캐시
  for (const item of visibleData.value) {
    const id = item.message?.id?.toString()
    if (!id) continue

    const el = document.getElementById(`item-${id}`)
    if (el) {
      const height = el.getBoundingClientRect().height
      const oldHeight = heights.value.get(id)

      // 높이가 변경된 경우에만 캐시 업데이트 및 재계산 마킹
      if (oldHeight !== height) {
        heights.value.set(id, height)
        needsHeightRecalculation = true
      }
    }
  }

  // 만료된 캐시 정리
  cleanupHeightCache()

  // 스크롤 중이 아닐 때 가시 범위 업데이트
  if (!isScrolling.value) {
    updateVisibleRange()
  }
}

// 스크롤 위치에 기반한 시작 인덱스 계산 - 누적 높이 캐시를 사용한 최적화
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

// 지정 인덱스의 오프셋 계산 - 누적 높이 캐시를 사용하여 최적화
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

  // 기존 계산 방식으로 폴백
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

  // 가시 영역과 사전 렌더링 영역까지의 높이 합산
  while (total < clientHeight + OVERSCAN_SIZE * 2 && end < props.items.length) {
    const itemHeight = heights.value.get(props.items[end].message?.id?.toString()) || ESTIMATED_ITEM_HEIGHT
    total += itemHeight
    end++
  }

  // 종료 인덱스가 범위를 벗어나지 않도록 하고 버퍼 추가
  end = Math.min(props.items.length - 1, end + BUFFER_SIZE)

  // 가시 범위와 오프셋 업데이트
  visibleRange.value = { start, end }
  // 상단 힌트를 위한 32px 공간 예약 (표시될 때)
  const topOffset = (!props.isLoadingMore && props.isLast) || (props.isLoadingMore && !props.isLast) ? 32 : 0
  const newOffset = getOffsetForIndex(start) + (props.isLoadingMore && !props.isLast ? LOADING_OFFSET : 0) + topOffset
  offset = newOffset
  updateContentOffset(newOffset)
}

// 가시 범위 업데이트 프레임 애니메이션 처리
const updateFrame = () => {
  if (!containerRef.value) return

  const currentScrollTop = containerRef.value.scrollTop

  // 추가 로딩 필요 여부 체크
  if (currentScrollTop < SCROLL_THRESHOLD && !props.isLoadingMore && !props.isLast) {
    emit('loadMore')
  }

  // 스크롤 위치 변화 체크
  if (currentScrollTop !== lastScrollTop) {
    // 스크롤 발생, 정지 프레임 카운트 초기화
    consecutiveStaticFrames = 0
    // 스크롤 방향 변화 이벤트 발생
    if (currentScrollTop < lastScrollTop) {
      emit('scrollDirectionChange', 'up')
    } else if (currentScrollTop > lastScrollTop) {
      emit('scrollDirectionChange', 'down')
    }
    updateVisibleRange()
    lastScrollTop = currentScrollTop
  } else {
    // 스크롤 위치 변화 없음, 정지 프레임 카운트 증가
    consecutiveStaticFrames++

    // 연속 3프레임 동안 스크롤이 없으면 스크롤 종료로 판단
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

  // 다음 프레임 계속 진행
  rafId = requestAnimationFrame(updateFrame)
}

// 디바운스를 사용한 스크롤 이벤트 처리
const debouncedEmitScroll = useDebounceFn((event: Event) => {
  emit('scroll', event)
  emitVisibleItems()
}, 16) // 약 60fps 빈도

// 스크롤 이벤트 핸들러
const handleScroll = (event: Event) => {
  // 디바운스된 스크롤 이벤트 발생
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
    // 디바운스를 사용한 ResizeObserver 콜백 최적화
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
        // 하단 스크롤 전 높이 업데이트 확인
        nextTick(() => {
          updateItemHeight()
          // 누적 높이 업데이트 확인
          if (needsHeightRecalculation) {
            updateAccumulatedHeights()
            needsHeightRecalculation = false
          }
          nextTick(() => {
            if (containerRef.value) {
              // 정확한 스크롤 위치 계산: scrollHeight - clientHeight
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
        // 상단 스크롤
        containerRef.value.scrollTo({
          top: 0,
          behavior: options.behavior || 'auto'
        })
      } else if (typeof options.index === 'number') {
        // 지정 인덱스로 스크롤
        // 누적 높이 업데이트 확인
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

    // 즉시 실행; 부드러운 스크롤인 경우에만 한 번 더 보정
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
  overscroll-behavior: contain; /* 부모 요소로 스크롤 전파 방지 */
  box-sizing: border-box;
  /* 항상 스크롤바 공간 유지 */
  scrollbar-gutter: stable;
  /* 스크롤바를 위한 공간 예약 */
  padding-right: 6px;
  /* 호환성 보장: 다양한 브라우저에서 일관된 스크롤바 공간 확보 */
  overflow-y: scroll;
  overscroll-behavior: none; /* Mac의 바운스 효과 방지 */

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
  backface-visibility: hidden; /* 깜빡임 방지 */
  perspective: 1000; /* 3D 효과 강화 */
  z-index: 1; /* 컨텐츠가 가이드 텍스트 위에 오도록 설정 */
}
</style>
