<template>
  <!-- 하단 바 -->
  <main
    :class="[isMobile() ? 'flex-col w-full' : 'border-t-(1px solid [--right-chat-footer-line-color])']"
    class="h-full flex flex-col relative">
    <!-- 마스크 레이어 추가 -->
    <div
      v-if="isSingleChat && !isFriend"
      :style="{ height: `${footerHeight}px` }"
      class="absolute inset-0 z-997 backdrop-blur-md cursor-default flex-center select-none pointer-events-auto light:bg-[rgba(255,255,255,0.1)] dark:bg-[rgba(33,33,33,0.1)]">
      <n-flex align="center" justify="center" class="pb-60px">
        <svg class="size-24px">
          <use href="#cloudError"></use>
        </svg>
        <span class="text-(14px [--chat-text-color])">{{ t('editor.relation.not_friends') }}</span>
      </n-flex>
    </div>

    <ChatMsgMultiChoose v-if="chatStore.isMsgMultiChoose" />

    <div v-if="!chatStore.isMsgMultiChoose" class="color-[--icon-color] flex flex-col flex-1 min-h-0">
      <!-- 입력 상자 상단 옵션 바 -->
      <n-flex
        v-if="!isMobile()"
        align="center"
        justify="space-between"
        class="p-[10px_22px_5px] select-none flex-shrink-0">
        <n-flex align="center" :size="0" class="input-options">
          <!-- 이모티콘 -->
          <n-popover
            v-model:show="emojiShow"
            trigger="click"
            :show-arrow="false"
            placement="top-start"
            style="
              padding: 0;
              background: var(--bg-emoji);
              backdrop-filter: blur(10px);
              -webkit-backdrop-filter: blur(10px);
              box-shadow: 2px 2px 12px 2px var(--box-shadow-color);
              border: 1px solid var(--box-shadow-color);
              width: auto;
            ">
            <template #trigger>
              <n-popover
                v-model:show="recentlyTip"
                trigger="hover"
                :delay="800"
                :duration="100"
                :show-arrow="false"
                :disabled="emojiShow || recentEmojis.length < 4"
                placement="top">
                <template #trigger>
                  <svg class="mr-18px">
                    <use href="#smiling-face"></use>
                  </svg>
                </template>
                <div v-if="recentEmojis.length > 0" class="p-4px">
                  <div class="text-xs text-gray-500 mb-4px">최근 사용</div>
                  <div class="flex flex-wrap gap-8px max-w-212px">
                    <div
                      v-for="(emoji, index) in recentEmojis"
                      :key="index"
                      class="emoji-item cursor-pointer flex-center"
                      @click="
                        emojiHandle(
                          checkIsUrl(emoji) ? { renderUrl: resolveRecentRenderUrl(emoji), serverUrl: emoji } : emoji,
                          checkIsUrl(emoji) ? 'emoji-url' : 'emoji'
                        )
                      ">
                      <img v-if="checkIsUrl(emoji)" :src="resolveRecentRenderUrl(emoji)" class="size-24px" />
                      <span v-else class="text-18px">{{ emoji }}</span>
                    </div>
                  </div>
                </div>
              </n-popover>
            </template>
            <Emoticon @emojiHandle="emojiHandle" :all="false" />
          </n-popover>

          <div class="flex-center gap-2px mr-12px">
            <svg @click="handleScreenshot()">
              <use href="#screenshot"></use>
            </svg>
            <n-popover
              style="
                padding: 0;
                background: var(--bg-emoji);
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                box-shadow: 2px 2px 12px 2px var(--box-shadow-color);
                border: 1px solid var(--box-shadow-color);
              "
              trigger="hover"
              :show-arrow="false"
              placement="top">
              <template #trigger>
                <svg class="dropdown-arrow" style="width: 14px; height: 14px">
                  <use href="#down"></use>
                </svg>
              </template>

              <div class="footer-item">
                <n-flex
                  @click="handleScreenshot()"
                  class="text-12px cursor-pointer group"
                  align="center"
                  justify="space-between">
                  <n-flex align="center" :size="6">
                    <svg class="size-14px">
                      <use href="#screenshot"></use>
                    </svg>
                    <p>{{ t('editor.screenshot') }}</p>
                  </n-flex>
                  <p class="text-(12px #909090)">{{ settingStore.shortcuts.screenshot }}</p>
                </n-flex>

                <n-flex
                  class="text-12px cursor-pointer group"
                  align="center"
                  justify="space-between"
                  @click="isConceal = !isConceal">
                  <n-checkbox v-model:checked="isConceal" @click.stop />
                  <p class="text-(12px --chat-text-color)">{{ t('editor.screenshot_hide_curr_window') }}</p>
                </n-flex>
              </div>
            </n-popover>
          </div>

          <n-popover trigger="hover" :show-arrow="false" placement="bottom">
            <template #trigger>
              <div class="flex-center gap-2px mr-12px">
                <svg @click="handleFileOpen">
                  <use href="#file2"></use>
                </svg>
                <svg style="width: 14px; height: 14px">
                  <use href="#down"></use>
                </svg>
              </div>
            </template>
            <span>{{ t('editor.file') }}</span>
          </n-popover>
          <n-popover trigger="hover" :show-arrow="false" placement="bottom">
            <template #trigger>
              <svg @click="handleImageOpen" class="mr-18px">
                <use href="#photo"></use>
              </svg>
            </template>
            <span>{{ t('editor.image') }}</span>
          </n-popover>
          <n-popover trigger="hover" :show-arrow="false" placement="bottom">
            <template #trigger>
              <svg @click="handleVoiceRecord" class="mr-18px">
                <use href="#voice"></use>
              </svg>
            </template>
            <span>{{ t('editor.voice') }}</span>
          </n-popover>
          <n-popover v-if="!isMac()" trigger="hover" :show-arrow="false" placement="bottom">
            <template #trigger>
              <svg @click="showLocationModal = true" class="mr-18px">
                <use href="#local"></use>
              </svg>
            </template>
            <span>{{ t('editor.location') }}</span>
          </n-popover>
        </n-flex>

        <n-popover trigger="hover" :show-arrow="false" placement="bottom">
          <template #trigger>
            <svg class="w-22px h-22px cursor-pointer outline-none" @click="openChatHistory">
              <use href="#history"></use>
            </svg>
          </template>
          <span>{{ t('editor.chat_history') }}</span>
        </n-popover>
      </n-flex>

      <!-- 입력 상자 영역 -->
      <div :class="[isMobile() ? '' : 'pl-20px ']" class="flex flex-1 min-h-0">
        <MsgInput
          ref="MsgInputRef"
          @clickMore="handleMoreClick"
          @clickEmoji="handleEmojiClick"
          @clickVoice="handleVoiceClick"
          @customFocus="handleCustomFocus"
          @send="handleSend" />
      </div>
    </div>

    <!-- 위치 선택 팝업 -->
    <LocationModal
      v-model:visible="showLocationModal"
      @location-selected="handleLocationSelected"
      @cancel="showLocationModal = false" />

    <!-- 모바일 입력 상자 아이콘 클릭 시 나타나는 패널 -->
    <Transition v-if="isMobile()" name="panel-slide">
      <div v-show="isPanelVisible" class="panel-container panel-container--fixed">
        <Transition name="panel-content" mode="out-in">
          <div v-if="mobilePanelState === MobilePanelStateEnum.EMOJI" key="emoji" class="panel-content">
            <Emoticon @emojiHandle="emojiHandle" :all="false" />
          </div>
          <div v-else-if="mobilePanelState === MobilePanelStateEnum.VOICE" key="voice" class="panel-content">
            <VoicePanel @cancel="handleMobileVoiceCancel" @send="handleMobileVoiceSend" />
          </div>
          <div v-else-if="mobilePanelState === MobilePanelStateEnum.MORE" key="more" class="panel-content">
            <More @sendFiles="handleMoreSendFiles" />
          </div>
        </Transition>
      </div>
    </Transition>
  </main>
