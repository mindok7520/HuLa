<template>
  <div class="flex flex-col h-full">
    <HeaderBar
      :isOfficial="false"
      :hidden-right="true"
      :enable-default-background="false"
      :enable-shadow="false"
      room-name="사용자 프로필" />

    <img src="@/assets/mobile/chat-home/background.webp" class="w-100% fixed top-0" alt="hula" />

    <PersonalInfo :is-my-page="isMyPage" :is-show="isShow"></PersonalInfo>

    <div class="relative top-0 flex-1 flex">
      <div ref="measureRef" class="h-full w-full absolute top-0 z-0"></div>

      <div ref="scrollContainer" :style="{ height: tabHeight + 'px' }" class="z-1 overflow-y-auto absolute z-3">
        <div class="custom-rounded flex px-24px flex-col gap-4 z-1 p-10px mt-4 shadow">
          <CommunityTab
            :style="{ height: tabHeight - 10 + 'px' }"
            :custom-height="tabHeight - 10"
            @scroll="handleScroll"
            @update="onUpdate"
            :options="tabOptions"
            active-tab-name="find">
            <template #find>
              <!-- 로딩 상태 -->
              <div
                v-if="feedOptions.isLoading && feedList.length === 0"
                class="flex justify-center items-center py-20px">
                <n-spin size="large" />
              </div>

              <!-- 빈 상태 -->
              <div v-else-if="feedList.length === 0" class="flex justify-center items-center py-40px text-gray-500">
                게시물 없음
              </div>

              <!-- 게시물 목록 -->
              <template v-else>
                <CommunityContent v-for="item in feedList" :key="item.id" :feed-item="item" />

                <!-- 더 불러오기 -->
                <div v-if="!feedOptions.isLast" class="flex justify-center py-15px">
                  <n-button :loading="feedOptions.isLoading" @click="loadMore" type="primary" text size="small">
                    {{ feedOptions.isLoading ? '로딩 중...' : '더 불러오기' }}
                  </n-button>
                </div>

                <!-- 모두 로드됨 -->
                <div v-else class="flex justify-center py-15px text-12px text-gray-400">모두 로드됨</div>
              </template>
            </template>

            <template #follow>
              <!-- 좋아요한 게시물 -->
              <div
                v-if="feedOptions.isLoading && feedList.length === 0"
                class="flex justify-center items-center py-20px">
                <n-spin size="large" />
              </div>

              <div v-else-if="feedList.length === 0" class="flex justify-center items-center py-40px text-gray-500">
                좋아요한 게시물 없음
              </div>

              <template v-else>
                <CommunityContent v-for="item in feedList" :key="item.id" :feed-item="item" />

                <div v-if="!feedOptions.isLast" class="flex justify-center py-15px">
                  <n-button :loading="feedOptions.isLoading" @click="loadMore" type="primary" text size="small">
                    {{ feedOptions.isLoading ? '로딩 중...' : '더 불러오기' }}
                  </n-button>
                </div>

                <div v-else class="flex justify-center py-15px text-12px text-gray-400">모두 로드됨</div>
              </template>
            </template>
          </CommunityTab>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { storeToRefs } from 'pinia'
import CommunityContent from '#/components/community/CommunityContent.vue'
import CommunityTab from '#/components/community/CommunityTab.vue'
import PersonalInfo from '#/components/my/PersonalInfo.vue'
import { useUserStore } from '@/stores/user'
import { useFeedStore } from '@/stores/feed'

const feedStore = useFeedStore()
const { feedList, feedOptions } = storeToRefs(feedStore)

const isShow = ref(true)
const avatarBox = ref<HTMLElement | null>(null)
const lastScrollTop = ref(0)
const hasTriggeredHide = ref(false)
const infoBox = ref<HTMLElement | null>(null)
const measureRef = ref<HTMLDivElement>()
const scrollContainer = ref<HTMLElement | null>(null)
const tabHeight = ref(300)
const contentRectObserver = new ResizeObserver((event) => {
  tabHeight.value = event[0].contentRect.height
})
const userStore = useUserStore()

const route = useRoute()

const uid = route.params.uid as string

const isMyPage = ref(false)

const onUpdate = (newTab: string) => {
  console.log('업데이트됨:', newTab)
}

const loadMore = async () => {
  if (feedOptions.value.isLoading || feedOptions.value.isLast) return
  await feedStore.loadMore()
}

const tabOptions = reactive([
  {
    tab: '게시물',
    name: 'find'
  },
  {
    tab: '좋아요',
    name: 'follow'
  }
])

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

onMounted(async () => {
  if (measureRef.value) {
    contentRectObserver.observe(measureRef.value)
  }

  if (userStore.userInfo?.uid === uid) {
    isMyPage.value = true
  } else {
    isMyPage.value = false
  }

  // 초기 게시물 목록 로드
  await feedStore.getFeedList(true)
})

onUnmounted(() => {
  if (measureRef.value) {
    contentRectObserver.unobserve(measureRef.value)
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
  border-top-left-radius: 20px; /* 좌측 상단 */
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
  max-height: 24px; // 컨테이너가 펼쳐졌을 때의 높이와 일치
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
