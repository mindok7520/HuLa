<template>
  <div
    v-show="shouldShowUserList"
    class="w-240px flex-shrink-0 flex flex-col bg-[--center-bg-color] border-r border-solid border-[--line-color]">
    <!-- 검색바 -->
    <div class="p-16px pb-12px">
      <n-input
        v-model:value="searchKeyword"
        :placeholder="getSearchPlaceholder()"
        :input-props="{ spellcheck: false }"
        clearable
        spellCheck="false"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        class="rounded-6px border-(solid 1px [--line-color]) w-full relative text-12px"
        size="small">
        <template #prefix>
          <svg class="size-16px text-[--text-color] opacity-60">
            <use href="#search"></use>
          </svg>
        </template>
      </n-input>
    </div>

    <!-- 동적 컨텐츠 영역 -->
    <div class="flex-1 px-8px overflow-hidden">
      <div class="pl-4px mb-12px">
        <span class="text-14px font-500 text-[--text-color]">{{ getSectionTitle() }}</span>
      </div>

      <n-scrollbar style="height: calc(100vh / var(--page-scale, 1) - 110px)">
        <div class="pr-12px">
          <!-- 모든 옵션 -->
          <UserItem
            :user="getAllOption()"
            :is-selected="selectedUser === '' && selectedRoom === ''"
            @click="handleItemClick"
            class="mb-8px" />

          <!-- 동적 목록 컨텐츠 -->
          <component
            :is="getItemComponent()"
            v-for="item in filteredList"
            :key="(item as any).id || (item as any).roomId || (item as any).uid"
            :user="item"
            :room="item"
            :contact="item"
            :is-selected="isItemSelected(item)"
            @click="handleItemClick"
            class="mb-8px" />

          <!-- 빈 상태 -->
          <div v-if="filteredList.length === 0 && searchKeyword && !loading" class="flex-center h-200px">
            <div class="flex-col-center">
              <svg class="size-48px text-[--text-color] opacity-30 mb-12px">
                <use href="#search"></use>
              </svg>
              <p class="text-14px text-[--text-color] opacity-60 m-0">{{ getEmptyMessage() }}</p>
            </div>
          </div>

          <!-- 로딩 상태 -->
          <div v-if="loading" class="flex-center h-200px">
            <n-spin size="small" />
            <span class="ml-8px text-14px text-[--text-color] opacity-60">로딩 중</span>
          </div>
        </div>
      </n-scrollbar>
    </div>
  </div>
</template>

<script setup lang="ts">
import { invoke } from '@tauri-apps/api/core'
import { useContactStore } from '@/stores/contacts.ts'
import { useGroupStore } from '@/stores/group'
import { AvatarUtils } from '@/utils/AvatarUtils'
import UserItem from './UserItem.vue'
import { useI18n } from 'vue-i18n'

type FileManagerState = {
  activeNavigation: Ref<string>
  userList: Ref<any[]>
  selectedUser: Ref<string>
  selectedRoom: Ref<string>
  setSearchKeyword: (keyword: string) => void
  setSelectedUser: (userId: string) => void
  setSelectedRoom: (roomId: string) => void
}

const { t } = useI18n()
const fileManagerState = inject<FileManagerState>('fileManagerState')!
const { activeNavigation, selectedUser, selectedRoom, setSelectedUser, setSelectedRoom } = fileManagerState

// Store 인스턴스
const contactStore = useContactStore()
const groupStore = useGroupStore()

// 로컬 상태
const searchKeyword = ref('')
const loading = ref(false)
const contactList = ref<any[]>([])
const sessionList = ref<any[]>([])

// 사용자 목록 표시 여부
const shouldShowUserList = computed(() => {
  return activeNavigation.value !== 'myFiles'
})

// 현재 표시된 목록 가져오기
const currentList = computed(() => {
  switch (activeNavigation.value) {
    case 'senders':
      return enrichedContactsList.value
    case 'sessions':
      return sessionList.value
    case 'groups':
      return groupChatList.value
    default:
      return []
  }
})

// 친구 데이터 강화
const enrichedContactsList = computed(() => {
  return contactStore.contactsList.map((item) => {
    const userInfo = groupStore.getUserInfo(item.uid)
    return {
      ...item,
      name: userInfo?.name || item.remark || t('fileManager.common.unknownUser'),
      avatar: AvatarUtils.getAvatarUrl(userInfo?.avatar || '/logoD.png'),
      activeStatus: item.activeStatus
    }
  })
})

// 그룹 채팅 목록
const groupChatList = computed(() => {
  return [...groupStore.groupDetails]
    .map((item) => ({
      ...item,
      avatar: AvatarUtils.getAvatarUrl(item.avatar)
    }))
    .sort((a, b) => {
      // roomId가 '1'인 그룹 채팅을 맨 앞으로 배치
      if (a.roomId === '1' && b.roomId !== '1') return -1
      if (a.roomId !== '1' && b.roomId === '1') return 1
      return 0
    })
})