</template>

<script setup lang="ts">
import { open } from '@tauri-apps/plugin-dialog'
import { readFile } from '@tauri-apps/plugin-fs'
import { FOOTER_HEIGHT, MAX_FOOTER_HEIGHT, MIN_FOOTER_HEIGHT } from '@/common/constants'
import LocationModal from '@/components/rightBox/location/LocationModal.vue'
import { MittEnum, MobilePanelStateEnum, MsgEnum, RoomTypeEnum } from '@/enums'
import { useChatLayoutGlobal } from '@/hooks/useChatLayout'
import { type SelectionRange, useCommon } from '@/hooks/useCommon.ts'
import { useGlobalShortcut } from '@/hooks/useGlobalShortcut.ts'
import { useMitt } from '@/hooks/useMitt'
import { useWindow } from '@/hooks/useWindow'
import type { FriendItem, SessionItem } from '@/services/types'
import { useChatStore } from '@/stores/chat'
import { useContactStore } from '@/stores/contacts'
import { useGlobalStore } from '@/stores/global.ts'
import { useHistoryStore } from '@/stores/history'
import { useSettingStore } from '@/stores/setting'
import { useEmojiStore } from '@/stores/emoji'
import FileUtil from '@/utils/FileUtil'
import { extractFileName, getMimeTypeFromExtension } from '@/utils/Formatting'
import { isMac, isMobile } from '@/utils/PlatformConstants'
import { useDebounceFn } from '@vueuse/core'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
// 모바일 컴포넌트 조건부 가져오기
const More = isMobile() ? defineAsyncComponent(() => import('@/mobile/components/chat-room/panel/More.vue')) : void 0
const VoicePanel = isMobile()
  ? defineAsyncComponent(() => import('@/mobile/components/chat-room/panel/VoicePanel.vue'))
  : void 0

