<template>
  <n-flex vertical :size="6" class="notify" @mouseenter="handleMouseEnter" @mouseleave="handleMouseLeave">
    <n-flex align="center" :size="4" class="m-[8px_0_0_0] text-(12px)">
      <p>{{ t('message.notify.new_messages') }}</p>
      <p>·</p>
      <p>{{ msgCount }}</p>
    </n-flex>
    <component :is="division" />
    <n-scrollbar style="max-height: 320px">
      <n-flex
        v-for="group in content"
        :key="group.id"
        v-memo="[group.id, group.messageCount, group.latestContent, group.isAtMe, group.name, group.avatar]"
        @click="handleClickMsg(group)"
        align="left"
        :size="10"
        class="mt-2px p-6px box-border rounded-8px hover:bg-[--tray-hover] cursor-pointer">
        <n-avatar round :size="44" :src="AvatarUtils.getAvatarUrl(group.avatar)" />

        <n-flex class="flex-1" vertical justify="center" :size="8">
          <span class="text-(16px [--text-color])">{{ group.name }}</span>

          <n-flex class="w-full" align="center" justify="space-between" :size="10">
            <span class="max-w-150px truncate text-(12px [--text-color])">
              <template v-if="group.isAtMe">
                <span class="text flex-1 leading-tight text-12px truncate">
                  <span class="text-#d5304f mr-4px">{{ t('message.message_list.mention_tag') }}</span>
                  <span>{{ group.latestContent.replace(':', '：') }}</span>
                </span>
              </template>
              <template v-else>
                <span class="text flex-1 leading-tight text-12px truncate">
                  {{ group.latestContent.replace(':', '：') }}
                </span>
              </template>
            </span>

            <!-- 메시지 수 -->
            <div class="text-(10px #fff) rounded-full px-6px py-2px flex-center bg-#d5304f">
              {{ group.messageCount > 99 ? '99+' : group.messageCount }}
            </div>
          </n-flex>
        </n-flex>
      </n-flex>
    </n-scrollbar>
    <component :is="division" />
    <p @click="handleTip" class="pt-4px pl-6px text-(12px #13987f) cursor-pointer">
      {{ t('message.notify.ignore_all') }}
    </p>
  </n-flex>
</template>
<script setup lang="tsx">
import { PhysicalPosition } from '@tauri-apps/api/dpi'
import { type Event, emitTo } from '@tauri-apps/api/event'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { info } from '@tauri-apps/plugin-log'
import { useDebounceFn } from '@vueuse/core'
import { sumBy } from 'es-toolkit'
import { RoomTypeEnum } from '@/enums'
import { useReplaceMsg } from '@/hooks/useReplaceMsg.ts'
import { useWindow } from '@/hooks/useWindow.ts'
import type { MessageType } from '@/services/types.ts'
import { useChatStore } from '@/stores/chat.ts'
import { useGlobalStore } from '@/stores/global.ts'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { isWindows } from '@/utils/PlatformConstants'
import { useI18n } from 'vue-i18n'

// import { useTauriListener } from '../hooks/useTauriListener'

// 그룹 메시지 유형 정의
type GroupedMessage = {
  id: string
  roomId: string
  latestContent: string
  messageCount: number
  avatar: string
  name: string
  timestamp: number
  isAtMe: boolean
  top?: boolean // 상단 고정 상태 속성 추가
  roomType: number // 방 유형: 1=그룹 채팅, 2=1:1 채팅
}

const appWindow = WebviewWindow.getCurrent()
const { checkWinExist, resizeWindow } = useWindow()
// const { addListener } = useTauriListener()
const { checkMessageAtMe } = useReplaceMsg()
const globalStore = useGlobalStore()
const chatStore = useChatStore()
const { tipVisible } = storeToRefs(globalStore)
const { t } = useI18n()
const isMouseInWindow = ref(false)
const content = ref<GroupedMessage[]>([])
const msgCount = ref(0)
let homeFocusUnlisten: (() => void) | null = null
let homeBlurUnlisten: (() => void) | null = null

// tipVisible 변경 감지, false가 되면 메시지 목록 초기화
watch(
  () => tipVisible.value,
  (newValue) => {
    if (!newValue) {
      content.value = []
      msgCount.value = 0
      // 창 높이 초기화
      resizeWindow('notify', 280, 140)
    }
  }
)

const division = () => {
  return <div class={'h-1px bg-[--line-color] w-full'}></div>
}

// 메시지 클릭 로직 처리
// TODO: 빈도 제어 트리거 가능성 있음
const handleClickMsg = async (group: any) => {
  // 메시지 페이지 열기
  await checkWinExist('home')
  // 해당 세션 찾기 - 메시지 ID가 아닌 roomId 기준
  const session = chatStore.sessionList.find((s) => s.roomId === group.roomId)
  if (session) {
    info(`메시지 클릭, 세션 열기: ${JSON.stringify(session)}`)
    emitTo('home', 'search_to_msg', {
      uid: group.roomType === RoomTypeEnum.SINGLE ? session.detailId : session.roomId,
      roomType: group.roomType
    })
    // 알림 패널 접기
    await debouncedHandleTip()
  } else {
    console.error('해당 세션 정보를 찾을 수 없습니다')
  }
}

// 상태 표시줄 깜박임 취소
const handleTip = async () => {
  globalStore.setTipVisible(false)
  // 창 상단 고정 취소
  await appWindow?.setAlwaysOnTop(false)

  // 창 숨기기
  await appWindow?.hide()

  // 메시지 내용 비우기
  content.value = []
  msgCount.value = 0

  // 창 높이 초기화
  resizeWindow('notify', 280, 140)
}

const debouncedHandleTip = useDebounceFn(handleTip, 100)

