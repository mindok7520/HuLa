<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar
        :isOfficial="false"
        style="border-bottom: 1px solid; border-color: #dfdfdf"
        :hidden-right="true"
        :room-name="title + '설정'" />
    </template>

    <template #container>
      <div
        class="bg-[url('@/assets/mobile/chat-home/background.webp')] bg-cover bg-center flex flex-col overflow-auto h-full">
        <div class="flex flex-col gap-15px py-15px px-20px flex-1 min-h-0">
          <div class="flex shadow py-10px bg-white rounded-10px w-full items-center gap-10px" @click="clickInfo">
            <!-- 그룹 프로필 사진 -->
            <div class="flex justify-center">
              <div class="rounded-full relative bg-white w-38px h-38px overflow-hidden" style="margin-left: 10px">
                <n-avatar
                  class="absolute"
                  :size="38"
                  :src="AvatarUtils.getAvatarUrl(activeItem?.avatar || '')"
                  fallback-src="/logo.png"
                  :style="{
                    'object-fit': 'cover',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)'
                  }"
                  round />
              </div>
              <input
                v-if="isGroup"
                ref="fileInput"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                class="hidden"
                @change="handleFileChange" />
              <AvatarCropper
                ref="cropperRef"
                v-model:show="showCropper"
                :image-url="localImageUrl"
                @crop="handleCrop" />
            </div>

            <div class="text-14px flex items-center h-full gap-5px">
              <span>
                {{ activeItem?.name || '' }}
              </span>
              <span v-if="activeItem?.hotFlag === 1">
                <svg class="w-18px h-18px iconpark-icon text-#1A9B83">
                  <use href="#auth"></use>
                </svg>
              </span>
            </div>
          </div>
          <!-- 그룹 멤버  -->
          <div v-if="isGroup" class="bg-white rounded-10px max-w-full p-[5px_10px_5x_10px] shadow">
            <div class="p-[15px_15px_0px_15px] flex flex-col">
              <!-- 그룹 ID -->
              <div class="flex justify-between items-center">
                <div class="text-14px">그룹 멤버</div>
                <div @click="toGroupChatMember" class="text-12px text-#6E6E6E flex flex-wrap gap-10px items-center">
                  <div>
                    총
                    <span class="text-#398D7E">{{ groupStore.countInfo?.memberNum || 0 }}</span>
                    명
                  </div>
                  <div>
                    <svg class="w-14px h-14px iconpark-icon">
                      <use href="#right"></use>
                    </svg>
                  </div>
                </div>
              </div>
            </div>
            <div class="py-15px px-5px grid grid-cols-5 gap-15px text-12px">
              <div
                @click="toFriendInfo(i.uid)"
                v-for="i in groupMemberListSliced"
                :key="i.uid"
                class="flex flex-col justify-center items-center gap-5px">
                <div class="rounded-full relative bg-#E5EFEE w-36px h-36px flex items-center justify-center">
                  <!-- 마스크 -->
                  <div
                    v-if="i.activeStatus !== OnlineEnum.ONLINE"
                    class="w-36px h-36px absolute rounded-full bg-#707070 opacity-70 z-4"></div>
                  <n-avatar class="absolute z-3" :size="36" :src="avatarSrc(i.avatar)" fallback-src="/logo.png" round />
                </div>
                <div class="truncate max-w-full text-#707070">{{ i.name }}</div>
              </div>
              <div
                @click="toInviteGroupMember"
                class="flex flex-col justify-center items-center gap-5px cursor-pointer">
                <div
                  class="rounded-full bg-#E5EFEE w-36px h-36px flex items-center justify-center hover:bg-#D5E5E0 transition-colors">
                  <svg class="iconpark-icon h-25px w-25px">
                    <use href="#plus"></use>
                  </svg>
                </div>
                <div>초대</div>
              </div>
            </div>
          </div>

          <!-- 그룹 멤버 관리 -->
          <div
            v-if="isGroup && groupStore.isAdminOrLord() && globalStore.currentSessionRoomId !== '1'"
            class="bg-white p-15px rounded-10px shadow text-14px flex cursor-pointer"
            @click="toManageGroupMember">
            그룹 멤버 관리
          </div>

          <div
            class="bg-white p-15px rounded-10px shadow text-14px flex cursor-pointer"
            @click="handleSearchChatContent">
            채팅 내용 검색
          </div>
          <!-- 그룹 공지 -->
          <div class="flex bg-white rounded-10px w-full h-auto shadow">
            <div class="px-15px flex flex-col w-full">
              <!-- 그룹 ID -->
              <div
                style="border-bottom: 1px solid; border-color: #ebebeb"
                @click="handleCopy(activeItem?.account || '')"
                class="flex justify-between py-15px items-center">
                <div class="text-14px">{{ isGroup ? '그룹 ID/QR' : 'Hula ID/QR' }}</div>
                <div class="text-12px text-#6E6E6E flex flex-wrap gap-10px items-center">
                  <div>{{ activeItem?.account || '' }}</div>
                  <div>
                    <svg class="w-14px h-14px iconpark-icon">
                      <use href="#saoma-i3589iic"></use>
                    </svg>
                  </div>
                </div>
              </div>

              <!-- 공지 내용 -->
              <div @click="goToNotice" v-if="isGroup" class="pt-15px flex flex-col text-14px gap-10px">
                <div>그룹 공지</div>
                <div class="text-#707070 line-clamp-2 text-12px line-height-20px">
                  {{ announList.length > 0 ? announList[0]?.content : '' }}
                </div>
              </div>

              <div v-if="isGroup && groupStore.isAdminOrLord()" class="flex justify-between py-15px items-center">
                <div class="text-14px">그룹 닉네임</div>
                <div class="text-12px text-#6E6E6E flex flex-wrap gap-10px items-center">
                  <input
                    style="
                      height: 17px;
                      border: none;
                      text-align: right;
                      outline: none;
                      font-size: 14px;
                      text-align: right;
                    "
                    v-model="nameValue"
                    @blur="handleGroupInfoUpdate"
                    placeholder="그룹 닉네임 입력" />
                </div>
              </div>

              <div v-if="isGroup" class="flex justify-between py-15px items-center">
                <div class="text-14px">내 그룹 닉네임</div>
                <div class="text-12px text-#6E6E6E flex flex-wrap gap-10px items-center">
                  <input
                    style="
                      height: 17px;
                      border: none;
                      text-align: right;
                      outline: none;
                      font-size: 14px;
                      text-align: right;
                    "
                    v-model="nicknameValue"
                    @blur="handleInfoUpdate"
                    placeholder="내 그룹 닉네임 입력" />
                </div>
              </div>
            </div>
          </div>
          <!-- 메모 -->
          <div class="w-full flex flex-col gap-15px rounded-10px">
            <div class="ps-15px text-14px">
              <span>{{ title + '메모' }}</span>
              <span class="text-#6E6E6E">(나에게만 보임)</span>
            </div>
            <div class="rounded-10px flex w-full bg-white shadow">
              <div class="w-full px-15px">
                <input
                  v-model="remarkValue"
                  class="h-50px w-full"
                  style="border: none; outline: none; font-size: 14px"
                  :placeholder="title + '메모 입력'"
                  @blur="handleInfoUpdate" />
              </div>
            </div>
          </div>
          <div class="flex bg-white rounded-10px w-full h-auto shadow">
            <div class="px-15px flex flex-col w-full">
              <div class="pt-15px text-14px text-#6E6E6E">{{ title }}설정</div>
              <!-- 그룹 ID -->
              <div
                style="border-bottom: 1px solid; border-color: #ebebeb"
                class="flex justify-between py-12px items-center">
                <div class="text-14px">상단 고정 설정</div>
                <n-switch :value="!!activeItem?.top" @update:value="handleTop" />
              </div>
              <div
                style="border-bottom: 1px solid; border-color: #ebebeb"
                class="flex justify-between py-12px items-center">
                <div class="text-14px">메시지 알림 끄기</div>
                <n-switch
                  @update:value="handleNotification"
                  :value="activeItem?.muteNotification === NotificationTypeEnum.NOT_DISTURB" />
              </div>
            </div>
          </div>
          <div class="shadow bg-white cursor-pointer text-red text-14px rounded-10px w-full mb-20px">
            <div class="p-15px">채팅 기록 삭제</div>
          </div>
          <!-- 그룹 해체, 그룹 나가기, 친구 삭제 버튼 -->
          <div v-if="isGroup && globalStore.currentSessionRoomId !== '1'" class="mt-auto flex justify-center mb-20px">
            <n-button type="error" @click="handleExit">
              {{ isGroup ? (isLord ? '그룹 해체' : '그룹 나가기') : '친구 삭제' }}
            </n-button>
          </div>
        </div>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { MittEnum, NotificationTypeEnum, OnlineEnum, RoleEnum, RoomTypeEnum } from '@/enums'