const props = withDefaults(
  defineProps<{
    detailId?: SessionItem['detailId']
  }>(),
  {
    detailId: ''
  }
)
const detailId = computed(() => props.detailId || '')
const globalStore = useGlobalStore()
const contactStore = useContactStore()
const historyStore = useHistoryStore()
const chatStore = useChatStore()
const settingStore = useSettingStore()
const emojiStore = useEmojiStore()
const { handleScreenshot } = useGlobalShortcut()
const MsgInputRef = ref()
const msgInputDom = ref<HTMLInputElement | null>(null)
const emojiShow = ref(false)
const recentlyTip = ref(false)
const showLocationModal = ref(false)
const isConceal = computed({
  get: () => settingStore.screenshot.isConceal,
  set: (value: boolean) => settingStore.setScreenshotConceal(value)
})
const recentEmojis = computed(() => {
  return historyStore.emoji.slice(0, 15)
})
const { insertNodeAtRange, triggerInputEvent, processFiles, imgPaste } = useCommon()

// 전역 레이아웃 상태 사용
const { footerHeight, setFooterHeight } = useChatLayoutGlobal()

// 창 관리 사용
const { createWebviewWindow } = useWindow()

// 컨테이너 높이 반응형 상태
const containerHeight = ref(600) // 초기 높이 설정

// 최대 높이 동적 계산
const maxHeight = computed(() => {
  // 최대 높이가 390px를 초과하지 않고 최소 높이 200px보다 작지 않도록 보장
  return Math.max(Math.min(MAX_FOOTER_HEIGHT), MIN_FOOTER_HEIGHT)
})

// 현재 최소 높이 동적 계산 (녹음 모드 상태에 따라)
const currentMinHeight = computed(() => {
  return MsgInputRef.value?.isVoiceMode ? FOOTER_HEIGHT : MIN_FOOTER_HEIGHT
})

// maxHeight 변경 감지, footerHeight가 최대값을 초과하지 않도록 보장 (즉시 응답)
watch(
  maxHeight,
  (newMaxHeight) => {
    if (footerHeight.value > newMaxHeight) {
      setFooterHeight(newMaxHeight)
    }
  },
  {
    immediate: true,
    flush: 'sync'
  }
)

