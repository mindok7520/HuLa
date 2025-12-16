<template>
  <n-flex vertical class="select-none">
    <n-flex
      v-if="props.closeHeader === true ? false : true"
      align="center"
      justify="space-between"
      class="color-[--text-color] px-20px py-10px">
      <p class="text-16px">{{ props.type === 'friend' ? '친구 알림' : '그룹 알림' }}</p>
      <svg class="size-18px cursor-pointer">
        <use href="#delete"></use>
      </svg>
    </n-flex>

    <n-virtual-list
      :style="{
        maxHeight: props.customHeight
          ? props.customHeight + 'px'
          : 'max-height: calc(100vh / var(--page-scale, 1) - 80px)'
      }"
      :items="applyList"
      :item-size="87"
      :item-resizable="true"
      @scroll="handleScroll"
      ref="virtualListRef">
      <template #default="{ item }">
        <div class="flex gap-2 w-full text-14px mb-15px">
          <div class="flex h-full">
            <n-avatar
              round
              size="large"
              :src="
                props.type === 'friend'
                  ? avatarSrc(getUserInfo(item)?.avatar || '')
                  : avatarSrc(groupDetailsMap[item.roomId]?.avatar || '/default-group-avatar.png')
              " />
          </div>
          <div class="flex-1 flex flex-col gap-10px">
            <div
              @click="isCurrentUser(item.senderId) ? (currentUserId = item.operateId) : (currentUserId = item.senderId)"
              class="flex justify-between text-14px text-#2DA38D">
              {{ getUserInfo(item)?.name || '알 수 없는 사용자' }}
            </div>
            <div class="flex justify-between text-gray-500 text-12px">
              <span>
                {{ applyMsg(item) }}
              </span>
            </div>
            <div v-if="isFriendApplyOrGroupInvite(item)" class="flex gap-2 flex-1 text-12px text-gray-500">
              <div class="whitespace-nowrap">메시지:</div>
              <n-ellipsis :tooltip="true" expand-trigger="click" line-clamp="2" style="max-width: 100%">
                {{ item.content }}
              </n-ellipsis>
            </div>
            <div v-else class="flex gap-2 flex-1 text-12px text-gray-500">
              <div class="whitespace-nowrap">처리자:</div>
              <n-ellipsis :tooltip="true" expand-trigger="click" line-clamp="2" style="max-width: 100%">
                {{ groupStore.getUserInfo(item.senderId)?.name || '알 수 없는 사용자' }}
              </n-ellipsis>
            </div>
          </div>
          <div
            v-if="isFriendApplyOrGroupInvite(item)"
            class="flex w-17 max-h-64px flex-col items-center justify-center">
            <n-flex
              align="center"
              :size="10"
              v-if="item.status === RequestNoticeAgreeStatus.UNTREATED && !isCurrentUser(item.senderId)">
              <n-button size="small" secondary :loading="loadingMap[item.applyId]" @click="handleAgree(item)">
                수락
              </n-button>
            </n-flex>
            <n-dropdown
              trigger="click"
              :options="dropdownOptions"
              @select="(key: string) => handleFriendAction(key, item.applyId)"
              v-if="item.status === RequestNoticeAgreeStatus.UNTREATED && !isCurrentUser(item.senderId)">
              <n-icon class="cursor-pointer px-15px py-3px rounded-5px mt-10px bg-gray-300 h-50% items-center flex">
                <svg class="size-16px color-[--text-color]">
                  <use href="#more"></use>
                </svg>
              </n-icon>
            </n-dropdown>
            <span class="text-(12px #64a29c)" v-else-if="item.status === RequestNoticeAgreeStatus.ACCEPTED">
              이미 동의함
            </span>
            <span class="text-(12px #c14053)" v-else-if="item.status === RequestNoticeAgreeStatus.REJECTED">
              이미 거부함
            </span>
            <span class="text-(12px #909090)" v-else-if="item.status === RequestNoticeAgreeStatus.IGNORE">이미 무시함</span>
            <span
              class="text-(12px #64a29c)"
              :class="{ 'text-(12px #c14053)': item.status === RequestNoticeAgreeStatus.REJECTED }"
              v-else-if="isCurrentUser(item.senderId)">
              {{
                isAccepted(item)
                  ? '이미 동의함'
                  : item.status === RequestNoticeAgreeStatus.REJECTED
                    ? '상대방이 이미 거부함'
                    : '검증 대기 중'
              }}
            </span>
          </div>
        </div>
      </template>
    </n-virtual-list>

    <!-- 빈 데이터 안내 -->
    <n-flex v-if="applyList.length === 0" vertical justify="center" align="center" class="py-40px">
      <n-empty :description="props.type === 'friend' ? '친구 신청이 없습니다' : '그룹 알림이 없습니다'" />
    </n-flex>
  </n-flex>
