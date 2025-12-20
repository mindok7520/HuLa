<template>
  <div class="flex flex-col overflow-hidden h-full relative">
    <!-- 네트워크 상태 알림 -->
    <n-flex
      v-if="!networkStatus.isOnline.value"
      align="center"
      justify="center"
      class="z-999 w-full h-40px rounded-4px text-(12px [--danger-text]) bg-[--danger-bg] flex-shrink-0">
      <svg class="size-16px">
        <use href="#cloudError"></use>
      </svg>
      {{ t('home.chat_main.network_offline') }}
    </n-flex>

    <!-- 고정 공지 알림 -->
    <Transition name="announcement" mode="out-in">
      <div
        v-if="isGroup && topAnnouncement"
        key="announcement"
        :class="{ 'bg-#eee': isMobile() }"
        class="p-[6px_12px_0_12px]">
        <div
          class="custom-announcement"
          :class="{ 'announcement-hover': isAnnouncementHover }"
          @mouseenter="isAnnouncementHover = true"
          @mouseleave="isAnnouncementHover = false">
          <n-flex :wrap="false" class="w-full" align="center" justify="space-between">
            <n-flex :wrap="false" align="center" class="pl-12px select-none flex-1" :size="6">
              <svg class="size-16px flex-shrink-0">
                <use href="#Loudspeaker"></use>
              </svg>
              <div class="flex-1 min-w-0 line-clamp-1 text-(12px [--chat-text-color])">
                {{ topAnnouncement.content }}
              </div>
            </n-flex>
            <div class="flex-shrink-0 w-60px select-none" @click="handleViewAnnouncement">
              <p class="text-(12px #13987f) cursor-pointer">{{ t('home.chat_main.announcement.view_all') }}</p>
            </div>
          </n-flex>
        </div>
      </div>
    </Transition>

    <!-- 채팅 내용 -->
    <div :class="{ 'bg-#eee': isMobile() }" class="flex flex-col flex-1 min-h-0">
      <div
        id="image-chat-main"
        ref="scrollContainer"
        class="scrollbar-container"
        :class="{ 'hide-scrollbar': !showScrollbar }"
        @scroll="handleScroll"
        @click="handleChatAreaClick"
        @mouseenter="showScrollbar = true"
        @mouseleave="showScrollbar = false">
        <!-- 메시지 목록 -->
        <div ref="messageListRef" class="message-list min-h-full flex flex-col">
          <!-- 더 이상 메시지 없음 알림 -->
          <div
            v-show="chatStore.shouldShowNoMoreMessage"
            class="flex-center gap-6px h-32px flex-shrink-0 cursor-default select-none">
            <p class="text-(12px #909090)">{{ t('home.chat_main.no_more') }}</p>
          </div>
          <n-flex
            v-for="(item, index) in chatStore.chatMessageList"
            :key="item.message.id"
            vertical
            class="flex-y-center mb-12px"
            :data-message-id="item.message.id"
            :data-message-index="index">
            <!-- 메시지 간격 시간 -->
            <span class="text-(12px #909090) select-none p-4px" v-if="item.timeBlock" @click.stop>
              {{ timeToStr(item.message.sendTime) }}
            </span>
            <!-- 메시지 내용 컨테이너 -->
            <div
              @mouseenter="hoverId = item.message.id"
              :class="[
                'w-full box-border',
                item.message.type === MsgEnum.RECALL ? 'min-h-22px' : 'min-h-62px',
                isGroup ? 'p-[14px_10px_14px_20px]' : 'chat-single p-[4px_10px_10px_20px]',
                { 'active-reply': activeReply === item.message.id },
                { 'bg-#90909020': computeMsgHover(item) }
              ]"
              @click="
                () => {
                  if (chatStore.isMsgMultiChoose && isMessageMultiSelectEnabled(item.message.type)) {
                    item.isCheck = !item.isCheck
                  }
                }
              ">
              <RenderMessage
                :message="item"
                :is-group="isGroup"
                :from-user="{ uid: item.fromUser.uid }"
                :upload-progress="item.uploadProgress"
                @jump2-reply="jumpToReplyMsg" />
            </div>
          </n-flex>
        </div>
      </div>
    </div>

    <!-- 플로팅 버튼 알림 (하단 고정) -->
    <footer
      class="float-footer-button"
      v-if="shouldShowFloatFooter && currentNewMsgCount && !isMobileRef"
      :style="{ bottom: '24px', right: '50px' }">
      <div class="float-box" :class="{ max: currentNewMsgCount?.count > 99 }" @click="handleFloatButtonClick">
        <n-flex justify="space-between" align="center">
          <n-icon :color="currentNewMsgCount?.count > 99 ? '#ce304f' : '#13987f'">
            <svg>
              <use href="#double-down"></use>
            </svg>
          </n-icon>
          <span
            v-if="currentNewMsgCount?.count && currentNewMsgCount.count > 0"
            class="text-12px"
            :class="{ 'color-#ce304f': currentNewMsgCount?.count > 99 }">
            {{ t('home.chat_main.new_messages', { count: newMsgCountLabel }) }}
          </span>
        </n-flex>
      </div>
    </footer>

    <!-- 파일 업로드 진행 바 -->
    <FileUploadProgress />
  </div>

  <!-- 팝업 창 -->
  <n-modal v-model:show="modalShow" class="w-350px border-rd-8px">
    <div class="bg-[--bg-popover] w-360px h-full p-6px box-border flex flex-col">
      <div
        v-if="isMac()"
        @click="modalShow = false"
        class="mac-close z-999 size-13px shadow-inner bg-#ed6a5eff rounded-50% select-none absolute left-6px">
        <svg class="hidden size-7px color-#000 select-none absolute top-3px left-3px">
          <use href="#close"></use>
        </svg>
      </div>

      <svg v-if="isWindows()" @click="modalShow = false" class="w-12px h-12px ml-a cursor-pointer select-none">
        <use href="#close"></use>
      </svg>
      <div class="flex flex-col gap-30px p-[22px_10px_10px_22px] select-none">
        <span class="text-14px">{{ tips }}</span>

        <n-flex justify="end">
          <n-button @click="handleConfirm" class="w-78px" color="#13987f">{{ t('home.chat_main.confirm') }}</n-button>
          <n-button @click="modalShow = false" class="w-78px" secondary>{{ t('home.chat_main.cancel') }}</n-button>
        </n-flex>
      </div>
    </div>
  </n-modal>

  <n-modal v-model:show="groupNicknameModalVisible" class="w-360px border-rd-8px" :mask-closable="false">
    <div class="bg-[--bg-popover] w-360px h-full p-6px box-border flex flex-col">
      <div
        v-if="isMac()"
        @click="groupNicknameModalVisible = false"
        class="mac-close z-999 size-13px shadow-inner bg-#ed6a5eff rounded-50% select-none absolute left-6px">
        <svg class="hidden size-7px color-#000 select-none absolute top-3px left-3px">
          <use href="#close"></use>
        </svg>
      </div>

      <svg
        v-if="isWindows()"
        @click="groupNicknameModalVisible = false"
        class="w-12px h-12px ml-a cursor-pointer select-none">
        <use href="#close"></use>
      </svg>
      <div class="flex flex-col gap-20px p-[22px_10px_10px_22px] select-none">
        <span class="text-(16px [--text-color]) font-500">{{ t('home.chat_main.group_nickname.title') }}</span>
        <n-input
          v-model:value="groupNicknameValue"
          :placeholder="t('home.chat_main.group_nickname.placeholder')"
          :maxlength="12"
          class="border-(1px solid #90909080)"
          :disabled="groupNicknameSubmitting"
          clearable
          @keydown.enter.prevent="handleGroupNicknameConfirm" />
        <p v-if="groupNicknameError" class="text-(12px #d03553)">{{ groupNicknameError }}</p>
        <n-flex justify="end" :size="12">
          <n-button @click="groupNicknameModalVisible = false" :disabled="groupNicknameSubmitting" secondary>
            {{ t('home.chat_main.cancel') }}
          </n-button>
          <n-button color="#13987f" :loading="groupNicknameSubmitting" @click="handleGroupNicknameConfirm">
            {{ t('home.chat_main.confirm') }}
          </n-button>
        </n-flex>
      </div>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, provide, ref, useTemplateRef, watch, watchPostEffect } from 'vue'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { info } from '@tauri-apps/plugin-log'
