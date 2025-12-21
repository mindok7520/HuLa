<template>
  <n-config-provider
    :theme="lightTheme"
    class="h-full flex flex-col box-border"
    :class="{
      'bg-cover bg-center bg-no-repeat': props.backgroundImage
    }"
    :style="mergedStyle">
    <!-- 상단 안전 구역 -->
    <div :class="[{ 'safe-area-top': safeAreaTop }, props.topSafeAreaClass]" />

    <!-- 콘텐츠 영역 -->
    <div class="flex-1 min-h-0">
      <slot></slot>
    </div>

    <!-- 하단 안전 구역 -->
    <div :class="[{ 'safe-area-bottom': safeAreaBottom }, props.bottomSafeAreaClass]" />
  </n-config-provider>
</template>

<script setup lang="ts">
import { emitTo } from '@tauri-apps/api/event'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { MsgEnum, NotificationTypeEnum, TauriCommand } from '@/enums'
import { useMitt } from '@/hooks/useMitt'
import type { MessageType } from '@/services/types'
import { WsResponseMessageType } from '@/services/wsType'
import { useChatStore } from '@/stores/chat'
import { useFileStore } from '@/stores/file'
import { useGlobalStore } from '@/stores/global'
import { useSettingStore } from '@/stores/setting'
import { useUserStore } from '@/stores/user'
import { audioManager } from '@/utils/AudioManager'
import { isMobile, isWindows } from '@/utils/PlatformConstants'
import { invokeSilently } from '@/utils/TauriInvokeHandler'
import { useRoute } from 'vue-router'
import { lightTheme } from 'naive-ui'
interface MobileLayoutProps {
  /** 상단 안전 구역 적용 여부 */
  safeAreaTop?: boolean
  /** 하단 안전 구역 적용 여부 */
  safeAreaBottom?: boolean
  /** 배경 이미지 URL */
  backgroundImage?: string
  /** 상단 안전 구역 사용자 정의 CSS 클래스 */
  topSafeAreaClass?: string
  /** 하단 안전 구역 사용자 정의 CSS 클래스 */
  bottomSafeAreaClass?: string
}

const route = useRoute()
const chatStore = useChatStore()
const fileStore = useFileStore()
const userStore = useUserStore()
const globalStore = useGlobalStore()
const settingStore = useSettingStore()
const userUid = computed(() => userStore.userInfo!.uid)
const playMessageSound = async () => {
  // 메시지 알림음이 켜져 있는지 확인
  if (!settingStore.notification?.messageSound) {
    return
  }

  try {
    const audio = new Audio('/sound/message.mp3')
    await audioManager.play(audio, 'message-notification')
  } catch (error) {
    console.warn('메시지 효과음 재생 실패:', error)
  }
}

const props = withDefaults(defineProps<MobileLayoutProps>(), {
  safeAreaTop: true,
  safeAreaBottom: true,
  backgroundImage: '',
  topSafeAreaClass: '',
  bottomSafeAreaClass: ''
})

// 배경 이미지 스타일 계산
const backgroundImageStyle = computed(() => {
  const styles: Record<string, string> = {}

  // 배경 이미지 설정
  if (props.backgroundImage) {
    // 경로 별칭 @/를 /src/로 변환 처리
    let imagePath = props.backgroundImage
    if (imagePath.startsWith('@/')) {
      imagePath = imagePath.replace('@/', '/src/')
    }
    styles.backgroundImage = `url(${imagePath})`
  }
  return styles
})

const mergedStyle = computed(() => ({
  backgroundColor: 'var(--center-bg-color)',
  ...backgroundImageStyle.value
}))

/**
 * 메시지에서 파일 정보를 추출하여 file store에 추가
 */
