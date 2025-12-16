<template>
  <div class="chat-history-container">
    <!--상단 작업 표시줄-->
    <ActionBar :shrink="false" />

    <!-- 검색창 -->
    <div class="search-section select-none">
      <n-input
        spellCheck="false"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        v-model:value="searchKeyword"
        size="small"
        :placeholder="t('chatHistory.search.placeholder')"
        clearable
        @input="handleSearch">
        <template #prefix>
          <svg class="search-icon"><use href="#search"></use></svg>
        </template>
      </n-input>
    </div>

    <!-- 탭 및 필터 버튼 -->
    <div class="tab-section select-none">
      <n-tabs v-model:value="activeTab" @update:value="resetAndReload">
        <n-tab-pane name="all" :tab="t('chatHistory.tabs.all')" />
        <n-tab-pane name="image" :tab="t('chatHistory.tabs.imageVideo')" />
        <n-tab-pane name="file" :tab="t('chatHistory.tabs.file')" />
      </n-tabs>

      <n-date-picker
        v-model:value="dateRange"
        type="daterange"
        :placeholder="t('chatHistory.datePicker.placeholder')"
        clearable
        size="small"
        @update:value="handleDateChange"
        :start-placeholder="t('chatHistory.datePicker.start')"
        :end-placeholder="t('chatHistory.datePicker.end')"
        format="yyyy-MM-dd"
        value-format="timestamp" />
    </div>

    <!-- 메시지 목록 -->
    <div class="flex-1 overflow-auto select-none">
      <n-infinite-scroll :distance="10" @load="loadMore">
        <div v-if="messages.length === 0 && !loading" class="flex-center h-200px">
          <n-empty :description="t('chatHistory.empty.noData')" />
        </div>

        <div v-else class="px-20px py-16px">
          <!-- 날짜별 그룹화된 메시지 -->
          <div v-for="(group, date) in groupedMessages" :key="date">
            <n-tag type="warning" class="date-tag-sticky text-12px rounded-8px">
              {{ formatDateGroupLabel(group.timestamp) }}
            </n-tag>

            <template v-for="item in group.messages" :key="item.message.id">
              <div class="px-4px py-12px mb-16px">
                <!-- 메시지 아바타 및 정보 -->
                <div class="flex cursor-default">
                  <n-avatar
                    :size="32"
                    :src="getAvatarSrc(item.fromUser.uid)"
                    class="rounded-10px mr-12px"
                    fallback-src="/default-avatar.png" />

                  <div class="flex-y-center gap-12px h-fit">
                    <p class="text-(14px #909090)">{{ getUserDisplayName(item.fromUser.uid) }}</p>
                    <p class="text-(12px #909090)">{{ formatTime(item.message.sendTime) }}</p>
                  </div>
                </div>

                <ContextMenu
                  :content="item"
                  class="w-fit max-w-80vw break-words relative flex flex-col pl-44px text-(14px [--text-color]) leading-26px user-select-text"
                  :data-key="item.fromUser.uid === userUid ? `U${item.message.id}` : `Q${item.message.id}`"
                  :special-menu="specialMenuList(item.message.type)"
                  @select="$event.click(item)">
                  <RenderMessage
                    :message="item"
                    :from-user="item.fromUser"
                    :is-group="isGroup"
                    :on-image-click="handleImageClick"
                    :on-video-click="handleVideoClick"
                    :search-keyword="searchKeyword"
                    :history-mode="true" />
                </ContextMenu>
              </div>
            </template>
          </div>
        </div>
      </n-infinite-scroll>
    </div>
  </div>
</template>

<script setup lang="ts">
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useDebounceFn } from '@vueuse/core'
import { useRoute } from 'vue-router'
import { MsgEnum, TauriCommand } from '@/enums'
import { useChatMain } from '@/hooks/useChatMain'
import { useImageViewer } from '@/hooks/useImageViewer'
import { useVideoViewer } from '@/hooks/useVideoViewer'
import type { MessageType } from '@/services/types'
import { useChatStore } from '@/stores/chat'
import { useGroupStore } from '@/stores/group'
import { useUserStore } from '@/stores/user'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { formatDateGroupLabel } from '@/utils/ComputedTime'
import { useI18n } from 'vue-i18n'