import { useDebounceFn, useEventListener, useResizeObserver, useTimeoutFn } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { MittEnum, MsgEnum, ScrollIntentEnum } from '@/enums'
import { chatMainInjectionKey, useChatMain } from '@/hooks/useChatMain.ts'
import { useAutoScrollGuard } from '@/hooks/useAutoScrollGuard'
import { useMitt } from '@/hooks/useMitt.ts'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { usePopover } from '@/hooks/usePopover.ts'
import { useWindow } from '@/hooks/useWindow.ts'
import type { MessageType } from '@/services/types.ts'
import { useChatStore } from '@/stores/chat.ts'
import { useGlobalStore } from '@/stores/global'
import { useUserStore } from '@/stores/user.ts'
import { audioManager } from '@/utils/AudioManager'
import { timeToStr } from '@/utils/ComputedTime'
import { useCachedStore } from '@/stores/cached'
import { isMessageMultiSelectEnabled } from '@/utils/MessageSelect'
import { isMac, isMobile, isWindows } from '@/utils/PlatformConstants'
import FileUploadProgress from '@/components/rightBox/FileUploadProgress.vue'

const selfEmit = defineEmits(['scroll'])
const { t } = useI18n()

type AnnouncementData = {
  content: string
  top?: boolean
}

type SessionChangedPayload = {
  roomId: string
  oldRoomId: string | null
}

