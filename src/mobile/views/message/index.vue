<template>
  <div class="flex flex-col h-full">
    <img src="@/assets/mobile/chat-home/background.webp" class="w-100% fixed top-0" alt="hula" />

    <!-- 페이지 마스크 -->
    <div
      v-if="showMask"
      @touchend="maskHandler.close"
      @mouseup="maskHandler.close"
      :class="[
        longPressState.longPressActive
          ? ''
          : 'bg-black/20 backdrop-blur-sm transition-all duration-3000 ease-in-out opacity-100'
      ]"
      class="fixed inset-0 z-[999]"></div>

    <NavBar>
      <template #left>
        <n-flex @click="toSimpleBio" align="center" :size="6" class="w-full">
          <n-avatar
            :size="38"
            :src="AvatarUtils.getAvatarUrl(userStore.userInfo?.avatar ? userStore.userInfo.avatar : '/logoD.png')"
            fallback-src="/logo.png"
            round />

          <n-flex vertical justify="center" :size="6">
            <p
              style="
                font-weight: bold !important;
                font-family:
                  system-ui,
                  -apple-system,
                  sans-serif;
              "
              class="text-(16px [--text-color])">
              {{ userStore.userInfo?.name ? userStore.userInfo.name : '이름 없음' }}
            </p>
            <p class="text-(10px [--text-color])">
              {{
                userStore.userInfo?.uid ? groupStore.getUserInfo(userStore.userInfo!.uid)?.locPlace || '중국' : '중국'
              }}
            </p>
          </n-flex>
        </n-flex>
      </template>

      <template #right>
        <n-dropdown
          @on-clickoutside="addIconHandler.clickOutside"
          @select="addIconHandler.select"
          trigger="click"
          :show-arrow="true"
          :options="uiViewsData.addOptions">
          <svg @click="addIconHandler.open" class="size-22px bg-white p-5px rounded-8px">
            <use href="#plus"></use>
          </svg>
        </n-dropdown>
      </template>
    </NavBar>

    <div class="px-16px mt-5px">
      <div class="py-5px shrink-0">
        <n-input
          id="search"
          class="rounded-6px w-full bg-white relative text-12px"
          :maxlength="20"
          clearable
          spellCheck="false"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          placeholder="검색"
          @focus="lockScroll"
          @blur="unlockScroll">
          <template #prefix>
            <svg class="w-12px h-12px">
              <use href="#search"></use>
            </svg>
          </template>
        </n-input>
      </div>
      <div class="border-b-1 border-solid color-gray-200 px-18px mt-5px"></div>
    </div>

    <van-pull-refresh
      class="flex-1"
      :pull-distance="100"
      :disabled="!isEnablePullRefresh"
      v-model="loading"
      @refresh="onRefresh">
      <div class="flex flex-col h-full">
        <div class="flex-1 overflow-y-auto overflow-x-hidden min-h-0" @scroll="onScroll" ref="scrollContainer">
          <van-swipe-cell
            @open="handleSwipeOpen"
            @close="handleSwipeClose"
            v-for="(item, idx) in sessionList"
            v-on-long-press="[(e: PointerEvent) => handleLongPress(e, item), longPressOption]"
            :key="`${item.id}-${idx}`"
            class="text-black"
            :class="item.top ? 'w-full bg-#64A29C18' : ''">
            <!-- 길게 누르기 항목 -->
            <div @click.stop="intoRoom(item)" class="grid grid-cols-[2.2rem_1fr_4rem] items-start px-4 py-3 gap-1">
              <div class="flex-shrink-0">
                <n-badge
                  :offset="[-6, 6]"
                  :color="item.muteNotification === NotificationTypeEnum.NOT_DISTURB ? 'grey' : '#d5304f'"
                  :value="item.unreadCount"
                  :max="99">
                  <n-avatar :size="52" :src="AvatarUtils.getAvatarUrl(item.avatar)" fallback-src="/logo.png" round />
                </n-badge>
              </div>
              <!-- 중간: 두 줄 내용 -->
              <div class="truncate pl-7 flex pt-5px gap-10px leading-tight flex-col">
                <div class="text-16px font-bold flex-1 truncate text-#333 truncate">{{ item.name }}</div>
                <div class="text-13px text-#555 truncate">
                  {{ item.text }}
                </div>
              </div>

              <!-- 시간: 상단 정렬 -->
              <div class="text-12px pt-9px text-right flex flex-col gap-1 items-end justify-center">
                <div class="flex items-center gap-1">
                  <span v-if="item.hotFlag === IsAllUserEnum.Yes">
                    <svg class="size-22px select-none outline-none cursor-pointer color-#13987f">
                      <use href="#auth"></use>
                    </svg>
                  </span>
                  <span class="text-#555">
                    {{ formatTimestamp(item?.activeTime) }}
                  </span>
                </div>
                <div v-if="item.muteNotification === NotificationTypeEnum.NOT_DISTURB">
                  <svg class="size-14px z-100 color-#909090">
                    <use href="#close-remind"></use>
                  </svg>
                </div>
              </div>
            </div>
            <template #right>
              <div class="flex w-auto flex-wrap h-full">
                <div
                  class="h-full text-14px w-80px bg-#13987f text-white flex items-center justify-center"
                  @click="handleToggleTop(item)">
                  {{ item.top ? '상단 고정 해제' : '상단 고정' }}
                </div>
                <div
                  :class="(item?.unreadCount ?? 0) > 0 ? 'bg-#909090' : 'bg-#fbb160'"
                  class="h-full text-14px w-80px text-white flex items-center justify-center"
                  @click="handleToggleReadStatus((item?.unreadCount ?? 0) > 0, item)">
                  {{ (item?.unreadCount ?? 0) > 0 ? '읽음으로 표시' : '읽지 않음으로 표시' }}
                </div>
                <div
                  class="h-full text-14px w-80px bg-#d5304f text-white flex items-center justify-center"
                  @click="handleDelete(item)">
                  삭제
                </div>
              </div>
            </template>
          </van-swipe-cell>
        </div>
      </div>
    </van-pull-refresh>

    <teleport to="body">
      <div
        v-if="longPressState.showLongPressMenu"
        :style="{ top: longPressState.longPressMenuTop + 'px' }"
        class="fixed gap-10px z-999 left-1/2 transform -translate-x-1/2">
        <div class="flex justify-between p-18px text-16px gap-22px rounded-16px bg-#4e4e4e whitespace-nowrap">
          <div class="text-white" @click="handleDelete(currentLongPressItem)">삭제</div>
          <div class="text-white" @click="handleToggleTop(currentLongPressItem)">
            {{ currentLongPressItem?.top ? '상단 고정 해제' : '상단 고정' }}
          </div>
          <div class="text-white" @click="handleToggleReadStatus((currentLongPressItem?.unreadCount ?? 0) > 0)">
            {{ (currentLongPressItem?.unreadCount ?? 0) > 0 ? '읽음' : '읽지 않음' }}
          </div>
        </div>
        <div class="flex w-full justify-center h-15px">
          <svg width="34" height="13" viewBox="0 0 35 13">
            <path d="M0 0 L35 0 L17.5 13 Z" fill="#4e4e4e" />
          </svg>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup lang="ts">
