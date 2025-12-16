<template>
  <div class="h-full w-full bg-[--center-bg-color] select-none cursor-default">
    <!-- 창 헤더 -->
    <ActionBar
      class="absolute right-0 w-full z-999"
      :shrink="false"
      :max-w="false"
      :current-label="WebviewWindow.getCurrent().label" />

    <!-- 제목 -->
    <p
      class="absolute-x-center h-fit pt-6px text-(13px [--text-color]) select-none cursor-default"
      data-tauri-drag-region>
      {{ t('home.search_window.title') }}
    </p>

    <!-- 주요 내용 -->
    <n-flex vertical :size="14" class="p-[45px_0_18px]" data-tauri-drag-region>
      <!-- 검색창 -->
      <div class="px-12px">
        <n-input
          v-model:value="searchValue"
          type="text"
          size="small"
          style="border-radius: 8px; border: 1px solid #ccc"
          :placeholder="searchPlaceholder[searchType]"
          :maxlength="20"
          round
          spellCheck="false"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          clearable
          @keydown.enter="handleSearch"
          @clear="handleClear">
          <template #prefix>
            <n-icon>
              <svg class="icon" aria-hidden="true">
                <use href="#search" />
              </svg>
            </n-icon>
          </template>
        </n-input>
      </div>

      <!-- 검색 유형 전환 -->
      <n-tabs v-model:value="searchType" animated size="small" @update:value="handleTypeChange">
        <n-tab-pane v-for="tab in tabs" :key="tab.name" :name="tab.name" :tab="tab.label">
          <template>
            <span>{{ tab.label }}</span>
          </template>

          <!-- 초기 로딩 상태 -->
          <template v-if="initialLoading">
            <n-spin class="flex-center" style="height: calc(100vh / var(--page-scale, 1) - 200px)" size="large" />
          </template>

          <!-- 검색 결과 -->
          <template v-else-if="searchResults.length">
            <FloatBlockList
              :data-source="searchResults"
              item-key="id"
              :item-height="64"
              max-height="calc(100vh / var(--page-scale, 1) - 128px)"
              style-id="search-hover-classes">
              <template #item="{ item }">
                <div class="p-[0_20px] box-border">
                  <n-flex align="center" :size="12" class="p-[8px_0] rounded-lg">
                    <n-avatar
                      :size="48"
                      :src="AvatarUtils.getAvatarUrl(item.avatar)"
                      :color="themes.content === ThemeEnum.DARK ? '' : '#fff'"
                      :fallback-src="themes.content === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'"
                      round />
                    <n-flex vertical justify="center" :size="10" class="flex-1">
                      <n-space align="center" :size="10">
                        <span class="text-(14px [--text-color])">{{ item.name }}</span>
                        <template v-for="account in item.itemIds" :key="account">
                          <img class="size-20px" :src="cachedStore.badgeById(account)?.img" alt="" />
                        </template>
                      </n-space>
                      <n-flex align="center" :size="10">
                        <span class="text-(12px [--chat-text-color])">
                          {{ t('home.search_window.labels.account', { account: item.account }) }}
                        </span>
                        <n-tooltip trigger="hover">
                          <template #trigger>
                            <svg
                              class="size-12px hover:color-#909090 hover:transition-colors"
                              @click="handleCopy(item.account)">
                              <use href="#copy"></use>
                            </svg>
                          </template>
                          <span>{{ t('home.search_window.tooltip.copy_account') }}</span>
                        </n-tooltip>
                      </n-flex>
                    </n-flex>

                    <!-- 세 가지 상태 버튼 -->
                    <n-button
                      secondary
                      :type="getButtonType(item.uid, item.roomId)"
                      size="small"
                      class="action-button"
                      @click="handleButtonClick(item)">
                      {{ getButtonText(item.uid, item.roomId) }}
                    </n-button>
                  </n-flex>
                </div>
              </template>
            </FloatBlockList>
          </template>

          <!-- 검색 중 상태 -->
          <template v-else-if="loading">
            <n-spin class="flex-center" style="height: calc(100vh / var(--page-scale, 1) - 200px)" size="large" />
          </template>

          <!-- 검색 결과 없음 상태 -->
          <template v-else-if="hasSearched">
            <n-empty
              class="flex-center"
              style="height: calc(100vh / var(--page-scale, 1) - 200px)"
              :description="t('home.search_window.empty.no_result')" />
          </template>

          <!-- 기본 빈 상태 -->
          <template v-else>
            <n-empty
              style="height: calc(100vh / var(--page-scale, 1) - 200px)"
              class="flex-center"
              :description="t('home.search_window.empty.prompt')">
              <template #icon>
                <n-icon>
                  <svg><use href="#explosion"></use></svg>
                </n-icon>
              </template>
            </n-empty>
          </template>
        </n-tab-pane>
      </n-tabs>
    </n-flex>
  </div>
