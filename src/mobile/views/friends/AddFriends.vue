<template>
  <div class="flex flex-1 flex-col relative bg-cover bg-center">
    <MobileLayout>
      <HeaderBar
        :isOfficial="false"
        :hidden-right="true"
        :enable-default-background="false"
        :enable-shadow="false"
        room-name="친구/그룹 추가" />

      <div class="flex flex-col gap-1 overflow-auto h-full">
        <!-- 주요 내용 -->
        <n-flex vertical :size="14">
          <!-- 검색창 -->
          <div class="px-16px">
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
                            <span class="text-(12px [--chat-text-color])">{{ `계정: ${item.account}` }}</span>
                            <n-tooltip trigger="hover">
                              <template #trigger>
                                <svg
                                  class="size-12px hover:color-#909090 hover:transition-colors"
                                  @click="handleCopy(item.account)">
                                  <use href="#copy"></use>
                                </svg>
                              </template>
                              <span>계정 복사</span>
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
                  description="관련 결과를 찾을 수 없습니다" />
              </template>

              <!-- 기본 빈 상태 -->
              <template v-else>
                <n-empty
                  style="height: calc(100vh / var(--page-scale, 1) - 200px)"
                  class="flex-center"
                  description="검색어 입력">
                  <template #icon>
                    <n-icon>
                      <svg>
                        <use href="#explosion"></use>
                      </svg>
                    </n-icon>
                  </template>
                </n-empty>
              </template>
            </n-tab-pane>
          </n-tabs>
        </n-flex>
      </div>
    </MobileLayout>
  </div>
</template>

<script setup lang="ts">
import { emitTo } from '@tauri-apps/api/event'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useDebounceFn } from '@vueuse/core'
import FloatBlockList from '@/components/common/FloatBlockList.vue'
import { ThemeEnum } from '@/enums'
import { RoomTypeEnum } from '@/enums/index.ts'
import type { FriendItem, GroupDetailReq } from '@/services/types'
import { useCachedStore } from '@/stores/cached'
import { useContactStore } from '@/stores/contacts'
import { useGlobalStore } from '@/stores/global'
import { useGroupStore } from '@/stores/group'
import { useSettingStore } from '@/stores/setting'
import { useUserStore } from '@/stores/user'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { searchFriend, searchGroup } from '@/utils/ImRequestUtils'
import { isMobile } from '@/utils/PlatformConstants'
import router from '@/router'

const contactStore = useContactStore()
const userStore = useUserStore()
const globalStore = useGlobalStore()
const settingStore = useSettingStore()
const cachedStore = useCachedStore()
const { themes } = storeToRefs(settingStore)
// 탭 정의
const tabs = ref([
  { name: 'recommend', label: '추천' },
  { name: 'user', label: '친구 찾기' },
  { name: 'group', label: '그룹 찾기' }
])
// 검색 유형
const searchType = ref<'recommend' | 'user' | 'group'>('recommend')
// 검색 유형별 placeholder 매핑
const searchPlaceholder = {
  recommend: '추천 검색어 입력',
  user: '닉네임 입력하여 친구 검색',
  group: '그룹 ID 입력하여 그룹 검색'
}
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

// 캐시 스토리지에서 사용자 데이터 가져오기
const getCachedUsers = () => {
  // 캐시에서 모든 사용자 가져오기
  const users = groupStore.allUserInfo
  console.log(users)

  // 표시할 사용자 필터링 (ID 20016-20030 사이 사용자)
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

// 검색 결과 초기화
const clearSearchResults = () => {
  searchResults.value = []
  hasSearched.value = false
  searchValue.value = ''
}

// 계정 복사 처리
const handleCopy = (account: string) => {
  navigator.clipboard.writeText(account)
  window.$message.success(`복사 성공 ${account}`)
}

// 초기화 버튼 클릭 처리
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
      // 그룹 검색 API 호출
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
      // 친구 검색 API 호출
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
    // 공통 정렬 함수
    searchResults.value = sortSearchResults(searchResults.value, searchType.value)
  } catch (error) {
    window.$message.error('검색 실패')
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
// 그룹 가입 여부 확인
const isInGroup = (roomId: string) => {
  return groupStore.groupDetails.some((group: GroupDetailReq) => group.roomId === roomId)
}

// 공통 정렬 함수
const sortSearchResults = (items: any[], type: 'user' | 'group' | 'recommend') => {
  if (type === 'group') {
    // 그룹 정렬 로직: 가입한 그룹 우선 정렬
    return items.sort((a, b) => {
      const aInGroup = isInGroup(a.roomId)
      const bInGroup = isInGroup(b.roomId)
      if (aInGroup && !bInGroup) return -1
      if (!aInGroup && bInGroup) return 1
      return 0
    })
  } else {
    // 사용자 정렬 로직: 본인 최상단, 친구 2순위
    return items.sort((a, b) => {
      // uid가 string 또는 number일 수 있는 상황 처리
      const aUid = String(a.uid)
      const bUid = String(b.uid)

      // 본인 최상단 배치
      if (isCurrentUser(aUid)) return -1
      if (isCurrentUser(bUid)) return 1

      // 친구 2순위 배치
      const aIsFriend = isFriend(aUid)
      const bIsFriend = isFriend(bUid)
      if (aIsFriend && !bIsFriend) return -1
      if (!aIsFriend && bIsFriend) return 1

      return 0
    })
  }
}

// 이미 친구인지 확인
const isFriend = (uid: string) => {
  return contactStore.contactsList.some((contact: FriendItem) => contact.uid === uid)
}

// 현재 로그인한 사용자인지 확인
const isCurrentUser = (uid: string) => {
  return userStore.userInfo!.uid === uid
}

// 버튼 텍스트 가져오기
const getButtonText = (uid: string, roomId: string) => {
  // 그룹 로직
  if (searchType.value === 'group') {
    return isInGroup(roomId) ? '메시지 보내기' : '추가'
  }
  // 사용자 로직
  if (isCurrentUser(uid)) return '프로필 편집'
  if (isFriend(uid)) return '메시지 보내기'
  return '추가'
}

// 버튼 유형 가져오기
const getButtonType = (uid: string, roomId: string) => {
  // 그룹 로직
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

// 친구 또는 그룹 추가 처리
const handleAddFriend = async (item: any) => {
  if (searchType.value === 'user' || searchType.value === 'recommend') {
    globalStore.addFriendModalInfo.uid = item.uid

    router.push('/mobile/mobileFriends/confirmAddFriend')
  } else {
    globalStore.addGroupModalInfo.account = item.account
    globalStore.addGroupModalInfo.name = item.name
    globalStore.addGroupModalInfo.avatar = item.avatar

    router.push('/mobile/mobileFriends/confirmAddGroup')
  }
}

// 개인 프로필 편집 처리
const handleEditProfile = async () => {
  // 메인 창 가져오기
  if (!isMobile()) {
    const homeWindow = await WebviewWindow.getByLabel('home')
    // 메인 창 활성화
    await homeWindow?.setFocus()
  }
  // 개인 프로필 편집 창 열기
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
  // await getCurrentWebviewWindow().show()

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

/* 탭 내용 패딩 제거 */
:deep(.n-tab-pane) {
  padding: 0 !important;
}

:deep(.n-tabs .n-tabs-nav-scroll-wrapper) {
  padding: 0 20px 10px !important;
}
</style>
