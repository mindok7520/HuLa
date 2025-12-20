<template>
  <n-flex vertical class="select-none">
    <n-flex align="center" justify="space-between" class="color-[--text-color] px-20px py-10px">
      <p class="text-16px">
        {{ t(props.type === 'friend' ? 'home.apply_list.friend_notice' : 'home.apply_list.group_notice') }}
      </p>
    </n-flex>

    <n-virtual-list
      style="max-height: calc(100vh / var(--page-scale, 1) - 80px)"
      :items="applyList"
      :item-size="102"
      :item-resizable="true"
      @scroll="handleScroll"
      ref="virtualListRef">
      <template #default="{ item }">
        <n-flex vertical :size="10" class="p-[10px_30px] box-border">
          <n-flex
            align="center"
            justify="space-between"
            :size="10"
            class="bg-[--center-bg-color] rounded-10px p-20px box-border border-(1px solid [--bg-popover])">
            <n-flex align="center" :size="10" class="min-w-0 flex-1">
              <n-avatar
                round
                size="large"
                :src="
                  props.type === 'friend'
                    ? avatarSrc(getUserInfo(item)?.avatar || '')
                    : avatarSrc(groupDetailsMap[item.roomId]?.avatar || '/default-group-avatar.png')
                "
                class="mr-10px" />
              <n-flex vertical :size="12" class="min-w-0 flex-1">
                <n-flex align="center" :size="10" class="min-w-0 flex-1 gap-10px">
                  <p
                    @click="
                      isCurrentUser(item.senderId) ? (currentUserId = item.operateId) : (currentUserId = item.senderId)
                    "
                    class="text-(14px #13987f) cursor-pointer shrink-0 max-w-150px truncate">
                    {{
                      item.eventType === NoticeType.GROUP_MEMBER_DELETE && item.operateId == item.receiverId
                        ? t('home.apply_list.you')
                        : getUserInfo(item)?.name || t('home.apply_list.unknown_user')
                    }}
                  </p>

                  <div class="flex items-center min-w-0 flex-1 gap-6px">
                    <p class="text-(14px [--text-color]) min-w-0 truncate whitespace-nowrap">
                      {{ applyMsg(item) }}
                    </p>

                    <p class="text-(10px #909090) shrink-0 whitespace-nowrap">{{ formatTimestamp(item.createTime) }}</p>
                  </div>
                </n-flex>
                <p
                  :title="t('home.apply_list.message_label') + item.content"
                  v-if="isFriendApplyOrGroupInvite(item)"
                  class="text-(12px [--text-color]) cursor-default w-340px truncate">
                  {{ t('home.apply_list.message_label') }}{{ item.content }}
                </p>
                <p v-else class="text-(12px [--text-color])">
                  {{
                    t('home.apply_list.handler_label', {
                      name: groupStore.getUserInfo(item.senderId)?.name || t('home.apply_list.unknown_user')
                    })
                  }}
                </p>
              </n-flex>
            </n-flex>

            <div v-if="isFriendApplyOrGroupInvite(item)" class="shrink-0 flex items-center gap-10px">
              <n-flex
                align="center"
                :size="10"
                class="shrink-0"
                v-if="item.status === RequestNoticeAgreeStatus.UNTREATED && !isCurrentUser(item.senderId)">
                <n-button secondary :loading="loadingMap[item.applyId]" @click="handleAgree(item)">
                  {{ t('home.apply_list.accept') }}
                </n-button>
                <n-dropdown
                  trigger="click"
                  :options="dropdownOptions"
                  @select="(key: string) => handleFriendAction(key, item.applyId)">
                  <n-icon class="cursor-pointer px-6px">
                    <svg class="size-16px color-[--text-color]">
                      <use href="#more"></use>
                    </svg>
                  </n-icon>
                </n-dropdown>
              </n-flex>
              <span class="text-(12px #64a29c)" v-else-if="item.status === RequestNoticeAgreeStatus.ACCEPTED">
                {{ t('home.apply_list.status.accepted') }}
              </span>
              <span class="text-(12px #c14053)" v-else-if="item.status === RequestNoticeAgreeStatus.REJECTED">
                {{ t('home.apply_list.status.rejected') }}
              </span>
              <span class="text-(12px #909090)" v-else-if="item.status === RequestNoticeAgreeStatus.IGNORE">
                {{ t('home.apply_list.status.ignored') }}
              </span>
              <span
                class="text-(12px #64a29c)"
                :class="{ 'text-(12px #c14053)': item.status === RequestNoticeAgreeStatus.REJECTED }"
                v-else-if="isCurrentUser(item.senderId)">
                {{
                  isAccepted(item)
                    ? t('home.apply_list.status.accepted')
                    : item.status === RequestNoticeAgreeStatus.REJECTED
                      ? t('home.apply_list.status.rejected_by_other')
                      : t('home.apply_list.status.pending')
                }}
              </span>
            </div>
          </n-flex>
        </n-flex>
      </template>
    </n-virtual-list>

    <!-- 빈 데이터 안내 -->
    <n-flex v-if="applyList.length === 0" vertical justify="center" align="center" class="py-40px">
      <n-empty
        :description="t(props.type === 'friend' ? 'home.apply_list.empty_friend' : 'home.apply_list.empty_group')" />
    </n-flex>
  </n-flex>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { uniq } from 'es-toolkit'
