<template>
  <!-- 친구 상세 정보 -->
  <n-flex v-if="content.type === RoomTypeEnum.SINGLE" vertical align="center" :size="30" class="mt-60px">
    <n-image
      object-fit="cover"
      show-toolbar-tooltip
      preview-disabled
      width="146"
      height="146"
      style="border: 2px solid #fff"
      class="rounded-50% select-none cursor-pointer"
      :src="AvatarUtils.getAvatarUrl(item.avatar)"
      @dblclick="openImageViewer"
      alt="" />

    <span class="text-(20px [--text-color])">{{ item.name }}</span>

    <template v-if="!isBotUser">
      <span class="text-(14px #909090)">{{ t('home.chat_details.single.empty_signature') }}</span>

      <n-flex align="center" justify="space-between" :size="30" class="text-#606060 select-none cursor-default">
        <span>
          {{
            t('home.chat_details.single.region', {
              place: item.locPlace || t('home.chat_details.single.unknown')
            })
          }}
        </span>
        <n-flex align="center">
          <span>{{ t('home.chat_details.single.badge_label') }}</span>
          <template v-for="badge in item.itemIds" :key="badge">
            <n-popover trigger="hover">
              <template #trigger>
                <img class="size-34px" :src="cacheStore.badgeById(badge)?.img" alt="" />
              </template>
              <span>{{ cacheStore.badgeById(badge)?.describe }}</span>
            </n-popover>
          </template>
        </n-flex>
      </n-flex>
      <!-- 옵션 버튼 -->
      <n-flex align="center" justify="space-between" :size="60">
        <n-icon-wrapper
          v-for="(item, index) in footerOptions"
          :key="index"
          @click="item.click()"
          class="cursor-pointer"
          :size="28"
          :border-radius="10"
          :color="'#13987f'">
          <n-popover trigger="hover">
            <template #trigger>
              <n-icon :size="20">
                <svg class="color-#fff"><use :href="`#${item.url}`"></use></svg>
              </n-icon>
            </template>
            <span>{{ item.title }}</span>
          </n-popover>
        </n-icon-wrapper>
      </n-flex>
    </template>
  </n-flex>

  <!-- 그룹 채팅 상세 정보 -->
  <div
    v-else-if="content.type === RoomTypeEnum.GROUP && item"
    class="flex flex-col flex-1 mt-60px gap-30px select-none p-[0_40px] box-border">
    <!-- 그룹 채팅 아바타 및 이름 -->
    <n-flex align="center" justify="space-between" class="px-30px box-border">
      <n-flex align="center" :size="30">
        <n-image
          object-fit="cover"
          show-toolbar-tooltip
          preview-disabled
          width="106"
          height="106"
          style="border: 2px solid #fff"
          class="rounded-50% select-none cursor-pointer"
          :src="AvatarUtils.getAvatarUrl(item.avatar)"
          @dblclick="openImageViewer"
          alt="" />

        <n-flex vertical :size="16">
          <n-flex align="center" :size="12">
            <span class="text-(20px [--text-color])">{{ item.groupName }}</span>
            <n-popover trigger="hover" v-if="item.roomId === '1'">
              <template #trigger>
                <svg class="size-20px color-#13987f select-none outline-none cursor-pointer">
                  <use href="#auth"></use>
                </svg>
              </template>
              <span>{{ t('home.chat_details.group.official_badge') }}</span>
            </n-popover>
          </n-flex>
          <n-flex align="center" :size="12">
            <span class="text-(14px #909090)">{{ t('home.chat_details.group.id', { account: item.account }) }}</span>
            <n-tooltip trigger="hover">
              <template #trigger>
                <svg class="size-12px cursor-pointer color-#909090" @click="handleCopy(item.account)">
                  <use href="#copy"></use>
                </svg>
              </template>
              <span>{{ t('home.chat_details.group.copy') }}</span>
            </n-tooltip>
          </n-flex>
        </n-flex>
      </n-flex>

      <n-icon-wrapper
        @click="footerOptions[0].click()"
        class="cursor-pointer"
        :size="40"
        :border-radius="10"
        :color="'#13987f'">
        <n-icon :size="22">
          <svg class="color-#fff"><use href="#message"></use></svg>
        </n-icon>
      </n-icon-wrapper>
    </n-flex>

    <!-- 그룹 정보 목록 -->
    <n-flex vertical class="select-none w-full px-30px box-border">
      <n-flex
        align="center"
        justify="space-between"
        class="py-6px h-26px pr-4px border-b text-(14px [--chat-text-color])">
        <span>{{ t('home.chat_details.group.remark.label') }}</span>
        <div v-if="isEditingRemark" class="flex items-center">
          <n-input
            ref="remarkInputRef"
            v-model:value="item.remark"
            size="tiny"
            class="border-(1px solid #90909080)"
            :placeholder="t('home.chat_details.group.remark.placeholder')"
            clearable
            spellCheck="false"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            @blur="handleRemarkUpdate"
            @keydown.enter="handleRemarkUpdate" />
        </div>
        <span v-else class="cursor-pointer" @click="startEditRemark">
          {{ item.remark || t('home.chat_details.group.remark.empty') }}
        </span>
      </n-flex>

      <n-flex
        align="center"
        justify="space-between"
        :class="{ 'pr-4px': item.myName }"
        class="py-6px border-b h-26px text-(14px [--chat-text-color])">
        <span>{{ t('home.chat_details.group.nickname.label') }}</span>
        <div v-if="isEditingNickname" class="flex items-center">
          <n-input
            ref="nicknameInputRef"
            v-model:value="nicknameValue"
            size="tiny"
            class="border-(1px solid #90909080)"
            :placeholder="t('home.chat_details.group.nickname.placeholder')"
            clearable
            spellCheck="false"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            @blur="handleNicknameUpdate"
            @keydown.enter="handleNicknameUpdate" />
        </div>
        <span v-else class="flex items-center cursor-pointer" @click="startEditNickname">
          <p class="text-#909090">{{ displayNickname || t('home.chat_details.group.nickname.empty') }}</p>
          <n-icon v-if="!item.myName" size="16" class="ml-1">
            <svg><use href="#right"></use></svg>
          </n-icon>
        </span>
      </n-flex>

      <n-flex align="center" justify="space-between" class="py-12px border-b text-(14px [--chat-text-color])">
        <span>{{ t('home.chat_details.group.announcement.label') }}</span>
        <span class="flex items-center cursor-pointer gap-4px" @click="handleOpenAnnouncement">
          <p
            class="text-#909090 max-w-200px truncate leading-tight"
            :title="announcementContent || t('home.chat_details.group.announcement.empty')">
            {{ announcementContent || t('home.chat_details.group.announcement.empty') }}
          </p>
          <n-icon size="16">
            <svg><use href="#right"></use></svg>
          </n-icon>
        </span>
      </n-flex>
    </n-flex>

    <!-- 그룹 멤버 -->
    <n-flex vertical :size="10" class="px-30px box-border">
      <n-flex align="center" justify="space-between" class="text-(14px [--chat-text-color])">
        <span>{{ t('home.chat_details.group.members.count', { count: item.memberNum }) }}</span>
        <span class="flex items-center">
          {{ t('home.chat_details.group.members.online', { count: item.onlineNum }) }}
        </span>
      </n-flex>

      <n-flex class="pt-16px">
        <n-avatar-group :options="options" :size="40" :max="10" expand-on-hover>
          <template #avatar="{ option: { src } }">
            <n-avatar :src="AvatarUtils.getAvatarUrl(src)" />
          </template>
        </n-avatar-group>
      </n-flex>
    </n-flex>
  </div>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { CallTypeEnum, RoomTypeEnum, UserType } from '@/enums'
