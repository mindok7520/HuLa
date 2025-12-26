<template>
  <n-scrollbar ref="msg-scrollbar" style="max-height: calc(100vh / var(--page-scale, 1) - 70px)">
    <!-- 메시지 동기화 로딩 표시 -->
    <div v-if="syncLoading" class="flex-center gap-10px py-12px text-(12px [--text-color])">
      <n-spin :size="14" />
      <span>{{ t('message.message_list.sync_loading') }}</span>
    </div>
    <!-- 우측 chatBox가 표시되지 않고 네트워크가 오프라인일 때, 목록 영역에 네트워크 상태 표시 -->
    <div
      v-if="!networkStatus.isOnline.value && !syncLoading && !globalStore.currentSessionRoomId"
      class="mx-10px mt-6px border-(1px solid [--danger-text]) flex items-center gap-8px rounded-6px bg-[--danger-bg] px-12px py-10px text-(12px [--danger-text])"
      style="position: sticky; top: 6px; z-index: 999">
      <svg class="size-16px flex-shrink-0">
        <use href="#cloudError"></use>
      </svg>
      <span class="leading-tight">{{ t('home.chat_main.network_offline') }}</span>
    </div>
    <!--  대화 목록  -->
    <div v-if="sessionList.length > 0" class="p-[4px_10px_0px_8px]">
      <ContextMenu
        v-for="item in sessionList"
        :key="item.roomId"
        :class="getItemClasses(item)"
        :data-key="item.roomId"
        :menu="visibleMenu(item)"
        :special-menu="visibleSpecialMenu(item)"
        :content="item"
        class="msg-box w-full h-75px mb-5px"
        @click="handleMsgClick(item)"
        @dblclick="handleMsgDblclick(item)"
        @select="$event.click(item)"
        @menu-show="handleMenuShow(item.roomId, $event)">
        <n-flex :size="10" align="center" class="h-75px pl-6px pr-8px flex-1">
          <n-avatar
            style="border: 1px solid var(--avatar-border-color)"
            :size="44"
            :color="themes.content === ThemeEnum.DARK ? '' : '#fff'"
            :fallback-src="themes.content === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'"
            :src="AvatarUtils.getAvatarUrl(item.avatar)"
            round />

          <n-flex class="h-fit flex-1 truncate" justify="space-between" vertical>
            <n-flex :size="4" align="center" class="flex-1 truncate" justify="space-between">
              <n-flex :size="0" align="center" class="leading-tight flex-1 truncate">
                <span class="text-14px leading-tight flex-1 truncate">{{ item.name }}</span>
                <n-popover trigger="hover" v-if="item.hotFlag === IsAllUserEnum.Yes">
                  <template #trigger>
                    <svg
                      :class="[globalStore.currentSessionRoomId === item.roomId ? 'color-#33ceab' : 'color-#13987f']"
                      class="size-20px select-none outline-none cursor-pointer">
                      <use href="#auth"></use>
                    </svg>
                  </template>
                  <span>{{ t('message.message_list.official_popover') }}</span>
                </n-popover>

                <n-popover trigger="hover" v-if="item.account === UserType.BOT">
                  <template #trigger>
                    <svg class="size-20px select-none outline-none cursor-pointer color-#13987f">
                      <use href="#authenticationUser"></use>
                    </svg>
                  </template>
                  <span>{{ t('message.message_list.bot_popover') }}</span>
                </n-popover>
              </n-flex>
              <span
                v-if="item.account !== UserType.BOT"
                :class="{ 'color-#d5304f90!': item.shield && globalStore.currentSessionRoomId === item.roomId }"
                class="text text-10px w-fit truncate text-right">
                {{ item.lastMsgTime }}
              </span>
            </n-flex>

            <n-flex align="center" justify="space-between">
              <template v-if="item.isAtMe">
                <span class="text flex-1 leading-tight text-12px truncate">
                  <span class="text-#d5304f mr-4px">{{ t('message.message_list.mention_tag') }}</span>
                  <span>{{ String(item.lastMsg || '').replace(':', '：') }}</span>
                </span>
              </template>
              <template v-else-if="item.shield">
                <span class="text flex-1 leading-tight text-12px truncate">
                  <span :class="globalStore.currentSessionRoomId === item.roomId ? 'color-#d5304f90' : 'color-#909090'">
                    {{
                      item.type === RoomTypeEnum.GROUP
                        ? t('message.message_list.shield_group')
                        : t('message.message_list.shield_user')
                    }}
                  </span>
                </span>
              </template>
              <template v-else>
                <span
                  :class="[
                    'text flex-1 leading-tight text-12px truncate',
                    { 'text-[#707070]! dark:text-[#fff]!': item.account === UserType.BOT }
                  ]">
                  {{ String(item.lastMsg || t('message.message_list.default_last_msg')).replace(':', '：') }}
                </span>
              </template>

              <!-- 메시지 알림 -->
              <template v-if="item.shield">
                <svg
                  :class="[globalStore.currentSessionRoomId === item.roomId ? 'color-#d5304f90' : 'color-#909090']"
                  class="size-14px">
                  <use href="#forbid"></use>
                </svg>
              </template>
              <template v-else-if="item.muteNotification === 1 && !item.unreadCount">
                <svg
                  :class="[globalStore.currentSessionRoomId === item.roomId ? 'color-#fefefe' : 'color-#909090']"
                  class="size-14px">
                  <use href="#close-remind"></use>
                </svg>
              </template>
              <n-badge
                v-else
                :max="99"
                :value="item.unreadCount"
                :show="globalStore.unreadReady && item.unreadCount > 0"
                :color="item.muteNotification === 1 ? 'rgba(128, 128, 128, 0.5)' : undefined" />
            </n-flex>
          </n-flex>
        </n-flex>
      </ContextMenu>
    </div>

    <!-- 로딩 중 표시되는 스켈레톤 화면 -->
    <n-flex
      v-else-if="chatStore.sessionOptions.isLoading"
      vertical
      :size="18"
      style="max-height: calc(100vh / var(--page-scale, 1) - 70px)"
      class="relative h-100vh box-border p-20px">
      <n-flex>
        <n-skeleton style="border-radius: 14px" height="60px" width="100%" :sharp="false" />
      </n-flex>

      <n-flex>
        <n-skeleton style="border-radius: 14px" height="40px" width="80%" :sharp="false" />
      </n-flex>

      <n-flex justify="end">
        <n-skeleton style="border-radius: 14px" height="40px" width="80%" :sharp="false" />
      </n-flex>

      <n-flex>
        <n-skeleton style="border-radius: 14px" height="60px" width="100%" :sharp="false" />
      </n-flex>
    </n-flex>

    <!-- 데이터가 없을 때 표시되는 안내 -->
    <n-result v-else class="absolute-center" status="418" :description="t('message.message_list.empty_description')">
      <template #footer>
        <n-button secondary type="primary">{{ t('message.message_list.empty_action') }}</n-button>
      </template>
    </n-result>
  </n-scrollbar>