// 최소 높이 변경 감지, footerHeight가 최소값보다 낮지 않도록 보장
watch(
  currentMinHeight,
  (newMinHeight) => {
    if (footerHeight.value < newMinHeight) {
      setFooterHeight(newMinHeight)
    }
  },
  {
    immediate: true,
    flush: 'sync'
  }
)

// 효율적인 크기 변경 감지
const observeContainerResize = () => {
  const chatContainer = document.querySelector('.h-full') || document.querySelector('[data-chat-container]')
  if (!chatContainer) return
  // 초기 높이 설정
  containerHeight.value = (chatContainer as HTMLElement).clientHeight
}

/**
 * 문자열이 URL인지 확인
 */
const checkIsUrl = (str: string) => {
  try {
    new URL(str)
    return true
  } catch {
    return false
  }
}

// 최근 사용한 이모티콘 패키지는 최상위 바로 가기 모음에서도 로컬 렌더링 우선 사용
const resolveRecentRenderUrl = (url: string) => {
  const matched = emojiStore.emojiList.find((item) => item.expressionUrl === url)
  return matched?.localUrl || url
}

// 1:1 채팅인지 확인
const isSingleChat = computed(() => {
  return globalStore.currentSession?.type === RoomTypeEnum.SINGLE
})

/** 친구 관계인지 여부 */
const isFriend = computed(() => {
  if (!isSingleChat.value) return true
  const target = detailId.value
  if (!target) return false
  return contactStore.contactsList.some((contact: FriendItem) => contact.uid === target)
})

// emojiShow 변경 감지, emojiShow가 true일 때 recentlyTip 닫기
watch(emojiShow, (newValue) => {
  if (newValue === true) {
    recentlyTip.value = false
  }
})

// 파일 선택 (유형 제한 없음)
const handleFileOpen = async () => {
  const filesData = await FileUtil.openAndCopyFile()
  if (!filesData) return
  // processFiles 메서드를 사용하여 파일 유형 검증
  await processFiles(filesData.files, MsgInputRef.value.messageInputDom, MsgInputRef.value?.showFileModal)
}

// 이미지 선택 (이미지 유형만 선택 가능)
const handleImageOpen = async () => {
  const selected = await open({
    multiple: true,
    filters: [
      {
        name: 'Images',
        extensions: ['jpeg', 'jpg', 'png', 'gif', 'webp', 'bmp', 'svg']
      }
    ]
  })

  if (selected && Array.isArray(selected)) {
    // 모든 이미지 파일 병렬 처리
    const imagePromises = selected.map(async (path) => {
      const fileData = await readFile(path)
      const fileName = extractFileName(path)
      const mimeType = getMimeTypeFromExtension(fileName)

      const blob = new Blob([new Uint8Array(fileData)], { type: mimeType })
      return new File([blob], fileName, { type: mimeType })
    })

    const files = await Promise.all(imagePromises)

    // 모든 이미지를 입력 상자에 삽입
    for (const file of files) {
      await imgPaste(file, MsgInputRef.value.messageInputDom)
    }
  }
}

// VueUse의 디바운스 함수를 사용하여 이모티콘 패키지 전송 처리 (300ms 디바운스)
type EmojiUrlPayload = { renderUrl: string; serverUrl: string }

const sendEmojiWithDebounce = useDebounceFn((payload: EmojiUrlPayload) => {
  try {
    // 전송 완료 기다리지 않고 즉시 반환 (지연 방지)
    MsgInputRef.value?.sendEmojiDirect(payload.serverUrl).catch((error: unknown) => {
      console.error('[ChatFooter] 이모티콘 패키지 전송 실패:', error)
      window.$message?.error?.('이모티콘 패키지 전송 실패')
    })

    // 최근 사용 이모티콘 목록에 추가
    updateRecentEmojis(payload.serverUrl)
  } catch (error) {
    console.error('[ChatFooter] 이모티콘 패키지 전송 실패:', error)
    window.$message?.error?.('이모티콘 패키지 전송 실패')
  }
}, 200)

