<template>
  <div
    class="size-full bg-#222 relative flex flex-col select-none"
    @mousemove="handleMouseMove"
    @mouseleave="handleMouseLeave">
    <!-- 상단 조작 바 -->
    <ActionBar class="bg-#000 z-9999" :shrink="false" :current-label="currentLabel" />

    <!-- 본문 내용 영역 -->
    <div ref="contentRef" class="flex-1 overflow-auto">
      <!-- 이미지 표시 영역 -->
      <div ref="imgContainerRef" style="min-height: calc(100vh / var(--page-scale, 1) - 124px)" class="flex-center">
        <img
          ref="imageRef"
          :src="currentImage"
          :style="{
            willChange: isDragging ? 'transform' : 'auto',
            cursor: isDragging ? 'grabbing' : 'grab'
          }"
          class="max-w-90% max-h-90% select-none"
          :class="[{ 'transition-transform duration-200': !isDragging }]"
          @mousedown="startDrag"
          @load="checkScrollbar"
          alt="preview" />

        <!-- 안내 텍스트 -->
        <transition name="viewer-tip">
          <div
            v-if="showTip"
            class="fixed z-10 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/60 px-24px py-12px rounded-8px text-(white 14px) transition-all duration-300 backdrop-blur-sm select-none flex items-center gap-8px">
            <svg class="size-16px"><use href="#info"></use></svg>
            {{ tipText }}
          </div>
        </transition>
      </div>
    </div>

    <!-- 좌우 화살표 -->
    <div
      v-show="imageList.length > 1 && showArrows.left"
      @click="prevImage"
      @mouseenter="handleArrowEnter('left')"
      @mouseleave="handleArrowLeave('left')"
      class="fixed left-20px top-1/2 -translate-y-1/2 size-40px rounded-full bg-black/30 flex-center cursor-pointer hover:bg-black/50 transition-all duration-200 opacity-0 z-10"
      :class="{ 'opacity-100': showArrows.left }">
      <svg class="size-24px color-white rotate-180"><use href="#arrow-right"></use></svg>
    </div>
    <div
      v-show="imageList.length > 1 && showArrows.right"
      @click="nextImage"
      @mouseenter="handleArrowEnter('right')"
      @mouseleave="handleArrowLeave('right')"
      class="fixed right-20px top-1/2 -translate-y-1/2 size-40px rounded-full bg-black/30 flex-center cursor-pointer hover:bg-black/50 transition-all duration-200 opacity-0 z-10"
      :class="{ 'opacity-100': showArrows.right }">
      <svg class="size-24px color-white"><use href="#arrow-right"></use></svg>
    </div>

    <!-- 하단 도구 모음 -->
    <div data-tauri-drag-region class="z-9999 h-50px bg-#000 flex justify-center items-center gap-30px">
      <n-tooltip placement="top">
        <template #trigger>
          <svg @click="zoomOut" class="size-24px cursor-pointer color-white"><use href="#zoom-out"></use></svg>
        </template>
        {{ t('message.image_viewer.zoom_out') }}
      </n-tooltip>

      <span class="color-white text-14px min-w-50px text-center select-none">{{ scaleText }}</span>

      <n-tooltip placement="top">
        <template #trigger>
          <svg @click="zoomIn" class="size-24px cursor-pointer color-white"><use href="#zoom-in"></use></svg>
        </template>
        {{ t('message.image_viewer.zoom_in') }}
      </n-tooltip>

      <n-tooltip placement="top">
        <template #trigger>
          <svg @click="rotateLeft" class="size-24px cursor-pointer scale-x--100 color-white">
            <use href="#RotateRight"></use>
          </svg>
        </template>
        {{ t('message.image_viewer.rotate_left') }}
      </n-tooltip>

      <n-tooltip placement="top">
        <template #trigger>
          <svg @click="rotateRight" class="size-24px cursor-pointer color-white"><use href="#RotateRight"></use></svg>
        </template>
        {{ t('message.image_viewer.rotate_right') }}
      </n-tooltip>

      <n-tooltip placement="top">
        <template #trigger>
          <svg @click="resetImage()" class="size-24px cursor-pointer color-white"><use href="#refresh"></use></svg>
        </template>
        {{ t('message.image_viewer.reset') }}
      </n-tooltip>

      <n-tooltip placement="top">
        <template #trigger>
          <svg @click="saveImage" class="size-24px cursor-pointer color-white"><use href="#Importing"></use></svg>
        </template>
        {{ t('message.image_viewer.save_as') }}
      </n-tooltip>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getCurrentWebviewWindow, WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { save } from '@tauri-apps/plugin-dialog'