</template>

<script setup lang="ts">
import { emitTo } from '@tauri-apps/api/event'
import { getCurrentWebviewWindow, WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useDebounceFn } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import FloatBlockList from '@/components/common/FloatBlockList.vue'
import { ThemeEnum } from '@/enums'
import { RoomTypeEnum } from '@/enums/index.ts'
import { useWindow } from '@/hooks/useWindow'
import type { FriendItem, GroupDetailReq } from '@/services/types'
import { useCachedStore } from '@/stores/cached'
import { useContactStore } from '@/stores/contacts'
import { useGlobalStore } from '@/stores/global'
import { useGroupStore } from '@/stores/group'
import { useSettingStore } from '@/stores/setting'
import { useUserStore } from '@/stores/user'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { searchFriend, searchGroup } from '@/utils/ImRequestUtils'

const { createWebviewWindow } = useWindow()
const contactStore = useContactStore()
const userStore = useUserStore()
const globalStore = useGlobalStore()
const settingStore = useSettingStore()
const cachedStore = useCachedStore()
const { themes } = storeToRefs(settingStore)

// 탭 정의
const { t } = useI18n()
const tabs = computed(() => [
  { name: 'recommend', label: t('home.search_window.tabs.recommend') },
  { name: 'user', label: t('home.search_window.tabs.user') },
  { name: 'group', label: t('home.search_window.tabs.group') }
])
// 검색 유형
const searchType = ref<'recommend' | 'user' | 'group'>('recommend')
// 검색 유형에 따른 placeholder 매핑
const searchPlaceholder = computed(() => ({
  recommend: t('home.search_window.placeholder.recommend'),
  user: t('home.search_window.placeholder.user'),
  group: t('home.search_window.placeholder.group')
}))
// 검색 값
const searchValue = ref('')
// 검색 결과
const searchResults = ref<any[]>([])
// 검색 여부
const hasSearched = ref(false)
// 로딩 상태
const loading = ref(false)
// 초기 로딩 상태
const initialLoading = ref(true)

// 캐시 저장소에서 사용자 데이터 가져오기
const getCachedUsers = () => {
  // 캐시에서 모든 사용자 가져오기
  const users = groupStore.allUserInfo
  console.log(users)

  // 표시할 사용자 필터링 (ID가 20016-20030 사이인 사용자)
  return sortSearchResults(
    users
      .filter((user) => {
        const uid = user.uid as string
        return uid >= '20016' && uid <= '20030'
      })
      .map((user) => ({
        uid: user.uid,
        account: user.account,
        name: user.name,
        avatar: user.avatar,
        itemIds: user.itemIds || null
      })),
    'recommend'
  )
}

// 검색 결과 지우기
const clearSearchResults = () => {
  searchResults.value = []
  hasSearched.value = false
  searchValue.value = ''
}

// 계정 복사 처리
const handleCopy = (account: string) => {
  navigator.clipboard.writeText(account)
  window.$message.success(t('home.search_window.notification.copy_success', { account }))
}

