<template>
  <main
    ref="centerEl"
    data-tauri-drag-region
    id="center"
    :class="{ 'rounded-r-8px': shrinkStatus }"
    class="resizable select-none flex flex-col border-r-(1px solid [--right-chat-footer-line-color])"
    :style="centerStyle">
    <!-- 구분선 -->
    <div v-show="!shrinkStatus" class="resize-handle transition-all duration-600 ease-in-out" @mousedown="initDrag">
      <div :class="{ 'opacity-100': isDragging }" class="transition-all duration-600 ease-in-out opacity-0 drag-icon">
        <div style="border-radius: 8px 0 0 8px" class="bg-#c8c8c833 h-60px w-14px absolute top-40% right-0 drag-icon">
          <svg class="size-16px absolute top-1/2 right--2px transform -translate-y-1/2 color-#909090">
            <use href="#sliding"></use>
          </svg>
        </div>
      </div>
    </div>

    <ActionBar
      class="absolute right-0 w-full"
      v-show="shrinkStatus"
      :shrink-status="!shrinkStatus"
      :max-w="false"
      :current-label="appWindow.label" />

    <!-- 상단 검색바 -->
    <header class="mt-30px pb-10px flex-1 flex-col-x-center border-b-(1px solid [--right-chat-footer-line-color])">
      <div class="flex-center gap-5px w-full pr-16px pl-16px box-border">
        <n-input
          id="search"
          v-model:value="searchText"
          @focus="() => handleSearchFocus()"
          @blur="resetSearchPlaceholder"
          @update:value="handleSearchInputChange"
          class="rounded-6px w-full relative text-12px"
          style="background: var(--search-bg-color)"
          :maxlength="20"
          clearable
          spellCheck="false"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          size="small"
          :placeholder="isSearchMode ? '' : searchPlaceholder">
          <template #prefix>
            <svg class="w-12px h-12px"><use href="#search"></use></svg>
          </template>
        </n-input>

        <!-- 추가 패널 -->
        <n-popover
          v-model:show="addPanels.show"
          style="padding: 0; background: transparent; user-select: none"
          :show-arrow="false"
          trigger="click">
          <template #trigger>
            <n-button size="small" secondary style="padding: 0 5px">
              <template #icon>
                <svg class="w-24px h-24px"><use href="#plus"></use></svg>
              </template>
            </n-button>
          </template>

          <div @click.stop="addPanels.show = false" class="add-item">
            <div class="menu-list">
              <div v-for="(item, index) in addPanels.list" :key="index">
                <div class="menu-item" @click="() => item.click()">
                  <svg><use :href="`#${item.icon}`"></use></svg>
                  {{ t(item.label) }}
                </div>
              </div>
            </div>
          </div>
        </n-popover>
      </div>
    </header>

    <!-- 리스트 -->
    <div id="centerList" class="h-full" :class="{ 'shadow-inner': page.shadow }">
      <router-view v-slot="{ Component }">
        <keep-alive :include="['message', 'friendsList']">
          <component :is="Component" />
        </keep-alive>
      </router-view>
    </div>

    <!-- 그룹 채팅 생성 셔틀 박스 -->
    <n-modal v-model:show="createGroupModal" :mask-closable="false" class="rounded-8px" transform-origin="center">
      <div class="bg-[--bg-edit] w-540px h-fit box-border flex flex-col">
        <n-flex :size="6" vertical>
          <div
            v-if="isMac()"
            @click="resetCreateGroupState"
            class="mac-close size-13px shadow-inner bg-#ed6a5eff rounded-50% mt-6px select-none absolute left-6px">
            <svg class="hidden size-7px color-#000 select-none absolute top-3px left-3px">
              <use href="#close"></use>
            </svg>
          </div>

          <n-flex class="text-(14px [--text-color]) select-none pt-6px" justify="center">
            {{ t('home.create_group.title') }}
          </n-flex>

          <svg
            v-if="isWindows()"
            class="size-14px cursor-pointer pt-6px select-none absolute right-6px"
            @click="resetCreateGroupState">
            <use href="#close"></use>
          </svg>

          <n-transfer
            :key="`${isFromChatbox}-${preSelectedFriendId}`"
            source-filterable
            target-filterable
            v-model:value="selectedValue"
            :options="options"
            :render-source-list="renderSourceList(isFromChatbox ? preSelectedFriendId : '', isFromChatbox)"
            :render-target-list="
              renderTargetList(
                isFromChatbox ? preSelectedFriendId : '',
                isFromChatbox,
                '',
                t('home.create_group.required_tag')
              )
            "
            :render-target-label="renderLabel" />

          <n-flex align="center" justify="center" class="p-16px">
            <n-button :disabled="selectedValue.length < 2" color="#13987f" @click="handleCreateGroup">
              {{ t('home.create_group.action') }}
            </n-button>
          </n-flex>
        </n-flex>
      </div>
    </n-modal>
  </main>