import { useCommon } from '@/hooks/useCommon.ts'
import { useMyRoomInfoUpdater } from '@/hooks/useMyRoomInfoUpdater'
import { useWindow } from '@/hooks/useWindow'
import type { UserItem } from '@/services/types'
import { useCachedStore } from '@/stores/cached'
import { useGroupStore } from '@/stores/group'
import { useImageViewer } from '@/stores/imageViewer'
import { useGlobalStore } from '@/stores/global'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { getGroupDetail } from '@/utils/ImRequestUtils'

const { t } = useI18n()
const { openMsgSession } = useCommon()
const { createWebviewWindow, startRtcCall } = useWindow()
const globalStore = useGlobalStore()
const IMAGEWIDTH = 630
const IMAGEHEIGHT = 660
const { content } = defineProps<{
  content: any
}>()
const item = ref<any>(null)
const options = ref<Array<{ name: string; src: string }>>([])

// 그룹 메모 편집 관련 상태
const isEditingRemark = ref(false)
const remarkInputRef = useTemplateRef('remarkInputRef')

// 그룹 닉네임 편집 관련 상태
const isEditingNickname = ref(false)
const nicknameValue = ref('')
const nicknameInputRef = useTemplateRef('nicknameInputRef')
const cacheStore = useCachedStore()
const groupStore = useGroupStore()
const { persistMyRoomInfo, resolveMyRoomNickname } = useMyRoomInfoUpdater()

