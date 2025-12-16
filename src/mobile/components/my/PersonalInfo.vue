<template>
  <!-- 개인 정보 영역 -->
  <div class="flex flex-col px-16px">
    <!-- 프로필 사진 및 기본 정보 -->
    <div ref="avatarBox" class="grid grid-cols-[86px_1fr] z-1 items-start mt-6 gap-2" style="transform: translateZ(0)">
      <!-- 프로필 사진 -->
      <div
        class="self-center h-auto transition-transform duration-300 ease-in-out origin-top"
        :style="{ transform: props.isShow ? 'scale(1) translateY(0)' : 'scale(0.62) translateY(0px)' }">
        <n-avatar :size="86" :src="AvatarUtils.getAvatarUrl(userDetailInfo!.avatar)" fallback-src="/logo.png" round />
      </div>

      <!-- 기본 정보 표시줄 -->
      <div ref="infoBox" class="pl-2 flex gap-8px flex-col transition-transform duration-300 ease-in-out">
        <!-- 이름 및 온라인 상태 -->
        <div class="flex flex-warp gap-4 items-center">
          <span class="font-bold text-20px text-#373838">{{ userDetailInfo!.name }}</span>
          <div
            v-show="hasUserOnlineState"
            class="bg-#E7EFE6 flex flex-wrap ps-2 px-8px items-center rounded-full gap-1 h-24px">
            <span class="w-12px h-12px rounded-15px flex items-center">
              <img
                :src="friendUserState.url ? friendUserState.url : currentState?.url"
                alt=""
                class="rounded-50% size-14px" />
            </span>
            <span class="text-bold-style" style="font-size: 12px; color: #373838">
              {{ friendUserState.title ? friendUserState.title : currentState.title }}
            </span>
          </div>
        </div>

        <!-- 계정 -->
        <div class="flex flex-warp gap-2 items-center">
          <span class="text-bold-style">계정:{{ userDetailInfo!.account }}</span>
          <span v-if="isMyPage" @click="toMyQRCode" class="pe-15px">
            <img class="w-14px h-14px" src="@/assets/mobile/my/qr-code.webp" alt="" />
          </span>
        </div>
        <Transition name="medal-fade">
          <div
            v-if="props.isShow"
            ref="medalBox"
            style="transform: translateZ(0)"
            class="relative w-118px overflow-hidden">
            <img class="block w-full" src="@/assets/mobile/my/my-medal.webp" alt="" />
            <div class="text-10px absolute inset-0 flex ps-2 items-center justify-around text-white font-medium">
              <span class="flex items-center">
                <div v-if="(userStore.userInfo?.itemIds?.length ?? 0) > 0">
                  <span class="font-bold">획득</span>
                  <span class="medal-number">{{ userStore.userInfo?.itemIds?.length }}</span>
                  <span class="font-bold">개 훈장</span>
                </div>
                <span v-else>아직 훈장이 없어요~</span>
              </span>

              <span class="flex ms-3">
                <svg class="iconpark-icon block w-5 h-5">
                  <use href="#right"></use>
                </svg>
              </span>
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </div>
  <!-- 개인 설명 및 좋아요/팔로우 영역 -->
  <Transition name="slide-fade" @before-enter="beforeEnter" @enter="enter" @leave="leave">
    <div v-if="props.isShow" ref="animatedBox" style="transform: translateZ(0)" class="flex flex-col px-16px">
      <!-- 개인 설명 -->
      <div class="mt-2 text-bold-style line-height-24px">
        {{ isMyPage ? userStore.userInfo?.resume : (userDetailInfo as UserInfoType).resume }}
      </div>
      <!-- 좋아요/팔로우 -->
      <div class="flex flex-wrap justify-around mt-4">
        <div class="flex flex-warp gap-2 items-center">
          <div class="min-w-10 flex flex-col items-center">
            <div class="fans-number">920.13W</div>
            <div class="fans-title">팔로워</div>
          </div>
          <div class="h-20px w-1px bg-gray-300"></div>
          <div class="min-w-10 flex flex-col items-center">
            <div class="fans-number">120</div>
            <div class="fans-title">팔로잉</div>
          </div>
          <div class="h-20px w-1px bg-gray-300"></div>
          <div class="min-w-10 flex flex-col items-center">
            <div class="fans-number">43.15W</div>
            <div class="fans-title">좋아요</div>
          </div>
        </div>
        <div class="flex-1 justify-end flex items-center gap-3">
          <n-button
            :disabled="loading"
            @click="toEditProfile"
            v-if="props.isMyPage && !isBotUser(uid)"
            class="font-bold px-4 py-10px bg-#EEF4F3 text-#373838 rounded-full text-12px">
            프로필 편집
          </n-button>
          <n-button
            :loading="loading"
            :disabled="loading"
            @click="handleDelete"
            :color="'#d5304f'"
            v-if="!props.isMyPage && isMyFriend && !isBotUser(uid)"
            class="px-5 py-10px font-bold text-center rounded-full text-12px">
            삭제
          </n-button>

          <n-button
            type="primary"
            :disabled="loading"
            v-if="!props.isMyPage && !isMyFriend && !isBotUser(uid)"
            @click="handleAddFriend"
            class="px-5 py-10px font-bold text-center rounded-full text-12px">
            +&nbsp;친구 추가
          </n-button>
          <n-button
            type="primary"
            @click="toChatRoom"
            :disabled="loading"
            v-if="!props.isMyPage && isMyFriend"
            class="px-5 py-10px text-center font-bold rounded-full text-12px">
            {{ isBotUser(uid) ? '어시스턴트 열기' : '1:1 채팅' }}
          </n-button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { showDialog } from 'vant'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { useUserStatusStore } from '@/stores/userStatus'