import { NTooltip } from 'naive-ui'
import ActionBar from '@/components/windows/ActionBar.vue'
import { useDownload } from '@/hooks/useDownload'
import { useImageViewer as useImageViewerHook } from '@/hooks/useImageViewer'
import { useTauriListener } from '@/hooks/useTauriListener'
import { useImageViewer as useImageViewerStore } from '@/stores/imageViewer.ts'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const { addListener } = useTauriListener()
const { downloadFile } = useDownload()
const imageViewerStore = useImageViewerStore()
const { downloadOriginalByIndex } = useImageViewerHook()
const appWindow = WebviewWindow.getCurrent()

// 데이터 초기화
const imageList = ref<string[]>([])

const currentLabel = WebviewWindow.getCurrent().label
const currentIndex = ref(0)
const scale = ref(1)
const rotation = ref(0)
const isDragging = ref(false)
const dragStart = reactive({ x: 0, y: 0 })
const imagePosition = reactive({ x: 0, y: 0 })
const imageRef = ref<HTMLImageElement>()
// 스크롤바 유무를 추적하기 위한 반응형 변수 추가
const contentScrollbar = useTemplateRef<HTMLElement>('contentRef')
// 이미지 컨테이너
const imgContainer = useTemplateRef<HTMLElement>('imgContainerRef')
// 안내 관련 반응형 변수
const showTip = ref(false)
const tipText = ref('')
// 좌우 화살표 표시
const showArrows = reactive({
  left: false,
  right: false,
  leftHover: false,
  rightHover: false
})

// 확대/축소 배율 표시를 위한 계산된 속성 추가
const scaleText = computed(() => {
  return `${Math.round(scale.value * 100)}%`
})
// 현재 표시되는 이미지 URL
const currentImage = computed(() => {
  if (imageViewerStore.isSingleMode) {
    return imageViewerStore.singleImage
  }
  return imageList.value[currentIndex.value]
})

// 마우스 이동 처리 함수
const handleMouseMove = (e: MouseEvent) => {
  const { clientX } = e
  const { innerWidth } = window

  // 왼쪽 화살표 표시 로직
  if (!showArrows.leftHover) {
    showArrows.left = clientX <= 78
  }

  // 오른쪽 화살표 표시 로직
  if (!showArrows.rightHover) {
    showArrows.right = innerWidth - clientX <= 78
  }
}

// 전체 컨테이너에서 마우스가 벗어날 때의 처리 추가
const handleMouseLeave = () => {
  if (!showArrows.leftHover) {
    showArrows.left = false
  }
  if (!showArrows.rightHover) {
    showArrows.right = false
  }
}

// 화살표 호버 상태 처리 추가
const handleArrowEnter = (direction: 'left' | 'right') => {
  showArrows[`${direction}Hover`] = true
  showArrows[direction] = true
}

const handleArrowLeave = (direction: 'left' | 'right') => {
  showArrows[`${direction}Hover`] = false
  showArrows[direction] = false
}

// 이미지 드래그 관련
const startDrag = (e: MouseEvent) => {
  isDragging.value = true
  dragStart.x = e.clientX - imagePosition.x
  dragStart.y = e.clientY - imagePosition.y

  // 성능 최적화를 위해 addEventListener의 세 번째 매개변수 { passive: true } 사용
  document.addEventListener('mousemove', handleDrag, { passive: true })
  document.addEventListener('mouseup', stopDrag)
}

const stopDrag = () => {
  isDragging.value = false
  document.removeEventListener('mousemove', handleDrag)
  document.removeEventListener('mouseup', stopDrag)
}

const updateTransform = () => {
  if (!imageRef.value) return
  const transform = `translate3d(${imagePosition.x}px, ${imagePosition.y}px, 0) scale3d(${scale.value}, ${scale.value}, 1) rotate(${rotation.value}deg)`

  requestAnimationFrame(() => {
    if (imageRef.value) {
      imageRef.value.style.transform = transform
    }
  })
}

const handleDrag = (e: MouseEvent) => {
  if (!isDragging.value) return
  imagePosition.x = e.clientX - dragStart.x
  imagePosition.y = e.clientY - dragStart.y
  updateTransform()
}

// 도구 모음 조작
const zoomIn = () => {
  scale.value = Math.min(5, scale.value + 0.1)
  updateTransform()
}

const zoomOut = () => {
  scale.value = Math.max(0.1, scale.value - 0.1)
  updateTransform()
}

