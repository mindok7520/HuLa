<template>
  <div class="flex flex-col h-full flex-1">
    <img src="@/assets/mobile/chat-home/background.webp" class="w-100% fixed top-0" alt="hula" />

    <!-- 페이지 마스크 -->
    <div
      v-if="showMask"
      @touchend="maskHandler.close"
      @click="maskHandler.close"
      class="fixed inset-0 bg-black/20 backdrop-blur-sm z-[999] transition-all duration-3000 ease-in-out opacity-100"></div>

    <!-- 네비게이션 바 -->
    <NavBar>
      <template #center>연락처</template>
      <template #right>
        <n-dropdown
          @on-clickoutside="addIconHandler.clickOutside"
          @select="addIconHandler.select"
          trigger="click"
          :show-arrow="true"
          :options="uiViewsData.addOptions">
          <svg @click="addIconHandler.open" class="size-22px bg-white p-5px rounded-8px">
            <use href="#plus"></use>
          </svg>
        </n-dropdown>
      </template>
    </NavBar>

    <!-- 입력창 -->
    <div class="px-16px mt-2 mb-12px z-1">
      <n-input
        id="search"
        class="rounded-6px w-full bg-white relative text-12px"
        :maxlength="20"
        clearable
        spellCheck="false"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        :placeholder="'검색'">
        <template #prefix>
          <svg class="w-12px h-12px"><use href="#search"></use></svg>
        </template>
      </n-input>
    </div>

    <div class="flex flex-1 gap-2 flex-col bg-white z-1 custom-rounded">
      <!-- 내 메시지 바 -->
      <div class="grid grid-cols-[4rem_1fr_24px] py-15px px-16px border-b-[1px] border-b-solid border-b-[#e5e7eb]">
        <div class="h-full flex items-center text-14px">내 메시지</div>
        <div @click="toMessage" class="h-full flex items-center justify-end overflow-hidden">
          <n-avatar
            v-if="contactStore.requestFriendsList.length > 0"
            :class="index > 0 ? '-ml-2' : ''"
            v-for="(avatar, index) in avatars"
            :key="avatar"
            round
            size="small"
            :src="avatar" />
        </div>
        <div @click="toMessage" class="h-full flex justify-end items-center">
          <img src="@/assets/mobile/friend/right-arrow.webp" class="block h-20px" alt="" />
        </div>
      </div>

      <n-tabs type="segment" animated class="mt-4px p-[4px_10px_0px_8px]">
        <n-tab-pane name="1" tab="친구">
          <n-collapse :display-directive="'show'" accordion :default-expanded-names="['1']">
            <ContextMenu @contextmenu="showMenu($event)" @select="handleSelect($event.label)" :menu="menuList">
              <n-collapse-item title="내 친구" name="1">
                <template #header-extra>
                  <span class="text-(10px #707070)">{{ onlineCount }}/{{ contactStore.contactsList.length }}</span>
                </template>
                <n-scrollbar style="max-height: calc(100vh - (340px + var(--safe-area-inset-top)))">
                  <!-- 사용자 상자: 기본 우클릭 이벤트를 제거하고 margin 간격으로 인해 우클릭이 가능한 문제를 해결하기 위해 div를 한 겹 더 씌움 -->
                  <div @contextmenu.stop="$event.preventDefault()">
                    <n-flex
                      :size="10"
                      @click="handleClick(item.uid, RoomTypeEnum.SINGLE)"
                      :class="{ active: activeItem === item.uid }"
                      class="item-box w-full h-75px mb-5px"
                      v-for="item in sortedContacts"
                      :key="item.uid">
                      <n-flex align="center" :size="10" class="h-75px pl-6px pr-8px flex-1 truncate">
                        <n-avatar
                          round
                          style="border: 1px solid var(--avatar-border-color)"
                          :size="44"
                          class="grayscale"
                          :class="{ 'grayscale-0': item.activeStatus === OnlineEnum.ONLINE }"
                          :src="AvatarUtils.getAvatarUrl(groupStore.getUserInfo(item.uid)?.avatar!)"
                          fallback-src="/logo.png" />

                        <n-flex vertical justify="space-between" class="h-fit flex-1 truncate">
                          <span class="text-14px leading-tight flex-1 truncate">
                            {{ groupStore.getUserInfo(item.uid)?.name }}
                          </span>

                          <div class="text leading-tight text-12px flex-y-center gap-4px flex-1 truncate">
                            [
                            <template v-if="isBotUser(item.uid)">도우미</template>
                            <template v-else-if="getUserState(item.uid)">
                              <img class="size-12px rounded-50%" :src="getUserState(item.uid)?.url" alt="" />
                              {{ getUserState(item.uid)?.title }}
                            </template>
                            <template v-else>
                              <n-badge :color="item.activeStatus === OnlineEnum.ONLINE ? '#1ab292' : '#909090'" dot />
                              {{ item.activeStatus === OnlineEnum.ONLINE ? '온라인' : '오프라인' }}
                            </template>
                            ]
                          </div>
                        </n-flex>
                      </n-flex>
                    </n-flex>
                  </div>
                </n-scrollbar>
              </n-collapse-item>
            </ContextMenu>
          </n-collapse>
        </n-tab-pane>
        <n-tab-pane name="2" tab="그룹 채팅">
          <n-collapse :display-directive="'show'" accordion :default-expanded-names="['1']">
            <n-collapse-item title="내 그룹 채팅" name="1">
              <template #header-extra>
                <span class="text-(10px #707070)">{{ groupChatList.length }}</span>
              </template>
              <n-scrollbar style="max-height: calc(100vh - (340px + var(--safe-area-inset-top)))">
                <div
                  @click="handleClick(item.roomId, RoomTypeEnum.GROUP)"
                  :class="{ active: activeItem === item.roomId }"
                  class="item-box w-full h-75px mb-5px"
                  v-for="item in groupChatList"
                  :key="item.roomId">
                  <n-flex align="center" :size="10" class="h-75px pl-6px pr-8px flex-1 truncate">
                    <n-avatar
                      round
                      style="border: 1px solid var(--avatar-border-color)"
                      bordered
                      :size="44"
                      :src="AvatarUtils.getAvatarUrl(item.avatar)"
                      fallback-src="/logo.png" />

                    <span class="text-14px leading-tight flex-1 truncate">{{ item.remark || item.groupName }}</span>
                  </n-flex>
                </div>
              </n-scrollbar>
            </n-collapse-item>
          </n-collapse>
        </n-tab-pane>
      </n-tabs>
    </div>
  </div>