// 필터링된 목록
const filteredList = computed(() => {
  if (!searchKeyword.value) {
    return currentList.value
  }

  return currentList.value.filter((item: any) => {
    const name = item.name || item.roomName || item.groupName || item.nickname || ''
    return name.toLowerCase().includes(searchKeyword.value.toLowerCase())
  })
})

// 검색 플레이스홀더 가져오기
const getSearchPlaceholder = () => {
  switch (activeNavigation.value) {
    case 'senders':
      return t('fileManager.userList.searchPlaceholder.senders')
    case 'sessions':
      return t('fileManager.userList.searchPlaceholder.sessions')
    case 'groups':
      return t('fileManager.userList.searchPlaceholder.groups')
    default:
      return t('fileManager.userList.searchPlaceholder.default')
  }
}

// 영역 제목 가져오기
const getSectionTitle = () => {
  const count = filteredList.value.length
  switch (activeNavigation.value) {
    case 'senders':
      return t('fileManager.userList.sectionTitle.senders', { count })
    case 'sessions':
      return t('fileManager.userList.sectionTitle.sessions', { count })
    case 'groups':
      return t('fileManager.userList.sectionTitle.groups', { count })
    default:
      return t('fileManager.userList.sectionTitle.default', { count })
  }
}

// 모든 옵션 가져오기
const getAllOption = () => {
  switch (activeNavigation.value) {
    case 'senders':
      return { id: '', name: t('fileManager.userList.allOptions.senders'), avatar: '' }
    case 'sessions':
      return { roomId: '', roomName: t('fileManager.userList.allOptions.sessions'), avatar: '' }
    case 'groups':
      return { roomId: '', roomName: t('fileManager.userList.allOptions.groups'), avatar: '' }
    default:
      return { id: '', name: t('fileManager.userList.allOptions.default'), avatar: '' }
  }
}

// 목록 항목 컴포넌트 가져오기
const getItemComponent = () => {
  // 모두 UserItem 컴포넌트를 사용하지만 다른 데이터를 전달함
  return UserItem
}

// 항목 선택 여부 판단
const isItemSelected = (item: any) => {
  switch (activeNavigation.value) {
    case 'senders':
      return selectedUser.value === (item.id || item.uid)
    case 'sessions':
    case 'groups':
      return selectedRoom.value === (item.roomId || item.id)
    default:
      return false
  }
}

// 빈 상태 메시지 가져오기
const getEmptyMessage = () => {
  switch (activeNavigation.value) {
    case 'senders':
      return t('fileManager.userList.empty.senders')
    case 'sessions':
      return t('fileManager.userList.empty.sessions')
    case 'groups':
      return t('fileManager.userList.empty.groups')
    default:
      return t('fileManager.userList.empty.default')
  }
}

// 항목 클릭 처리
const handleItemClick = (item: any) => {
  switch (activeNavigation.value) {
    case 'senders':
      setSelectedUser(item.uid || item.id || '')
      break
    case 'sessions':
    case 'groups':
      setSelectedRoom(item.roomId || item.id || '')
      break
  }
}

// 연락처 목록 로드
const loadContacts = async () => {
  try {
    loading.value = true
    await contactStore.getContactList()
  } catch (error) {
    console.error('연락처 로드 실패:', error)
  } finally {
    loading.value = false
  }
}

// 연락처 목록 로드 (원래 방식 복원)
const loadContactsOriginal = async () => {
  try {
    loading.value = true
    const contacts = (await invoke('list_contacts_command')) as any[]
    contactList.value = contacts
  } catch (error) {
    console.error('연락처 로드 실패:', error)
  } finally {
    loading.value = false
  }
}

// 세션 목록 로드 (원래 방식 복원)
const loadSessions = async () => {
  try {
    loading.value = true
    // 연락처를 세션 목록으로 사용하고 아바타 처리
    sessionList.value = contactList.value.map((item) => ({
      ...item,
      avatar: AvatarUtils.getAvatarUrl(item.avatar)
    }))
  } catch (error) {
    console.error('세션 로드 실패:', error)
  } finally {
    loading.value = false
  }
}

// 그룹 채팅 목록 로드 (그룹 데이터는 groupStore를 통해 가져옴)
const loadGroups = async () => {
  try {
    loading.value = true
    // 그룹 데이터는 이미 groupStore에서 관리되므로 추가 로드 불필요
    // 그룹 데이터 새로고침이 필요한 경우 해당 store 메서드 호출 가능
  } catch (error) {
    console.error('그룹 채팅 로드 실패:', error)
  } finally {
    loading.value = false
  }
}

// 내비게이션 변경 감시
watch(
  activeNavigation,
  async (newNav) => {
    if (!shouldShowUserList.value) return

    switch (newNav) {
      case 'senders':
        // 발신자 목록은 친구 목록을 사용하며 연락처 데이터가 로드되었는지 확인
        if (contactStore.contactsList.length === 0) {
          await loadContacts()
        }
        break
      case 'sessions':
        if (contactList.value.length === 0) {
          await loadContactsOriginal()
        }
        await loadSessions()
        break
      case 'groups':
        await loadGroups()
        break
    }
  },
  { immediate: true }
)
</script>

<style scoped lang="scss"></style>
