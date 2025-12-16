<template>
  <MobileLayout>
    <div class="flex w-full flex-col h-full">
      <HeaderBar
        :isOfficial="false"
        :hidden-right="true"
        :enable-default-background="false"
        :enable-shadow="false"
        room-name="그룹 채팅 시작" />

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

      <!-- 联系人列表 -->
      <!-- 연락처 목록 -->
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
                  <!-- ✅ 한 줄 강제 표시 -->
                  <div class="flex items-center gap-10px px-8px py-10px">
                    <!-- 프로필 사진 -->
                    <n-avatar
                      round
                      :size="44"
                      :src="AvatarUtils.getAvatarUrl(groupStore.getUserInfo(item.uid)!.avatar!)"
                      fallback-src="/logo.png"
                      style="border: 1px solid var(--avatar-border-color)" />
                    <!-- 텍스트 정보 -->
                    <div class="flex flex-col leading-tight truncate">
                      <span class="text-14px font-medium truncate">
                        {{ groupStore.getUserInfo(item.uid)!.name }}
                      </span>
                      <div class="text-12px text-gray-500 flex items-center gap-4px truncate">
                        <template v-if="getUserState(item.uid)">
                          <img class="size-12px rounded-50%" :src="getUserState(item.uid)?.url" alt="" />
                          {{ getUserState(item.uid)?.title }}
                        </template>
                        <template v-else>
                          <n-badge :color="item.activeStatus === OnlineEnum.ONLINE ? '#1ab292' : '#909090'" dot />
                          {{ item.activeStatus === OnlineEnum.ONLINE ? '온라인' : '오프라인' }}
                        </template>
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
        <n-button type="primary" :disabled="selectedList.length === 0" @click="createGroup">그룹 채팅 시작</n-button>
      </div>
    </div>
  </MobileLayout>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { OnlineEnum } from '@/enums'
import { useContactStore } from '@/stores/contacts'
import { useGroupStore } from '@/stores/group'
import { useUserStatusStore } from '@/stores/userStatus'
import { AvatarUtils } from '@/utils/AvatarUtils'
import * as ImRequestUtils from '@/utils/ImRequestUtils'
import { useChatStore } from '@/stores/chat.ts'
import { useGlobalStore } from '@/stores/global.ts'

const userStatusStore = useUserStatusStore()
const { stateList } = storeToRefs(userStatusStore)
const groupStore = useGroupStore()
const chatStore = useChatStore()
const globalStore = useGlobalStore()

/** 사용자 상태 가져오기 */
const getUserState = (uid: string) => {
  const userInfo = groupStore.getUserInfo(uid)!
  const userStateId = userInfo.userStateId

  if (userStateId && userStateId !== '1') {
    return stateList.value.find((state: { id: string }) => state.id === userStateId)
  }
  return null
}

// store
const contactStore = useContactStore()

// 검색 키워드
const keyword = ref('')

// 선택된 연락처 uid 배열
const selectedList = ref<string[]>([])

// 스크롤 높이 계산
const scrollHeight = ref(600)
onMounted(() => {
  scrollHeight.value = window.innerHeight - 180
})

// 검색 로직
const doSearch = () => {
  // 여기서는 반응성만 트리거하고, 실제 필터링 로직은 computed에 작성
}

const filteredContacts = computed(() => {
  const contactsList = contactStore.contactsList.filter((c) => {
    if (c.uid === '1') {
      // Hula 봇 제외
      return false
    }
    return true
  })

  if (!keyword.value) return contactsList
  return contactsList.filter((c) => {
    const name = groupStore.getUserInfo(c.uid)!.name
    if (name) {
      name.includes(keyword.value)
    } else {
      false
    }
  })
})

// 그룹 채팅 시작 클릭
const createGroup = async () => {
  if (selectedList.value.length < 2) {
    window.$message.success('두 명으로는 그룹을 만들 수 없습니다')
    return
  }

  try {
    const result: any = await ImRequestUtils.createGroup({ uidList: selectedList.value })

    await chatStore.getSessionList(true)

    const resultRoomId = result?.roomId != null ? String(result.roomId) : undefined
    const resultId = result?.id != null ? String(result.id) : undefined

    const matchedSession = chatStore.sessionList.find((session) => {
      const sessionRoomId = String(session.roomId)
      const sessionDetailId = session.detailId != null ? String(session.detailId) : undefined
      return (
        (resultRoomId !== undefined && sessionRoomId === resultRoomId) ||
        (resultId !== undefined && (sessionDetailId === resultId || sessionRoomId === resultId))
      )
    })

    if (matchedSession?.roomId) {
      globalStore.updateCurrentSessionRoomId(matchedSession.roomId)
      await Promise.all([
        groupStore.addGroupDetail(matchedSession.roomId),
        groupStore.getGroupUserList(matchedSession.roomId, true)
      ])
    }

    resetCreateGroupState()
    window.$message.success('그룹 채팅 생성 성공')
  } catch (error) {
    window.$message.error('그룹 채팅 생성 실패')
  }
}

const resetCreateGroupState = () => {
  selectedList.value = []
  keyword.value = ''
}
</script>

<style lang="scss" scoped></style>