const remarkSnapshot = ref('')
const nicknameSnapshot = ref('')
const announcementContent = ref('')

const loadAnnouncement = async (roomId: string) => {
  if (!roomId) {
    announcementContent.value = ''
    return
  }

  try {
    const data: any = await cacheStore.getGroupAnnouncementList(roomId, 1, 10)
    if (data && Array.isArray(data.records) && data.records.length > 0) {
      const topAnnouncement = data.records.find((item: any) => item.top)
      const targetAnnouncement = topAnnouncement || data.records[0]
      announcementContent.value = targetAnnouncement?.content || ''
    } else {
      announcementContent.value = ''
    }
  } catch (error) {
    console.error('그룹 공지 가져오기 실패:', error)
    announcementContent.value = ''
  }
}

const handleOpenAnnouncement = async () => {
  if (!item.value?.roomId) return
  await createWebviewWindow(
    t('home.chat_details.group.announcement.window_title'),
    `announList/${item.value.roomId}/1`,
    420,
    620
  )
}

const displayNickname = computed(() =>
  resolveMyRoomNickname({ roomId: item.value?.roomId, myName: item.value?.myName })
)

// BOT 사용자인지 확인
const isBotUser = computed(() => {
  if (content.type !== RoomTypeEnum.SINGLE || !item.value?.uid) return false
  return groupStore.getUserInfo(item.value.uid)?.account === UserType.BOT
})

watchEffect(async () => {
  if (content.type === RoomTypeEnum.SINGLE) {
    item.value = groupStore.getUserInfo(content.uid)!
    nicknameValue.value = ''
    remarkSnapshot.value = ''
    nicknameSnapshot.value = ''
    announcementContent.value = ''
  } else {
    await getGroupDetail(content.uid)
      .then((response: any) => {
        item.value = response
        const normalizedNickname = resolveMyRoomNickname({ roomId: response.roomId, myName: response.myName })
        const normalizedRemark = response.remark || ''
        nicknameValue.value = normalizedNickname
        nicknameSnapshot.value = normalizedNickname
        remarkSnapshot.value = normalizedRemark
        if (item.value && item.value.roomId) {
          fetchGroupMembers(item.value.roomId)
          void loadAnnouncement(item.value.roomId)
        }
      })
      .catch((e) => {
        console.error('그룹 상세 정보 가져오기 실패:', e)
        announcementContent.value = ''
      })
  }
})

// 그룹 메모 편집 시작
const startEditRemark = () => {
  remarkSnapshot.value = item.value?.remark || ''
  isEditingRemark.value = true
  nextTick(() => {
    remarkInputRef.value?.focus()
  })
}

// 그룹 메모 업데이트 처리
const handleRemarkUpdate = async () => {
  if (!item.value?.roomId) {
    isEditingRemark.value = false
    return
  }

  const previousRemark = remarkSnapshot.value || ''
  const nextRemark = item.value.remark || ''

  if (nextRemark === previousRemark) {
    isEditingRemark.value = false
    return
  }

  try {
    await persistMyRoomInfo({
      roomId: item.value.roomId,
      myName: item.value.myName || '',
      remark: nextRemark
    })
    remarkSnapshot.value = nextRemark
    window.$message.success(t('home.chat_details.group.remark.success'))
  } catch (error) {
    item.value.remark = previousRemark
    window.$message.error(t('home.chat_details.group.remark.fail'))
  } finally {
    isEditingRemark.value = false
  }
}