import { useAvatarUpload } from '@/hooks/useAvatarUpload'
import { useMitt } from '@/hooks/useMitt.ts'
import { useMyRoomInfoUpdater } from '@/hooks/useMyRoomInfoUpdater'
import router from '@/router'
import type { UserItem } from '@/services/types'
import { useCachedStore } from '@/stores/cached'
import { useChatStore } from '@/stores/chat.ts'
import { useContactStore } from '@/stores/contacts.ts'
import { useGlobalStore } from '@/stores/global'
import { useGroupStore } from '@/stores/group'
import { useUserStore } from '@/stores/user'
import { AvatarUtils } from '@/utils/AvatarUtils'
import {
  deleteFriend,
  getGroupDetail,
  modifyFriendRemark,
  notification,
  setSessionTop,
  shield,
  updateRoomInfo
} from '@/utils/ImRequestUtils'
import { toFriendInfoPage } from '@/utils/RouterUtils'

defineOptions({
  name: 'mobileChatSetting'
})

const dialog = useDialog()
const userStore = useUserStore()
const chatStore = useChatStore()
const globalStore = useGlobalStore()
const groupStore = useGroupStore()
const cacheStore = useCachedStore()
const contactStore = useContactStore()
const { currentSessionRoomId } = storeToRefs(globalStore)
const { persistMyRoomInfo } = useMyRoomInfoUpdater()

