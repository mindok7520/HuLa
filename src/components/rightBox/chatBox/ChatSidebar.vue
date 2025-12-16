<template>
  <!--! n-flex를 사용하지 않는 것이 좋습니다. 스크롤 높이 문제가 발생할 수 있습니다 -->
  <main
    style="height: 100%"
    class="flex-shrink-0"
    :class="[
      isGroup
        ? isCollapsed
          ? 'w-0 pr-1px'
          : 'w-180px border-l-(1px solid [--right-chat-footer-line-color]) p-[12px_0_12px_6px] custom-shadow'
        : 'w-0 pr-1px',
      'item-box'
    ]">
    <!-- 축소 버튼 -->
    <div
      v-show="isGroup"
      @click.stop="isCollapsed = !isCollapsed"
      style="border-radius: 18px 0 0 18px"
      class="contraction transition-all duration-600 ease-in-out absolute top-35% left--14px cursor-pointer opacity-0 bg-#c8c8c833 h-60px w-14px">
      <svg
        :class="isCollapsed ? 'rotate-0' : 'rotate-180'"
        class="size-16px color-#909090 dark:color-#303030 absolute top-38%">
        <use href="#left-arrow"></use>
      </svg>
    </div>

    <div v-if="isGroup && !isCollapsed">
      <!-- 그룹 공지 -->
      <n-flex vertical :size="14" class="px-4px py-10px">
        <n-flex align="center" justify="space-between" :size="8" class="cursor-pointer">
          <p
            class="text-(14px --text-color) truncate flex-1 min-w-0"
            @click="handleOpenAnnoun(announNum === 0 && isAddAnnoun)">
            {{ t('home.chat_sidebar.announcement.title') }}
          </p>
          <svg
            class="size-16px rotate-270 color-[--text-color] shrink-0"
            @click="handleOpenAnnoun(announNum === 0 && isAddAnnoun)">
            <use v-if="announNum === 0 && isAddAnnoun" href="#plus"></use>
            <use v-else href="#down"></use>
          </svg>
        </n-flex>

        <!-- 공지 로드 실패 알림 -->
        <n-flex v-if="announError" class="h-74px" align="center" justify="center">
          <div class="text-center">
            <p class="text-(12px #909090) mb-8px">{{ t('home.chat_sidebar.announcement.load_failed') }}</p>
            <n-button size="tiny" @click="announcementStore.loadGroupAnnouncements()">
              {{ t('home.chat_sidebar.actions.retry') }}
            </n-button>
          </div>
        </n-flex>

        <!-- 공지 내용 -->
        <n-scrollbar v-else class="h-74px">
          <p class="text-(12px #909090) leading-6 line-clamp-4 max-w-99%" v-if="announNum === 0">
            {{ t('home.chat_sidebar.announcement.default') }}
          </p>
          <p
            v-else
            style="user-select: text"
            class="announcement-text text-(12px #909090) leading-6 line-clamp-4 max-w-99% break-words">
            <template v-if="announcementSegments.length > 0">
              <template v-for="(segment, index) in announcementSegments" :key="index">
                <span
                  v-if="segment.isLink"
                  class="cursor-pointer hover:underline hover:opacity-80 text-#13987f"
                  @click.stop="openAnnouncementLink(segment.text)">
                  {{ segment.text }}
                </span>
                <template v-else>{{ segment.text }}</template>
              </template>
            </template>
            <template v-else>{{ announcementContent }}</template>
          </p>
        </n-scrollbar>
      </n-flex>

      <n-flex v-if="!isSearch" align="center" justify="space-between" class="pr-8px pl-8px h-42px">
        <span class="text-14px">{{ t('home.chat_sidebar.online_members', { count: onlineCountDisplay }) }}</span>
        <svg @click="handleSelect" class="size-14px">
          <use href="#search"></use>
        </svg>
      </n-flex>
      <!-- 검색 상자 -->
      <n-flex v-else align="center" class="pr-8px h-42px">
        <n-input
          :on-input="handleSearch"
          @blur="handleBlur"
          ref="inputInstRef"
          v-model:value="searchRef"
          clearable
          :placeholder="t('home.chat_sidebar.search.placeholder')"
          type="text"
          size="tiny"
          spellCheck="false"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          class="h-26px w-95% lh-26px rounded-6px">
          <template #prefix>
            <svg class="w-12px h-12px">
              <use href="#search"></use>
            </svg>
          </template>
        </n-input>
      </n-flex>

      <!-- 멤버 목록 -->
      <n-virtual-list
        id="image-chat-sidebar"
        style="max-height: calc(100vh / var(--page-scale, 1) - 250px)"
        item-resizable
        @scroll="handleScroll($event)"
        :item-size="46"
        :items="displayedUserList">
        <template #default="{ item }">
          <n-popover
            :ref="(el: any) => (infoPopoverRefs[item.uid] = el)"
            @update:show="handlePopoverUpdate(item.uid, $event)"
            trigger="click"
            placement="left"
            :show-arrow="false"
            style="padding: 0; background: var(--bg-info)">
            <template #trigger>
              <ContextMenu
                :content="item"
                @select="$event.click(item, 'Sidebar')"
                :menu="optionsList"
                :special-menu="report">
                <n-flex
                  @click="onClickMember(item)"
                  :key="item.uid"
                  :size="10"
                  align="center"
                  justify="space-between"
                  class="item">
                  <n-flex align="center" :size="8" class="flex-1 truncate">
                    <div class="relative inline-flex items-center justify-center">
                      <n-avatar
                        round
                        class="grayscale"
                        :class="{ 'grayscale-0': item.activeStatus === OnlineEnum.ONLINE }"
                        :size="26"
                        :color="themes.content === ThemeEnum.DARK ? '' : '#fff'"
                        :fallback-src="themes.content === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'"
                        :src="AvatarUtils.getAvatarUrl(item.avatar)"
                        @load="userLoadedMap[item.uid] = true"
                        @error="userLoadedMap[item.uid] = true" />
                    </div>
                    <n-flex vertical :size="2" class="flex-1 truncate">
                      <p :title="item.name" class="text-12px truncate flex-1 leading-tight">
                        {{ item.myName ? item.myName : item.name }}
                      </p>
                      <n-flex
                        v-if="item.userStateId && getUserState(item.userStateId)"
                        align="center"
                        :size="4"
                        class="flex-1">
                        <img class="size-12px" :src="getUserState(item.userStateId)?.url" alt="" />
                        <span
                          class="text-10px text-[--chat-text-color] flex-1 min-w-0 truncate"
                          :title="translateStateTitle(getUserState(item.userStateId)?.title)">
                          {{ translateStateTitle(getUserState(item.userStateId)?.title) }}
                        </span>
                      </n-flex>
                    </n-flex>
                  </n-flex>

                  <div
                    v-if="item.roleId === RoleEnum.LORD"
                    class="flex px-4px bg-#d5304f30 py-3px rounded-4px size-fit select-none">
                    <p class="text-(10px #d5304f)">{{ t('home.chat_sidebar.roles.owner') }}</p>
                  </div>
                  <div
                    v-if="item.roleId === RoleEnum.ADMIN"
                    class="flex px-4px bg-#1a7d6b30 py-3px rounded-4px size-fit select-none">
                    <p class="text-(10px #008080)">{{ t('home.chat_sidebar.roles.admin') }}</p>
                  </div>
                </n-flex>
              </ContextMenu>
            </template>
            <!-- 사용자 개인 정보 상자 -->
            <InfoPopover v-if="selectKey === item.uid" :uid="item.uid" :activeStatus="item.activeStatus" />
          </n-popover>
        </template>
      </n-virtual-list>
    </div>
  </main>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useDebounceFn } from '@vueuse/core'