// 그룹 닉네임 편집 시작
const startEditNickname = () => {
  const resolved = displayNickname.value || ''
  nicknameSnapshot.value = resolved
  nicknameValue.value = resolved
  isEditingNickname.value = true
  nextTick(() => {
    nicknameInputRef.value?.focus()
  })
}

// 그룹 닉네임 업데이트 처리
const handleNicknameUpdate = async () => {
  if (!item.value?.roomId) {
    isEditingNickname.value = false
    return
  }

  const previousNickname = nicknameSnapshot.value || ''
  const nextNickname = nicknameValue.value || ''

  if (nextNickname === previousNickname) {
    nicknameValue.value = previousNickname
    isEditingNickname.value = false
    return
  }

  const originalStoredNickname = item.value.myName || ''

  try {
    await persistMyRoomInfo({
      roomId: item.value.roomId,
      myName: nextNickname,
      remark: item.value.remark || ''
    })
    item.value.myName = nextNickname
    const resolvedNickname = resolveMyRoomNickname({ roomId: item.value.roomId, myName: nextNickname })
    nicknameValue.value = resolvedNickname
    nicknameSnapshot.value = resolvedNickname
    window.$message.success(t('home.chat_details.group.nickname.success'))
  } catch (error) {
    item.value.myName = originalStoredNickname
    const fallbackNickname = resolveMyRoomNickname({
      roomId: item.value?.roomId,
      myName: originalStoredNickname
    })
    nicknameValue.value = fallbackNickname || previousNickname
    nicknameSnapshot.value = fallbackNickname || previousNickname
    window.$message.error(t('home.chat_details.group.nickname.fail'))
  } finally {
    isEditingNickname.value = false
  }
}

// 복사
const handleCopy = (account: string) => {
  if (account) {
    navigator.clipboard.writeText(account)
    window.$message.success(t('home.chat_details.group.copy_success', { account }))
  }
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

const handleStartCall = async (callType: CallTypeEnum) => {
  if (content.type !== RoomTypeEnum.SINGLE) {
    window.$message.warning(t('home.chat_details.single.call_only_single'))
    return
  }

  const targetUid = item.value?.uid
  if (!targetUid) {
    window.$message.error(t('home.chat_details.single.friend_info_missing'))
    return
  }

  if (globalStore.currentSession?.detailId !== targetUid) {
    await Promise.resolve(openMsgSession(targetUid, RoomTypeEnum.SINGLE))
    await nextTick()
  }

  startRtcCall(callType)
}

const footerOptions = computed<OPT.Details[]>(() => {
  const sessionType = content.type

  return [
    {
      url: 'message',
      title: t('home.chat_details.actions.message'),
      click: () => {
        if (sessionType === RoomTypeEnum.GROUP) {
          const roomId = item.value?.roomId
          if (!roomId) {
            window.$message.error(t('home.chat_details.group.info_missing'))
            return
          }
          openMsgSession(roomId, sessionType)
        } else {
          const uid = item.value?.uid
          if (!uid) {
            window.$message.error(t('home.chat_details.single.friend_info_missing'))
            return
          }
          openMsgSession(uid, sessionType)
        }
      }
    },
    ...(sessionType === RoomTypeEnum.SINGLE
      ? [
          {
            url: 'phone-telephone',
            title: t('home.chat_details.single.footer.audio_call'),
            click: () => handleStartCall(CallTypeEnum.AUDIO)
          },
          {
            url: 'video-one',
            title: t('home.chat_details.single.footer.video_call'),
            click: () => handleStartCall(CallTypeEnum.VIDEO)
          }
        ]
      : [])
  ]
})

// 이미지 뷰어 열기
const openImageViewer = async () => {
  try {
    const imageViewerStore = useImageViewer()
    // 단일 이미지 모드로 설정하고 이미지 URL 전달
    imageViewerStore.setSingleImage(AvatarUtils.getAvatarUrl(item.value.avatar))

    // 계산된 크기를 사용하여 창 생성
    await createWebviewWindow(
      t('home.chat_details.window.image_viewer'),
      'imageViewer',
      IMAGEWIDTH,
      IMAGEHEIGHT,
      '',
      true,
      IMAGEWIDTH,
      IMAGEHEIGHT
    )
  } catch (error) {
    console.error('이미지 뷰어 열기 실패:', error)
  }
}
</script>

<style scoped></style>
