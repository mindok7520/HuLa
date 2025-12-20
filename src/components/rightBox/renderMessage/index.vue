<template>
  <component
    v-memo="[
      message.message.id,
      message.message.status,
      message.message.body?.translatedText?.text || '',
      uploadProgress,
      searchKeyword,
      historyMode
    ]"
    v-if="historyMode || !hasBubble(message.message.type)"
    :is="componentMap[message.message.type]"
    :body="message.message.body"
    :message-status="message.message.status"
    :upload-progress="uploadProgress"
    :from-user-uid="fromUser?.uid"
    :message="message.message"
    :data-message-id="message.message.id"
    :is-group="isGroup"
    :on-image-click="onImageClick"
    :onVideoClick="onVideoClick"
    :search-keyword="searchKeyword"
    :history-mode="historyMode" />

  <!-- 친구 또는 그룹 채팅 정보 -->
  <div v-else class="flex flex-col w-full" :class="{ 'justify-end': isMe }">
    <!-- 메시지 시간(개인 채팅) -->
    <div
      v-if="!isGroup"
      class="text-(12px #909090) h-12px flex select-none"
      :class="{
        'pr-48px justify-end': isMe,
        'pl-42px justify-start': !isMe
      }">
      <Transition name="fade-single">
        <span v-if="hoverMsgId === message.message.id">
          {{ formatTimestamp(message.message.sendTime, true) }}
        </span>
      </Transition>
    </div>
    <div class="flex justify-center items-center">
      <n-checkbox
        v-model:checked="message.isCheck"
        v-if="chatStore.isMsgMultiChoose && chatStore.msgMultiChooseMode !== 'forward' && !isMultiSelectDisabled"
        class="mr-3 select-none"
        :focusable="false"
        @click.stop />
      <div class="flex items-start flex-1" :class="isMe ? 'flex-row-reverse' : ''">
        <!-- 답장 메시지 표시 화살표 -->
        <svg
          v-if="activeReply === message.message.id"
          class="size-16px pt-4px color-#909090"
          :class="isMe ? 'ml-8px' : 'mr-8px'">
          <use :href="isMe ? `#corner-down-left` : `#corner-down-right`"></use>
        </svg>
        <!-- 아바타 -->
        <n-popover
          :ref="(el: any) => el && (infoPopoverRefs[message.message.id] = el)"
          @update:show="handlePopoverUpdate(message.message.id, $event)"
          trigger="click"
          placement="right"
          :show-arrow="false"
          style="padding: 0; background: var(--bg-info)">
          <template #trigger>
            <ContextMenu
              @select="$event.click(message, 'Main')"
              :content="message"
              :menu="isGroup ? optionsList : void 0"
              :special-menu="report">
              <!-- 아바타가 있을 때 표시 -->
              <n-avatar
                round
                :size="34"
                @click="handleAvatarClick(message.fromUser.uid, message.message.id)"
                class="select-none"
                :color="themes.content === ThemeEnum.DARK ? '' : '#fff'"
                :fallback-src="themes.content === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'"
                :src="getAvatarSrc(message.fromUser.uid)"
                :class="isMe ? '' : 'mr-10px'" />
            </ContextMenu>
          </template>
          <!-- 사용자 개인 정보 창 -->
          <InfoPopover v-if="selectKey === message.message.id" :uid="fromUser.uid" />
        </n-popover>

        <n-flex vertical :size="6" class="color-[--text-color] flex-1" :class="isMe ? 'items-end mr-10px' : ''">
          <n-flex :size="6" align="center" :style="isMe ? 'flex-direction: row-reverse' : ''">
            <ContextMenu
              @select="$event.click(message, 'Main')"
              :content="message"
              :menu="isGroup ? optionsList : void 0"
              :special-menu="report">
              <n-flex
                :size="6"
                class="select-none cursor-default"
                align="center"
                v-if="isGroup"
                :style="isMe ? 'flex-direction: row-reverse' : ''">
                <!-- 사용자 휘장 -->
                <n-popover
                  v-if="
                    globalStore.currentSessionRoomId === '1' &&
                    cachedStore.badgeById(groupStore.getUserInfo(fromUser.uid)?.wearingItemId)?.img
                  "
                  trigger="hover">
                  <template #trigger>
                    <n-avatar
                      class="select-none"
                      :size="18"
                      round
                      :fallback-src="themes.content === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'"
                      :src="cachedStore.badgeById(groupStore.getUserInfo(fromUser.uid)?.wearingItemId)?.img" />
                  </template>
                  <span>
                    {{ cachedStore.badgeById(groupStore.getUserInfo(fromUser.uid)?.wearingItemId)?.describe }}
                  </span>
                </n-popover>
                <!-- 사용자 이름 -->
                <span
                  :class="[
                    'text-12px select-none color-#909090 inline-block align-top',
                    !isMe ? 'cursor-pointer hover:color-#13987f transition-colors' : ''
                  ]"
                  @click.stop="handleMentionUser">
                  {{ senderDisplayName }}
                </span>
                <!-- 메시지 소속 지역 -->
                <span v-if="senderLocPlace" class="text-(12px #909090)">({{ senderLocPlace }})</span>
              </n-flex>
            </ContextMenu>
            <!-- 그룹 소유자 -->
            <div
              v-if="groupStore.isCurrentLord(fromUser.uid)"
              class="flex px-4px py-3px rounded-4px bg-#d5304f30 size-fit select-none">
              <span class="text-(9px #d5304f)">{{ t('home.chat_sidebar.roles.owner') }}</span>
            </div>
            <!-- 관리자 -->
            <div
              v-if="groupStore.isAdmin(fromUser.uid)"
              class="flex px-4px py-3px rounded-4px bg-#1a7d6b30 size-fit select-none">
              <span class="text-(9px #008080)">{{ t('home.chat_sidebar.roles.admin') }}</span>
            </div>
            <!-- 메시지 시간(그룹 채팅) -->
            <Transition name="fade-group">
              <span v-if="isGroup && hoverMsgId === message.message.id" class="text-(12px #909090) select-none">
                {{ formatTimestamp(message.message.sendTime, true) }}
              </span>
            </Transition>
          </n-flex>
          <!--  말풍선 스타일  -->
          <ContextMenu
            v-on-long-press="[(e) => handleLongPress(e, handleItemType(message.message.type)), longPressOption]"
            :content="message"
            @mousedown.right="recordSelectionBeforeContext"
            @contextmenu="handleContextMenuSelection"
            @mouseenter="() => (hoverMsgId = message.message.id)"
            @mouseleave="() => (hoverMsgId = '')"
            class="relative flex flex-col chat-message-max-width"
            :data-key="isMe ? `U${message.message.id}` : `Q${message.message.id}`"
            :class="[isMe ? 'items-end' : 'items-start', isMobile() ? 'w-full max-w-full' : '']"
            :style="{ '--bubble-max-width': bubbleMaxWidth }"
            @select="$event.click(message, 'Main')"
            :menu="handleItemType(message.message.type)"
            :emoji="emojiList"
            :special-menu="specialMenuList(message.message.type)"
            @reply-emoji="handleEmojiSelect($event, message)"
            @click="handleMsgClick(message)">
            <component
              v-memo="[
                message.message.id,
                message.message.status,
                message.message.body?.translatedText?.text || '',
                uploadProgress,
                searchKeyword,
                historyMode
              ]"
              :class="[
                message.message.type === MsgEnum.VOICE ? 'select-none cursor-pointer' : 'select-text cursor-text',
                !isSpecialMsgType(message.message.type) ? (isMe ? 'bubble-oneself' : 'bubble') : '',
                {
                  active:
                    activeBubble === message.message.id &&
                    !isSpecialMsgType(message.message.type) &&
                    message.message.type !== MsgEnum.VOICE &&
                    !isMobile()
                }
              ]"
              :is="componentMap[message.message.type]"
              :body="message.message.body"
              :message-status="message.message.status"
              :upload-progress="uploadProgress"
              :from-user-uid="fromUser?.uid"
              :message="message.message"
              :data-message-id="message.message.id"
              :is-group="isGroup"
              :on-image-click="onImageClick"
              :onVideoClick="onVideoClick"
              :search-keyword="searchKeyword"
              :history-mode="historyMode" />

            <!-- 번역 텍스트 표시 -->
            <Transition name="fade-translate" appear mode="out-in">
              <div v-if="message.message.body.translatedText" class="translated-text cursor-default flex flex-col">
                <n-flex align="center" justify="space-between" class="mb-6px">
                  <n-flex align="center" :size="4">
                    <span class="text-(12px #909090)">{{ message.message.body.translatedText.provider }}</span>
                    <svg class="size-12px">
                      <use href="#success"></use>
                    </svg>

                    <n-tooltip trigger="hover">
                      <template #trigger>
                        <svg
                          class="pl-6px size-10px cursor-pointer hover:color-#909090 hover:transition-colors"
                          @click="handleCopyTranslation(message.message.body.translatedText.text)">
                          <use href="#copy"></use>
                        </svg>
                      </template>
                      <span>번역 복사</span>
                    </n-tooltip>
                  </n-flex>
                  <svg class="size-10px cursor-pointer" @click="message.message.body.translatedText = null">
                    <use href="#close"></use>
                  </svg>
                </n-flex>
                <p class="select-text cursor-text">{{ message.message.body.translatedText.text }}</p>
              </div>
            </Transition>

            <!-- 메시지 상태 표시기 -->
            <div v-if="isMe" class="absolute -left-6 top-2">
              <n-icon v-if="message.message.status === MessageStatusEnum.SENDING" class="text-gray-400">
                <img class="size-16px" src="@/assets/img/loading-one.svg" alt="" />
              </n-icon>
              <n-icon
                v-if="message.message.status === MessageStatusEnum.FAILED"
                class="text-#d5304f cursor-pointer"
                @click.stop="handleRetry(message)">
                <svg class="size-16px">
                  <use href="#cloudError"></use>
                </svg>
              </n-icon>
            </div>
          </ContextMenu>

          <!-- 답장 내용 -->
          <n-flex
            align="center"
            :size="6"
            v-if="message.message.body.reply"
            @click="emit('jump2Reply', message.message.body.reply.id)"
            :class="isMobile() ? 'bg-#fafafa text-13px' : 'bg-[--right-chat-reply-color] text-12px'"
            class="reply-bubble relative w-fit custom-shadow select-none chat-message-max-width"
            :style="{ 'max-width': bubbleMaxWidth }">
            <svg class="size-14px">
              <use href="#to-top"></use>
            </svg>
            <n-avatar
              class="reply-avatar"
              round
              :size="20"
              :color="themes.content === ThemeEnum.DARK ? '' : '#fff'"
              :fallback-src="themes.content === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'"
              :src="getAvatarSrc(message.message.body.reply.uid)" />
            <span>{{ `${message.message.body.reply.username}: ` }}</span>
            <span class="content-span">
              {{ message.message.body.reply.body }}
            </span>
            <div v-if="message.message.body.reply.imgCount" class="reply-img-sub">
              {{ message.message.body.reply.imgCount }}
            </div>
          </n-flex>

          <!-- 모든 답장 이모지 반응 동적 렌더링 -->
          <div
            v-if="message.message"
            class="flex-y-center gap-6px flex-wrap w-270px"
            :class="{ 'justify-end': isSingleLineEmojis(message) }">
            <template v-for="emoji in emojiList" :key="emoji.value">
              <!-- 이모지 유형에 따른 해당 카운트 속성명 가져오기 -->
              <div class="flex-y-center" v-if="message && getEmojiCount(message, emoji.value) > 0">
                <div
                  class="emoji-reply-bubble"
                  :class="{ 'emoji-reply-bubble--active': hasUserMarkedEmoji(message, emoji.value) }"
                  @click.stop="message && cancelReplyEmoji(message, emoji.value)">
                  <img :title="emoji.title" class="size-18px" :src="emoji.url" :alt="emoji.title" />
                  <span :class="hasUserMarkedEmoji(message, emoji.value) ? 'text-#fbb160' : 'text-(12px #eee)'">
                    {{ message ? getEmojiCount(message, emoji.value) : 0 }}
                  </span>
                </div>
              </div>
            </template>
          </div>
        </n-flex>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import type { Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { MessageStatusEnum, MittEnum, MsgEnum, ThemeEnum } from '@/enums'
import { chatMainInjectionKey, useChatMain } from '@/hooks/useChatMain'
import { useMitt } from '@/hooks/useMitt'
import { usePopover } from '@/hooks/usePopover'
import type { MessageType } from '@/services/types'
import { useCachedStore } from '@/stores/cached'
import { useGlobalStore } from '@/stores/global'
import { useGroupStore } from '@/stores/group'
import { useSettingStore } from '@/stores/setting'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { formatTimestamp } from '@/utils/ComputedTime.ts'
import { isMessageMultiSelectEnabled } from '@/utils/MessageSelect'
import { useChatStore } from '@/stores/chat'
import { useUserStore } from '@/stores/user'
import { markMsg, getUserByIds } from '@/utils/ImRequestUtils'
import { createMacContextSelectionGuard } from '@/utils/MacSelectionGuard'
import { isMobile } from '@/utils/PlatformConstants'
import Announcement from './Announcement.vue'
import AudioCall from './AudioCall.vue'
import Emoji from './Emoji.vue'
import File from './File.vue'
import Image from './Image.vue'
import Location from './Location.vue'
import MergeMessage from './MergeMessage.vue'
import BotMessage from './special/BotMessage.vue'
import RecallMessage from './special/RecallMessage.vue'
import SystemMessage from './special/SystemMessage.vue'
import Text from './Text.vue'
import Video from './Video.vue'
import VideoCall from './VideoCall.vue'
import Voice from './Voice.vue'
import { toFriendInfoPage } from '@/utils/RouterUtils'
import { vOnLongPress } from '@vueuse/components'

const props = withDefaults(
  defineProps<{
    message: MessageType
    uploadProgress?: number
    isGroup: boolean
    fromUser: {
      uid: string
    }
    onImageClick?: (url: string) => void
    onVideoClick?: (url: string) => void
    searchKeyword?: string
    historyMode?: boolean
  }>(),
  {
    historyMode: false
  }
)

const emit = defineEmits(['jump2Reply'])
const { t } = useI18n()
const globalStore = useGlobalStore()
const selectKey = ref(props.fromUser!.uid)
const infoPopoverRefs = reactive<Record<string, any>>({})
const { handlePopoverUpdate } = usePopover(selectKey, 'image-chat-main')

const userStore = useUserStore()
// 반응형 상태 변수
const activeReply = ref<string>('')
const hoverMsgId = ref<string>('')
const settingStore = useSettingStore()
const { themes } = storeToRefs(settingStore)
const injectedChatMain = inject(chatMainInjectionKey, null)
const chatMainApi = injectedChatMain ?? useChatMain()
const { optionsList, report, activeBubble, handleItemType, emojiList, specialMenuList, handleMsgClick } = chatMainApi
const groupStore = useGroupStore()
const chatStore = useChatStore()
const cachedStore = useCachedStore()
const resolvingUserSet = new Set<string>()
const isMultiSelectDisabled = computed(() => !isMessageMultiSelectEnabled(props.message.message.type))
const bubbleMaxWidth = computed(() => {
  if (isMobile()) {
    return '84%'
  }
  return props.isGroup ? '32vw' : '50vw'
})

const { recordSelectionBeforeContext, handleContextMenuSelection } = createMacContextSelectionGuard({
  lockSelector: '.chat-message-max-width'
})

const handleAvatarClick = (uid: string, msgId: string) => {
  if (isMobile()) {
    toFriendInfoPage(uid)
  } else {
    selectKey.value = msgId
  }
}

const handleMentionUser = () => {
  if (!props.isGroup || isMe.value) return
  const targetUid = props.fromUser?.uid
  if (!targetUid) return
  useMitt.emit(MittEnum.AT, targetUid)
}

// 사용자 아바타 가져오기
const getAvatarSrc = computed(() => (uid: string) => {
  const isCurrentUser = uid === userStore.userInfo?.uid
  const storeUser = groupStore.getUserInfo(uid)
  if (isMe.value && isCurrentUser) {
    return AvatarUtils.getAvatarUrl(userStore.userInfo!.avatar as string)
  }
  const resolvedAvatar = storeUser?.avatar || (uid === props.fromUser.uid ? props.message.fromUser.avatar : '')
  return AvatarUtils.getAvatarUrl(resolvedAvatar as string)
})

const senderDisplayName = computed(() => {
  const displayName = groupStore.getUserDisplayName(props.fromUser.uid)
  if (displayName) {
    return displayName
  }

  const storeUser = groupStore.getUserInfo(props.fromUser.uid)
  if (storeUser?.myName || storeUser?.name) {
    return storeUser.myName || storeUser.name || ''
  }

  return props.message.fromUser.username || '알 수 없는 사용자'
})

const ensureSenderInfo = async (uid: string) => {
  if (!uid || resolvingUserSet.has(uid)) return
  const cachedUser = groupStore.getUserInfo(uid)
  if (cachedUser?.name || cachedUser?.myName || cachedUser?.avatar) return
  const roomId = props.message?.message?.roomId
  if (!roomId) return
  resolvingUserSet.add(uid)
  try {
    const users = await getUserByIds([uid])
    const user = Array.isArray(users) ? users[0] : null
    if (user?.uid) {
      // 누락된 사용자 정보를 메시지가 속한 방에 기록하여 다른 방을 오염시키거나 결과를 버리지 않도록 함
      groupStore.updateUserItem(user.uid, user, roomId)
    }
  } catch (error) {
    console.error('[Message] 누락된 사용자 정보 가져오기 실패:', error)
  } finally {
    resolvingUserSet.delete(uid)
  }
}

watchEffect(() => {
  if (!senderDisplayName.value || senderDisplayName.value === '알 수 없는 사용자') {
    ensureSenderInfo(props.fromUser.uid)
  }
})

const senderLocPlace = computed(() => {
  const storeLocPlace = groupStore.getUserInfo(props.fromUser.uid)?.locPlace
  if (storeLocPlace) {
    return storeLocPlace
  }
  return props.message.fromUser.locPlace || ''
})

const componentMap: Partial<Record<MsgEnum, Component>> = {
  [MsgEnum.TEXT]: Text,
  [MsgEnum.IMAGE]: Image,
  [MsgEnum.EMOJI]: Emoji,
  [MsgEnum.VIDEO]: Video,
  [MsgEnum.VOICE]: Voice,
  [MsgEnum.FILE]: File,
  [MsgEnum.NOTICE]: Announcement,
  [MsgEnum.VIDEO_CALL]: VideoCall,
  [MsgEnum.AUDIO_CALL]: AudioCall,
  [MsgEnum.SYSTEM]: SystemMessage,
  [MsgEnum.RECALL]: RecallMessage,
  [MsgEnum.BOT]: BotMessage,
  [MsgEnum.MERGE]: MergeMessage,
  [MsgEnum.LOCATION]: Location
}

const isSpecialMsgType = (type: number): boolean => {
  return (
    type === MsgEnum.IMAGE ||
    type === MsgEnum.EMOJI ||
    type === MsgEnum.NOTICE ||
    type === MsgEnum.VIDEO ||
    type === MsgEnum.FILE ||
    type === MsgEnum.MERGE ||
    type === MsgEnum.LOCATION
  )
}

// 이모지 반응이 한 줄인지 판단
const isSingleLineEmojis = (item: MessageType): boolean => {
  if (!item || !item.fromUser || !item.message) return false

  // 이모지 반응 개수 계산
  let emojiCount = 0
  for (const emoji of emojiList.value) {
    if (getEmojiCount(item, emoji.value) > 0) {
      emojiCount++
    }
  }

  // 이모지 개수가 3개 이하이면 한 줄로 간주 (UI에 따라 조정 가능)
  // 이 임계값은 실제 UI에 따라 조정될 수 있음
  return isMe.value && emojiCount <= 5
}

// 이모지 반응 취소
const cancelReplyEmoji = async (item: MessageType, type: number): Promise<void> => {
  if (!item || !item.message || !item.message.messageMarks) return

  // 현재 사용자가 해당 이모지를 표시했는지 확인
  const userMarked = item.message.messageMarks[String(type)]?.userMarked

  // 사용자가 표시한 경우에만 취소 요청 전송
  if (userMarked) {
    try {
      const data = {
        msgId: item.message.id,
        markType: type, // 해당 MarkEnum 유형 사용
        actType: 2 // Confirm을 동작 유형으로 사용
      }
      await markMsg(data)
    } catch (error) {
      console.error('이모지 표시 취소 실패:', error)
    }
  }
}

/**
 * 이모지 유형에 따라 해당 카운트 가져오기
 * @param item 메시지 항목
 * @param emojiType 이모지 유형 값
 * @returns 카운트 값
 */
const getEmojiCount = (item: MessageType, emojiType: number): number => {
  if (!item || !item.message || !item.message.messageMarks) return 0

  // messageMarks는 객체이며, 키는 이모지 유형, 값은 count와 userMarked를 포함하는 객체입니다.
  // 해당 이모지 유형의 통계 데이터가 있으면 카운트 값을 반환하고, 없으면 0을 반환합니다.
  return item.message.messageMarks[String(emojiType)]?.count || 0
}

// 현재 로그인한 사용자가 표시했는지 여부
const hasUserMarkedEmoji = (item: MessageType, emojiType: number) => {
  if (!item || !item.message || !item.message.messageMarks) return false

  return item.message.messageMarks[String(emojiType)]?.userMarked
}

const handleRetry = (item: MessageType): void => {
  // TODO: 재전송 로직 구현
  console.log('메시지 재전송 시도:', item)
}

// 번역 텍스트 복사 처리
const handleCopyTranslation = (text: string) => {
  if (text) {
    navigator.clipboard.writeText(text)
    window.$message.success('복사 성공')
  }
}

const hasBubble = (type: MsgEnum) => {
  return !(type === MsgEnum.RECALL || type === MsgEnum.SYSTEM || type === MsgEnum.BOT)
}

const isMe = computed(() => {
  return props.fromUser?.uid === userStore.userInfo!.uid
})

// Mac에서 우클릭 시 텍스트가 선택되는 문제 해결
const closeMenu = (event: any) => {
  if (!event.target.matches('.bubble', 'bubble-oneself')) {
    activeBubble.value = ''
  }
}

// 이모지 반응 처리
const handleEmojiSelect = async (
  context: { label: string; value: number; title: string },
  item: MessageType
): Promise<void> => {
  if (!item || !item.message) return

  if (!item.message.messageMarks) {
    item.message.messageMarks = {}
  }

  // 현재 사용자가 해당 이모지를 표시했는지 확인
  const userMarked = item.message.messageMarks[String(context.value)]?.userMarked
  // 표시되지 않은 아이콘에만 표시 수행
  if (!userMarked) {
    try {
      await markMsg({
        msgId: item.message.id,
        markType: context.value,
        actType: 1
      })
    } catch (error) {
      console.error('이모지 표시 실패:', error)
    }
  } else {
    window.$message.warning('이미 표시된 이모지입니다')
  }
}

useMitt.on(`${MittEnum.INFO_POPOVER}-Main`, (event: any) => {
  const messageId = event.uid

  // 먼저 InfoPopover 컴포넌트를 표시하기 위해 selectKey 설정
  selectKey.value = messageId

  // 해당 popover 참조가 있으면 표시
  if (infoPopoverRefs[messageId]) {
    infoPopoverRefs[messageId].setShow(true)
    handlePopoverUpdate(messageId)
  }
})

onMounted(() => {
  window.addEventListener('click', closeMenu, true)
})

onUnmounted(() => {
  window.removeEventListener('click', closeMenu, true)
})

/**
 * 길게 누르기 이벤트 (시작)
 */

const longPressOption = computed(() => ({
  delay: 700,
  modifiers: {
    // 모바일에서만 기본 동작 방지, 데스크톱에서는 텍스트 선택 허용
    prevent: isMobile(),
    stop: isMobile()
  },
  reset: true,
  windowResize: true,
  windowScroll: true,
  immediate: true,
  updateTiming: 'sync'
}))

const handleLongPress = (e: PointerEvent, _menu: any) => {
  if (!isMobile()) return

  // 1. 기본 동작 방지 (시스템 메뉴 방지)
  e.preventDefault()
  e.stopPropagation()

  // // 2. 대상 엘리먼트 획득
  const target = e.target as HTMLElement

  const preventClick = (event: Event) => {
    event.stopPropagation()
    event.preventDefault()
    document.removeEventListener('click', preventClick, true)
    document.removeEventListener('pointerup', preventClick, true)
  }

  // 3. 임시 이벤트 리스너를 추가하여 후속 클릭 이벤트 방지
  document.addEventListener('click', preventClick, true)
  document.addEventListener('pointerup', preventClick, true)

  // 4. 우클릭 이벤트 시뮬레이션
  const contextMenuEvent = new MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
    clientX: e.clientX,
    clientY: e.clientY,
    button: 2 // 우클릭으로 명시
  })

  target.dispatchEvent(contextMenuEvent)

  setTimeout(() => {
    document.removeEventListener('click', preventClick, true)
    document.removeEventListener('pointerup', preventClick, true)
  }, 300)
}

/**
 * 길게 누르기 이벤트 (종료)
 */
</script>
<style scoped lang="scss">
@use '@/styles/scss/render-message';
</style>