// Store 인스턴스
const cacheStore = useCachedStore()
const appWindow = WebviewWindow.getCurrent()
const globalStore = useGlobalStore()
const chatStore = useChatStore()
const userStore = useUserStore()
const networkStatus = useNetworkStatus()
// const { footerHeight } = useChatLayoutGlobal() // 제거됨, 더 이상 필요하지 않음
const { createWebviewWindow } = useWindow()
const chatMainContext = useChatMain(false, { enableGroupNicknameModal: true })
provide(chatMainInjectionKey, chatMainContext)
const {
  handleConfirm,
  tips,
  modalShow,
  selectKey,
  scrollTop,
  groupNicknameModalVisible,
  groupNicknameValue,
  groupNicknameError,
  groupNicknameSubmitting,
  handleGroupNicknameConfirm
} = chatMainContext
const { enableScroll } = usePopover(selectKey, 'image-chat-main')

const isMobileRef = ref(isMobile())

provide('popoverControls', { enableScroll })

// 스크롤 의도 상태
const scrollIntent = ref<ScrollIntentEnum>(ScrollIntentEnum.NONE)

// 계산 속성
const isGroup = computed<boolean>(() => chatStore.isGroup)
const userUid = computed(() => userStore.userInfo!.uid || '')
const currentNewMsgCount = computed(() => chatStore.currentNewMsgCount || null)
const newMsgCountLabel = computed(() => {
  if (!currentNewMsgCount.value?.count || currentNewMsgCount.value.count <= 0) return '0'
  return currentNewMsgCount.value.count > 99 ? '99+' : String(currentNewMsgCount.value.count)
})
const currentRoomId = computed(() => globalStore.currentSessionRoomId ?? null)
const computeMsgHover = computed(() => (item: MessageType) => {
  if (!chatStore.isMsgMultiChoose || !isMessageMultiSelectEnabled(item.message.type)) {
    return false
  }

  if (chatStore.msgMultiChooseMode === 'forward') {
    return false
  }

  return hoverId.value === item.message.id || item.isCheck
})
// 플로팅 푸터 표시 여부
const shouldShowFloatFooter = computed<boolean>(() => {
  const container = scrollContainerRef.value
  if (!container) return false

  // 자동 스크롤 중이거나 더 많은 메시지를 불러오는 중에는 표시 안 함
  if (isLoadingMore.value) {
    return false
  }

  const scrollHeight = container.scrollHeight
  const clientHeight = container.clientHeight
  const distanceFromBottom = scrollHeight - scrollTop.value - clientHeight

  // 하단에 가까우면 세션 전환 시 깜빡임 방지를 위해 표시 안 함
  if (distanceFromBottom <= 20) {
    return false
  }

  // 우선순위 1: 새 메시지가 있으면 새 메시지 알림 우선 표시
  if (currentNewMsgCount.value?.count && currentNewMsgCount.value.count > 0) {
    return true
  }

  // 우선순위 2: 아래로 스크롤 중이고 하단에서 멀 때만 버튼 표시
  if (distanceFromBottom > clientHeight * 0.5) {
    return true
  }

  return false
})