import { AvatarUtils } from '@/utils/AvatarUtils'
import 'vant/es/dialog/style'
import { OnlineEnum, UserType } from '@/enums'
import { useMessage } from '@/hooks/useMessage.ts'
import type { UserInfoType, UserItem } from '@/services/types'
import { useChatStore } from '@/stores/chat'
import { useContactStore } from '@/stores/contacts'
import { useGlobalStore } from '@/stores/global'
import { useGroupStore } from '@/stores/group'
import { getSessionDetailWithFriends } from '@/utils/ImRequestUtils'

const props = defineProps({
  isShow: {
    type: Boolean,
    default: true
  },
  isMyPage: {
    type: Boolean,
    default: true,
    require: false
  },
  isMyFriend: {
    type: Boolean,
    default: false,
    require: false
  }
})

const router = useRouter()
const userStore = useUserStore()
const userStatusStore = useUserStatusStore()
const groupStore = useGroupStore()
const route = useRoute()
const contactStore = useContactStore() // 연락처
const globalStore = useGlobalStore()
const chatStore = useChatStore()

const { preloadChatRoom } = useMessage()
const uid = route.params.uid as string
const isMyFriend = ref(props.isMyFriend)

const isBotUser = (uid: string) => groupStore.getUserInfo(uid)?.account === UserType.BOT

const toChatRoom = async () => {
  try {
    const res = await getSessionDetailWithFriends({ id: uid, roomType: 2 })
    // 먼저 세션이 이미 존재하는지 확인
    const existingSession = chatStore.getSession(res.roomId)
    if (!existingSession) {
      // 세션이 존재하지 않을 때만 세션 목록 순서 업데이트
      chatStore.updateSessionLastActiveTime(res.roomId)
      // 세션이 존재하지 않으면 세션 목록을 다시 가져오되, 현재 선택된 세션은 유지
      await chatStore.getSessionList(true)
    }
    await preloadChatRoom(res.roomId)
    router.push(`/mobile/chatRoom/chatMain`)
  } catch (error) {
    console.error('1:1 채팅방 입장 시도 실패:', error)
  }
}

const handleAddFriend = async () => {
  globalStore.addFriendModalInfo.uid = uid
  router.push('/mobile/mobileFriends/confirmAddFriend')
}