</template>

<script setup lang="ts">
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useWindowSize } from '@vueuse/core'
import { MittEnum } from '@/enums'
import { useMitt } from '@/hooks/useMitt.ts'
import { useWindow } from '@/hooks/useWindow'
import router from '@/router'
import { useChatStore } from '@/stores/chat.ts'
import { useGlobalStore } from '@/stores/global.ts'
import { useGroupStore } from '@/stores/group'
import { useSettingStore } from '@/stores/setting.ts'
import * as ImRequestUtils from '@/utils/ImRequestUtils'
import { isMac, isWindows } from '@/utils/PlatformConstants'
import { options, renderLabel, renderSourceList, renderTargetList } from './model.tsx'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const { createWebviewWindow } = useWindow()

const chatStore = useChatStore()
const settingStore = useSettingStore()
const globalStore = useGlobalStore()
const groupStore = useGroupStore()
const { page } = storeToRefs(settingStore)
const appWindow = WebviewWindow.getCurrent()
const selectedValue = ref<string[]>([])
const createGroupModal = ref(false)
const preSelectedFriendId = ref('')
const isFromChatbox = ref(false) // 채팅창에서 왔는지 여부 표시
/** 최소 너비 설정 */
const minWidth = 160
/** 최대 너비 설정 */
const maxWidth = 300
/** 초기 너비 */
const initWidth = ref(250)
/**! 뷰포트 너비 사용(vueUse 함수로 획득) */
const { width } = useWindowSize()
/** 드래그 여부 */
const isDrag = ref(true)
/** 검색창 placeholder 문구 */
const searchPlaceholder = computed(() => t('home.search_input_placeholder'))
/** 검색창 텍스트 */
const searchText = ref(searchPlaceholder.value)
/** 검색 모드 여부 */
const isSearchMode = ref(false)
/** 추가 패널 표시 여부 */
const addPanels = ref({
  show: false,
  list: [
    {
      label: 'home.action.start_group_chat',
      icon: 'launch',
      click: () => {
        isFromChatbox.value = false
        preSelectedFriendId.value = ''
        selectedValue.value = []
        createGroupModal.value = true
      }
    },
    {
      label: 'home.action.add_friend_or_group',
      icon: 'people-plus',
      click: async () => {
        await createWebviewWindow(t('home.action.add_friend_or_group'), 'searchFriend', 500, 580)
      }
    }
  ]
})

const resetSearchPlaceholder = () => {
  if (isSearchMode.value) return
  searchText.value = searchPlaceholder.value
}

watch(searchPlaceholder, (next, prev) => {
  // 비검색 모드이고 현재 값이 비어 있거나 이전 문구와 같을 때, 최신 언어로 동기화
  if (!isSearchMode.value && (searchText.value === '' || searchText.value === prev)) {
    searchText.value = next
  }
})

const LEFT_MIN_WIDTH = 64
const RIGHT_MIN_WIDTH = 600 // 우측 패널이 유지할 최소 너비
// 사용자 정의 스케일링 방식을 결합하여 현재 페이지의 스케일 비율을 획득, 다른 DPI에서 중단점 왜곡 방지
const resolvePageScale = () => {
  if (typeof window === 'undefined') return 1
  const scale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--page-scale') || '1')
  return Number.isFinite(scale) && scale > 0 ? scale : 1
}