</template>
<style scoped>
.custom-rounded {
  border-top-left-radius: 20px; /* 왼쪽 상단 */
  border-top-right-radius: 20px;
  overflow: hidden;
}
</style>
<script setup lang="ts">
import { storeToRefs } from 'pinia'
import NavBar from '#/layout/navBar/index.vue'
import addFriendIcon from '@/assets/mobile/chat-home/add-friend.webp'
import groupChatIcon from '@/assets/mobile/chat-home/group-chat.webp'
import { MittEnum, OnlineEnum, RoomTypeEnum, UserType } from '@/enums'
import { useMessage } from '@/hooks/useMessage.ts'
import { useMitt } from '@/hooks/useMitt.ts'
import router from '@/router'
import { useContactStore } from '@/stores/contacts.ts'
import { useGroupStore } from '@/stores/group'
import { useUserStatusStore } from '@/stores/userStatus'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { NoticeType } from '@/services/types'

/**
 * 현재 사용자 조회 시점 가져오기
 * @param item 알림 메시지
 */
const getUserInfo = (item: any) => {
  switch (item.eventType) {
    case NoticeType.FRIEND_APPLY:
    case NoticeType.GROUP_INVITE:
    case NoticeType.GROUP_MEMBER_DELETE: {
      return groupStore.getUserInfo(item.operateId)!
    }
    case NoticeType.ADD_ME:
    case NoticeType.GROUP_INVITE_ME:
    case NoticeType.GROUP_SET_ADMIN:
    case NoticeType.GROUP_APPLY:
    case NoticeType.GROUP_RECALL_ADMIN: {
      return groupStore.getUserInfo(item.senderId)!
    }
  }
}

const avatars = computed(() => {
  const seen = new Set()
  const unique = []

  for (const item of contactStore.requestFriendsList) {
    const avatar = avatarSrc(getUserInfo(item)!.avatar!)
    if (!seen.has(avatar)) {
      seen.add(avatar)
      unique.push(avatar)
    }

    if (unique.length >= 6) break
  }

  return unique
})

/**
 * 이미지 아이콘 렌더링 함수 팩토리
 * @param {string} src - 아이콘 이미지 경로
 * @returns {() => import('vue').VNode} 이미지 렌더링 함수 컴포넌트 반환
 */
const renderImgIcon = (src: string) => {
  return () =>
    h('img', {
      src,
      style: 'display:block; width: 24px; height: 24px; vertical-align: middle'
    })
}

/**
 * UI 뷰 데이터, 메뉴 옵션 및 아이콘 포함
 * @type {import('vue').Ref<{ addOptions: { label: string; key: string; icon: () => import('vue').VNode }[] }>}
 */
const uiViewsData = ref({
  addOptions: [
    {
      label: '그룹 채팅 시작',
      key: '/mobile/mobileFriends/startGroupChat',
      icon: renderImgIcon(groupChatIcon)
    },
    {
      label: '친구/그룹 추가',
      key: '/mobile/mobileFriends/addFriends',
      icon: renderImgIcon(addFriendIcon)
    }
  ]
})