// 사용자 상세 정보, 기본 필드는 필요한 것만 작성, 추가하지 않으면 undefined 오류 발생 가능
const userDetailInfo = ref<UserItem | UserInfoType | undefined>({
  activeStatus: OnlineEnum.ONLINE,
  avatar: '',
  lastOptTime: 0,
  name: '',
  uid: '',
  account: '',
  resume: ''
})

// 이 값은 친구 상세 정보를 볼 때만 사용됨
const friendUserState = ref<any>({
  title: '',
  url: ''
})

// 사용자 온라인 상태 존재 여부
const hasUserOnlineState = ref(false)

const { stateList } = storeToRefs(userStatusStore)

const getUserState = (
  stateId: string
): {
  createBy: string
  createTime: number
  id: string
  title: string
  updateBy: null
  updateTime: null
  url: string
} => {
  // 바로 return하지 않음, 디버깅 용이성을 위해
  const foundedState = stateList.value.find((state: { id: string }) => state.id === stateId)
  return foundedState
}

onMounted(() => {
  if (!uid) {
    userDetailInfo.value = userStore.userInfo
    return
  }

  const foundedUser = groupStore.allUserInfo.find((i) => i.uid === uid)

  userDetailInfo.value = foundedUser

  if (foundedUser?.userStateId && foundedUser?.userStateId !== '0') {
    const state = getUserState(foundedUser.userStateId)
    friendUserState.value = state

    // 완료 상태 설정 후 마지막에 상태 표시
    hasUserOnlineState.value = true
  }

  const foundedFriend = contactStore.contactsList.find((item) => item.uid === uid)

  if (foundedFriend) {
    isMyFriend.value = true
  }
})

const currentState = computed(() => userStatusStore.currentState)

const animatedBox = ref<HTMLElement | null>(null)

const loading = ref(false)

const handleDelete = () => {
  showDialog({
    title: '친구 삭제',
    message: '이 친구를 삭제하시겠습니까?',
    showCancelButton: true,
    confirmButtonText: '확인',
    cancelButtonText: '취소',
  })
    .then(async () => {
      if (userDetailInfo.value?.uid) {
        try {
          loading.value = true
          await contactStore.onDeleteFriend(userDetailInfo.value.uid)
          isMyFriend.value = false
          chatStore.getSessionList(true)
          window.$message.success('친구 삭제됨')
          router.back()
        } catch (error) {
          window.$message.warning('삭제 실패')
          console.error('친구 삭제 실패:', error)
        } finally {
          loading.value = false
        }
      } else {
        window.$message.warning('친구를 찾을 수 없습니다')
      }
    })
    .catch(() => {
      // 사용자가 취소를 클릭하면 아무 작업도 하지 않음
    })
}

const toEditProfile = () => {
  router.push('/mobile/mobileMy/editProfile')
}

const toMyQRCode = () => {
  router.push('/mobile/myQRCode')
}

function beforeEnter(el: Element) {
  const box = el as HTMLElement
  box.style.height = '0'
  box.style.opacity = '0'
  box.style.transform = 'translateY(-20px)'
}

function enter(el: Element, done: () => void) {
  const box = el as HTMLElement
  box.style.transition = 'all 0.3s ease'
  requestAnimationFrame(() => {
    box.style.height = box.scrollHeight + 'px'
    box.style.opacity = '1'
    box.style.transform = 'translateY(0)'
  })

  // 애니메이션 정리
  box.addEventListener(
    'transitionend',
    () => {
      box.style.height = 'auto' // 애니메이션 종료 후 auto로 다시 설정하여 레이아웃 영향 방지
      done()
    },
    { once: true }
  )
}

function leave(el: Element, done: () => void) {
  const box = el as HTMLElement
  box.style.height = box.scrollHeight + 'px'
  box.style.opacity = '1'
  box.style.transform = 'translateY(0)'

  requestAnimationFrame(() => {
    box.style.transition = 'all 0.3s ease'
    box.style.height = '0'
    box.style.opacity = '0'
    box.style.transform = 'translateY(-20px)'
  })

  box.addEventListener('transitionend', done, { once: true })
}