type ChatHistoryResponse = {
  messages: MessageType[]
  hasMore: boolean
  currentPage: number
}

const route = useRoute()
const userStore = useUserStore()
const groupStore = useGroupStore()
const chatStore = useChatStore()
const { openImageViewer } = useImageViewer()
const { openVideoViewer } = useVideoViewer()
const { specialMenuList } = useChatMain(true, { disableHistoryActions: true })
const { t } = useI18n()

const isGroup = computed(() => chatStore.isGroup)
const userUid = computed(() => userStore.userInfo!.uid)

// 반응형 데이터
const messages = ref<MessageType[]>([])
const loading = ref(false)
const hasMore = ref(true)
const currentPage = ref(1)

// 검색 및 필터링
const searchKeyword = ref('')
const activeTab = ref<'all' | 'image' | 'file'>('all')
const dateRange = ref<[number, number] | null>(null)

// 라우트 매개변수에서 방 ID 가져오기
const roomId = computed(() => route.query.roomId as string)

// 내 그룹 닉네임
const getUserDisplayName = computed(() => (uid: string) => {
  const user = groupStore.getUserInfo(uid)
  return user?.myName || user?.name || ''
})

// 현재 페이지의 모든 비디오 URL 가져오기
const getAllVideoUrls = computed(() => {
  const videoUrls: string[] = []
  messages.value.forEach((message) => {
    if (message.message.type === MsgEnum.VIDEO && message.message.body?.url) {
      videoUrls.push(message.message.body.url)
    }
  })
  return videoUrls
})

// 날짜별 메시지 그룹화
const groupedMessages = computed(() => {
  const groups: Record<string, { messages: MessageType[]; timestamp: number }> = {}

  messages.value.forEach((i) => {
    // BOT, SYSTEM 및 회수된 메시지 제외
    if (
      i.message.sendTime &&
      i.message.type !== MsgEnum.BOT &&
      i.message.type !== MsgEnum.SYSTEM &&
      i.message.type !== MsgEnum.RECALL
    ) {
      const date = new Date(i.message.sendTime).toDateString()
      if (!groups[date]) {
        groups[date] = {
          messages: [],
          timestamp: i.message.sendTime
        }
      }
      groups[date].messages.push(i)
    }
  })

  return groups
})

// 디바운스 검색
const handleSearch = useDebounceFn(() => {
  resetAndReload()
}, 300)

// 날짜 필터 변경 처리
const handleDateChange = useDebounceFn((value) => {
  if (Array.isArray(value) && value.length === 2 && value[0] && value[1]) {
    // 날짜 경계 문제 수정: 같은 날을 선택하면 종료 시간은 해당 날짜의 23:59:59.999여야 함
    let startTime = value[0]
    let endTime = value[1]

    const startDate = new Date(startTime)
    const endDate = new Date(endTime)

    // 같은 날인지 확인 (날짜 선택기가 동일한 타임스탬프를 반환할 수 있음)
    const isSameDay = startDate.toDateString() === endDate.toDateString()

    if (isSameDay) {
      // 같은 날이면 시간 범위 조정
      const adjustedStart = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0, 0, 0)
      const adjustedEnd = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999)

      startTime = adjustedStart.getTime()
      endTime = adjustedEnd.getTime()

      // dateRange 값 업데이트
      dateRange.value = [startTime, endTime]
    } else {
      // 다른 날이면 종료 시간이 해당 날짜의 마지막 순간인지 확인
      const adjustedEnd = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999)
      endTime = adjustedEnd.getTime()

      if (endTime !== value[1]) {
        dateRange.value = [startTime, endTime]
      }
    }
  }

  resetAndReload()
}, 300)

