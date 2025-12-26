<template>
  <div class="size-full rounded-8px bg-[--right-bg-color] flex flex-col">
    <ActionBar :shrink="false" :current-label="WebviewWindow.getCurrent().label" />

    <!-- 주요 내용 영역 -->
    <div class="flex-1 flex overflow-hidden">
      <!-- 왼쪽 네비게이션 영역 -->
      <SideNavigation />

      <!-- 중앙 사용자 목록 영역 -->
      <UserList />

      <!-- 오른쪽 파일 표시 영역 -->
      <FileContent />
    </div>
  </div>
</template>

<script setup lang="ts">
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWebviewWindow, WebviewWindow } from '@tauri-apps/api/webviewWindow'
import FileContent from '@/components/fileManager/FileContent.vue'
import SideNavigation from '@/components/fileManager/SideNavigation.vue'
import UserList from '@/components/fileManager/UserList.vue'

// 파일 관리 반응형 상태 정의
const activeNavigation = ref('myFiles')
const selectedUser = ref('')
const selectedRoom = ref('')
const searchKeyword = ref('')
const timeGroupedFiles = ref<any[]>([])
const userList = ref<any[]>([])
const loading = ref(false)
const navigationItems = ref<any[]>([])

// 파일 조회
const queryFiles = async () => {
  try {
    loading.value = true

    // 네비게이션 타입에 따라 쿼리 파라미터 결정
    const queryParam = {
      navigationType: activeNavigation.value,
      selectedUser: undefined,
      searchKeyword: searchKeyword.value || undefined,
      roomId: undefined,
      page: 1,
      pageSize: 50
    } as any

    // 네비게이션 타입별 쿼리 파라미터 설정
    switch (activeNavigation.value) {
      case 'myFiles':
        // 내 파일: 모든 파일 조회, 사용자 또는 방 필터링 없음
        break
      case 'senders':
        // 보낸 사람: 사용자별 필터링
        queryParam.selectedUser = selectedUser.value || undefined
        break
      case 'sessions':
      case 'groups':
        // 대화/그룹 채팅: 방별 필터링
        queryParam.roomId = selectedRoom.value || undefined
        break
    }

    const response = (await invoke('query_files', {
      param: queryParam
    })) as any

    timeGroupedFiles.value = response.timeGroupedFiles
    userList.value = response.userList
  } catch (error) {
    console.error('파일 조회 실패:', error)
  } finally {
    loading.value = false
  }
}

// 네비게이션 메뉴 항목 가져오기
const getNavigationItems = async () => {
  try {
    const items = (await invoke('get_navigation_items')) as any[]
    navigationItems.value = items
  } catch (error) {
    console.error('네비게이션 메뉴 가져오기 실패:', error)
  }
}

// 활성화된 네비게이션 항목 설정
const setActiveNavigation = (key: string) => {
  activeNavigation.value = key
  navigationItems.value.forEach((item) => {
    item.active = item.key === key
  })

  // 네비게이션 전환 시 선택 상태 초기화
  selectedUser.value = ''
  selectedRoom.value = ''

  queryFiles() // 파일 다시 조회
}

// 선택된 사용자 설정
const setSelectedUser = (userId: string) => {
  selectedUser.value = userId
  queryFiles() // 파일 다시 조회
}

// 선택된 방 설정
const setSelectedRoom = (roomId: string) => {
  selectedRoom.value = roomId
  queryFiles() // 파일 다시 조회
}

// 검색 키워드 설정
const setSearchKeyword = (keyword: string) => {
  searchKeyword.value = keyword
  queryFiles() // 파일 다시 조회
}

// 하위 컴포넌트에 제공하는 메서드 및 상태
provide('fileManagerState', {
  activeNavigation: readonly(activeNavigation),
  selectedUser: readonly(selectedUser),
  selectedRoom: readonly(selectedRoom),
  searchKeyword: readonly(searchKeyword),
  timeGroupedFiles: readonly(timeGroupedFiles),
  userList: readonly(userList),
  loading: readonly(loading),
  navigationItems: readonly(navigationItems),
  setActiveNavigation,
  setSelectedUser,
  setSelectedRoom,
  setSearchKeyword
})

onMounted(async () => {
  await getCurrentWebviewWindow().show()
  // 네비게이션 메뉴 및 파일 데이터 로드
  await getNavigationItems()
  await queryFiles()
})
</script>

<style scoped lang="scss"></style>