// 반응형 상태 변수
const activeReply = ref<string>('')
const scrollContainerRef = useTemplateRef<HTMLDivElement>('scrollContainer')
const messageListRef = useTemplateRef<HTMLDivElement>('messageListRef')
const showScrollbar = ref<boolean>(true)
const isAnnouncementHover = ref<boolean>(false)
const topAnnouncement = ref<AnnouncementData | null>(null)
const hoverId = ref('')
// 과거 메시지 로딩 여부 식별을 위한 플래그 추가
const isLoadingMore = ref(false)
// 초기화 시 상단 추가 로딩 자동 트리거 방지
const suppressTopLoadMore = ref(false)
// 현재 하단 위치 여부 플래그
const isAtBottom = ref(true)
// 자동 스크롤 보호 (rAF 타이밍)
const { isAutoScrolling, enableAutoScroll, stopAutoScrollGuard } = useAutoScrollGuard()

const temporarilySuppressTopLoadMore = () => {
  suppressTopLoadMore.value = true
  const release = () => {
    suppressTopLoadMore.value = false
  }
  setTimeout(release, 32)
}

// 휠 스크롤 제한 상태
const MAX_WHEEL_DELTA = 130
const DOM_DELTA_LINE = 1
const DOM_DELTA_PAGE = 2

const clampWheelDelta = (delta: number): number => {
  if (Math.abs(delta) <= MAX_WHEEL_DELTA) {
    return delta
  }
  return Math.sign(delta) * MAX_WHEEL_DELTA
}

const normalizeWheelDelta = (event: WheelEvent, target: HTMLElement): number => {
  switch (event.deltaMode) {
    case DOM_DELTA_LINE:
      return event.deltaY * 16
    case DOM_DELTA_PAGE:
      return event.deltaY * target.clientHeight
    default:
      return event.deltaY
  }
}

const handleWheel = (event: WheelEvent) => {
  const container = scrollContainerRef.value
  if (!container) return

  // 트랙패드 확대/축소 또는 가로 스크롤 건너뛰기
  if (event.ctrlKey || Math.abs(event.deltaY) < Math.abs(event.deltaX)) {
    return
  }

  const normalizedDelta = normalizeWheelDelta(event, container)
  if (Math.abs(normalizedDelta) < 0.5) {
    return
  }

  event.preventDefault()
  const limitedDelta = clampWheelDelta(normalizedDelta)
  if (Math.abs(limitedDelta) < 0.5) {
    return
  }
  container.scrollTop += limitedDelta
}

const stopWheelListener = useEventListener(scrollContainerRef, 'wheel', handleWheel, { passive: false })

// 공지 업데이트 및 초기화 이벤트 리스너 변수
let announcementUpdatedListener: any = null
let announcementClearListener: any = null
// 상단 공지 가져오기
const loadTopAnnouncement = async (roomId?: string): Promise<void> => {
  const targetRoomId = roomId ?? currentRoomId.value

  if (!targetRoomId || !isGroup.value) {
    topAnnouncement.value = null
    return
  }

  try {
    const data = await cacheStore.getGroupAnnouncementList(targetRoomId, 1, 1)
    if (targetRoomId !== currentRoomId.value) {
      return
    }

    if (data && data.records.length > 0) {
      const topNotice = data.records.find((item: any) => item.top)
      const oldAnnouncement = topAnnouncement.value
      topAnnouncement.value = topNotice || null

      if (oldAnnouncement !== topAnnouncement.value) {
        const container = scrollContainerRef.value
        if (container) {
          const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
          if (distanceFromBottom <= 20) {
            nextTick(() => {
              scrollToBottom()
            })
          }
        }
      }
    } else {
      topAnnouncement.value = null
    }
  } catch (error) {
    console.error('상단 공지 가져오기 실패:', error)
    if (targetRoomId === currentRoomId.value) {
      topAnnouncement.value = null
    }
  }
}