const rotateLeft = () => {
  rotation.value -= 90
  updateTransform()
}

const rotateRight = () => {
  rotation.value += 90
  updateTransform()
}

// 이미지 초기화
const resetImage = (immediate = false) => {
  scale.value = 1
  rotation.value = 0
  imagePosition.x = 0
  imagePosition.y = 0
  if (imageRef.value) {
    if (immediate) {
      // 트랜지션 애니메이션 없이 즉시 초기화
      imageRef.value.style.transition = 'none'
      imageRef.value.style.transform = ''
      // 강제 다시 그리기
      imageRef.value.offsetHeight
      // 트랜지션 애니메이션 복구
      imageRef.value.style.transition = ''
    } else {
      imageRef.value.style.transform = ''
    }
  }
}

const saveImage = async () => {
  const imageUrl = currentImage.value
  const suggestedName = imageUrl.split('/').pop() || 'image.png'

  const savePath = await save({
    filters: [
      {
        name: t('message.image_viewer.filter_name'),
        extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp']
      }
    ],
    defaultPath: suggestedName
  })

  if (savePath) {
    await downloadFile(imageUrl, savePath)
  }
}

// 안내 메시지 표시 함수
const showTipMessage = (message: string) => {
  tipText.value = message
  showTip.value = true
  setTimeout(() => {
    showTip.value = false
  }, 1500)
}

// 이미지 전환 함수 수정
const syncCurrentIndex = (index: number) => {
  currentIndex.value = index
  imageViewerStore.currentIndex = index
  downloadOriginalByIndex(index)
}

const prevImage = () => {
  if (currentIndex.value > 0) {
    resetImage(true) // 즉시 초기화
    syncCurrentIndex(currentIndex.value - 1)
  } else {
    showTipMessage(t('message.image_viewer.first_image'))
  }
}

const nextImage = () => {
  if (currentIndex.value < imageList.value.length - 1) {
    resetImage(true) // 즉시 초기화
    syncCurrentIndex(currentIndex.value + 1)
  } else {
    showTipMessage(t('message.image_viewer.last_image'))
  }
}

// 키보드 이벤트 처리 추가
const handleKeydown = (e: KeyboardEvent) => {
  switch (e.key) {
    case 'ArrowLeft':
      prevImage()
      break
    case 'ArrowRight':
      nextImage()
      break
    case '=':
    case '+':
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        zoomIn()
      }
      break
    case '-':
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        zoomOut()
      }
      break
    case '0':
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        resetImage()
      }
      break
    case 'Escape':
      appWindow.close()
      break
  }
}

// 스크롤바 유무 확인 함수
const checkScrollbar = () => {
  if (!imgContainer.value || !contentScrollbar.value || !imageRef.value) return

  imgContainer.value.style.height = 'auto' // 정확한 계산을 위해 먼저 auto로 재설정
  // 스크롤바 유무 확인
  imgContainer.value.style.height =
    contentScrollbar.value.scrollHeight > contentScrollbar.value.clientHeight ? 'auto' : '100%'
}

onMounted(async () => {
  // 창 표시
  await getCurrentWebviewWindow().show()

  await addListener(
    appWindow.listen('update-image', (event: any) => {
      const { index } = event.payload
      imageList.value = imageViewerStore.imageList
      syncCurrentIndex(index)
      // 이미지 상태 초기화
      resetImage(true)
    }),
    'update-image'
  )

  if (imageViewerStore.isSingleMode) {
    // 단일 이미지 모드에서는 imageList와 currentIndex를 설정할 필요가 없음
    imageList.value = [imageViewerStore.singleImage]
    syncCurrentIndex(0)
  } else {
    // 다중 이미지 모드는 기존 로직 유지
    imageList.value = imageViewerStore.imageList
    syncCurrentIndex(imageViewerStore.currentIndex)
  }

  // 키보드 이벤트 감지
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  document.removeEventListener('mousemove', handleDrag)
  document.removeEventListener('mouseup', stopDrag)
})
</script>

<style scoped>
.viewer-tip-enter-active,
.viewer-tip-leave-active {
  transition: opacity 0.3s ease;
}

.viewer-tip-enter-from,
.viewer-tip-leave-to {
  opacity: 0;
}

/* 사용자 정의 스크롤바 스타일 */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

/* ActionBar의 svg 색상을 수정하기 위해 다음 스타일 추가 */
:deep(.action-close),
:deep(.hover-box) {
  svg {
    color: #fff !important;
  }
}
</style>