import { useDebounceFn, useThrottleFn } from '@vueuse/core'
import NavBar from '#/layout/navBar/index.vue'
import addFriendIcon from '@/assets/mobile/chat-home/add-friend.webp'
import groupChatIcon from '@/assets/mobile/chat-home/group-chat.webp'
import { RoomTypeEnum, NotificationTypeEnum } from '@/enums'
import { useMessage } from '@/hooks/useMessage.ts'
import { useReplaceMsg } from '@/hooks/useReplaceMsg'
import { IsAllUserEnum, type SessionItem } from '@/services/types.ts'
import rustWebSocketClient from '@/services/webSocketRust'
import { useChatStore } from '@/stores/chat.ts'
import { useGlobalStore } from '@/stores/global'
import { useGroupStore } from '@/stores/group'
import { useUserStore } from '@/stores/user.ts'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { formatTimestamp } from '@/utils/ComputedTime.ts'
import { vOnLongPress } from '@vueuse/components'
import { markMsgRead, setSessionTop } from '@/utils/ImRequestUtils'
import { useContactStore } from '@/stores/contacts'

const loading = ref(false)
const count = ref(0)
const currentLongPressItem = ref<SessionItem | null>(null)
const groupStore = useGroupStore()
const chatStore = useChatStore()
const userStore = useUserStore()
const globalStore = useGlobalStore()
const contactStore = useContactStore()

