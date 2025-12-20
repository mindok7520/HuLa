<template>
  <div class="flex flex-col h-full">
    <img src="@/assets/mobile/chat-home/background.webp" class="w-100% fixed z-0 top-0" alt="hula" />

    <!-- 설정 영역 -->
    <Settings />

    <PersonalInfo :is-show="isShow"></PersonalInfo>

    <div class="relative top-0 flex-1 flex">
      <div ref="measureRef" class="h-full w-full absolute top-0 z-0"></div>
      <!-- 게시물 내용 -->
      <div
        ref="scrollContainer"
        :style="{ height: tabHeight + 'px' }"
        class="z-1 overflow-y-auto mt-2 absolute z-3 w-full">
        <div class="custom-rounded bg-white flex px-24px flex-col gap-4 z-1 p-10px mt-4">
          <n-scrollbar ref="scrollbarRef" :style="{ height: tabHeight + 'px' }" @scroll="handleScroll">
            <!-- 게시물 내용 영역 -->
            <div class="py-12px">
              <DynamicList
                mode="mobile"
                @preview-image="previewImage"
                @video-play="handleVideoPlay"
                @load-more="loadMore"
                @item-click="handleItemClick" />
            </div>
          </n-scrollbar>
        </div>
      </div>
    </div>

    <div
      @click="toPublishCommunity"
      class="w-52px h-52px rounded-full absolute bottom-120px right-20px z-3 flex items-center justify-center bg-[linear-gradient(145deg,#ACD7DA,#13987F)] shadow-[0_4px_12px_rgba(0,0,0,0.25),0_0_12px_rgba(172,215,218,0.8)]">
      <div class="relative w-20px h-20px">
        <!-- 세로선 -->
        <div class="absolute left-1/2 top-0 h-full w-2px bg-white -translate-x-1/2"></div>
        <!-- 가로선 -->
        <div class="absolute top-1/2 left-0 w-full h-2px bg-white -translate-y-1/2"></div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import PersonalInfo from '#/components/my/PersonalInfo.vue'
import Settings from '#/components/my/Settings.vue'
import router from '@/router'
import { useFeedStore } from '@/stores/feed'
import DynamicList from '@/components/common/DynamicList.vue'

const feedStore = useFeedStore()

const measureRef = ref<HTMLDivElement>()

const tabHeight = ref(300)

const measureElementObserver = new ResizeObserver((event) => {
  tabHeight.value = event[0].contentRect.height
})

const toPublishCommunity = () => {
  router.push('/mobile/mobileMy/publishCommunity')
}

const loadMore = async () => {
  await feedStore.loadMore()
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

// 게시물 항목 클릭 처리
const handleItemClick = (feedId: string) => {
  router.push({
    name: 'mobileDynamicDetail',
    params: { id: feedId }
  })
}

const isShow = ref(true)

const avatarBox = ref<HTMLElement | null>(null)

watch(isShow, (show) => {
  const box = avatarBox.value
  if (!box) return

  box.style.overflow = 'hidden'
  box.style.transition = 'all 0.3s ease'

  if (show) {
    // 표시: 축소에서 원래 높이로 복원
    box.style.height = box.scrollHeight + 'px'
    box.style.opacity = '1'
    box.style.transform = 'scale(1) translateY(0)'

    box.addEventListener(
      'transitionend',
      () => {
        box.style.height = 'auto' // 적응형 높이로 복귀
        box.style.overflow = ''
      },
      { once: true }
    )
  } else {
    // 숨김: 축소 및 높이 접기
    box.style.height = box.scrollHeight + 'px' // 먼저 현재 높이로 설정
    requestAnimationFrame(() => {
      box.style.height = '58px' // 약간 작은 높이 유지 (원본 86px, 0.65 배율 축소 시 약 56px)
      box.style.transform = 'scale(1) translateY(0)'
    })
  }
})

const infoBox = ref<HTMLElement | null>(null)
watch(isShow, (show) => {
  const info = infoBox.value
  if (!info) return

  // 애니메이션 전환 추가 (class에 직접 작성 가능)
  info.style.transition = 'transform 0.3s ease'

  if (show) {
    info.style.transform = 'translateX(0)'
  } else {
    info.style.transform = 'translateX(-20px)' // 👈 왼쪽으로 약간 이동
  }
})

const scrollContainer = ref<HTMLElement | null>(null)

const lastScrollTop = ref(0)
const hasTriggeredHide = ref(false)

onMounted(async () => {
  if (measureRef.value) {
    measureElementObserver.observe(measureRef.value)
  }

  // 초기 게시물 목록 로드
  await feedStore.getFeedList(true)
})

onUnmounted(() => {
  if (measureRef.value) {
    measureElementObserver.unobserve(measureRef.value)
  }
})

const handleScroll = (event: Event) => {
  const target = event.target as HTMLElement
  if (!target) return

  const scrollTop = target.scrollTop

  // 위로 스와이프
  if (scrollTop - lastScrollTop.value > 0) {
    if (scrollTop > 700 && isShow.value && !hasTriggeredHide.value) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          isShow.value = false
          hasTriggeredHide.value = true
        })
      })
    }
  }

  // 아래로 스와이프하여 상단 영역으로 복귀
  if (scrollTop < 580) {
    requestAnimationFrame(() => {
      isShow.value = true
      hasTriggeredHide.value = false
      if (scrollContainer.value) {
        scrollContainer.value.scrollTop = 0
      }
    })
  }

  lastScrollTop.value = scrollTop
}
</script>
<style lang="scss" scoped>
$text-font-size-base: 14px;

$font-family-system: -apple-system, BlinkMacSystemFont;
$font-family-windows: 'Segoe UI', 'Microsoft YaHei';
$font-family-chinese: 'PingFang SC', 'Hiragino Sans GB';
$font-family-sans: 'Helvetica Neue', Helvetica, Arial, sans-serif;

.text-bold-style {
  font-size: 14px;
  font-family: $font-family-system, $font-family-windows, $font-family-sans;
  color: #757775;
}

.medal-number {
  margin: 0 5px 0 3px;
  font-style: italic;
  font-weight: bolder;
  font-size: 1.25em;
  font-family: $font-family-system, $font-family-windows, $font-family-chinese, $font-family-sans;
}

.fans-number {
  font-size: $text-font-size-base;
  font-family: $font-family-system, $font-family-windows, $font-family-chinese, $font-family-sans;
}

.custom-rounded {
  border-top-left-radius: 20px; /* 左上角 */
  border-top-right-radius: 20px;
  overflow: hidden;
}

.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.3s ease;
}

.slide-fade-enter-from {
  opacity: 0;
  transform: translateY(-20px);
}
.slide-fade-enter-to {
  opacity: 1;
  transform: translateY(0);
}

.slide-fade-leave-from {
  opacity: 1;
  transform: translateY(0);
}
.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

.medal-fade-enter-active,
.medal-fade-leave-active {
  transition:
    max-height 0.3s ease,
    opacity 0.3s ease;
  overflow: hidden;
}

.medal-fade-enter-from {
  max-height: 0;
  opacity: 0;
}

.medal-fade-enter-to {
  max-height: 24px; // 和你容器展开时的高度一致
  opacity: 1;
}

.medal-fade-leave-from {
  max-height: 24px;
  opacity: 1;
}

.medal-fade-leave-to {
  max-height: 0;
  opacity: 0;
}

.avatar-collapsible {
  transition: all 0.3s ease;
  transform-origin: top;
}
</style>