const title = computed(() => (isGroup.value ? '그룹' : '친구'))
const isGroup = computed(() => globalStore.currentSession?.type === RoomTypeEnum.GROUP)

const isLord = computed(() => {
  const currentUser = groupStore.userList.find((user) => user.uid === useUserStore().userInfo?.uid)
  return currentUser?.roleId === RoleEnum.LORD
})
const isAdmin = computed(() => {
  const currentUser = groupStore.userList.find((user) => user.uid === useUserStore().userInfo?.uid)
  return currentUser?.roleId === RoleEnum.ADMIN
})

const groupMemberListSliced = computed(() => {
  const list = groupStore.memberList.slice(0, 9)
  return list
})

const avatarSrc = (url: string) => AvatarUtils.getAvatarUrl(url)

const announError = ref(false)
const announNum = ref(0)
const isAddAnnoun = ref(false)
const announList = ref<any[]>([])
const remarkValue = ref('')
const item = ref<any>(null)
const nameValue = ref('')
const avatarValue = ref('')
const nicknameValue = ref('')
const options = ref<Array<{ name: string; src: string }>>([])
const { currentSession: activeItem } = storeToRefs(globalStore)
const friend = computed(() => contactStore.contactsList.find((item) => item.uid === activeItem.value?.detailId))

// 초기값 저장, 내용 변경 여부 확인용
const initialRemarkValue = ref('')
const initialNicknameValue = ref('')
const initialNameValue = ref('')