/**
 * 이모티콘 선택 및 입력 상자에 삽입
 * @param item 선택한 이모티콘
 * @param type 이모티콘 유형, 'emoji'는 일반 이모티콘, 'emoji-url'은 이모티콘 패키지 URL
 */
const emojiHandle = async (item: string | EmojiUrlPayload, type: 'emoji' | 'emoji-url' = 'emoji') => {
  emojiShow.value = false

  const inp = msgInputDom.value
  if (!inp) {
    return
  }

  const isEmojiUrlPayload = (value: any): value is EmojiUrlPayload =>
    value && typeof value === 'object' && typeof value.serverUrl === 'string'

  // 모바일이고 이모티콘 패키지 URL인 경우 디바운스 전송 사용 (서버 URL 전송)
  if (isMobile() && type === 'emoji-url') {
    const payload: EmojiUrlPayload = isEmojiUrlPayload(item)
      ? item
      : { renderUrl: typeof item === 'string' ? item : '', serverUrl: typeof item === 'string' ? item : '' }
    sendEmojiWithDebounce(payload)
    return
  }

  // 데스크톱 또는 일반 emoji, 입력 상자에 삽입
  // 입력 상자 포커스 보장
  MsgInputRef.value?.focus()

  // 마지막 편집 범위 가져오기 시도
  let lastEditRange: SelectionRange | null = MsgInputRef.value?.getLastEditRange()

  // 마지막 편집 범위가 없으면 현재 선택 영역 가져오기 시도
  if (!lastEditRange) {
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      lastEditRange = {
        range: selection.getRangeAt(0),
        selection
      }
    } else {
      // 선택 영역이 없으면 끝까지 새 범위 생성
      const range = document.createRange()
      range.selectNodeContents(inp)
      range.collapse(false)
      lastEditRange = {
        range,
        selection: window.getSelection()!
      }
    }
  }

  // 컨텍스트 선택 영역 지우고 새 선택 영역 설정
  const selection = window.getSelection()
  if (selection) {
    selection.removeAllRanges()
    selection.addRange(lastEditRange.range)
  }

  // 콘텐츠 유형에 따라 다른 노드 삽입
  if (type === 'emoji-url') {
    const payload: EmojiUrlPayload = isEmojiUrlPayload(item)
      ? item
      : { renderUrl: typeof item === 'string' ? item : '', serverUrl: typeof item === 'string' ? item : '' }
    const renderUrl = payload.renderUrl || payload.serverUrl
    const serverUrl = payload.serverUrl || payload.renderUrl
    if (!renderUrl) return
    // URL인 경우 이미지 요소 생성 및 삽입
    const imgElement = document.createElement('img')
    imgElement.src = renderUrl
    imgElement.style.maxWidth = '80px'
    imgElement.style.maxHeight = '80px'
    // 데이터 유형 설정, 일반 이미지와 이모티콘 패키지 구분
    imgElement.dataset.type = 'emoji'
    if (serverUrl) {
      imgElement.dataset.serverUrl = serverUrl
    }

    // 사용자 커서 위치에 이모티콘 패키지 삽입
    lastEditRange.range.insertNode(imgElement)

    // 커서를 이미지 뒤로 이동
    const range = document.createRange()
    range.setStartAfter(imgElement)
    range.collapse(true)
    selection?.removeAllRanges()
    selection?.addRange(range)
  } else {
    const emojiText = typeof item === 'string' ? item : ''
    insertNodeAtRange(MsgEnum.TEXT, emojiText, inp, lastEditRange)
  }

  // 새 선택 영역 위치 기록
  MsgInputRef.value?.updateSelectionRange()

  // 입력 이벤트 트리거
  triggerInputEvent(inp)

  // 입력 상자에 포커스 유지
  MsgInputRef.value?.focus()

  // 최근 사용 이모티콘 목록에 추가
  if (type === 'emoji-url') {
    const payload: EmojiUrlPayload = isEmojiUrlPayload(item)
      ? item
      : { renderUrl: typeof item === 'string' ? item : '', serverUrl: typeof item === 'string' ? item : '' }
    updateRecentEmojis(payload.serverUrl || payload.renderUrl)
  } else {
    updateRecentEmojis(typeof item === 'string' ? item : '')
  }
}