watch(
  () => [currentRoomId.value, isGroup.value] as const,
  async ([roomId, isGroupChat], prevValue) => {
    const [prevRoomId, prevIsGroup] = prevValue ?? [undefined, undefined]
    if (!roomId || !isGroupChat) {
      topAnnouncement.value = null
      return
    }

    if (roomId === prevRoomId && prevIsGroup === isGroupChat) {
      return
    }

    await loadTopAnnouncement(roomId)
  },
  { immediate: true }
)

// 1. 방 전환 감지, 초기 스크롤 의도 트리거
watch(
  () => [currentRoomId.value] as const,
  ([newRoomId], [oldRoomId]) => {
    // 방이 전환되고 DOM이 준비되었을 때만 초기 의도 트리거
    if (newRoomId && newRoomId !== oldRoomId) {
      suppressTopLoadMore.value = true
      // 방 전환 시 강제로 바닥 상태로 재설정하고 자동 스크롤 보호 활성화
      isAtBottom.value = true
      enableAutoScroll(1200)

      scrollIntent.value = ScrollIntentEnum.INITIAL
    }
  },
  { flush: 'post' } // DOM 업데이트 후 실행 보장
)

// 3. 특정 스크롤 작업 실행 - DOM 업데이트 완료 보장을 위해 watchPostEffect 사용
watchPostEffect(() => {
  if (scrollIntent.value === ScrollIntentEnum.NONE) return

  handleScrollByIntent(scrollIntent.value)
  // 의도 상태 재설정
  scrollIntent.value = ScrollIntentEnum.NONE
})

// 답장 메시지로 이동
const jumpToReplyMsg = async (key: string): Promise<void> => {
  // 먼저 현재 목록에서 찾기 시도
  let messageIndex = chatStore.chatMessageList.findIndex((msg: any) => msg.message.id === String(key))

  // 찾으면 해당 메시지로 바로 스크롤
  if (messageIndex !== -1) {
    scrollToIndex(messageIndex, 'instant')
    activeReply.value = String(key)
    return
  }

  // 로딩 플래그 설정
  isLoadingMore.value = true

  // 로딩 상태 표시
  window.$message.info('메시지를 찾는 중...')

  // 목표 메시지를 찾거나 더 이상 로드할 수 없을 때까지 기록 메시지 로드 시도
  let foundMessage = false
  let attemptCount = 0
  const MAX_ATTEMPTS = 5 // 무한 루프 방지를 위한 최대 시도 횟수 설정

  while (!foundMessage && attemptCount < MAX_ATTEMPTS) {
    attemptCount++

    // 더 많은 기록 메시지 로드
    await chatStore.loadMore()

    // 새로 로드된 메시지에서 찾기
    messageIndex = chatStore.chatMessageList.findIndex((msg) => msg.message.id === key)

    if (messageIndex !== -1) {
      foundMessage = true
      break
    }

    // 빠른 요청 방지를 위한 간단한 지연
    await new Promise((resolve) => setTimeout(resolve, 300))
  }

  // 로딩 플래그 재설정
  isLoadingMore.value = false

  // 메시지를 찾으면 해당 위치로 스크롤
  if (foundMessage) {
    nextTick(() => {
      scrollToIndex(messageIndex, 'instant')
      activeReply.value = key
    })
  } else {
    // 여러 번 시도 후에도 메시지를 찾지 못한 경우
    window.$message.warning('원본 메시지를 찾을 수 없습니다. 삭제되었거나 너무 오래되었을 수 있습니다.')
  }
}

// 지정된 인덱스 위치로 스크롤
const scrollToIndex = (index: number, behavior: ScrollBehavior = 'auto'): void => {
  const container = scrollContainerRef.value
  if (!container || index < 0) return

  // 해당 메시지 요소 찾기
  const messageElements = container.querySelectorAll('[data-message-index]')
  const targetElement = messageElements[index] as HTMLElement

  if (targetElement) {
    targetElement.scrollIntoView({ behavior, block: 'center', inline: 'nearest' })
  }
}