const {
  fileInput,
  localImageUrl,
  showCropper,
  cropperRef,
  openAvatarCropper,
  handleFileChange,
  handleCrop: onCrop
} = useAvatarUpload({
  onSuccess: async (downloadUrl) => {
    avatarValue.value = downloadUrl
  }
})

const handleCrop = async (cropBlob: Blob) => {
  await onCrop(cropBlob)
}

const handleCopy = (val: string) => {
  if (val) {
    navigator.clipboard.writeText(val)
    window.$message.success(`복사 성공 ${val}`)
  }
}

const toFriendInfo = (uid: string) => {
  toFriendInfoPage(uid)
}

const toGroupChatMember = () => {
  router.push({ name: 'mobileGroupChatMember' })
}

const toInviteGroupMember = () => {
  router.push({ name: 'mobileInviteGroupMember' })
}

const toManageGroupMember = () => {
  router.push({ name: 'manageGroupMember' })
}

const goToNotice = () => {
  router.push({
    path: '/mobile/chatRoom/notice',
    query: {
      announList: JSON.stringify(announList.value),
      roomId: globalStore.currentSessionRoomId
    }
  })
}

// 로그아웃 로직
async function handleExit() {
  dialog.error({
    title: '알림',
    content: isGroup.value
      ? isLord.value
        ? '정말로 그룹을 해체하시겠습니까?'
        : '정말로 그룹을 나가시겠습니까?'
      : '친구 삭제',
    positiveText: '확인',
    negativeText: '취소',
    onPositiveClick: async () => {
      const session = activeItem.value
      if (!session) {
        window.$message.warning('현재 세션이 존재하지 않습니다')
        return
      }
      try {
        if (isGroup.value) {
          if (isLord.value) {
            if (currentSessionRoomId.value === '1') {
              window.$message.warning('채널을 해체할 수 없습니다')
              return
            }

            groupStore.exitGroup(currentSessionRoomId.value).then(() => {
              window.$message.success('그룹이 해체되었습니다')
              // 현재 세션 삭제
              useMitt.emit(MittEnum.DELETE_SESSION, currentSessionRoomId.value)
            })
          } else {
            if (currentSessionRoomId.value === '1') {
              window.$message.warning('채널을 나갈 수 없습니다')
              return
            }

            groupStore.exitGroup(currentSessionRoomId.value).then(() => {
              window.$message.success('그룹을 나갔습니다')
              // 현재 세션 삭제
              useMitt.emit(MittEnum.DELETE_SESSION, currentSessionRoomId.value)
            })
          }
        } else {
          const detailId = session.detailId
          if (!detailId) {
            window.$message.warning('친구 정보를 가져올 수 없습니다')
            return
          }
          await deleteFriend({ targetUid: detailId })
          window.$message.success('친구 삭제 성공')
        }

        router.push('/mobile/message')
      } catch (error) {
        console.error('로그인 창 생성 실패:', error)
      }
    },
    onNegativeClick: () => {
      console.log('사용자가 취소를 클릭함')
    }
  })
}

/** 현재 사용자가 id가 6인 뱃지를 가지고 있고 채널인지 확인 */
const hasBadge6 = computed(() => {
  // roomId가 "1"일 때만 뱃지 판단 (채널)
  if (globalStore.currentSessionRoomId !== '1') return false

  const currentUser = groupStore.getUserInfo(userStore.userInfo!.uid!)!
  return currentUser?.itemIds?.includes('6')
})

const clickInfo = () => {
  if (isGroup) {
    openAvatarCropper()
  } else {
    const detailId = activeItem.value?.detailId
    if (!detailId) {
      window.$message.warning('현재 세션 정보가 준비되지 않았습니다')
      return
    }
    router.push(`/mobile/mobileFriends/friendInfo/${detailId}`)
  }
}
/**
 * 그룹 공지 로드
 */