import type { NoticeItem } from '@/services/types.ts'
import { NoticeType, RequestNoticeAgreeStatus } from '@/services/types.ts'
import { useContactStore } from '@/stores/contacts.ts'
import { useUserStore } from '@/stores/user'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { formatTimestamp } from '@/utils/ComputedTime.ts'
import { useGroupStore } from '@/stores/group'
import { getGroupInfo } from '@/utils/ImRequestUtils'

const userStore = useUserStore()
const contactStore = useContactStore()
const groupStore = useGroupStore()
const { t } = useI18n()
const currentUserId = ref('0')
const loadingMap = ref<Record<string, boolean>>({})
const virtualListRef = ref()
const isLoadingMore = ref(false)
const props = defineProps<{
  type: 'friend' | 'group'
}>()

// 신규: 그룹 정보를 저장하는 반응형 객체
const groupDetailsMap = ref<Record<string, any>>({})
const loadingGroups = ref<Set<string>>(new Set())

// 친구 신청이 수락되었는지 확인
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

// 신규: 그룹 정보를 가져오는 함수
const getGroupDetail = async (roomId: string) => {
  if (!roomId) return null

  // 이미 로딩 중이면 그대로 반환
  if (loadingGroups.value.has(roomId)) {
    return null
  }

  // 이미 캐시가 있으면 그대로 반환
  if (groupDetailsMap.value[roomId]) {
    return groupDetailsMap.value[roomId]
  }

  // 로딩 시작
  loadingGroups.value.add(roomId)
  try {
    const groupInfo = await getGroupInfo(roomId)
    if (groupInfo) {
      groupDetailsMap.value[roomId] = groupInfo
      return groupInfo
    }
  } catch (error) {
    console.error('그룹 정보를 가져오지 못했습니다:', error)
  } finally {
    loadingGroups.value.delete(roomId)
  }

  return null
}

// 비동기로 그룹 정보를 가져오는 계산 속성
const applyMsg = computed(() => (item: NoticeItem) => {
  if (props.type === 'friend') {
    return isCurrentUser(item.senderId)
      ? isAccepted(item)
        ? t('home.apply_list.friend.accepted_you')
        : t('home.apply_list.friend.pending')
      : t('home.apply_list.friend.request')
  }

  const groupDetail = groupDetailsMap.value[item.roomId]
  if (!groupDetail) {
    if (item.roomId && !loadingGroups.value.has(item.roomId)) {
      void getGroupDetail(item.roomId)
    }
    return t('home.apply_list.group.loading')
  }

  const groupName = groupDetail.name?.toString() ?? ''
  if (item.eventType === NoticeType.GROUP_APPLY) {
    return t('home.apply_list.group.apply', { group: groupName })
  }
  if (item.eventType === NoticeType.GROUP_INVITE) {
    const inviterName = item.operateId ? groupStore.getUserInfo(item.operateId)?.name : undefined
    return t('home.apply_list.group.invite', {
      name: inviterName ?? t('home.apply_list.unknown_user'),
      group: groupName
    })
  }
  if (isFriendApplyOrGroupInvite(item)) {
    return isCurrentUser(item.senderId)
      ? t('home.apply_list.group.invite_confirmed', { group: groupName })
      : t('home.apply_list.group.invite_you', { group: groupName })
  }
  if (item.eventType === NoticeType.GROUP_MEMBER_DELETE) {
    const operatorName = item.senderId ? groupStore.getUserInfo(item.senderId)?.name : undefined
    return t('home.apply_list.group.kicked', {
      operator: operatorName ?? t('home.apply_list.unknown_user'),
      group: groupName
    })
  }
  if (item.eventType === NoticeType.GROUP_SET_ADMIN) {
    return t('home.apply_list.group.set_admin', { group: groupName })
  }
  if (item.eventType === NoticeType.GROUP_RECALL_ADMIN) {
    return t('home.apply_list.group.remove_admin', { group: groupName })
  }
  return ''
})

// 드롭다운 메뉴 옵션
const dropdownOptions = computed(() => [
  {
    label: t('home.apply_list.dropdown.reject'),
    key: 'reject'
  },
  {
    label: t('home.apply_list.dropdown.ignore'),
    key: 'ignore'
  }
])

const avatarSrc = (url: string) => AvatarUtils.getAvatarUrl(url)

// 현재 로그인한 사용자인지 판단
const isCurrentUser = (uid: string) => {
  return uid === userStore.userInfo!.uid
}

/**
 * 현재 사용자 조회 시점의 정보 획득
 * @param item 알림 메시지
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

// 친구 신청, 그룹 신청 또는 그룹 초대인지 판단
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
  // 바닥에서 20px 이내로 스크롤되면 더 불러오기 트리거
  if (scrollHeight - scrollTop - clientHeight < 20) {
    loadMoreFriendRequests()
  }
}

// 친구 신청 더 불러오기
const loadMoreFriendRequests = async () => {
  // 마지막 페이지거나 로딩 중이면 더 이상 불러오지 않음
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

// 친구 요청 처리(거절 또는 무시)
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
  // 컴포넌트 마운트 시 목록 새로고침
  contactStore.getApplyPage(props.type, true)
})

// applyList 변경 감지, 그룹 정보 일괄 로드
watch(
  () => applyList.value,
  (newList) => {
    const roomIds = uniq(newList.filter((item) => item.roomId && Number(item.roomId) > 0).map((item) => item.roomId))

    if (roomIds.length > 0) {
      // 그룹 정보 일괄 로드
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