// 지우기 버튼 클릭 처리
const handleClear = () => {
  clearSearchResults()

  // 추천 탭인 경우 추천 사용자 다시 로드
  if (searchType.value === 'recommend') {
    searchResults.value = getCachedUsers()
  }
}

// 검색 처리
const handleSearch = useDebounceFn(async () => {
  if (!searchValue.value.trim()) {
    // 검색창이 비어 있고 추천 탭인 경우 모든 추천 사용자 표시
    if (searchType.value === 'recommend') {
      searchResults.value = getCachedUsers()
    }
    return
  }

  loading.value = true
  hasSearched.value = true

  try {
    if (searchType.value === 'group') {
      // 그룹 채팅 검색 인터페이스 호출
      const res = await searchGroup({ account: searchValue.value })
      searchResults.value = res.map((group: any) => ({
        account: group.account,
        name: group.name,
        avatar: group.avatar,
        deleteStatus: group.deleteStatus,
        extJson: group.extJson,
        roomId: group.roomId
      }))
    } else if (searchType.value === 'user') {
      // 친구 검색 인터페이스 호출
      const res = await searchFriend({ key: searchValue.value })
      searchResults.value = res.map((user: any) => ({
        uid: user.uid,
        name: user.name,
        avatar: user.avatar,
        account: user.account
      }))
    } else {
      // 추천 탭 검색 결과
      const cachedUsers = getCachedUsers()
      searchResults.value = cachedUsers.filter(
        (user) =>
          user?.name?.includes(searchValue.value) || (user.uid && user.uid.toString().includes(searchValue.value))
      )
    }
    // 일반 정렬 함수
    searchResults.value = sortSearchResults(searchResults.value, searchType.value)
  } catch (error) {
    window.$message.error(t('home.search_window.notification.search_fail'))
    searchResults.value = []
  } finally {
    loading.value = false
  }
}, 300)

// 탭 전환 처리
const handleTypeChange = () => {
  clearSearchResults()

  if (searchType.value === 'recommend') {
    searchResults.value = getCachedUsers()
  }
}
const groupStore = useGroupStore()
// 그룹 채팅 가입 여부 판단
const isInGroup = (roomId: string) => {
  return groupStore.groupDetails.some((group: GroupDetailReq) => group.roomId === roomId)
}

// 일반 정렬 함수
const sortSearchResults = (items: any[], type: 'user' | 'group' | 'recommend') => {
  if (type === 'group') {
    // 그룹 채팅 정렬 로직: 가입한 그룹 채팅이 앞에 위치
    return items.sort((a, b) => {
      const aInGroup = isInGroup(a.roomId)
      const bInGroup = isInGroup(b.roomId)
      if (aInGroup && !bInGroup) return -1
      if (!aInGroup && bInGroup) return 1
      return 0
    })
  } else {
    // 사용자 정렬 로직: 자신이 가장 앞에, 친구가 두 번째
    return items.sort((a, b) => {
      // uid가 string 또는 number일 수 있는 상황 처리
      const aUid = String(a.uid)
      const bUid = String(b.uid)

      // 자신이 가장 앞에 위치
      if (isCurrentUser(aUid)) return -1
      if (isCurrentUser(bUid)) return 1

      // 친구가 두 번째 위치
      const aIsFriend = isFriend(aUid)
      const bIsFriend = isFriend(bUid)
      if (aIsFriend && !bIsFriend) return -1
      if (!aIsFriend && bIsFriend) return 1

      return 0
    })
  }
}

// 이미 친구인지 판단
const isFriend = (uid: string) => {
  return contactStore.contactsList.some((contact: FriendItem) => contact.uid === uid)
}

// 현재 로그인한 사용자인지 판단
const isCurrentUser = (uid: string) => {
  return userStore.userInfo!.uid === uid
}