// 스크롤 의도에 따라 해당 작업 실행
const handleScrollByIntent = (intent: ScrollIntentEnum): void => {
  const container = scrollContainerRef.value
  if (!container) return

  switch (intent) {
    case ScrollIntentEnum.INITIAL:
      // 초기 스크롤: 최신 메시지를 표시하기 위해 바닥으로 바로 스크롤
      scrollToBottom()
      break

    case ScrollIntentEnum.NEW_MESSAGE:
      // 새 메시지 스크롤: 바닥으로 바로 스크롤
      scrollToBottom()
      break

    case ScrollIntentEnum.LOAD_MORE:
      // 더 불러오기: handleLoadMore에서 관리하므로 스크롤 실행 안 함
      break

    default:
      break
  }
}

// 바닥으로 스크롤
const scrollToBottom = (): void => {
  temporarilySuppressTopLoadMore()
  const container = scrollContainerRef.value
  if (!container) return
  // 새 메시지 카운트 즉시 초기화
  chatStore.clearNewMsgCount()
  // 바닥에 있다고 표시하고 자동 스크롤 보호 활성화, 스크롤 중 이벤트로 인해 isAtBottom이 잘못 false로 설정되는 것을 방지
  isAtBottom.value = true
  enableAutoScroll(500)

  // 렌더링 후 실행되도록 requestAnimationFrame 사용
  requestAnimationFrame(() => {
    if (!container) return
    container.scrollTop = container.scrollHeight
  })
}
// 메시지 목록 크기 변화 감지, 현재 바닥에 있으면 자동으로 바닥으로 스크롤
useResizeObserver(messageListRef, () => {
  const container = scrollContainerRef.value
  if (!container) return

  // isAtBottom 상태에 완전히 의존하지 않고 DOM을 통해 직접 거리 계산, 상태 업데이트 지연으로 인한 문제 방지
  const { scrollHeight, scrollTop, clientHeight } = container
  const distanceFromBottom = scrollHeight - scrollTop - clientHeight

  // 바닥에서 150px 이내(일정 오차 허용)이거나 상태 플래그가 바닥에 있다고 표시되면 스크롤 실행
  if (distanceFromBottom <= 150 || isAtBottom.value) {
    // DOM 상태가 안정되도록 nextTick 사용
    nextTick(() => {
      scrollToBottom()
    })
  }
})

// 플로팅 버튼 클릭 처리 - 메시지 목록 재설정 및 바닥으로 스크롤
const handleFloatButtonClick = async () => {
  try {
    // 메시지 수가 60개 이상일 때만 재설정 및 새로고침
    if (chatStore.chatMessageList.length > 60) {
      await chatStore.resetAndRefreshCurrentRoomMessages()
    }
    scrollToBottom()
  } catch (error) {
    console.error('메시지 목록 재설정 실패:', error)
    scrollToBottom()
  }
}

// 스크롤 이벤트 처리 (푸터 표시 기능용)
const handleScroll = (event: Event) => {
  selfEmit('scroll', event)

  const container = event.target as HTMLElement
  if (!container) return

  const currentScrollTop = container.scrollTop
  scrollTop.value = currentScrollTop

  // 자동 스크롤 보호 기간 중이면 강제로 바닥에 있다고 간주
  if (isAutoScrolling.value) {
    isAtBottom.value = true
  } else {
    // 바닥에 있는지 여부 상태 업데이트
    const { scrollHeight, clientHeight } = container
    // 판단 임계값을 150px로 늘려 오류 허용 범위 증가
    isAtBottom.value = scrollHeight - currentScrollTop - clientHeight <= 150
  }

  debouncedScrollOperations(container)
}