const handleLoadGroupAnnoun = async () => {
  try {
    const roomId = globalStore.currentSessionRoomId
    if (!roomId) {
      console.error('현재 세션에 roomId가 없습니다')
      return
    }
    // 공지 추가 가능 여부 설정
    isAddAnnoun.value = isLord.value || isAdmin.value || hasBadge6.value!
    // 그룹 공지 목록 가져오기
    const data = await cacheStore.getGroupAnnouncementList(roomId, 1, 10)
    if (data) {
      announList.value = data.records
      // 상단 고정 공지 처리
      if (announList.value && announList.value.length > 0) {
        const topAnnouncement = announList.value.find((item: any) => item.top)
        if (topAnnouncement) {
          announList.value = [topAnnouncement, ...announList.value.filter((item: any) => !item.top)]
        }
      }
      announNum.value = parseInt(data.total, 10)
      announError.value = false
    } else {
      announError.value = false
    }
  } catch (error) {
    console.error('그룹 공지 로드 실패:', error)
    announError.value = true
  }
}

/** 상단 고정 */
const handleTop = (value: boolean) => {
  const session = activeItem.value
  if (!session) return
  setSessionTop({ roomId: currentSessionRoomId.value, top: value })
    .then(() => {
      // 로컬 세션 상태 업데이트
      chatStore.updateSession(currentSessionRoomId.value, { top: value })
      window.$message.success(value ? '상단 고정됨' : '상단 고정 취소됨')
    })
    .catch(() => {
      window.$message.error('상단 고정 실패')
    })
}

// 그룹 메모 업데이트 처리
const handleInfoUpdate = async () => {
  // 내용이 실제로 변경되었는지 확인
  const remarkChanged = remarkValue.value !== initialRemarkValue.value
  const nicknameChanged = nicknameValue.value !== initialNicknameValue.value

  // 그룹 및 1:1 채팅의 메모, 닉네임이 모두 변경되지 않았다면 API 호출 안 함
  if (!remarkChanged && !nicknameChanged) {
    return
  }

  if (isGroup.value) {
    await persistMyRoomInfo({
      roomId: globalStore.currentSessionRoomId,
      remark: remarkValue.value,
      myName: nicknameValue.value
    })
    // 초기값 업데이트
    initialRemarkValue.value = remarkValue.value
    initialNicknameValue.value = nicknameValue.value
  } else {
    // 1:1 채팅은 메모 변경만 확인
    if (!remarkChanged) {
      return
    }

    const detailId = activeItem.value?.detailId
    if (!detailId) {
      window.$message.warning('친구 정보를 가져올 수 없습니다')
      return
    }
    await modifyFriendRemark({
      targetUid: detailId,
      remark: remarkValue.value
    })

    if (friend.value) {
      friend.value.remark = remarkValue.value
    }
    // 초기값 업데이트
    initialRemarkValue.value = remarkValue.value
  }
  window.$message.success(title.value + '메모 업데이트 성공')
}

// 그룹 이름 업데이트 처리
const handleGroupInfoUpdate = async () => {
  const session = activeItem.value
  if (!session) return
  // 그룹 이름이 실제로 변경되었는지 확인
  if (nameValue.value === initialNameValue.value) {
    return
  }

  await updateRoomInfo({
    id: currentSessionRoomId.value,
    name: nameValue.value,
    avatar: avatarValue.value
  })
  session.avatar = avatarValue.value

  // 초기값 업데이트
  initialNameValue.value = nameValue.value
  window.$message.success('그룹 이름 업데이트 성공')
}

// 그룹 상세 정보 및 멤버 정보 가져오기
const fetchGroupMembers = async (roomId: string) => {
  try {
    // 각 멤버의 uid를 사용하여 상세 정보 가져오기
    const userList = groupStore.getUserListByRoomId(roomId)
    const memberDetails = userList.map((member: UserItem) => {
      const userInfo = groupStore.getUserInfo(member.uid)!
      return {
        name: userInfo.name || member.name || member.uid,
        src: userInfo.avatar || member.avatar
      }
    })

    options.value = memberDetails
  } catch (error) {
    console.error('그룹 멤버 가져오기 실패:', error)
  }
}