const menuList = ref([
  { label: '그룹 추가', icon: 'plus' },
  { label: '그룹 이름 변경', icon: 'edit' },
  { label: '그룹 삭제', icon: 'delete' }
])
/** 이 상태를 localStorage에 저장하는 것을 권장 */
const activeItem = ref('')
const detailsShow = ref(false)
const shrinkStatus = ref(false)
const groupStore = useGroupStore()
const contactStore = useContactStore()
const userStatusStore = useUserStatusStore()
const { stateList } = storeToRefs(userStatusStore)

const avatarSrc = (url: string) => AvatarUtils.getAvatarUrl(url)

const toMessage = () => {
  router.push('/mobile/mobileMy/myMessages')
}

/** 그룹 채팅 목록 */
const groupChatList = computed(() => {
  return [...groupStore.groupDetails].sort((a, b) => {
    // roomId가 '1'인 그룹 채팅을 맨 앞에 배치
    if (a.roomId === '1' && b.roomId !== '1') return -1
    if (a.roomId !== '1' && b.roomId === '1') return 1
    return 0
  })
})
/** 온라인 사용자 수 통계 */
const onlineCount = computed(() => {
  return contactStore.contactsList.filter((item) => item.activeStatus === OnlineEnum.ONLINE).length
})
/** 친구 목록 정렬 */
const sortedContacts = computed(() => {
  return [...contactStore.contactsList].sort((a, b) => {
    // 온라인 사용자를 앞에 배치
    if (a.activeStatus === OnlineEnum.ONLINE && b.activeStatus !== OnlineEnum.ONLINE) return -1
    if (a.activeStatus !== OnlineEnum.ONLINE && b.activeStatus === OnlineEnum.ONLINE) return 1
    return 0
  })
})

const { preloadChatRoom } = useMessage()

const isBotUser = (uid: string) => groupStore.getUserInfo(uid)?.account === UserType.BOT

/**
 *
 * @param uid 그룹 채팅 id 또는 친구 uid
 * @param type 1 그룹 채팅 2 1:1 채팅
 */
const handleClick = async (id: string, type: number) => {
  detailsShow.value = true
  activeItem.value = id
  const data = {
    context: {
      type: type,
      uid: id
    },
    detailsShow: detailsShow.value
  }
  useMitt.emit(MittEnum.DETAILS_SHOW, data)

  if (type === 1) {
    try {
      await preloadChatRoom(id)
      router.push(`/mobile/chatRoom/chatMain`)
    } catch (error) {
      console.error(error)
    }
  } else {
    router.push(`/mobile/mobileFriends/friendInfo/${id}`)
  }
}

// todo 그룹을 표시하기 위해 배열 순회 필요
const showMenu = (event: MouseEvent) => {
  console.log(event)
}

const handleSelect = (event: MouseEvent) => {
  console.log(event)
}

/** 사용자 상태 가져오기 */
const getUserState = (uid: string) => {
  const userInfo = groupStore.getUserInfo(uid)!
  const userStateId = userInfo.userStateId

  if (userStateId && userStateId !== '1') {
    return stateList.value.find((state: { id: string }) => state.id === userStateId)
  }
  return null
}

onMounted(async () => {
  useMitt.on(MittEnum.SHRINK_WINDOW, async (event) => {
    shrinkStatus.value = event as boolean
  })
  try {
    await contactStore.getContactList(true)
    await contactStore.getApplyPage('friend', false)
  } catch (error) {
    console.log('친구 신청 목록 요청 실패')
  }
})

onUnmounted(() => {
  detailsShow.value = false
  useMitt.emit(MittEnum.DETAILS_SHOW, detailsShow.value)
})

/**
 * 페이지 마스크 표시 상태
 * @type {import('vue').Ref<boolean>}
 */
const showMask = ref(false)

/**
 * 현재 페이지 스크롤의 세로 위치, 마스크를 열 때 페이지 점프 방지
 * @type {number}
 */
let scrollY = 0

/**
 * 페이지 마스크 제어 객체, 열기 및 닫기 메서드 포함
 */
const maskHandler = {
  /**
   * 마스크 열기 및 스크롤 위치 잠금
   */
  open: () => {
    scrollY = window.scrollY
    showMask.value = true
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = '100%'
  },

  /**
   * 마스크 닫기, 스크롤 상태 및 위치 복원
   */
  close: () => {
    setTimeout(() => {
      showMask.value = false
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
      window.scrollTo(0, scrollY) // 스크롤 위치 복원
    }, 200)
  }
}

/**
 * 추가 버튼 관련 이벤트 처리 객체
 */
const addIconHandler = {
  /**
   * 옵션 선택 시 마스크 닫기
   */
  select: (item: string) => {
    console.log('선택된 항목:', item)
    router.push(item)
    maskHandler.close()
  },

  /**
   * 플러스 버튼 클릭 시 마스크 열기
   */
  open: () => {
    maskHandler.open()
  },

  /**
   * 드롭다운 메뉴 외부 영역 클릭 시 마스크 닫기
   */
  clickOutside: () => {
    maskHandler.close()
  }
}
</script>
