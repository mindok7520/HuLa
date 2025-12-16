<template>
  <n-flex
    data-tauri-drag-region
    vertical
    :size="0"
    class="bg-[--chat-left-bg] select-none w-300px h-full p-[40px_20px_6px_20px] box-border">
    <n-flex vertical :size="30" data-tauri-drag-region>
      <!-- 제목 -->
      <n-flex justify="space-between" align="center" :size="0">
        <n-flex :size="4" vertical>
          <n-flex :size="0" align="center">
            <p class="text-(20px [--chat-text-color]) font-semibold select-none">HuLa-</p>
            <p class="gpt-subtitle">ChatBot</p>
            <div class="ml-6px p-[4px_8px] size-fit bg-[--bate-bg] rounded-8px text-(12px [--bate-color] center)">
              Beta
            </div>
          </n-flex>
          <p class="text-(12px #909090)">나만의 AI 만들기</p>
        </n-flex>
        <svg class="size-44px color-#13987f opacity-20"><use href="#GPT"></use></svg>
      </n-flex>

      <!-- 프로필 및 플러그인 -->
      <n-flex align="center" justify="space-between" :size="0">
        <n-flex align="center">
          <n-avatar bordered round :src="AvatarUtils.getAvatarUrl(userStore.userInfo!.avatar!)" :size="48" />
          <n-flex vertical>
            <p class="text-(14px [--chat-text-color]) font-500">{{ userStore.userInfo!.name }}</p>
            <p class="text-(12px #909090)">남은 기간: 28일 후 만료</p>
          </n-flex>
        </n-flex>

        <!-- 플러그인 버튼 숨김 -->
        <!-- <div class="plugins">
          <svg class="size-22px"><use href="#plugins"></use></svg>
          <p>플러그인</p>
        </div> -->
      </n-flex>
      <!-- 대화 목록 -->
      <n-scrollbar
        ref="scrollbar"
        style="max-height: calc(100vh / var(--page-scale, 1) - 286px); padding-right: 8px"
        @scroll="handleScroll">
        <!-- 로딩 상태 -->
        <div v-if="loading && pageNo === 1" class="flex justify-center items-center py-20px">
          <n-spin size="small" />
          <span class="ml-10px text-(12px #909090)">로딩 중...</span>
        </div>

        <!-- 빈 상태 -->
        <div
          v-else-if="chatList.length === 0"
          class="flex flex-col items-center justify-center py-20px text-(12px #909090)">
          <svg class="size-40px mb-10px opacity-50"><use href="#empty"></use></svg>
          <p>대화가 없습니다. 아래 버튼을 클릭하여 새로운 채팅을 시작하세요.</p>
        </div>

        <TransitionGroup
          v-else
          name="list"
          tag="div"
          style="padding: 4px"
          class="sort-target flex flex-col-center gap-12px">
          <div
            v-for="(item, index) in chatList"
            :key="item.id"
            @click="handleActive(item)"
            :class="['chat-item', activeItem?.id === item.id ? 'chat-item-active' : '']">
            <ContextMenu
              :menu="menuList"
              :special-menu="specialMenuList"
              class="msg-box w-full h-75px mb-5px"
              @select="$event.click(item)">
              <div class="absolute flex flex-col gap-14px w-full p-[8px_14px] box-border">
                <n-flex justify="space-between" align="center" :size="0" class="leading-22px">
                  <n-ellipsis
                    v-if="editingItemId !== item.id"
                    style="width: calc(100% - 20px)"
                    class="text-(14px [--chat-text-color]) truncate font-500 select-none">
                    {{ item.title || `대화 ${index + 1}` }}
                  </n-ellipsis>
                  <n-input
                    v-else
                    @blur="handleBlur(item, index)"
                    ref="inputInstRef"
                    v-model:value="item.title"
                    clearable
                    placeholder="제목 입력"
                    type="text"
                    size="tiny"
                    spellCheck="false"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    style="width: 200px"
                    class="h-22px lh-22px rounded-6px"></n-input>
                  <svg
                    @click.stop="deleteChat(item)"
                    class="color-[--chat-text-color] size-20px opacity-0 absolute right-0px top-4px">
                    <use href="#squareClose"></use>
                  </svg>
                </n-flex>
                <n-flex justify="space-between" align="center" :size="0" class="text-(12px #909090)">
                  <p>{{ item.messageCount || 0 }}개 대화</p>
                  <p>{{ formatTimestamp(item.createTime) }}</p>
                </n-flex>
              </div>
            </ContextMenu>
          </div>
        </TransitionGroup>

        <!-- 더 보기 로드 -->
        <div v-if="hasMore" class="flex justify-center items-center py-16px">
          <n-button v-if="!loadingMore" size="small" tertiary @click="loadMore">더 보기</n-button>
          <n-spin v-else size="small" />
          <span v-if="loadingMore" class="ml-10px text-(12px #909090)">로딩 중...</span>
        </div>

        <!-- 더 이상 데이터 없음 -->
        <div v-else-if="chatList.length > 0" class="flex justify-center items-center py-16px text-(12px #909090)">
          <span>더 이상 대화가 없습니다</span>
        </div>
      </n-scrollbar>
    </n-flex>

    <!-- 하단 옵션 바 -->
    <n-flex data-tauri-drag-region vertical :size="8" class="m-[auto_0_0_0]">
      <!-- 관리 버튼 행 -->
      <n-flex :size="4" align="center" justify="space-between">
        <n-flex :size="4" align="center">
          <div
            @click="jump"
            class="bg-[--chat-bt-color] border-(1px solid [--line-color]) color-[--chat-text-color] size-fit p-[8px_9px] rounded-8px custom-shadow cursor-pointer">
            <svg class="size-18px"><use href="#settings"></use></svg>
          </div>
          <a
            target="_blank"
            rel="noopener noreferrer"
            href="https://github.com/HuLaSpark/HuLa"
            class="bg-[--chat-bt-color] border-(1px solid [--line-color]) color-[--chat-text-color] size-fit p-[8px_9px] rounded-8px custom-shadow cursor-pointer">
            <svg class="size-18px"><use href="#github"></use></svg>
          </a>
        </n-flex>

        <n-flex :size="4" align="center">
          <div
            @click="openHistory"
            class="bg-[--chat-bt-color] border-(1px solid [--line-color]) color-[--chat-text-color] size-fit p-[8px_9px] rounded-8px custom-shadow cursor-pointer"
            title="기록 생성">
            <Icon icon="mdi:history" class="text-18px" />
          </div>
          <div
            @click="openModelManagement"
            class="bg-[--chat-bt-color] border-(1px solid [--line-color]) color-[--chat-text-color] size-fit p-[8px_9px] rounded-8px custom-shadow cursor-pointer"
            title="모델 관리">
            <Icon icon="mdi:robot-outline" class="text-18px" />
          </div>
          <div
            @click="openRoleManagement"
            class="bg-[--chat-bt-color] border-(1px solid [--line-color]) color-[--chat-text-color] size-fit p-[8px_9px] rounded-8px custom-shadow cursor-pointer"
            title="역할 관리">
            <Icon icon="mdi:account-cog" class="text-18px" />
          </div>
        </n-flex>
      </n-flex>

      <!-- 작업 버튼 행 -->
      <n-flex :size="4" align="center" justify="space-between">
        <!-- 힌트 메시지 또는 새로 만들기 버튼 -->
        <div v-if="!hasRoles" class="flex-1 text-(11px #d5304f) text-center">먼저 역할을 생성하세요</div>
        <div
          v-else
          @click="add"
          class="flex items-center justify-center gap-4px bg-[--chat-bt-color] border-(1px solid [--line-color]) select-none text-(12px [--chat-text-color]) size-fit w-80px h-32px rounded-8px custom-shadow cursor-pointer">
          <svg class="size-15px pb-2px"><use href="#plus"></use></svg>
          <p>새 채팅</p>
        </div>

        <n-popconfirm v-model:show="showDeleteConfirm">
          <template #icon>
            <svg class="size-22px"><use href="#explosion"></use></svg>
          </template>
          <template #action>
            <n-button size="small" tertiary @click.stop="showDeleteConfirm = false">취소</n-button>
            <n-button size="small" type="error" @click.stop="deleteAllChats">삭제</n-button>
          </template>
          <template #trigger>
            <div
              class="flex items-center justify-center gap-4px bg-[--chat-bt-color] border-(1px solid [--line-color]) select-none text-(12px [--chat-text-color]) size-fit w-80px h-32px rounded-8px custom-shadow cursor-pointer">
              <svg class="size-15px pb-2px"><use href="#delete"></use></svg>
              <p>모두 삭제</p>
            </div>
          </template>
          모든 대화를 삭제하시겠습니까?
        </n-popconfirm>
      </n-flex>
    </n-flex>
  </n-flex>