</template>
<script lang="ts" setup name="message">
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { MittEnum, RoomTypeEnum, ThemeEnum, UserType, MsgEnum } from '@/enums'
import { useCommon } from '@/hooks/useCommon.ts'
import { useMessage } from '@/hooks/useMessage.ts'
import { useMitt } from '@/hooks/useMitt'
import { useReplaceMsg } from '@/hooks/useReplaceMsg.ts'
import { useTauriListener } from '@/hooks/useTauriListener'
import { IsAllUserEnum, type SessionItem } from '@/services/types.ts'
import { useChatStore } from '@/stores/chat.ts'
import { useGlobalStore } from '@/stores/global.ts'
import { useGroupStore } from '@/stores/group.ts'
import { useSettingStore } from '@/stores/setting'
import { useBotStore } from '@/stores/bot'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { formatTimestamp } from '@/utils/ComputedTime.ts'
import { markMsgRead } from '@/utils/ImRequestUtils'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const route = useRoute()
const appWindow = WebviewWindow.getCurrent()
const chatStore = useChatStore()
const globalStore = useGlobalStore()
const groupStore = useGroupStore()
const settingStore = useSettingStore()
const botStore = useBotStore()
const { addListener } = useTauriListener()
const { themes } = storeToRefs(settingStore)
const { syncLoading } = storeToRefs(chatStore)
const botDisplayText = computed(() => botStore.displayText)
const { checkRoomAtMe, getMessageSenderName, formatMessageContent } = useReplaceMsg()
const { openMsgSession } = useCommon()
const msgScrollbar = useTemplateRef<HTMLElement>('msg-scrollbar')
const { handleMsgClick, handleMsgDelete, handleMsgDblclick, visibleMenu, visibleSpecialMenu } = useMessage()
// 현재 우측 클릭 메뉴가 표시된 대화 ID 추적
const activeContextMenuRoomId = ref<string | null>(null)
const networkStatus = useNetworkStatus()
// 읽지 않은 상태 초기화 타이머
let clearUnreadTimer: NodeJS.Timeout | null = null

type SessionMsgCacheItem = { msg: string; isAtMe: boolean; time: number; senderName: string }