const medalBox = ref<HTMLElement | null>(null)

const avatarBox = ref<HTMLElement | null>(null)

watch(
  () => props.isShow,
  (show) => {
    const box = avatarBox.value
    if (!box) return

    box.style.overflow = 'hidden'
    box.style.transition = 'all 0.3s ease'

    if (show) {
      // 표시: 축소 상태에서 원래 높이로 복구
      box.style.height = box.scrollHeight + 'px'
      box.style.opacity = '1'
      box.style.transform = 'scale(1) translateY(0)'

      box.addEventListener(
        'transitionend',
        () => {
          box.style.height = 'auto' // 자동 높이로 복귀
          box.style.overflow = ''
        },
        { once: true }
      )
    } else {
      // 숨김: 축소하고 높이 접기
      box.style.height = box.scrollHeight + 'px' // 먼저 현재 높이로 설정
      requestAnimationFrame(() => {
        box.style.height = '58px' // 약간 작은 높이 유지 (원본 86px, 0.65 축소 후 약 56px)
        box.style.transform = 'scale(1) translateY(0)'
      })
    }
  }
)

const infoBox = ref<HTMLElement | null>(null)
watch(
  () => props.isShow,
  (show) => {
    const info = infoBox.value
    if (!info) return

    // 애니메이션 전환 추가 (class에 직접 작성 가능)
    info.style.transition = 'transform 0.3s ease'

    if (show) {
      info.style.transform = 'translateX(0)'
    } else {
      info.style.transform = 'translateX(-20px)' // 👈 왼쪽으로 약간 이동
    }
  }
)
</script>
<style lang="scss" scoped>
$text-font-size-base: 14px;

$font-family-system: -apple-system, BlinkMacSystemFont;
$font-family-windows: 'Segoe UI', 'Microsoft YaHei';
$font-family-chinese: 'PingFang SC', 'Hiragino Sans GB';
$font-family-sans: 'Helvetica Neue', Helvetica, Arial, sans-serif;

.text-bold-style {
  font-size: 14px;
  font-family: $font-family-system, $font-family-windows, $font-family-sans;
  color: #757775;
}

.medal-number {
  margin: 0 5px 0 3px;
  font-style: italic;
  font-weight: bolder;
  font-size: 1.25em;
  font-family: $font-family-system, $font-family-windows, $font-family-chinese, $font-family-sans;
}

.fans-number {
  font-size: $text-font-size-base;
  font-family: $font-family-system, $font-family-windows, $font-family-chinese, $font-family-sans;
  font-weight: 600;
}

.fans-title {
  margin-top: 0.5rem;
  font-size: 13px;
  font-family: $font-family-system, $font-family-windows, $font-family-sans;
  color: #757775;
}

.custom-rounded {
  border-top-left-radius: 20px;
  /* 왼쪽 상단 */
  border-top-right-radius: 20px;
  overflow: hidden;
}

.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.3s ease;
}

.slide-fade-enter-from {
  opacity: 0;
  transform: translateY(-20px);
}

.slide-fade-enter-to {
  opacity: 1;
  transform: translateY(0);
}

.slide-fade-leave-from {
  opacity: 1;
  transform: translateY(0);
}

.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

.medal-fade-enter-active,
.medal-fade-leave-active {
  transition:
    max-height 0.3s ease,
    opacity 0.3s ease;
  overflow: hidden;
}

.medal-fade-enter-from {
  max-height: 0;
  opacity: 0;
}

.medal-fade-enter-to {
  max-height: 24px; // 컨테이너가 펼쳐졌을 때의 높이와 일치
  opacity: 1;
}

.medal-fade-leave-from {
  max-height: 24px;
  opacity: 1;
}

.medal-fade-leave-to {
  max-height: 0;
  opacity: 0;
}

.avatar-collapsible {
  transition: all 0.3s ease;
  transform-origin: top;
}
</style>