/**
 * 최근 사용 이모티콘 목록 업데이트
 */
const updateRecentEmojis = (emoji: string) => {
  const currentEmojis = [...historyStore.emoji]
  const index = currentEmojis.indexOf(emoji)
  if (index !== -1) {
    currentEmojis.splice(index, 1)
  }
  currentEmojis.unshift(emoji)
  const updatedEmojis = currentEmojis.slice(0, 15)
  historyStore.setEmoji(updatedEmojis)
}

const handleVoiceRecord = () => {
  // 녹음 모드 전환 이벤트 트리거
  useMitt.emit(MittEnum.VOICE_RECORD_TOGGLE)
}

// 위치 선택 처리
const handleLocationSelected = async (locationData: any) => {
  try {
    await MsgInputRef.value.handleLocationSelected(locationData)
    showLocationModal.value = false
  } catch (error) {
    console.error('위치 메시지 전송 실패:', error)
  }
}

// 채팅 기록 창 열기
const openChatHistory = async () => {
  const currentRoomId = globalStore.currentSessionRoomId

  // 채팅 기록 창 생성
  await createWebviewWindow('채팅 기록', 'chat-history', 800, 600, undefined, true, 600, 400, false, false, {
    roomId: currentRoomId
  })
}

/**
 *
 * 모바일 코드 (시작)
 *
 *
 */

// 모바일 패널 상태 - MsgInput에서 동기화
const mobilePanelState = ref<MobilePanelStateEnum>(MobilePanelStateEnum.NONE)

// 패널 표시 여부 계산
const isPanelVisible = computed(() => {
  return (
    mobilePanelState.value === MobilePanelStateEnum.EMOJI ||
    mobilePanelState.value === MobilePanelStateEnum.VOICE ||
    mobilePanelState.value === MobilePanelStateEnum.MORE
  )
})

/** 더보기 버튼 클릭 */
const handleMoreClick = (value: { panelState: MobilePanelStateEnum }) => {
  mobilePanelState.value = value.panelState
}

/** 이모티콘 버튼 클릭 */
const handleEmojiClick = (value: { panelState: MobilePanelStateEnum }) => {
  mobilePanelState.value = value.panelState
}

/** 음성 버튼 클릭 */
const handleVoiceClick = (value: { panelState: MobilePanelStateEnum }) => {
  mobilePanelState.value = value.panelState
}

/** 사용자 정의 포커스 이벤트 */
const handleCustomFocus = (value: { panelState: MobilePanelStateEnum }) => {
  // 포커스 상태인 경우 패널 닫기
  if (value.panelState === MobilePanelStateEnum.FOCUS) {
    mobilePanelState.value = MobilePanelStateEnum.NONE
  } else {
    mobilePanelState.value = value.panelState
  }
}

/** 음성 녹음 취소 */
const handleMobileVoiceCancel = () => {
  useMitt.emit(MittEnum.MOBILE_CLOSE_PANEL)
  // 상태 재설정
  mobilePanelState.value = MobilePanelStateEnum.NONE
}

/** 음성 메시지 전송 */
const handleMobileVoiceSend = async (voiceData: any) => {
  try {
    await MsgInputRef.value?.sendVoiceDirect(voiceData)
  } catch (error) {
    console.error('음성 전송 실패', error)
  }
  // 전송 후 패널 닫기
  handleMobileVoiceCancel()
}

const handleMoreSendFiles = async (files: File[]) => {
  if (!files || files.length === 0) return
  try {
    await MsgInputRef.value?.sendFilesDirect(files)
  } catch (error) {
    console.error('모바일 파일 전송 실패:', error)
    window.$message?.error?.('파일 전송 실패')
  }
}