import type { InputInst } from 'naive-ui'
import { storeToRefs } from 'pinia'
import { MittEnum, OnlineEnum, RoleEnum, ThemeEnum, RoomTypeEnum } from '@/enums'
import { useChatMain } from '@/hooks/useChatMain.ts'
import { useMitt } from '@/hooks/useMitt.ts'
import { usePopover } from '@/hooks/usePopover.ts'
import { useWindow } from '@/hooks/useWindow.ts'
import { useLinkSegments } from '@/hooks/useLinkSegments'
import type { UserItem } from '@/services/types'
import { WsResponseMessageType } from '@/services/wsType.ts'
import { useGlobalStore } from '@/stores/global.ts'
import { useGroupStore } from '@/stores/group.ts'
import { useSettingStore } from '@/stores/setting'
import { useUserStatusStore } from '@/stores/userStatus'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { getUserByIds } from '@/utils/ImRequestUtils'
import { useAnnouncementStore } from '@/stores/announcement'

const { t } = useI18n()
const appWindow = WebviewWindow.getCurrent()
const emit = defineEmits<(e: 'ready') => void>()
const { createWebviewWindow } = useWindow()
const groupStore = useGroupStore()
const globalStore = useGlobalStore()
const settingStore = useSettingStore()
const announcementStore = useAnnouncementStore()
const { clearAnnouncements } = announcementStore
const { themes } = storeToRefs(settingStore)
// 현재 로드된 그룹 채팅 ID
// 멤버 목록이 완전히 로드되지 않은 경우 현재 목록의 온라인 수를 사용하여 아바타 표시 불일치 방지
const onlineCountDisplay = computed(() => {
  const totalOnline = groupStore.countInfo?.onlineNum ?? 0
  const loadedOnline =
    groupStore.onlineCountMap[globalStore.currentSessionRoomId] ??
    groupStore.userList.filter((m) => m.activeStatus === OnlineEnum.ONLINE).length
  return groupStore.userListOptions.isLast ? totalOnline : loadedOnline
})
const isGroup = computed(() => globalStore.currentSession?.type === RoomTypeEnum.GROUP)
// 공지 관련 계산된 속성
const { announcementContent, announNum, announError, isAddAnnoun } = storeToRefs(announcementStore)
const { segments: announcementSegments, openLink: openAnnouncementLink } = useLinkSegments(announcementContent)