</template>

<script setup lang="ts">
import { type InputInst, type VirtualListInst } from 'naive-ui'
import { Icon } from '@iconify/vue'
import { useMitt } from '@/hooks/useMitt.ts'
import router from '@/router'
import { useUserStore } from '@/stores/user.ts'
import { AvatarUtils } from '@/utils/AvatarUtils'
import {
  conversationPage,
  conversationCreateMy,
  conversationDeleteMy,
  conversationUpdateMy,
  chatRolePage
} from '@/utils/ImRequestUtils'
import { formatTimestamp } from '@/utils/ComputedTime'

const userStore = useUserStore()
const activeItem = ref<ChatItem | null>(null)
const scrollbar = ref<VirtualListInst>()
const inputInstRef = ref<InputInst | null>(null)
const editingItemId = ref<string | null>()
const loading = ref(false)
const loadingMore = ref(false)
/** 원본 제목 */
const originalTitle = ref('')
const showDeleteConfirm = ref(false)
/** 사용 가능한 역할 존재 여부 */
const hasRoles = ref(false)
/** 첫 번째 사용 가능한 역할의 ID */
const firstAvailableRoleId = ref<string | null>(null)

// 페이지네이션 매개변수
const pageNo = ref(1)
const pageSize = ref(20)
const hasMore = ref(true)
const total = ref(0)