// 각 대화의 포맷팅된 메시지를 캐시하여 중복 계산 방지
const sessionMsgCache = reactive<Record<string, SessionMsgCacheItem>>({})
// 대화의 마지막 메시지가 강제 새로고침되어야 할 때 증가시켜 mitt 이벤트와 함께 재계산 트리거
const sessionCacheRefreshKey = ref(0)

// 대화 목록
const sessionList = computed(() => {
  // refreshKey에 의존하여 외부 캐시가 만료될 때 재계산 트리거 보장
  sessionCacheRefreshKey.value

  return (
    chatStore.sessionList
      .map((item) => {
        // 최신 아바타 가져오기
        let latestAvatar = item.avatar
        if (item.type === RoomTypeEnum.SINGLE && item.detailId) {
          latestAvatar = groupStore.getUserInfo(item.detailId)?.avatar || item.avatar
        }

        // 그룹 대화 메모 이름 가져오기 (있는 경우)
        let displayName = item.name
        if (item.type === RoomTypeEnum.GROUP && item.remark) {
          displayName = item.remark
        }

        // @나를 확인하기 위해 해당 대화의 모든 메시지 가져오기
        const messages = chatStore.chatMessageListByRoomId(item.roomId)

        // 최적화: 캐시된 메시지 사용 또는 새 메시지 계산
        let displayMsg = ''
        let isAtMe = false

        const lastMsg = messages[messages.length - 1]
        const cacheKey = item.roomId
        const cached = sessionMsgCache[cacheKey]
        const sendTime = lastMsg?.message?.sendTime || 0

        // 메시지가 있고 캐시가 없거나 만료된 경우 재계산
        if (lastMsg) {
          const senderName = getMessageSenderName(lastMsg, '', item.roomId, item.type)
          const shouldRefreshCache = !cached || cached.time < sendTime || cached.senderName !== senderName

          if (shouldRefreshCache) {
            isAtMe = checkRoomAtMe(
              item.roomId,
              item.type,
              globalStore.currentSessionRoomId!,
              messages,
              item.unreadCount
            )
            // 순수 텍스트 메시지 내용 가져오기 (@나 표시 제외)
            displayMsg = formatMessageContent(lastMsg, item.type, senderName, item.roomId)

            // 그룹 시스템 메시지(예: 멤버 입장)인 경우 보낸 사람 닉네임 제외
            if (item.type === RoomTypeEnum.GROUP && lastMsg.message?.type === MsgEnum.SYSTEM && displayMsg) {
              const separatorIndex = displayMsg.indexOf(':')
              if (separatorIndex > -1) {
                displayMsg = displayMsg.slice(separatorIndex + 1)
              }
            }

            // 캐시 업데이트 (순수 텍스트 메시지 내용만 캐시)
            sessionMsgCache[cacheKey] = {
              msg: displayMsg,
              isAtMe,
              time: sendTime,
              senderName
            }
          } else {
            displayMsg = cached.msg
            isAtMe = item.unreadCount > 0 ? cached.isAtMe : false
          }
        } else if (cached) {
          // 캐시된 값을 사용하되, 읽지 않은 수가 0이면 isAtMe를 강제로 false로 설정
          displayMsg = cached.msg
          isAtMe = item.unreadCount > 0 ? cached.isAtMe : false
        }

        if (item.account === UserType.BOT) {
          displayMsg = botDisplayText.value || displayMsg
        }

        return {
          ...item,
          avatar: latestAvatar,
          name: displayName,
          lastMsg: displayMsg || '欢迎使用HuLa',
          lastMsgTime: formatTimestamp(item?.activeTime),
          isAtMe
        }
      })
      // 정렬 로직 추가: 상단 고정 상태 우선 정렬 후 활성 시간순 정렬
      .sort((a, b) => {
        // 1. 상단 고정 상태 우선 정렬 (상단 고정된 항목을 앞으로)
        if (a.top && !b.top) return -1
        if (!a.top && b.top) return 1

        // 2. 동일 상단 고정 상태 내에서 최종 활성 시간 내림차순 정렬 (최신 항목을 앞으로)
        return b.activeTime - a.activeTime
      })
  )
})