// 스크롤 작업을 디바운스 함수로 분리
const debouncedScrollOperations = useDebounceFn(async (container: HTMLElement) => {
  const scrollHeight = container.scrollHeight
  const clientHeight = container.clientHeight
  const distanceFromBottom = scrollHeight - scrollTop.value - clientHeight

  // 상단 도달 시 더 불러오기 처리
  if (scrollTop.value < 60) {
    // 로딩 중이거나 이미 로딩이 트리거되었거나 마지막 페이지에 도달했으면 중복 트리거 안 함
    if (
      suppressTopLoadMore.value ||
      chatStore.currentMessageOptions?.isLoading ||
      chatStore.currentMessageOptions?.isLast
    )
      return

    await handleLoadMore()
  }

  // 하단 스크롤 및 새 메시지 알림 처리
  if (distanceFromBottom <= 20) {
    chatStore.clearNewMsgCount()
  }
}, 16)

// 세션 전환 감지
const handleSessionChanged = async ({ roomId, oldRoomId }: SessionChangedPayload) => {
  if (!roomId || roomId === oldRoomId) {
    return
  }
  // 오디오 관리자를 사용하여 모든 오디오 중지
  audioManager.stopAll()
  // 그룹 채팅이 아니면 상단 공지 초기화
  if (!isGroup.value) {
    topAnnouncement.value = null
  }

  await nextTick()
  scrollToBottom()
}

// 메시지 목록 변화 감지
watch(
  () => chatStore.chatMessageList,
  async (value, oldValue) => {
    // 메시지 목록 감지 단순화, 직접 스크롤 작업 방지
    if (value.length > oldValue.length) {
      // 최신 메시지 가져오기
      const latestMessage = value[value.length - 1]

      // 기록 메시지 로딩 중이면 스크롤 작업 안 함, handleLoadMore에서 위치 복원 처리
      if (isLoadingMore.value) {
        return
      }

      // 새 메시지 카운트 로직 (바닥에 있지 않을 때)
      const container = scrollContainerRef.value
      if (container) {
        const isOtherUserMessage =
          latestMessage?.fromUser?.uid && String(latestMessage.fromUser.uid) !== String(userUid.value)
        // 바닥에 있지 않고 다른 사용자 메시지일 때만 카운트 증가
        if (shouldShowFloatFooter.value && isOtherUserMessage) {
          const roomId = globalStore.currentSessionRoomId
          const current = chatStore.newMsgCount[roomId]
          if (!current) {
            chatStore.newMsgCount[roomId] = {
              count: 1,
              isStart: true
            }
          } else {
            current.count++
          }
        } else {
          await nextTick()
          scrollToBottom()
        }
      }
    }
  },
  { deep: false }
)

// 채팅 영역 클릭 이벤트 처리, 답장 스타일 및 버블 활성화 상태 초기화용
const handleChatAreaClick = (event: Event): void => {
  const target = event.target as Element

  // 클릭 대상이 답장 관련 요소인지 확인
  const isReplyElement =
    target.closest('.reply-bubble') || target.matches('.active-reply') || target.closest('.active-reply')

  // 클릭한 것이 답장 관련 요소가 아니고 activeReply 값이 있으면 activeReply 스타일 초기화
  if (!isReplyElement && activeReply.value) {
    nextTick(() => {
      const activeReplyElement = document.querySelector('.active-reply') as HTMLElement
      if (activeReplyElement) {
        activeReplyElement.classList.add('reply-exit')
        useTimeoutFn(() => {
          activeReplyElement.classList.remove('reply-exit')
          activeReply.value = ''
        }, 300)
      }
    })
  }
}

// 충돌 방지 더 불러오기 처리
const handleLoadMore = async (): Promise<void> => {
  // 로딩 중이거나 이미 로딩이 트리거되었거나 마지막 페이지에 도달했으면 중복 트리거 안 함
  if (chatStore.currentMessageOptions?.isLoading || isLoadingMore.value || chatStore.currentMessageOptions?.isLast)
    return

  const container = scrollContainerRef.value
  if (!container) return
  scrollIntent.value = ScrollIntentEnum.LOAD_MORE

  isLoadingMore.value = true

  // 로딩 전 스크롤 높이 기록, 로딩 후 위치 복원용
  const oldScrollHeight = container.scrollHeight
  const oldScrollTop = container.scrollTop
  try {
    await chatStore.loadMore()

    // 새 스크롤 위치 계산, 사용자 위치를 로딩 전 상대 위치로 유지
    const newScrollHeight = container.scrollHeight
    const heightDifference = newScrollHeight - oldScrollHeight
    const newScrollTop = oldScrollTop + heightDifference

    // 스크롤 위치 복원
    container.scrollTop = newScrollTop
  } catch (error) {
    console.error('기록 메시지 로드 실패:', error)
    window.$message?.error('기록 메시지 로드 실패, 잠시 후 다시 시도해주세요')
  } finally {
    isLoadingMore.value = false

    scrollIntent.value = ScrollIntentEnum.NONE
  }
}