// 버튼 텍스트 가져오기
const getButtonText = (uid: string, roomId: string) => {
  // 그룹 채팅 로직
  if (searchType.value === 'group') {
    return isInGroup(roomId) ? t('home.search_window.buttons.message') : t('home.search_window.buttons.add')
  }
  // 사용자 로직
  if (isCurrentUser(uid)) return t('home.search_window.buttons.edit_profile')
  if (isFriend(uid)) return t('home.search_window.buttons.message')
  return t('home.search_window.buttons.add')
}

// 버튼 유형 가져오기
const getButtonType = (uid: string, roomId: string) => {
  // 그룹 채팅 로직
  if (searchType.value === 'group') {
    return isInGroup(roomId) ? 'info' : 'primary'
  }
  // 사용자 로직
  if (isCurrentUser(uid)) return 'default'
  if (isFriend(uid)) return 'info'
  return 'primary'
}

// 버튼 클릭 처리
const handleButtonClick = (item: any) => {
  if (searchType.value === 'group') {
    if (isInGroup(item.roomId)) {
      handleSendGroupMessage(item)
    } else {
      handleAddFriend(item)
    }
    return
  }

  // 사용자 로직 유지
  if (isCurrentUser(item.uid)) {
    handleEditProfile()
  } else if (isFriend(item.uid)) {
    handleSendMessage(item)
  } else {
    handleAddFriend(item)
  }
}

// 친구 또는 그룹 채팅 추가 처리
const handleAddFriend = async (item: any) => {
  if (searchType.value === 'user' || searchType.value === 'recommend') {
    await createWebviewWindow(
      t('home.search_window.modal.add_friend'),
      'addFriendVerify',
      380,
      300,
      '',
      false,
      380,
      300
    )
    globalStore.addFriendModalInfo.show = true
    globalStore.addFriendModalInfo.uid = item.uid
  } else {
    await createWebviewWindow(t('home.search_window.modal.add_group'), 'addGroupVerify', 380, 400, '', false, 380, 400)
    globalStore.addGroupModalInfo.show = true
    globalStore.addGroupModalInfo.account = item.account
    globalStore.addGroupModalInfo.name = item.name
    globalStore.addGroupModalInfo.avatar = item.avatar
  }
}

// 프로필 편집 처리
const handleEditProfile = async () => {
  // 메인 창 가져오기
  const homeWindow = await WebviewWindow.getByLabel('home')
  // 메인 창 활성화
  await homeWindow?.setFocus()
  // 프로필 편집 창 열기
  emitTo('home', 'open_edit_info')
}

// 메시지 전송 처리
const handleSendMessage = async (item: any) => {
  emitTo('home', 'search_to_msg', { uid: item.uid, roomType: RoomTypeEnum.SINGLE })
}

// 그룹 메시지 전송 처리
const handleSendGroupMessage = async (item: any) => {
  emitTo('home', 'search_to_msg', {
    uid: item.roomId,
    roomType: RoomTypeEnum.GROUP
  })
}

onMounted(async () => {
  await getCurrentWebviewWindow().show()

  try {
    // 연락처 목록 초기화
    await contactStore.getContactList(true)

    // 캐시에서 추천 사용자 가져오기
    const cachedUsers = getCachedUsers()

    // 기본적으로 추천 사용자 표시
    if (searchType.value === 'recommend') {
      searchResults.value = cachedUsers
    }
  } finally {
    initialLoading.value = false
  }
})
</script>

<style scoped lang="scss">
.action-button {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  opacity: 0.9;
}

.action-button:hover {
  opacity: 1;
  transform: scale(1.06);
  box-shadow: 0 2px 8px rgba(var(--primary-color-rgb), 0.25);
}

.action-button:active {
  transform: scale(0.98);
}

/* 탭 내용의 패딩 제거 */
:deep(.n-tab-pane) {
  padding: 0 !important;
}

:deep(.n-tabs .n-tabs-nav-scroll-wrapper) {
  padding: 0 20px 10px !important;
}
</style>