// 창 표시 및 숨김 로직 처리
const showWindow = async (event: Event<any>) => {
  if (tipVisible.value) {
    const notifyWindow = WebviewWindow.getCurrent()
    const outerSize = await notifyWindow?.outerSize()
    if (outerSize) {
      await notifyWindow?.setPosition(
        new PhysicalPosition(
          event.payload.position.Physical.x - 120,
          event.payload.position.Physical.y - outerSize.height + 8
        )
      )
      await notifyWindow?.show()
      await notifyWindow?.unminimize()
      await notifyWindow?.setFocus()
      await notifyWindow?.setAlwaysOnTop(true)
    }
  }
}

const hideWindow = async () => {
  if (!isMouseInWindow.value) {
    const notifyWindow = await WebviewWindow.getCurrent()
    await notifyWindow?.hide()
  }
}

const handleMouseEnter = () => {
  console.log('Mouse enter')
  isMouseInWindow.value = true
}

const handleMouseLeave = async () => {
  console.log('Mouse leave')
  isMouseInWindow.value = false
  await hideWindow()
}

// TODO 트레이 아이콘이 깜박일 때 마우스를 null 아이콘으로 이동하면 Notify 창이 사라지거나 표시되지 않는 문제 발생. Notify로 이동해도 사라짐.
onMounted(async () => {
  // 창 높이 초기화
  resizeWindow('notify', 280, 140)

  if (isWindows()) {
    appWindow.listen('notify_enter', async (event: Event<any>) => {
      info('enter 이벤트 감지, notify 창 열기')
      await showWindow(event)
    })

    appWindow.listen('notify_leave', async () => {
      setTimeout(async () => {
        await hideWindow()
      }, 300)
    })

    appWindow.listen('hide_notify', async () => {
      // tipVisible이 true일 때만 처리
      if (tipVisible.value) {
        await handleTip()
      }
    })

    appWindow.listen('notify_content', async (event: Event<MessageType>) => {
      if (event.payload) {
        // 창 표시는 notify_enter 이벤트에 의해 트리거됨

        // 메시지 내용 처리
        const msg = event.payload
        const session = chatStore.sessionList.find((s) => s.roomId === msg.message.roomId)
        const existingGroup = content.value.find((group) => group.roomId === msg.message.roomId)

        // useReplaceMsg를 사용하여 메시지 내용 처리
        const { formatMessageContent, getMessageSenderName } = useReplaceMsg()
        const isAtMe = checkMessageAtMe(msg)
        const currentTime = Date.now()

        // 발신자 정보 가져오기
        const senderName = getMessageSenderName(
          msg,
          session?.name || '',
          session?.roomId || msg.message.roomId,
          session?.type
        )

        // 메시지 내용 포맷팅
        const formattedContent = formatMessageContent(
          msg,
          session?.type || RoomTypeEnum.GROUP,
          senderName,
          session?.roomId || msg.message.roomId
        )

        if (existingGroup) {
          // 해당 방의 메시지가 이미 존재하면 최신 내용 및 카운트 업데이트
          existingGroup.id = msg.message.id
          existingGroup.latestContent = formattedContent
          existingGroup.messageCount++
          existingGroup.timestamp = currentTime
          existingGroup.isAtMe = isAtMe
          if (session) {
            existingGroup.avatar = session.avatar
            existingGroup.name = session.name
          }
        } else {
          // 새 방인 경우 새 그룹 생성
          // 세션의 읽지 않은 메시지 수 사용 (현재 수신된 메시지는 이미 unreadCount에 포함됨)
          const messageCount = session?.unreadCount || 1

          content.value.push({
            id: msg.message.id,
            roomId: msg.message.roomId,
            latestContent: formattedContent,
            messageCount: messageCount,
            avatar: session?.avatar || '',
            name: session?.name || '',
            timestamp: currentTime,
            isAtMe: isAtMe,
            // 방 유형 추가, 세션에서 가져오며 없으면 기본값은 1:1 채팅
            roomType: session?.type || RoomTypeEnum.SINGLE
          })

          // 창 높이 조정, 기본 높이 140, 두 번째 그룹부터 그룹당 60px 추가, 최대 4개 그룹
          const baseHeight = 140
          const groupCount = content.value.length
          const additionalHeight = Math.min(Math.max(groupCount - 1, 0), 3) * 60
          const newHeight = baseHeight + additionalHeight
          resizeWindow('notify', 280, newHeight)
        }

        // 메시지 정렬 - 상단 고정 상태 우선, 그 다음 활성 시간순
        content.value.sort((a, b) => {
          // 1. 상단 고정 상태로 먼저 정렬 (고정된 항목이 앞)
          if (a.top && !b.top) return -1
          if (!a.top && b.top) return 1

          // 2. 동일한 고정 상태에서 타임스탬프 내림차순 정렬 (최신 항목이 앞)
          return b.timestamp - a.timestamp
        })

        msgCount.value = sumBy(content.value, (group) => group.messageCount)
      }
    })

    homeFocusUnlisten = await appWindow.listen('home_focus', async () => {
      if (tipVisible.value) {
        await handleTip()
      } else {
        await hideWindow()
      }
    })

    homeBlurUnlisten = await appWindow.listen('home_blur', () => {
      // 자리 표시자 유지, 향후 포커스 해제 시 로직 처리가 필요한 경우 확장 가능
    })
  }
})

onUnmounted(() => {
  if (homeFocusUnlisten) {
    homeFocusUnlisten()
    homeFocusUnlisten = null
  }
  if (homeBlurUnlisten) {
    homeBlurUnlisten()
    homeBlurUnlisten = null
  }
})
</script>
<style scoped lang="scss">
.notify {
  @apply bg-[--center-bg-color] size-full p-8px box-border select-none text-[--text-color] text-12px;
}
</style>