// 레이아웃 컨테이너의 실시간 너비 읽기(창 드래그 또는 시스템 스케일링 시 동적으로 변경됨)
const getLayoutWidth = (fallback: number) => {
  if (typeof document === 'undefined') return fallback
  const layout = document.getElementById('layout')
  return layout?.getBoundingClientRect().width ?? fallback
}

// 왼쪽 내비게이션은 상태에 따라 너비가 고정되지 않으므로, 여기서 필요에 따라 측정
const getLeftWidth = () => {
  if (typeof document === 'undefined') return LEFT_MIN_WIDTH
  const left = document.querySelector('#layout .left') as HTMLElement | null
  return left?.getBoundingClientRect().width ?? LEFT_MIN_WIDTH
}
const startX = ref()
const startWidth = ref()
const shrinkStatus = ref(false)
const isDragging = ref(false)
const centerEl = shallowRef<HTMLElement | null>(null)
// 레이아웃 너비를 통일해서 측정, 여러 곳에서 DOM을 중복해서 읽는 것을 방지
const layoutMetrics = computed(() => {
  const windowWidth = width.value / resolvePageScale()
  const layoutWidth = getLayoutWidth(windowWidth)
  const leftWidth = getLeftWidth()
  const available = layoutWidth - leftWidth - RIGHT_MIN_WIDTH

  return {
    layoutWidth,
    leftWidth,
    available,
    lockThreshold: leftWidth + initWidth.value + RIGHT_MIN_WIDTH,
    collapsedWidth: Math.max(layoutWidth - leftWidth, minWidth)
  }
})

// 드래그 시 기록된 너비는 여기서 현재 사용 가능한 공간과 비교하여 더 작은 값을 취함
const centerWidth = computed(() => {
  const { available } = layoutMetrics.value

  if (available <= minWidth) {
    return minWidth
  }

  const desired = clamp(initWidth.value, minWidth, maxWidth)
  return clamp(Math.min(desired, available), minWidth, maxWidth)
})

// 레이아웃 상태에 따라 중단 패널의 최종 flex 설정 생성
const centerStyle = computed(() => {
  const { lockThreshold, layoutWidth, collapsedWidth } = layoutMetrics.value

  if (shrinkStatus.value) {
    return {
      flex: '1 1 auto',
      width: `${collapsedWidth}px`,
      minWidth: '0',
      maxWidth: 'none'
    }
  }

  const flexMode = layoutWidth > lockThreshold ? '0 0 auto' : '0 1 auto'

  return {
    flex: flexMode,
    width: `${centerWidth.value}px`,
    minWidth: `${minWidth}px`,
    maxWidth: `${maxWidth}px`
  }
})

// 창 너비를 모니터링하여 축소 모드 전환 및 드래그 스위치 제어
watchEffect(() => {
  const { available } = layoutMetrics.value
  const shouldShrink = available <= minWidth
  const canDrag = available > minWidth

  if (shrinkStatus.value !== shouldShrink) {
    useMitt.emit(MittEnum.SHRINK_WINDOW, shouldShrink)
  }

  const center = centerEl.value ?? document.getElementById('center')

  if (shouldShrink) {
    center?.classList.add('flex-1')
    isDrag.value = false
  } else {
    center?.classList.remove('flex-1')
    isDrag.value = canDrag
  }
})

// 선택된 값의 변화를 감지, 필수 항목이 지워지지 않도록 확인
watch(selectedValue, (newValue) => {
  if (isFromChatbox.value && preSelectedFriendId.value && newValue) {
    // 채팅창에서 트리거되었고 미리 선택된 친구가 있다면, 해당 친구가 항상 선택 목록에 있도록 확인
    if (!newValue.includes(preSelectedFriendId.value)) {
      // 미리 선택된 친구가 제거되었다면, 다시 추가
      selectedValue.value = [...newValue, preSelectedFriendId.value]
    }
  }
})

const resetCreateGroupState = () => {
  selectedValue.value = []
  preSelectedFriendId.value = ''
  isFromChatbox.value = false
  createGroupModal.value = false
}