/**
 *
 * 메시지 알림 끄기 관련 기능
 *
 *
 */

/** 메시지 차단 처리 */
const handleShield = (value: boolean) => {
  const session = activeItem.value
  if (!session) return
  shield({
    roomId: currentSessionRoomId.value,
    state: value
  })
    .then(() => {
      // 로컬 세션 상태 업데이트
      chatStore.updateSession(currentSessionRoomId.value, {
        shield: value
      })

      // 1. 현재 채팅방 ID 저장
      const tempRoomId = globalStore.currentSessionRoomId

      // 3. 다음 tick에서 원래 채팅방 ID 복원, 메시지 다시 로드 트리거
      nextTick(() => {
        globalStore.updateCurrentSessionRoomId(tempRoomId)
      })

      window.$message.success(value ? '메시지 차단됨' : '메시지 차단 해제됨')
    })
    .catch(() => {
      window.$message.error('설정 실패')
    })
}

/** 메시지 알림 끄기 처리 */
const handleNotification = (value: boolean) => {
  const session = activeItem.value
  if (!session) return
  const newType = value ? NotificationTypeEnum.NOT_DISTURB : NotificationTypeEnum.RECEPTION
  // 현재 차단 상태라면 먼저 차단 해제 필요
  if (session.shield) {
    handleShield(false)
  }
  notification({
    roomId: currentSessionRoomId.value,
    type: newType
  })
    .then(() => {
      // 로컬 세션 상태 업데이트
      chatStore.updateSession(currentSessionRoomId.value, {
        muteNotification: newType
      })

      // 알림 끄기에서 알림 허용으로 전환 시 전체 읽지 않은 수 다시 계산
      if (session.muteNotification === NotificationTypeEnum.NOT_DISTURB && newType === NotificationTypeEnum.RECEPTION) {
        chatStore.updateTotalUnreadCount()
      }

      // 알림 끄기로 설정 시 해당 세션의 읽지 않은 수는 더 이상 포함되지 않으므로 전체 읽지 않은 수 업데이트 필요
      if (newType === NotificationTypeEnum.NOT_DISTURB) {
        chatStore.updateTotalUnreadCount()
      }

      window.$message.success(value ? '메시지 수신하지만 알림 안 함' : '메시지 알림 허용')
    })
    .catch(() => {
      window.$message.error('설정 실패')
    })
}

/**
 *
 * 메시지 알림 끄기 관련 기능 (끝)
 *
 *  */

/** 채팅 내용 검색 처리 */
const handleSearchChatContent = () => {
  router.push({
    name: 'mobileSearchChatContent'
  })
}

/**
 * 여기서 상태 값을 직접 감지
 */
onMounted(async () => {
  await handleLoadGroupAnnoun()
  if (isGroup.value) {
    await getGroupDetail(globalStore.currentSessionRoomId)
      .then((response: any) => {
        item.value = response
        nameValue.value = response.groupName || ''
        avatarValue.value = response.avatar
        nicknameValue.value = response.myName || ''
        remarkValue.value = response.remark || ''

        // 초기값 저장
        initialNameValue.value = nameValue.value
        initialNicknameValue.value = nicknameValue.value
        initialRemarkValue.value = remarkValue.value
        if (item.value && item.value.roomId) {
          fetchGroupMembers(item.value.roomId)
        }
      })
      .catch((e: any) => {
        console.error('그룹 상세 정보 가져오기 실패:', e)
      })
  } else {
    // 친구 정보 가져오기 필요
    remarkValue.value = friend.value?.remark || ''
    // 초기값 저장
    initialRemarkValue.value = remarkValue.value
  }
})
</script>

<style scoped></style>
