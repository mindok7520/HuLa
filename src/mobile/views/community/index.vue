<template>
  <div class="flex flex-col h-full flex-1 bg-white">
    <!-- 피드 목록 영역 -->
    <van-pull-refresh
      class="flex-1 overflow-hidden"
      :pull-distance="100"
      :disabled="!isEnablePullRefresh"
      v-model="loading"
      @refresh="onRefresh">
      <n-scrollbar ref="scrollbarRef" class="h-full" @scroll="handleScroll">
        <!-- 이미지 영역 -->
        <div class="w-full h-30vh relative">
          <div class="flex h-95% w-full relative">
            <img class="w-full h-full object-contain bg-#90909048 dark:bg-#111" src="/hula.png" alt="" />
          </div>
          <!-- 왼쪽 상단 알림 버튼 -->
          <div class="absolute left-20px top-20px">
            <n-button text type="primary" @click="openNotificationPopup" class="relative">
              <template #icon>
                <div class="relative">
                  <svg class="w-24px h-24px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                  </svg>
                  <span
                    v-if="feedNotificationStore.notificationStats.unreadCount > 0"
                    class="absolute -top-8px -right-8px w-20px h-20px rounded-full bg-#ff6b6b text-white text-10px flex items-center justify-center font-600">
                    {{
                      feedNotificationStore.notificationStats.unreadCount > 99
                        ? '99+'
                        : feedNotificationStore.notificationStats.unreadCount
                    }}
                  </span>
                </div>
              </template>
            </n-button>
          </div>

          <div class="flex absolute right-20px bottom-0 gap-15px">
            <div class="text-white items-center flex">
              {{ userStore.userInfo?.name }}
            </div>
            <div>
              <n-avatar :size="65" round bordered :src="AvatarUtils.getAvatarUrl(userStore.userInfo!.avatar)" />
            </div>
          </div>
        </div>

        <!-- 피드 콘텐츠 영역 -->
        <div class="px-12px py-12px">
          <DynamicList
            mode="mobile"
            @preview-image="previewImage"
            @video-play="handleVideoPlay"
            @load-more="loadMore"
            @item-click="handleItemClick" />
        </div>
      </n-scrollbar>
    </van-pull-refresh>

    <!-- 알림 팝업 -->
    <FeedNotificationPopup ref="notificationPopupRef" />
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { useFeedStore } from '@/stores/feed'
import { useUserStore } from '@/stores/user'
import { useFeedNotificationStore } from '@/stores/feedNotification'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { useDebounceFn, useThrottleFn } from '@vueuse/core'
import DynamicList from '@/components/common/DynamicList.vue'
import FeedNotificationPopup from '@/components/common/FeedNotificationPopup.vue'
import { useMitt } from '@/hooks/useMitt'
import { WsResponseMessageType } from '@/services/wsType'

const router = useRouter()
const feedStore = useFeedStore()
const userStore = useUserStore()
const feedNotificationStore = useFeedNotificationStore()

const { feedOptions } = storeToRefs(feedStore)
const notificationPopupRef = ref()

const scrollbarRef = ref()
const loading = ref(false)
const isEnablePullRefresh = ref(true) // 당겨서 새로고침 활성화 여부, 현재는 맨 위로 스크롤될 때만 활성화됨

let scrollTop = 0 // 현재 스크롤 위치 기억

const enablePullRefresh = useDebounceFn((top: number) => {
  isEnablePullRefresh.value = top === 0
}, 100)

const disablePullRefresh = useThrottleFn(() => {
  isEnablePullRefresh.value = false
}, 80)

// 이미지 미리보기
const previewImage = (images: string[], index: number) => {
  console.log('이미지 미리보기:', images, index)
  // TODO: 이미지 미리보기 기능 구현
}

// 비디오 재생
const handleVideoPlay = (url: string) => {
  console.log('비디오 재생:', url)
  // TODO: 비디오 재생 기능 구현
}

// 당겨서 새로고침
const onRefresh = () => {
  loading.value = true

  const apiPromise = feedStore.refresh()
  const delayPromise = new Promise((resolve) => setTimeout(resolve, 500))

  Promise.all([apiPromise, delayPromise])
    .then(() => {
      loading.value = false
      // 새로고침 후 읽지 않은 수 초기화
      feedStore.clearUnreadCount()
      console.log('새로고침 완료')
    })
    .catch((error) => {
      loading.value = false
      console.log('피드 목록 새로고침 실패:', error)
      window.$message.error('새로고침 실패, 다시 시도해주세요')
    })
}

// 스크롤 처리
const handleScroll = (event: any) => {
  const target = event.target
  if (!target) return

  scrollTop = target.scrollTop
  const scrollHeight = target.scrollHeight
  const clientHeight = target.clientHeight

  // 당겨서 새로고침 활성화 상태 제어
  if (scrollTop < 200) {
    enablePullRefresh(scrollTop)
  } else {
    disablePullRefresh()
  }

  // 하단에서 100px 남았을 때 로드 트리거
  if (scrollHeight - scrollTop - clientHeight < 100) {
    loadMore()
  }
}

// 더 보기 로드
const loadMore = async () => {
  if (feedOptions.value.isLoading || feedOptions.value.isLast) return
  await feedStore.loadMore()
}

// 피드 항목 클릭 처리
const handleItemClick = (feedId: string) => {
  router.push({
    name: 'mobileDynamicDetail',
    params: { id: feedId }
  })
}

// 알림 팝업 열기
const openNotificationPopup = () => {
  notificationPopupRef.value?.openPopup()
}

// 피드 메시지 푸시 수신 대기
const handleFeedSendMsg = (_payload: any) => {
  feedStore.increaseUnreadCount()
}

// 데이터 초기화
onMounted(async () => {
  // 피드 목록 초기 로드
  await feedStore.getFeedList(true)

  // 피드 열 때 읽지 않은 수 초기화
  feedStore.clearUnreadCount()

  // 피드 메시지 리스너 등록
  useMitt.on(WsResponseMessageType.FEED_SEND_MSG, handleFeedSendMsg)
})

onUnmounted(() => {
  // 이벤트 리스너 정리
  useMitt.off(WsResponseMessageType.FEED_SEND_MSG, handleFeedSendMsg)
})
</script>

<style scoped lang="scss">
// 사용자 정의 스타일
</style>