const handleCreateGroup = async () => {
  if (selectedValue.value.length < 2) return
  try {
    const result: any = await ImRequestUtils.createGroup({ uidList: selectedValue.value })

    // 생성 성공 후 대화 목록을 새로 고쳐 새 그룹 채팅 표시
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
    window.$message.success(t('home.create_group.success'))
  } catch (error) {
    window.$message.error(t('home.create_group.fail'))
  }
}

const handleSearchFocus = () => {
  router.push('/searchDetails')
  searchText.value = ''
  isSearchMode.value = true

  // SearchDetails 컴포넌트로 현재 검색창 값 전송 지연
  setTimeout(() => {
    useMitt.emit('search_input_change', searchText.value)
  }, 100)
}

// 검색 입력 변경 처리
const handleSearchInputChange = (value: string) => {
  // 검색 상세 페이지에 있다면, 입력 값을 SearchDetails 컴포넌트로 전송
  if (isSearchMode.value) {
    useMitt.emit('search_input_change', value)
  }
}

const closeMenu = (event: Event) => {
  const e = event.target as HTMLInputElement
  const route = router.currentRoute.value.path
  /** 클릭한 것이 검색창이라면 메시지 목록 닫기 판단 */
  if (!e.matches('#search, #search *, #centerList *, #centerList') && route === '/searchDetails') {
    router.go(-1)
    isSearchMode.value = false
  }
}

/** 마우스 드래그 시 호출되는 함수 정의 */
const doDrag = (e: MouseEvent) => {
  // requestAnimationFrame을 사용하여 애니메이션 처리, 다음 프레임 렌더링 전에 애니메이션 실행 보장
  requestAnimationFrame(() => {
    // 새 너비 계산
    const newWidth = startWidth.value + e.clientX - startX.value
    // 새 너비가 최대 너비와 같지 않다면 너비 값 업데이트
    if (newWidth !== maxWidth) {
      initWidth.value = clamp(newWidth, minWidth, maxWidth) // clamp 함수를 사용하여 너비 값을 최소값과 최대값 사이로 제한
    }
  })
}

/** 수치를 지정된 최소값과 최대값 사이로 제한하는 함수 정의 */
const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max) // Math.min 및 Math.max 함수를 사용하여 수치 범위 제한
}

const initDrag = (e: MouseEvent) => {
  if (!isDrag.value) return
  startX.value = e.clientX
  startWidth.value = initWidth.value
  isDragging.value = true
  document.addEventListener('mousemove', doDrag, false)
  document.addEventListener('mouseup', stopDrag, false)
  // 드래그 시 텍스트 선택 방지
  document.body.style.userSelect = 'none'
  e.preventDefault()
}

const stopDrag = () => {
  // 텍스트 선택 기능 복원
  document.body.style.userSelect = ''
  document.removeEventListener('mousemove', doDrag, false)
  document.removeEventListener('mouseup', stopDrag, false)
  isDragging.value = false
  setTimeout(() => {
    // hover 스타일 제거
    const resizeHandle = document.querySelector('.resize-handle') as HTMLElement
    resizeHandle.classList.remove('hover')
  }, 1000)
}

onMounted(async () => {
  useMitt.on(MittEnum.SHRINK_WINDOW, (event: boolean) => {
    shrinkStatus.value = event
  })
  useMitt.on(MittEnum.CREATE_GROUP, (event: { id: string }) => {
    isFromChatbox.value = true
    preSelectedFriendId.value = event.id
    createGroupModal.value = true
    nextTick(() => {
      selectedValue.value = [event.id]
    })
  })
  window.addEventListener('click', closeMenu, true)
})

onUnmounted(() => {
  window.removeEventListener('click', closeMenu, true)
  // 드래그 관련 이벤트 리스너 및 스타일 정리
  if (isDragging.value) {
    document.removeEventListener('mousemove', doDrag, false)
    document.removeEventListener('mouseup', stopDrag, false)
    document.body.style.userSelect = ''
    isDragging.value = false
  }
})
</script>

<style scoped lang="scss">
@use 'style';
</style>
