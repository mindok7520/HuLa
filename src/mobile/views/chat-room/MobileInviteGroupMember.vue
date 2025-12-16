<template>
  <MobileLayout>
    <div class="flex w-full flex-col h-full">
      <HeaderBar
        :isOfficial="false"
        :hidden-right="true"
        :enable-default-background="false"
        :enable-shadow="false"
        room-name="그룹 멤버 초대" />

      <!-- 상단 검색창 -->
      <div class="px-16px mt-10px flex gap-3">
        <div class="flex-1 py-5px shrink-0">
          <n-input
            v-model:value="keyword"
            class="rounded-10px w-full bg-gray-100 relative text-14px"
            placeholder="연락처 검색~"
            clearable
            spellCheck="false"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off">
            <template #prefix>
              <svg class="w-12px h-12px"><use href="#search"></use></svg>
            </template>
          </n-input>
        </div>
        <div class="flex justify-end items-center">
          <n-button class="py-5px" @click="doSearch">검색</n-button>
        </div>
      </div>

      <!-- 친구 목록 -->
      <div ref="scrollArea" class="flex-1 overflow-y-auto px-16px mt-10px" :style="{ height: scrollHeight + 'px' }">
        <n-scrollbar style="max-height: calc(100vh - 150px)">
          <n-checkbox-group v-model:value="selectedList" class="flex flex-col gap-2">
            <div
              v-for="item in filteredContacts"
              :key="item.uid"
              class="rounded-10px border border-gray-200 overflow-hidden">
              <n-checkbox
                :value="item.uid"
                size="large"
                class="w-full flex items-center px-5px"
                :class="[
                  'cursor-pointer select-none transition-colors duration-150',
                  selectedList.includes(item.uid) ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50'
                ]">
                <template #default>
                  <div class="flex items-center gap-10px px-8px py-10px">
                    <!-- 프로필 사진 -->
                    <n-avatar
                      round
                      :size="44"
                      :src="AvatarUtils.getAvatarUrl(groupStore.getUserInfo(item.uid)?.avatar!)"
                      fallback-src="/logo.png"
                      style="border: 1px solid var(--avatar-border-color)" />
                    <!-- 텍스트 정보 -->
                    <div class="flex flex-col leading-tight truncate">
                      <span class="text-14px font-medium truncate">
                        {{ groupStore.getUserInfo(item.uid)?.name }}
                      </span>
                      <div class="text-12px text-gray-500 flex items-center gap-4px truncate">
                        <n-badge :color="item.activeStatus === OnlineEnum.ONLINE ? '#1ab292' : '#909090'" dot />
                        {{ item.activeStatus === OnlineEnum.ONLINE ? '온라인' : '오프라인' }}
                      </div>
                    </div>
                  </div>
                </template>
              </n-checkbox>
            </div>
          </n-checkbox-group>
        </n-scrollbar>
      </div>

      <!-- 하단 작업 표시줄 -->
      <div class="px-16px py-10px bg-white border-t border-gray-200 flex justify-between items-center">
        <span class="text-14px">{{ selectedList.length }}명 선택됨</span>
        <n-button type="primary" :disabled="selectedList.length === 0" :loading="isLoading" @click="handleInvite">
          초대
        </n-button>
      </div>
    </div>
  </MobileLayout>
</template>

<script setup lang="ts">
import { OnlineEnum } from '@/enums'
import { useContactStore } from '@/stores/contacts.ts'
import { useGlobalStore } from '@/stores/global'
import { useGroupStore } from '@/stores/group'
import { useChatStore } from '@/stores/chat'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { inviteGroupMember } from '@/utils/ImRequestUtils'
import router from '@/router'

defineOptions({
  name: 'mobileInviteGroupMember'
})

const contactStore = useContactStore()
const globalStore = useGlobalStore()
const groupStore = useGroupStore()

const keyword = ref('')
const selectedList = ref<string[]>([])
const isLoading = ref(false)
const scrollHeight = ref(0)
const scrollArea = ref<HTMLElement>()

// 모든 친구 목록 가져오기 (이미 그룹에 있는 멤버와 봇 제외)
const allContacts = computed(() => {
  return contactStore.contactsList.filter((item) => {
    // 봇 제외 (uid === '1')
    if (item.uid === '1') {
      return false
    }

    // 이미 그룹에 있는 멤버 제외
    const isInGroup = groupStore.memberList.some((member) => member.uid === item.uid)
    return !isInGroup
  })
})

// 검색 필터링
const filteredContacts = computed(() => {
  if (!keyword.value.trim()) {
    return allContacts.value
  }

  const searchKeyword = keyword.value.toLowerCase()
  return allContacts.value.filter((item) => {
    const userInfo = groupStore.getUserInfo(item.uid)
    if (!userInfo) return false
    return userInfo.name.toLowerCase().includes(searchKeyword) || userInfo.account.toLowerCase().includes(searchKeyword)
  })
})

// 검색 기능
const doSearch = () => {
  // 검색 로직은 filteredContacts에 구현되어 있음
}

// 초대 처리
const handleInvite = async () => {
  if (selectedList.value.length === 0) {
    window.$message.warning('초대할 친구를 선택하세요')
    return
  }

  isLoading.value = true
  try {
    await inviteGroupMember({
      roomId: globalStore.currentSessionRoomId,
      uidList: selectedList.value
    })

    window.$message.success(`${selectedList.value.length}명의 친구를 성공적으로 초대했습니다`)
    // 그룹 설정 페이지로 돌아가기
    router.back()
  } catch (error) {
    console.error('邀请失败:', error)
    window.$message.error('초대 실패, 다시 시도해주세요')
  } finally {
    isLoading.value = false
  }
}

// 스크롤 영역 높이 계산
const calculateScrollHeight = () => {
  if (scrollArea.value) {
    const rect = scrollArea.value.getBoundingClientRect()
    scrollHeight.value = window.innerHeight - rect.top - 60
  }
}

// 초기화 시 그룹 멤버 목록 및 모든 사용자 정보 가져오기
onMounted(async () => {
  try {
    // 모든 그룹의 멤버 데이터를 먼저 로드하여 groupStore.allUserInfo에 데이터가 있는지 확인
    const chatStore = useChatStore()
    const groupSessions = chatStore.getGroupSessions()

    // 현재 그룹의 멤버 목록 로드
    if (globalStore.currentSessionRoomId) {
      await groupStore.getGroupUserList(globalStore.currentSessionRoomId)
    }

    // 다른 그룹의 멤버 목록을 로드하여 모든 사용자 정보 가져오기
    await Promise.all(
      groupSessions
        .filter((session: any) => session.roomId !== globalStore.currentSessionRoomId)
        .map((session: any) => groupStore.getGroupUserList(session.roomId))
    )
  } catch (error) {
    console.error('사용자 정보 로드 실패:', error)
  }

  calculateScrollHeight()
  window.addEventListener('resize', calculateScrollHeight)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', calculateScrollHeight)
})
</script>

<style scoped></style>