const handleViewAnnouncement = (): void => {
  nextTick(async () => {
    if (!currentRoomId.value) return
    await createWebviewWindow('그룹 공지 보기', `announList/${currentRoomId.value}/1`, 420, 620)
  })
}

// 바닥으로 스크롤 이벤트 감지
useMitt.on(MittEnum.CHAT_SCROLL_BOTTOM, async () => {
  // 메시지 수가 20개 이상일 때만 중복 메시지 정리
  if (chatStore.chatMessageList.length > 20) {
    chatStore.clearRedundantMessages(globalStore.currentSessionRoomId)
  }
  scrollToBottom()
})

onMounted(() => {
  useMitt.on(MittEnum.SESSION_CHANGED, handleSessionChanged)
  // 리스너 초기화
  const initListeners = async () => {
    try {
      // 공지 초기화 이벤트 감지
      announcementClearListener = await appWindow.listen('announcementClear', () => {
        topAnnouncement.value = null
      })

      // 공지 업데이트 이벤트 감지
      announcementUpdatedListener = await appWindow.listen('announcementUpdated', async (event: any) => {
        info(`공지 업데이트 이벤트: ${event.payload}`)
        if (event.payload) {
          const { hasAnnouncements, topAnnouncement: newTopAnnouncement } = event.payload
          if (hasAnnouncements && newTopAnnouncement) {
            // 상단 공지만 상단 알림 업데이트
            if (newTopAnnouncement.top) {
              topAnnouncement.value = newTopAnnouncement
            } else if (topAnnouncement.value) {
              // 현재 상단 공지가 표시되어 있지만 새 공지가 상단 공지가 아니면 변경 없음
              await loadTopAnnouncement()
            }
          } else {
            // 공지가 없으면 표시 초기화
            topAnnouncement.value = null
          }
        }
      })
    } catch (error) {
      console.error('리스너 초기화 실패:', error)
    }
  }

  // 비동기 리스너 초기화 (결과를 기다리지 않음)
  initListeners().catch(console.error)

  scrollToBottom()
})

onUnmounted(() => {
  // 리스너 정리
  if (announcementUpdatedListener) {
    announcementUpdatedListener()
  }
  if (announcementClearListener) {
    announcementClearListener()
  }
  stopAutoScrollGuard()
  stopWheelListener()
})
</script>

<style scoped lang="scss">
// 플로팅 버튼 스타일
.float-footer-button {
  position: absolute;
  z-index: 10;
  width: fit-content;
  user-select: none;
  color: #13987f;
  cursor: pointer;
}

// 네이티브 스크롤 컨테이너 스타일
.scrollbar-container {
  flex: 1;
  overflow-y: auto;
  // 스크롤 성능 최적화
  -webkit-overflow-scrolling: touch;
  will-change: scroll-position;
  transform: translateZ(0);

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
    // min-height: 42px;
    z-index: 999;
  }

  &::-webkit-scrollbar-thumb:hover {
    background-color: rgba(144, 144, 144, 0.5);
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &.hide-scrollbar {
    &::-webkit-scrollbar {
      background: transparent;
    }

    &::-webkit-scrollbar-thumb {
      background: transparent;
    }

    &::-webkit-scrollbar-track {
      background: transparent;
    }

    // Mac에서 스크롤바가 표시되지 않는 문제를 방지하기 위해 작은 패딩 추가
    padding-right: 0.01px;
  }
}

// 성능 최적화 관련 스타일
.message-item {
  contain: layout style;
  will-change: auto;
}

// 드래그 중 마우스 이벤트 비활성화, 불필요한 리스너 손실 방지
:global(body.dragging-resize) .scrollbar-container {
  pointer-events: none;
}
</style>