const addFileToStore = (data: MessageType) => {
  const { message } = data
  const { type, body, roomId, id } = message

  // 이미지 및 동영상 유형만 처리
  if (type !== MsgEnum.IMAGE && type !== MsgEnum.VIDEO) {
    return
  }

  // 파일 정보 추출
  const fileUrl = body.url
  if (!fileUrl) {
    return
  }

  // URL에서 파일명 추출
  let fileName = ''
  try {
    const urlObj = new URL(fileUrl)
    const pathname = urlObj.pathname
    fileName = pathname.substring(pathname.lastIndexOf('/') + 1)
  } catch (e) {
    // 유효한 URL이 아닌 경우 메시지 ID를 파일명으로 직접 사용
    fileName = `${id}.${type === MsgEnum.IMAGE ? 'jpg' : 'mp4'}`
  }

  // 파일명에서 확장자 추출
  const suffix = fileName.includes('.')
    ? fileName.substring(fileName.lastIndexOf('.') + 1)
    : type === MsgEnum.IMAGE
      ? 'jpg'
      : 'mp4'

  // MIME 타입 결정
  let mimeType = ''
  if (type === MsgEnum.IMAGE) {
    mimeType = `image/${suffix === 'jpg' ? 'jpeg' : suffix}`
  } else if (type === MsgEnum.VIDEO) {
    mimeType = `video/${suffix}`
  }

  // file store에 추가
  fileStore.addFile({
    id,
    roomId,
    fileName,
    type: type === MsgEnum.IMAGE ? 'image' : 'video',
    url: fileUrl,
    suffix,
    mimeType
  })
}

/** 수신된 메시지 처리 */
useMitt.on(WsResponseMessageType.RECEIVE_MESSAGE, async (data: MessageType) => {
  if (chatStore.checkMsgExist(data.message.roomId, data.message.id)) {
    return
  }
  console.log('[mobile/layout] 수신된 메시지:', data)
  // 채팅방 페이지에 있고 현재 선택된 세션이 메시지 출처 세션일 때만 읽지 않은 메시지 수를 늘리지 않음
  chatStore.pushMsg(data, {
    isActiveChatView:
      route.path.startsWith('/mobile/chatRoom') && globalStore.currentSessionRoomId === data.message.roomId,
    activeRoomId: globalStore.currentSessionRoomId || ''
  })
  data.message.sendTime = new Date(data.message.sendTime).getTime()
  await invokeSilently(TauriCommand.SAVE_MSG, {
    data
  })

  // 이미지 또는 동영상 메시지인 경우 file store에 추가
  addFileToStore(data)
  if (data.fromUser.uid !== userUid.value) {
    // 해당 메시지의 세션 정보 가져오기
    const session = chatStore.sessionList.find((s) => s.roomId === data.message.roomId)

    // 방해 금지 모드가 아닌 세션만 알림 전송 및 아이콘 깜박임 트리거
    if (session && session.muteNotification !== NotificationTypeEnum.NOT_DISTURB) {
      let shouldPlaySound = isMobile()

      if (!isMobile()) {
        try {
          const home = await WebviewWindow.getByLabel('mobile-home')

          if (home) {
            const isVisible = await home.isVisible()
            const isMinimized = await home.isMinimized()
            const isFocused = await home.isFocused()

            // 창이 보이지 않거나 최소화되었거나 포커스되지 않은 경우 효과음 재생
            shouldPlaySound = !isVisible || isMinimized || !isFocused
          } else {
            // home 창을 찾을 수 없는 경우 효과음 재생
            shouldPlaySound = true
          }
        } catch (error) {
          console.warn('창 상태 확인 실패:', error)
          // 확인 실패 시 기본적으로 효과음 재생
          shouldPlaySound = true
        }
      }

      // 메시지 효과음 재생
      if (shouldPlaySound) {
        await playMessageSound()
      }

      // 아이콘 깜박임 설정
      // useMitt.emit(MittEnum.MESSAGE_ANIMATION, data)
      // session.unreadCount++
      // Windows 시스템에서만 알림 전송
      if (!isMobile() && isWindows()) {
        globalStore.setTipVisible(true)
      }

      if (!isMobile()) {
        const currentWindow = WebviewWindow.getCurrent()

        if (currentWindow.label === 'mobile-home') {
          await emitTo('notify', 'notify_content', data)
        }
      }
    }
  }

  await globalStore.updateGlobalUnreadCount()
})
</script>

<style scoped lang="scss">
.safe-area-top {
  padding-top: var(--safe-area-inset-top);
}
.safe-area-bottom {
  padding-bottom: var(--safe-area-inset-bottom);
}
</style>