// 대화 목록 데이터
interface ChatItem {
  id: string
  title?: string
  createTime: number
  messageCount?: number
  isPinned?: boolean
  roleId?: string | number
  modelId?: string | number
}

const chatList = ref<ChatItem[]>([])

// 대화 목록 가져오기
const fetchConversationList = async (isLoadMore = false) => {
  if (isLoadMore) {
    loadingMore.value = true
  } else {
    loading.value = true
    pageNo.value = 1
    hasMore.value = true
  }

  try {
    const data = await conversationPage({
      pageNo: pageNo.value,
      pageSize: pageSize.value
    })

    if (data && data.list) {
      const newChats = data.list.map((item: any) => {
        const parsedCreateTime = Number(item.createTime)
        return {
          id: item.id,
          title: item.title || `대화 ${item.id}`,
          createTime: Number.isFinite(parsedCreateTime) ? parsedCreateTime : Date.now(),
          messageCount: item.messageCount || 0,
          isPinned: item.isPinned || false,
          roleId: item.roleId,
          modelId: item.modelId
        }
      })

      if (isLoadMore) {
        // 더 보기 로드 시 데이터 추가
        chatList.value = [...chatList.value, ...newChats]
      } else {
        // 처음 로드 시 데이터 교체
        chatList.value = newChats

        // 처음 로드하고 대화가 있을 때 자동으로 첫 번째 대화 선택
        if (newChats.length > 0) {
          // Chat.vue 목록이 로드되도록 이벤트 전송 지연
          setTimeout(() => {
            handleActive(newChats[0])
          }, 500)
        }
      }

      // 페이지네이션 정보 업데이트
      total.value = data.total || 0
      hasMore.value = chatList.value.length < total.value

      // 데이터가 더 있으면 페이지 번호 증가
      if (hasMore.value) {
        pageNo.value++
      }
    }
  } catch (error) {
    console.error('대화 목록 가져오기 실패:', error)
    window.$message.error('대화 목록 가져오기 실패')
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

// 더 보기 로드
const loadMore = async () => {
  if (loadingMore.value || !hasMore.value) return
  await fetchConversationList(true)
}

// 스크롤 이벤트 처리
const handleScroll = (e: Event) => {
  const scrollElement = e.target as HTMLElement
  const { scrollTop, scrollHeight, clientHeight } = scrollElement

  // 하단으로 스크롤 시 자동으로 더 보기 로드 (하단에서 100px 거리일 때 트리거)
  if (scrollHeight - scrollTop - clientHeight < 100 && !loadingMore.value && hasMore.value) {
    loadMore()
  }
}

// 대화 목록 새로고침
const refreshConversationList = async () => {
  pageNo.value = 1
  await fetchConversationList(false)
}

const menuList = ref<OPT.RightMenu[]>([
  {
    label: '상단 고정',
    icon: 'topping',
    click: (item: ChatItem) => {
      const index = chatList.value.findIndex((e) => e.id === item.id)
      if (index !== 0) {
        const temp = chatList.value[index]
        chatList.value[index] = chatList.value[0]
        chatList.value[0] = temp
      }
    }
  },
  {
    label: '독립 채팅 창 열기',
    icon: 'freezing-line-column',
    click: (item: ChatItem) => {
      console.log('독립 창 열기:', item)
    }
  },
  {
    label: '이름 변경',
    icon: 'edit',
    click: (item: ChatItem) => {
      renameChat(item)
    }
  }
])

const specialMenuList = ref<OPT.RightMenu[]>([
  {
    label: '삭제',
    icon: 'delete',
    click: (item: ChatItem) => {
      deleteChat(item)
    }
  }
])

/** 설정으로 이동 */
const jump = () => {
  router.push('/chatSettings')
  activeItem.value = null
}

/** 대화 선택 */
const handleActive = (item: ChatItem) => {
  activeItem.value = item

  if (router.currentRoute.value.path !== '/chat') {
    router.push('/chat').then(() => {
      nextTick(() => {
        useMitt.emit('chat-active', item)
      })
    })
  } else {
    // 이미 /chat 라우트에 있으면 이벤트 직접 트리거
    nextTick(() => {
      useMitt.emit('chat-active', item)
    })
  }
}

// 사용 가능한 역할이 있는지 확인
const checkHasRoles = async () => {
  try {
    const data = await chatRolePage({ pageNo: 1, pageSize: 100 })
    // 사용 가능한 역할 확인 (status === 0)
    const availableRoles = (data.list || []).filter((item: any) => item.status === 0)
    hasRoles.value = availableRoles.length > 0
    // 첫 번째 사용 가능한 역할의 ID 저장
    firstAvailableRoleId.value = availableRoles.length > 0 ? availableRoles[0].id : null
  } catch (error) {
    console.error('역할 확인 실패:', error)
    hasRoles.value = false
    firstAvailableRoleId.value = null
  }
}

// 역할 관리 열기
const openRoleManagement = () => {
  useMitt.emit('open-role-management')
}

// 모델 관리 열기
const openModelManagement = () => {
  useMitt.emit('open-model-management')
}

// 생성 기록 열기
const openHistory = () => {
  useMitt.emit('open-generation-history')
}

/** 대화 추가 */
const add = async () => {
  // 사용 가능한 역할이 있는지 확인
  if (!hasRoles.value || !firstAvailableRoleId.value) {
    window.$message.warning('먼저 역할을 생성하세요')
    openRoleManagement()
    return
  }

  try {
    const data = await conversationCreateMy({
      roleId: firstAvailableRoleId.value,
      knowledgeId: undefined,
      title: '새로운 대화'
    })

    if (data) {
      const rawCreateTime = Number(data.createTime)
      const newChat: ChatItem = {
        id: data.id || data,
        title: data.title || '새로운 대화',
        createTime: Number.isFinite(rawCreateTime) ? rawCreateTime : Date.now(),
        messageCount: data.messageCount || 0,
        isPinned: data.pinned || false,
        roleId: firstAvailableRoleId.value,
        modelId: data.modelId
      }

      // 새 대화를 목록 상단에 추가
      chatList.value.unshift(newChat)

      // 상단으로 스크롤
      nextTick(() => {
        scrollbar.value?.scrollTo({ position: 'top' })
      })

      // 새 대화 활성화
      handleActive(newChat)

      window.$message.success('대화 생성 성공')
    }
  } catch (error) {
    console.error('❌ 대화 생성 실패:', error)
    window.$message.error('대화 생성 실패')
  }
}

/** 단일 대화 삭제 */
const deleteChat = async (item: ChatItem) => {
  try {
    await conversationDeleteMy({ conversationIdList: [item.id] })

    const index = chatList.value.findIndex((chat) => chat.id === item.id)
    if (index !== -1) {
      chatList.value.splice(index, 1)

      // 현재 선택된 대화를 삭제하는 경우 다시 선택해야 함
      if (activeItem.value?.id === item.id) {
        if (chatList.value.length > 0) {
          // 첫 번째 대화 선택
          const firstChat = chatList.value[0]
          activeItem.value = firstChat

          // 채팅 페이지로 이동
          router.push('/chat')
        } else {
          // 대화가 없으면 환영 페이지로 이동
          activeItem.value = null
          router.push('/welcome')
        }
      }

      window.$message.success('대화 삭제 성공')
    }
  } catch (error) {
    console.error('❌ 대화 삭제 실패:', error)
    window.$message.error('대화 삭제 실패')
  }
}

/** 모든 대화 삭제 */
const deleteAllChats = async () => {
  try {
    if (chatList.value.length === 0) {
      window.$message.warning('삭제할 대화가 없습니다')
      showDeleteConfirm.value = false
      return
    }

    const allChatIds = chatList.value.map((chat) => chat.id)
    await conversationDeleteMy({ conversationIdList: allChatIds })

    // 로컬 목록 지우기
    chatList.value = []
    activeItem.value = null
    showDeleteConfirm.value = false

    // 환영 페이지로 이동
    router.push('/welcome')

    window.$message.success('모든 대화가 삭제되었습니다')
  } catch (error) {
    console.error('모든 대화 삭제 실패:', error)
    window.$message.error('모든 대화 삭제 실패')
  }
}

/** 이름 변경 */
const renameChat = (item: ChatItem) => {
  originalTitle.value = item.title || ''
  editingItemId.value = item.id
  nextTick(() => {
    inputInstRef.value?.select()
  })
}

const handleBlur = async (item: ChatItem, index: number) => {
  editingItemId.value = null

  const trimmedTitle = item.title?.trim() || ''
  const fallbackTitle = `대화 ${item.id}`
  const nextTitle = trimmedTitle !== '' ? trimmedTitle : fallbackTitle

  if (originalTitle.value === nextTitle) {
    chatList.value[index].title = nextTitle
    return
  }

  const previousTitle = originalTitle.value
  item.title = nextTitle
  chatList.value[index].title = nextTitle
  if (activeItem.value?.id === item.id) {
    activeItem.value.title = nextTitle
  }

  try {
    await conversationUpdateMy({
      id: item.id,
      title: nextTitle
    })

    originalTitle.value = nextTitle
    window.$message.success(`${nextTitle}로 이름이 변경되었습니다`)
    useMitt.emit('left-chat-title', { id: item.id, title: nextTitle })
    useMitt.emit('update-chat-title', { id: item.id, title: nextTitle })
  } catch (error) {
    console.error('❌ 대화 이름 변경 실패:', error)
    item.title = previousTitle
    chatList.value[index].title = previousTitle
    originalTitle.value = previousTitle
    if (activeItem.value?.id === item.id) {
      activeItem.value.title = previousTitle
    }
  }
}

onMounted(async () => {
  // 대화 목록 로드
  await fetchConversationList()

  // 사용 가능한 역할이 있는지 확인
  checkHasRoles()

  // 대화가 없으면 환영 페이지로 이동
  if (chatList.value.length === 0) {
    router.push('/welcome')
  }

  useMitt.on('update-chat-title', (e: any) => {
    chatList.value.filter((item) => {
      if (item.id === e.id) {
        item.title = e.title
      }
    })
  })

  useMitt.on('return-chat', () => {
    if (chatList.value.length > 0) {
      handleActive(chatList.value[0])
    }
  })

  // 대화 새로고침 이벤트 감지
  useMitt.on('refresh-conversations', () => {
    refreshConversationList()
  })

  // 역할 관리 새로고침 이벤트 감지
  useMitt.on('refresh-roles', () => {
    checkHasRoles()
  })

  // ✅ 대화 추가 이벤트 감지
  useMitt.on('add-conversation', (newChat: any) => {
    if (newChat && newChat.id) {
      // 이미 존재하는지 확인
      const exists = chatList.value.some((chat) => chat.id === newChat.id)
      if (!exists) {
        const rawCreateTime = Number(newChat.createTime)
        const normalizedChat: ChatItem = {
          id: newChat.id,
          title: newChat.title,
          createTime: Number.isFinite(rawCreateTime) ? rawCreateTime : Date.now(),
          messageCount: newChat.messageCount || 0,
          isPinned: newChat.isPinned || false,
          roleId: newChat.roleId,
          modelId: newChat.modelId
        }

        // 목록 상단에 추가
        chatList.value.unshift(normalizedChat)

        // 상단으로 스크롤
        nextTick(() => {
          scrollbar.value?.scrollTo({ position: 'top' })
        })

        handleActive(normalizedChat)
      }
    }
  })

  useMitt.on('update-chat-meta', (payload: any) => {
    if (!payload?.id) return
    const target = chatList.value.find((chat) => chat.id === payload.id)
    if (target) {
      if (typeof payload.messageCount === 'number') {
        target.messageCount = payload.messageCount
      }
      if (payload.createTime !== undefined && payload.createTime !== null) {
        const parsed = Number(payload.createTime)
        if (Number.isFinite(parsed)) {
          target.createTime = parsed
        }
      }
    }

    const active = activeItem.value
    if (active && active.id === payload.id) {
      if (typeof payload.messageCount === 'number') {
        active.messageCount = payload.messageCount
      }
      if (payload.createTime !== undefined && payload.createTime !== null) {
        const parsed = Number(payload.createTime)
        if (Number.isFinite(parsed)) {
          active.createTime = parsed
        }
      }
    }
  })
})
</script>

<style scoped lang="scss">
.gpt-subtitle {
  @apply bg-clip-text text-transparent bg-gradient-to-r from-#38BDF8 to-#13987F text-20px font-800;
}

.plugins {
  @apply size-fit bg-[--chat-bt-color] rounded-8px custom-shadow p-[8px_14px]
  flex items-center gap-10px select-none cursor-pointer
  text-14px color-[--chat-text-color] border-(1px solid [--line-color]);
}

.chat-item {
  @apply relative bg-[--chat-bt-color] border-(1px solid [--line-color]) cursor-pointer custom-shadow rounded-8px w-full h-65px;
  transition: all 0.2s ease;

  &:hover {
    @apply bg-[--chat-hover-color];
    svg {
      @apply opacity-100 -translate-x-1 transition-all duration-800 ease-in-out;
    }
  }
}

.chat-item-active {
  border: 1px dashed #13987f;
  box-shadow: 0 0 0 1px rgba(19, 152, 127, 0.1) inset;
}

.list-move, /* 이동 중인 요소에 적용되는 전환 */
.list-enter-active,
.list-leave-active {
  transition: all 0.5s ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(-100%);
}
</style>