/** 전송 이벤트 처리 */
const handleSend = () => {
  // 전송 후 패널 닫지 않고 현재 상태 유지
  // mobilePanelState.value = MobilePanelStateEnum.NONE
}

/**
 * 모바일 패널 닫기 이벤트 감지
 */
const listenMobilePanelHandler = () => {
  mobilePanelState.value = MobilePanelStateEnum.NONE
}

/**
 * 모바일 패널 닫기 이벤트 감지
 */
const listenMobileClosePanel = () => {
  useMitt.on(MittEnum.MOBILE_CLOSE_PANEL, listenMobilePanelHandler)
}

/**
 * 모바일 패널 닫기 이벤트 제거
 */
const removeMobileClosePanel = () => {
  useMitt.off(MittEnum.MOBILE_CLOSE_PANEL, listenMobilePanelHandler)
}

/**
 *
 * 모바일 코드 (종료)
 *
 */

onMounted(async () => {
  if (isMobile()) {
    // 모바일 패널 닫기 이벤트 감지
    listenMobileClosePanel()
  }

  await nextTick()
  // 효율적인 컨테이너 크기 감지 시작
  observeContainerResize()

  if (MsgInputRef.value) {
    msgInputDom.value = MsgInputRef.value.messageInputDom
  }
})

onUnmounted(() => {
  if (isMobile()) {
    // 모바일 패널 닫기 이벤트 제거
    removeMobileClosePanel()
  }
})
</script>

<style scoped lang="scss">
.input-options {
  svg {
    width: 22px;
    height: 22px;
    cursor: pointer;

    &:hover {
      color: #13987f;
    }
  }

  .dropdown-arrow {
    transition: transform 0.3s ease;

    &:hover {
      transform: rotate(180deg);
    }
  }
}

.resize-indicator {
  width: 40px;
  height: 3px;
  background: #909090;
  border-radius: 2px;
  opacity: 0.3;
  transition: all 0.2s ease;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    top: -2px;
    left: 50%;
    transform: translateX(-50%);
    width: 20px;
    height: 1px;
    background: var(--icon-color, #666);
    border-radius: 1px;
    opacity: 0.5;
  }

  &::after {
    content: '';
    position: absolute;
    bottom: -2px;
    left: 50%;
    transform: translateX(-50%);
    width: 20px;
    height: 1px;
    background: var(--icon-color, #666);
    border-radius: 1px;
    opacity: 0.5;
  }
}

.footer-item {
  @apply flex-col-y-center gap-4px px-6px py-8px min-w-160px box-border size-fit select-none;

  .group {
    @apply px-4px py-6px rounded-4px;

    &:hover {
      background-color: var(--emoji-hover);

      svg {
        animation: twinkle 0.3s ease-in-out;
      }
    }
  }
}

:deep(.n-input .n-input-wrapper) {
  padding: 0;
}

// 모바일 스타일 (아래 모두)

/* 패널 컨테이너 스타일 */
.panel-container {
  width: 100%;
  overflow: hidden;
  background-color: var(--bg-emoji, #f5f5f5);
  display: flex;
  flex-direction: column;
  transition: height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.panel-container--fixed {
  height: 18rem;
}

/* transform을 사용하여 고성능 애니메이션 구현 - 아래에서 위로 슬라이드 */
.panel-slide-enter-active,
.panel-slide-leave-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  transform-origin: bottom;
}

.panel-slide-enter-from {
  opacity: 0;
  transform: translateY(100%);
}

.panel-slide-enter-to {
  opacity: 1;
  transform: translateY(0);
}

.panel-slide-leave-from {
  opacity: 1;
  transform: translateY(0);
}

.panel-slide-leave-to {
  opacity: 0;
  transform: translateY(100%);
}

.panel-content-enter-active,
.panel-content-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}

.panel-content-enter-from,
.panel-content-leave-to {
  opacity: 0;
  transform: translateY(12px);
}

.panel-content-enter-to,
.panel-content-leave-from {
  opacity: 1;
  transform: translateY(0);
}
</style>