// 더 보기 로드 UI 이벤트 처리 (시작)

const isEnablePullRefresh = ref(true) // 당겨서 새로고침 활성화 여부, 현재는 맨 위로 스크롤될 때만 활성화됨
const scrollContainer = ref(null) // 메시지 스크롤 컨테이너

let scrollTop = 0 // 현재 스크롤 위치 기억

const enablePullRefresh = useDebounceFn((top: number) => {
  isEnablePullRefresh.value = top === 0
}, 100)

const disablePullRefresh = useThrottleFn(() => {
  isEnablePullRefresh.value = false
}, 80)

const onScroll = (e: any) => {
  scrollTop = e.target.scrollTop
  if (scrollTop < 200) {
    enablePullRefresh(scrollTop)
  } else {
    disablePullRefresh()
  }
}

// 더 보기 로드 UI 이벤트 처리 (종료)

const longPressState = ref({
  showLongPressMenu: false,
  longPressMenuTop: 0,
  longPressActive: false,
  // 모든 이벤트 비활성화
  enable: () => {
    // 길게 누르기 활성 상태 설정
    longPressState.value.longPressActive = true
    disablePullRefresh()
  },

  disable: () => {
    longPressState.value.showLongPressMenu = false
    longPressState.value.longPressMenuTop = 0
    longPressState.value.longPressActive = false
    isEnablePullRefresh.value = true
    enablePullRefresh(scrollTop)
  }
})

const allUserMap = computed(() => {
  const map = new Map<string, any>() // User는 정의한 사용자 유형
  groupStore.allUserInfo.forEach((user) => {
    map.set(user.uid, user)
  })
  return map
})

// 세션 목록
const sessionList = computed(() => {
  return (
    chatStore.sessionList
      .map((item) => {
        // 최신 프로필 사진 가져오기
        let latestAvatar = item.avatar
        if (item.type === RoomTypeEnum.SINGLE && item.id) {
          latestAvatar = groupStore.getUserInfo(item.id)?.avatar || item.avatar
        }

        // 그룹 채팅 비고 이름 가져오기 (있는 경우)
        let displayName = item.name
        if (item.type === RoomTypeEnum.GROUP && item.remark) {
          // 그룹 비고 사용 (있는 경우)
          displayName = item.remark
        }

        const { checkRoomAtMe, getMessageSenderName, formatMessageContent } = useReplaceMsg()
        // 해당 세션의 모든 메시지를 가져와서 나를 멘션했는지 확인
        const messages = chatStore.chatMessageListByRoomId(item.roomId)
        // 나를 멘션한 메시지가 있는지 확인
        const isAtMe = checkRoomAtMe(
          item.roomId,
          item.type,
          globalStore.currentSessionRoomId!,
          messages,
          item.unreadCount
        )

        // 표시 메시지 처리
        let displayMsg = ''

        const lastMsg = messages[messages.length - 1]
        if (lastMsg) {
          const senderName = getMessageSenderName(lastMsg, '', item.roomId, item.type)
          displayMsg = formatMessageContent(lastMsg, item.type, senderName, item.roomId)
        }

        return {
          ...item,
          avatar: latestAvatar,
          name: displayName, // 수정되었을 수 있는 표시 이름 사용
          lastMsg: displayMsg || 'HuLa 사용을 환영합니다',
          lastMsgTime: formatTimestamp(item?.activeTime),
          isAtMe
        }
      })
      // 정렬 로직 추가: 먼저 상단 고정 상태로 정렬한 다음, 활성 시간순으로 정렬
      .sort((a, b) => {
        // 1. 상단 고정 상태로 먼저 정렬 (상단 고정된 항목이 앞에 옴)
        if (a.top && !b.top) return -1
        if (!a.top && b.top) return 1

        // 2. 동일한 상단 고정 상태에서 마지막 활성 시간 내림차순 정렬 (최신 항목이 앞에 옴)
        return b.activeTime - a.activeTime
      })
  )
})

// 세션 삭제
const handleDelete = async (item: SessionItem | null) => {
  if (!item) return

  try {
    await handleMsgDelete(item.roomId)
  } catch (error) {
    console.error('세션 삭제 실패:', error)
  } finally {
    maskHandler.close()
  }
}