/** 검색 모드 여부 */
const isSearch = ref(false)
const searchRef = ref('')
const searchRequestId = ref(0)
/** List의 Popover 컴포넌트 인스턴스 */
const infoPopoverRefs = ref<Record<string, any>>([])
const inputInstRef = ref<InputInst | null>(null)
const isCollapsed = ref(false)
const { optionsList, report, selectKey } = useChatMain()
const { handlePopoverUpdate, enableScroll } = usePopover(selectKey, 'image-chat-sidebar')
provide('popoverControls', { enableScroll })

// 안정적인 표시를 위한 사용자 목록
const displayedUserList = ref<UserItem[]>([])
/** 사용자 정보 로드 상태 */
const userLoadedMap = ref<Record<string, boolean>>({})

watch(
  () => [globalStore.currentSessionRoomId, isGroup.value] as const,
  async ([roomId, isGroupChat], prevValue) => {
    const [prevRoomId, prevIsGroup] = prevValue ?? [undefined, undefined]
    if (!roomId || !isGroupChat) {
      clearAnnouncements()
      return
    }

    if (roomId === prevRoomId && prevIsGroup === isGroupChat) {
      return
    }

    try {
      await announcementStore.loadGroupAnnouncements(roomId)
    } catch (error) {
      console.error('그룹 공지 새로 고침 실패:', error)
    }
  },
  { immediate: true }
)

const onClickMember = async (item: UserItem) => {
  console.log('사용자 클릭', item)
  selectKey.value = item.uid

  // 사용자의 최신 데이터를 가져와 pinia 업데이트
  getUserByIds([item.uid]).then((users) => {
    if (users && users.length > 0) {
      groupStore.updateUserItem(item.uid, users[0])
    }
  })
}

// 멤버 소스 목록 변경 감지
watch(
  () => groupStore.userList,
  (newList) => {
    if (searchRef.value.trim()) {
      return
    }

    displayedUserList.value = Array.isArray(newList) ? [...newList] : []
  },
  { immediate: true }
)

/**
 * 검색 입력 감지하여 사용자 필터링
 * @param value 입력 값
 */