</template>
<script setup lang="ts">
import { uniq } from 'es-toolkit'
import type { NoticeItem } from '@/services/types.ts'
import { NoticeType, RequestNoticeAgreeStatus } from '@/services/types.ts'
import { useContactStore } from '@/stores/contacts.ts'
import { useUserStore } from '@/stores/user'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { useGroupStore } from '@/stores/group'
import { getGroupInfo } from '@/utils/ImRequestUtils'

const userStore = useUserStore()
const contactStore = useContactStore()
const groupStore = useGroupStore()
const currentUserId = ref('0')
const loadingMap = ref<Record<string, boolean>>({})
const virtualListRef = ref()
const isLoadingMore = ref(false)
const props = defineProps<{
  type: 'friend' | 'group'
  customHeight?: number
  closeHeader?: boolean
}>()

// 그룹 정보를 저장하는 반응형 객체
const groupDetailsMap = ref<Record<string, any>>({})
const loadingGroups = ref<Set<string>>(new Set())

// 친구 신청이 이미 수락되었는지 확인
const isAccepted = (item: any) => {
  return item.status !== RequestNoticeAgreeStatus.UNTREATED
}

const applyList = computed(() => {
  return contactStore.requestFriendsList.filter((item) => {
    if (props.type === 'friend') {
      return item.type === 2
    } else {
      return item.type === 1
    }
  })
})

// 그룹 정보를 가져오는 함수
const getGroupDetail = async (roomId: string) => {
  if (!roomId) return null

  // 이미 로드 중이면 바로 반환
  if (loadingGroups.value.has(roomId)) {
    return null
  }

  // 이미 캐시가 있으면 바로 반환
  if (groupDetailsMap.value[roomId]) {
    return groupDetailsMap.value[roomId]
  }

  // 로드 시작
  loadingGroups.value.add(roomId)
  try {
    const groupInfo = await getGroupInfo(roomId)
    if (groupInfo) {
      groupDetailsMap.value[roomId] = groupInfo
      return groupInfo
    }
  } catch (error) {
    console.error('그룹 정보 가져오기 실패:', error)
  } finally {
    loadingGroups.value.delete(roomId)
  }

  return null
}

// 그룹 정보를 비동기로 가져오는 계산된 속성
const applyMsg = computed(() => (item: any) => {
  if (props.type === 'friend') {
    return isCurrentUser(item.senderId) ? (isAccepted(item) ? '당신의 요청에 동의함' : '당신의 초대를 검증 중') : '친구 추가 요청'
  } else {
    const groupDetail = groupDetailsMap.value[item.roomId]
    if (!groupDetail) {
      if (item.roomId && !loadingGroups.value.has(item.roomId)) {
        getGroupDetail(item.roomId)
      }
      return '로드 중...'
    }

    if (item.eventType === NoticeType.GROUP_APPLY) {
      return '가입 신청 [' + groupDetail.name + ']'
    } else if (item.eventType === NoticeType.GROUP_INVITE) {
      const inviter = groupStore.getUserInfo(item.operateId)?.name || '알 수 없는 사용자'
      return '초대' + inviter + '가입 [' + groupDetail.name + ']'
    } else if (isFriendApplyOrGroupInvite(item)) {
      return isCurrentUser(item.senderId)
        ? '가입에 동의함 [' + groupDetail.name + ']'
        : '가입 초대 [' + groupDetail.name + ']'
    } else if (item.eventType === NoticeType.GROUP_MEMBER_DELETE) {
      const operator = groupStore.getUserInfo(item.senderId)?.name || '알 수 없는 사용자'
      return '이미' + operator + '에 의해 추방됨 [' + groupDetail.name + ']'
    } else if (item.eventType === NoticeType.GROUP_SET_ADMIN) {
      return '그룹장에 의해 [' + groupDetail.name + '] 관리자로 설정됨'
    } else if (item.eventType === NoticeType.GROUP_RECALL_ADMIN) {
      return '그룹장에 의해 [' + groupDetail.name + '] 관리자 권한이 취소됨'
    }
  }
})