// 상단 고정/해제
const handleToggleTop = async (item: SessionItem | null) => {
  if (!item) return

  try {
    const newTopState = !item.top

    await setSessionTop({
      roomId: item.roomId,
      top: newTopState
    })

    // 로컬 세션 상태 업데이트
    chatStore.updateSession(item.roomId, { top: newTopState })
  } catch (error) {
    console.error('상단 고정 작업 실패:', error)
  } finally {
    maskHandler.close()
  }
}

// 읽음/읽지 않음 상태 전환
const handleToggleReadStatus = async (markAsRead: boolean, sessionItem?: SessionItem) => {
  const targetItem = sessionItem || currentLongPressItem.value
  if (!targetItem) return

  const item = targetItem
  const previousUnreadCount = item.unreadCount

  try {
    const unreadCount = markAsRead ? 0 : 1
    const successMsg = markAsRead ? '읽음으로 표시됨' : '읽지 않음으로 표시됨'

    // 읽지 않음 수 업데이트 (낙관적 업데이트, 실패 시 롤백)
    chatStore.updateSession(item.roomId, {
      unreadCount
    })
    globalStore.updateGlobalUnreadCount()

    if (markAsRead) {
      await markMsgRead(item.roomId)
    }

    window.$message.success(successMsg)
  } catch (error) {
    // 읽지 않음 수 롤백
    chatStore.updateSession(item.roomId, {
      unreadCount: previousUnreadCount
    })
    globalStore.updateGlobalUnreadCount()

    const errorMsg = markAsRead ? '읽음 표시 실패' : '읽지 않음 표시 실패'
    window.$message.error(errorMsg)
    console.error(errorMsg, error)
  } finally {
    maskHandler.close()
  }
}

const onRefresh = () => {
  // 0.5초가 안 되었으면 0.5초 지연, 인터페이스 실행 시간이 0.5초를 초과하면 getSessionList 시간을 기준으로 함
  loading.value = true
  count.value++

  const apiPromise = chatStore.getSessionList(true)
  const delayPromise = new Promise((resolve) => setTimeout(resolve, 500))

  Promise.all([apiPromise, delayPromise])
    .then(([res]) => {
      // 인터페이스와 지연이 모두 완료된 후 실행
      loading.value = false
      console.log('새로고침 완료', res)
    })
    .catch((error) => {
      loading.value = false
      console.log('세션 목록 새로고침 실패:', error)
    })
}

onMounted(async () => {
  await contactStore.getContactList(true)
  await rustWebSocketClient.setupBusinessMessageListeners()
})

/**
 * 이미지 아이콘 렌더링 함수 팩토리
 * @param {string} src - 아이콘 이미지 경로
 * @returns {() => import('vue').VNode} 이미지 렌더링 함수 컴포넌트 반환
 */
const renderImgIcon = (src: string) => {
  return () =>
    h('img', {
      src,
      style: 'display:block; width: 26px; height: 26px; vertical-align: middle;'
    })
}

/**
 * UI 뷰 데이터, 메뉴 옵션 및 아이콘 포함
 * @type {import('vue').Ref<{ addOptions: { label: string; key: string; icon: () => import('vue').VNode }[] }>}
 */
const uiViewsData = ref({
  addOptions: [
    {
      label: '그룹 채팅 시작',
      key: '/mobile/mobileFriends/startGroupChat',
      icon: renderImgIcon(groupChatIcon)
    },
    {
      label: '친구/그룹 추가',
      key: '/mobile/mobileFriends/addFriends',
      icon: renderImgIcon(addFriendIcon)
    }
  ]
})

// 페이지 마스크 관련 처리 (시작)

/**
 * 페이지 마스크 표시 상태
 * @type {import('vue').Ref<boolean>}
 */
const showMask = ref(false)

/**
 * 현재 페이지 스크롤의 세로 위치, 마스크를 열 때 페이지 점프 방지
 * @type {number}
 */
let scrollY = 0

/**
 * 페이지 마스크 제어 객체, 열기 및 닫기 메서드 포함
 */
const maskHandler = {
  /**
   * 마스크 열기 및 스크롤 위치 잠금
   */
  open: () => {
    scrollY = window.scrollY
    showMask.value = true
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = '100%'
  },

  /**
   * 마스크 닫기, 스크롤 상태 및 위치 복원
   */
  close: () => {
    const closeModal = () => {
      showMask.value = false
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
      window.scrollTo(0, scrollY) // 스크롤 위치 복원
    }

    setTimeout(closeModal, 60)

    longPressState.value.disable()
  }
}