// 사용자 아바타 가져오기
const getAvatarSrc = (uid: string) => {
  const avatar = uid === userUid.value ? userStore.userInfo!.avatar : groupStore.getUserInfo(uid)?.avatar
  return AvatarUtils.getAvatarUrl(avatar as string)
}

// 초기화 및 다시 로드
const resetAndReload = () => {
  messages.value = []
  currentPage.value = 1
  hasMore.value = true
  loadMessages()
}

// 시간 포맷팅
const formatTime = (timestamp?: number) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 현재 페이지의 모든 이미지 및 이모티콘 URL 가져오기
const getAllImageUrls = computed(() => {
  const imageUrls: string[] = []
  messages.value.forEach((message) => {
    if (
      (message.message.type === MsgEnum.IMAGE || message.message.type === MsgEnum.EMOJI) &&
      message.message.body?.url
    ) {
      imageUrls.push(message.message.body.url)
    }
  })
  return imageUrls
})

// 이미지 및 이모티콘 클릭 이벤트 처리
const handleImageClick = async (imageUrl: string) => {
  const imageList = getAllImageUrls.value
  await openImageViewer(imageUrl, [MsgEnum.IMAGE, MsgEnum.EMOJI], imageList)
}

// 비디오 클릭 이벤트 처리
const handleVideoClick = async (videoUrl: string) => {
  const videoList = getAllVideoUrls.value
  const currentIndex = videoList.indexOf(videoUrl)

  if (currentIndex === -1) {
    await openVideoViewer(videoUrl, [MsgEnum.VIDEO], [videoUrl])
  } else {
    // 다중 비디오 모드 사용
    await openVideoViewer(videoUrl, [MsgEnum.VIDEO], videoList)
  }
}

// 메시지 로드
const loadMessages = async () => {
  if (!roomId.value) return

  loading.value = true

  try {
    const params = {
      roomId: roomId.value,
      messageType: activeTab.value,
      searchKeyword: searchKeyword.value || undefined,
      sortOrder: 'desc',
      dateRange: dateRange.value
        ? {
            startTime: dateRange.value[0],
            endTime: dateRange.value[1]
          }
        : undefined,
      pagination: {
        page: currentPage.value,
        pageSize: 50
      }
    }

    const response = await invoke<ChatHistoryResponse>(TauriCommand.QUERY_CHAT_HISTORY, { param: params })

    if (currentPage.value === 1) {
      messages.value = response.messages
    } else {
      messages.value.push(...response.messages)
    }

    hasMore.value = response.hasMore
  } catch (error) {
    console.error('채팅 기록 로드 실패:', error)
  } finally {
    loading.value = false
  }
}

// 더 불러오기
const loadMore = () => {
  if (hasMore.value) {
    currentPage.value++
    loadMessages()
  }
}

// 방 ID 변경 감지
watch(
  roomId,
  () => {
    if (roomId.value) {
      resetAndReload()
    }
  },
  { immediate: true }
)

onMounted(async () => {
  await getCurrentWebviewWindow().show()
  if (roomId.value) {
    loadMessages()
  }
})
</script>

<style scoped lang="scss">
.chat-history-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-left-menu);
}

.search-section {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);

  .search-icon {
    width: 16px;
    height: 16px;
    color: var(--text-color);
  }
}

.tab-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  border-bottom: 1px solid var(--border-color);
}

.date-tag-sticky {
  position: sticky;
  top: 4px;
  z-index: 10;
  padding: 6px 12px;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.user-select-text {
  -webkit-user-select: text !important;
  -moz-user-select: text !important;
  -ms-user-select: text !important;
  user-select: text !important;
}
</style>
<style lang="scss">
.n-date-panel .n-date-panel-dates .n-date-panel-date.n-date-panel-date--selected::after {
  background-color: #13987f;
}
.n-date-panel.n-date-panel--daterange {
  border-radius: 14px;
}

.n-date-panel-actions .n-button {
  background-color: rgba(19, 152, 127, 0.1) !important;
  border: none !important;
  color: #13987f !important;
}
</style>