// 드롭다운 메뉴 옵션
const dropdownOptions = [
  {
    label: '거부',
    key: 'reject'
  },
  {
    label: '무시',
    key: 'ignore'
  }
]

const avatarSrc = (url: string) => AvatarUtils.getAvatarUrl(url)

// 현재 로그인한 사용자인지 판단
const isCurrentUser = (uid: string) => {
  return uid === userStore.userInfo!.uid
}

/**
 * 获取当前用户查询视角
 * @param item 通知消息
 */
const getUserInfo = (item: any) => {
  switch (item.eventType) {
    case NoticeType.FRIEND_APPLY:
    case NoticeType.GROUP_MEMBER_DELETE:
    case NoticeType.GROUP_SET_ADMIN:
    case NoticeType.GROUP_RECALL_ADMIN:
      return groupStore.getUserInfo(item.operateId)
    case NoticeType.ADD_ME:
    case NoticeType.GROUP_INVITE:
    case NoticeType.GROUP_INVITE_ME:
    case NoticeType.GROUP_APPLY:
      return groupStore.getUserInfo(item.senderId)
  }
}

// 친구 신청 또는 그룹 신청, 그룹 초대인지 판단
const isFriendApplyOrGroupInvite = (item: any) => {
  return (
    item.eventType === NoticeType.FRIEND_APPLY ||
    item.eventType === NoticeType.GROUP_APPLY ||
    item.eventType === NoticeType.GROUP_INVITE ||
    item.eventType === NoticeType.GROUP_INVITE_ME ||
    item.eventType === NoticeType.ADD_ME
  )
}

// 스크롤 이벤트 처리
const handleScroll = (e: Event) => {
  if (isLoadingMore.value) return

  const { scrollTop, scrollHeight, clientHeight } = e.target as HTMLElement
  // 하단 20px 이내로 스크롤할 때 더 로드 트리거
  if (scrollHeight - scrollTop - clientHeight < 20) {
    loadMoreFriendRequests()
  }
}

// 친구 신청 더 로드
const loadMoreFriendRequests = async () => {
  // 이미 마지막 페이지이거나 로드 중이면 더 이상 로드하지 않음
  if (contactStore.applyPageOptions.isLast) {
    return
  }

  isLoadingMore.value = true
  try {
    await contactStore.getApplyPage(props.type, false)
  } finally {
    isLoadingMore.value = false
  }
}

const handleAgree = async (item: NoticeItem) => {
  const applyId = item.applyId
  loadingMap.value[applyId] = true
  try {
    await contactStore.onHandleInvite({
      applyId,
      state: RequestNoticeAgreeStatus.ACCEPTED,
      roomId: item.roomId,
      type: item.type,
      applyType: props.type,
      markAsRead: true
    })
  } finally {
    setTimeout(() => {
      loadingMap.value[applyId] = false
    }, 600)
  }
}

// 친구 요청 작업 처리
const handleFriendAction = async (action: string, applyId: string) => {
  loadingMap.value[applyId] = true
  try {
    if (action === 'reject') {
      await contactStore.onHandleInvite({
        applyId,
        state: RequestNoticeAgreeStatus.REJECTED,
        applyType: props.type,
        markAsRead: true
      })
    } else if (action === 'ignore') {
      await contactStore.onHandleInvite({
        applyId,
        state: RequestNoticeAgreeStatus.IGNORE,
        applyType: props.type,
        markAsRead: true
      })
    }
  } finally {
    setTimeout(() => {
      loadingMap.value[applyId] = false
    }, 600)
  }
}

onMounted(() => {
  contactStore.getApplyPage(props.type, true)
})

// applyList 변화를 감지하여 그룹 정보를 일괄 로드
watch(
  () => applyList.value,
  (newList) => {
    const roomIds = uniq(newList.filter((item) => item.roomId && Number(item.roomId) > 0).map((item) => item.roomId))

    if (roomIds.length > 0) {
      // 그룹 정보를 일괄 로드
      roomIds.forEach((roomId) => {
        if (!groupDetailsMap.value[roomId] && !loadingGroups.value.has(roomId)) {
          getGroupDetail(roomId)
        }
      })
    }
  },
  { immediate: true, deep: true }
)
</script>

<style scoped lang="scss"></style>