watch(
  () => chatStore.currentSessionInfo,
  async (newVal) => {
    if (newVal) {
      // 중복 호출 방지: 새 대화가 현재 대화와 같으면 처리를 건너뜀 (그렇지 않으면 두 번 트리거됨)
      if (newVal.roomId === globalStore.currentSessionRoomId) {
        return
      }

      // 그룹 대화 여부 판단
      if (newVal.type === RoomTypeEnum.GROUP) {
        const sessionItem = {
          ...newVal,
          memberNum: groupStore.countInfo?.memberNum,
          remark: groupStore.countInfo?.remark,
          myName: groupStore.countInfo?.myName
        }
        handleMsgClick(sessionItem)
      } else {
        // 그룹 대화가 아닌 경우 원본 정보 직접 전달
        const sessionItem = newVal as SessionItem
        handleMsgClick(sessionItem)
      }
    }
  },
  { immediate: true }
)

// 라우트 변화 감지: /message 페이지로 돌아오고 선택된 대화가 있을 때 2초 후 읽지 않은 수 초기화 및 보고
watch(
  () => route.path,
  async (newPath) => {
    // 이전 타이머 정리
    if (clearUnreadTimer) {
      clearTimeout(clearUnreadTimer)
      clearUnreadTimer = null
    }

    // /message로 라우트가 전환될 때만 처리
    if (newPath === '/message') {
      // 선택된 대화가 있는지 확인
      const currentRoomId = globalStore.currentSessionRoomId
      if (currentRoomId) {
        const session = chatStore.getSession(currentRoomId)
        // 선택된 대화에 읽지 않은 메시지가 있으면 2초 후 초기화 및 보고
        if (session?.unreadCount && session.unreadCount > 0) {
          clearUnreadTimer = setTimeout(async () => {
            chatStore.markSessionRead(currentRoomId)
            // 읽음 보고 인터페이스 호출
            try {
              await markMsgRead(currentRoomId)
            } catch (error) {
              console.error('[message] 路由切换时已读上报失败:', error)
            }
            clearUnreadTimer = null
          }, 2000) // 等待2秒
        }
      }
    }
  },
  { immediate: true }
)

// 우측 클릭 메뉴 표시 상태 변화 처리
const handleMenuShow = (roomId: string, isShow: boolean) => {
  activeContextMenuRoomId.value = isShow ? roomId : null
}

// 해당 스타일 판단
const getItemClasses = (item: SessionItem) => {
  const isCurrentSession = globalStore.currentSessionRoomId === item.roomId
  const isContextMenuActive = activeContextMenuRoomId.value === item.roomId

  return {
    active: isCurrentSession,
    'active-bot': isCurrentSession && item.account === UserType.BOT,
    'active-shield': isCurrentSession && item.shield,
    'bg-[--bg-msg-first-child] rounded-12px relative': item.top,
    'context-menu-active': isContextMenuActive,
    'context-menu-active-shield': item.shield && isContextMenuActive,
    'active-context-menu': isContextMenuActive && isCurrentSession
  }
}

onBeforeMount(async () => {
  // 연락처 페이지에서 메시지 페이지로 전환할 때 선택된 대화로 자동 이동
  useMitt.emit(MittEnum.LOCATE_SESSION, { roomId: globalStore.currentSessionRoomId })
})

onMounted(async () => {
  // TODO: 완성 예정
  // SysNTF

  // TODO: 빈번한 대화 전환은 잦은 요청을 유발하며 전환 시 끊김이 발생할 수 있음
  if (appWindow.label === 'home') {
    await addListener(
      appWindow.listen('search_to_msg', (event: { payload: { uid: string; roomType: number } }) => {
        openMsgSession(event.payload.uid, event.payload.roomType)
      }),
      'search_to_msg'
    )
  }
  useMitt.on(MittEnum.UPDATE_SESSION_LAST_MSG, (payload?: { roomId?: string }) => {
    const roomId = payload?.roomId
    if (!roomId) return
    Reflect.deleteProperty(sessionMsgCache, roomId)
    sessionCacheRefreshKey.value++
  })
  useMitt.on(MittEnum.DELETE_SESSION, async (roomId: string) => {
    await handleMsgDelete(roomId)
  })
  useMitt.on(MittEnum.LOCATE_SESSION, async (e: { roomId: string }) => {
    const index = sessionList.value.findIndex((item) => item.roomId === e.roomId)
    if (index !== -1) {
      await nextTick(() => {
        msgScrollbar.value?.scrollTo({
          top: index * (75 + 5) - 264,
          behavior: 'smooth'
        })
      })
    }
  })
})

onUnmounted(() => {
  // 읽지 않은 상태 초기화 타이머 정리, 메모리 누수 방지
  if (clearUnreadTimer) {
    clearTimeout(clearUnreadTimer)
    clearUnreadTimer = null
  }
})
</script>

<style lang="scss" scoped>
@use '@/styles/scss/message';

#image-no-data {
  @apply size-full mt-60px text-[--text-color] text-14px;
}
</style>