const handleSearch = useDebounceFn((value: string) => {
  searchRef.value = value
  const keyword = value.trim().toLowerCase()

  // 검색 키워드가 없으면 모든 멤버 표시
  if (!keyword) {
    displayedUserList.value = Array.isArray(groupStore.userList) ? [...groupStore.userList] : []
    return
  }

  // 프론트엔드 로컬 멤버 목록 필터링
  const filteredList = groupStore.userList.filter((member) => {
    const matchName = member.name?.toLowerCase().includes(keyword)
    const matchMyName = member.myName?.toLowerCase().includes(keyword)
    return matchName || matchMyName
  })

  displayedUserList.value = filteredList
}, 10)

const handleBlur = () => {
  if (searchRef.value) return
  isSearch.value = false
  searchRequestId.value++
  displayedUserList.value = Array.isArray(groupStore.userList) ? [...groupStore.userList] : []
}

/**
 * 스크롤 이벤트 처리
 * @param event 스크롤 이벤트
 */
const handleScroll = (event: Event) => {
  if (searchRef.value.trim()) {
    return
  }

  const target = event.target as HTMLElement
  const isBottom = target.scrollHeight - target.scrollTop === target.clientHeight

  if (isBottom && !groupStore.userListOptions.loading) {
    groupStore.loadMoreGroupMembers()
  }
}

/**
 * 검색 모드 전환 및 입력 상자 자동 포커스
 */
const handleSelect = () => {
  isSearch.value = !isSearch.value

  if (isSearch.value) {
    nextTick(() => {
      inputInstRef.value?.select()
    })
  } else {
    searchRequestId.value++
    searchRef.value = ''
    displayedUserList.value = Array.isArray(groupStore.userList) ? [...groupStore.userList] : []
  }
}

/**
 * 그룹 공지 열기
 */
const handleOpenAnnoun = (isAdd: boolean) => {
  nextTick(async () => {
    const roomId = globalStore.currentSessionRoomId
    await createWebviewWindow(
      isAdd ? t('home.chat_sidebar.announcement.window.add') : t('home.chat_sidebar.announcement.window.view'),
      `announList/${roomId}/${isAdd ? 0 : 1}`,
      420,
      620
    )
  })
}

const userStatusStore = useUserStatusStore()
const { stateList } = storeToRefs(userStatusStore)

const getUserState = (stateId: string) => {
  return stateList.value.find((state: { id: string }) => state.id === stateId)
}

const translateStateTitle = (title?: string) => {
  if (!title) return ''
  const key = `auth.onlineStatus.states.${title}`
  const translated = t(key)
  return translated === key ? title : translated
}

appWindow.listen('announcementUpdated', async (event: any) => {
  if (event.payload) {
    const { hasAnnouncements } = event.payload
    if (hasAnnouncements) {
      // 그룹 공지 초기화
      await announcementStore.loadGroupAnnouncements()
      await nextTick()
    }
  }
})

onMounted(async () => {
  // 부모에게 알림: Sidebar 마운트됨, 자리 표시자 제거 가능
  emit('ready')

  useMitt.on(`${MittEnum.INFO_POPOVER}-Sidebar`, (event: any) => {
    selectKey.value = event.uid
    infoPopoverRefs.value[event.uid].setShow(true)
    handlePopoverUpdate(event.uid)
  })

  appWindow.listen('announcementClear', async () => {
    clearAnnouncements()
  })

  // 초기화 시 현재 그룹 사용자 정보 가져오기
  if (groupStore.userList.length > 0) {
    // 현재 목록 초기 표시
    displayedUserList.value = [...groupStore.userList]
    const currentRoom = globalStore.currentSessionRoomId
    if (currentRoom) {
      groupStore.updateMemberCache(currentRoom, displayedUserList.value)
    }
    const handleAnnounInitOnEvent = (shouldReload: boolean) => {
      return async (event: any) => {
        if (shouldReload || event) {
          await announcementStore.loadGroupAnnouncements()
        }
      }
    }
    // 그룹 공지 메시지 감지
    useMitt.on(WsResponseMessageType.ROOM_GROUP_NOTICE_MSG, handleAnnounInitOnEvent(true))
    useMitt.on(WsResponseMessageType.ROOM_EDIT_GROUP_NOTICE_MSG, handleAnnounInitOnEvent(true))
  }
})

onUnmounted(() => {
  groupStore.cleanupSession()
})
</script>

<style scoped lang="scss">
@use '@/styles/scss/chat-sidebar';
</style>