// 페이지 마스크 관련 처리 (종료)

/**
 * 추가 버튼 관련 이벤트 처리 객체
 */
const addIconHandler = {
  /**
   * 옵션 선택 시 마스크 닫기
   */
  select: (item: string) => {
    console.log('선택된 항목:', item)
    router.push(item)
    maskHandler.close()
  },

  /**
   * 플러스 버튼 클릭 시 마스크 열기
   */
  open: () => {
    maskHandler.open()
  },

  /**
   * 드롭다운 메뉴 외부 영역 클릭 시 마스크 닫기
   */
  clickOutside: () => {
    maskHandler.close()
  }
}

const router = useRouter()
const { handleMsgClick, handleMsgDelete } = useMessage()

// 메시지 클릭 이벤트 차단, false일 경우 차단하지 않음
let preventClick = false

const handleSwipeOpen = () => {
  preventClick = true
}

const handleSwipeClose = () => {
  preventClick = false
}

const intoRoom = (item: any) => {
  if (longPressState.value.longPressActive) {
    return
  }

  if (preventClick) {
    return
  }

  handleMsgClick(item)
  const foundedUser = allUserMap.value.get(item.detailId)

  setTimeout(() => {
    // 사용자를 찾으면 해당 세션이 친구의 것이므로 친구의 uid를 전달; 동시에 id가 1인 hula 봇 제외
    if (foundedUser && foundedUser.uid !== '1') {
      router.push({
        name: 'mobileChatMain',
        params: {
          uid: item.detailId
        }
      })
    } else {
      router.push({
        name: 'mobileChatMain'
      })
    }
  }, 0)
}
const toSimpleBio = () => {
  // 원하는 퇴장 애니메이션으로 전환
  router.push('/mobile/mobileMy/simpleBio')
}

// 스크롤 잠금 (마스크와 동일)
const lockScroll = () => {
  console.log('잠금 트리거됨')
  const scrollEl = document.querySelector('.flex-1.overflow-auto') as HTMLElement
  if (scrollEl) {
    scrollEl.style.overflow = 'hidden'
  }
}

const unlockScroll = () => {
  console.log('잠금 해제됨')
  const scrollEl = document.querySelector('.flex-1.overflow-auto') as HTMLElement
  if (scrollEl) {
    scrollEl.style.overflow = 'auto'
  }
}

// 길게 누르기 이벤트 처리 (시작)
const longPressOption = ref({
  delay: 200,
  modifiers: {
    prevent: true,
    stop: true
  },
  reset: true,
  windowResize: true,
  windowScroll: true,
  immediate: true,
  updateTiming: 'sync'
})

const handleLongPress = (e: PointerEvent, item: SessionItem) => {
  const latestItem = chatStore.sessionList.find((session) => session.roomId === item.roomId)
  if (!latestItem) return

  currentLongPressItem.value = latestItem

  e.stopPropagation()

  maskHandler.open()

  longPressState.value.enable()

  // 길게 누르기 메뉴 top 값 설정
  const setLongPressMenuTop = () => {
    const target = e.target as HTMLElement

    if (!target) {
      return
    }

    const currentTarget = target.closest('.grid') // 상위 요소를 찾아 grid가 나오면 중지

    if (!currentTarget) {
      return
    }

    const rect = currentTarget.getBoundingClientRect()

    longPressState.value.longPressMenuTop = rect.top - rect.height / 3
  }

  setLongPressMenuTop()

  longPressState.value.showLongPressMenu = true // 길게 누르기 메뉴 표시
}

// 길게 누르기 이벤트 처리 (종료)
</script>

<style scoped lang="scss">
.keyboard-mask {
  position: fixed;
  inset: 0;
  background: transparent; // 투명 배경
  z-index: 1400; // Naive 팝업보다 낮고, 페이지 콘텐츠보다 높음
  pointer-events: auto; // 이벤트 수신 보장
  touch-action: none; // 스크롤 금지
}

::deep(#search) {
  position: relative;
  z-index: 1500; // 키보드 마스크보다 높고, Naive 팝업보다 낮음
}
</style>
