<template>
  <div class="msg-input-container">
    <!-- 녹음 모드 -->
    <VoiceRecorder v-show="isVoiceMode" @cancel="handleVoiceCancel" @send="sendVoiceDirect" />

    <!-- 입력창 폼 -->
    <form
      v-show="!isVoiceMode"
      id="message-form"
      @submit.prevent="handleFormSubmit"
      :class="[isMobile() ? 'gap-10px ' : '']"
      class="w-full flex flex-1 min-h-0">
      <div
        class="w-full flex"
        :class="isMobile() ? 'flex flex-1 p-5px gap-2 pt-5px items-center min-h-2.25rem' : ' flex-col'">
        <div v-if="isMobile()" class="flex items-center justify-center w-6 ms-5px h-2.5rem">
          <svg
            @click="handleVoiceClick"
            :class="mobilePanelState === MobilePanelStateEnum.VOICE ? 'text-#169781' : ''"
            class="w-25px h-25px mt-2px outline-none">
            <use href="#voice"></use>
          </svg>
        </div>

        <ContextMenu class="w-full flex-1 min-h-0" @select="$event.click()" :menu="menuList">
          <n-scrollbar @click="focusInput">
            <div
              id="message-input"
              ref="messageInputDom"
              :style="{
                minHeight: isMobile() ? '2rem' : '36px',
                lineHeight: isMobile() && !msgInput ? '2rem' : '20px',
                outline: 'none'
              }"
              contenteditable
              spellcheck="false"
              @paste="onPaste($event)"
              @input="handleInternalInput"
              @keydown.exact.enter="handleEnterKey"
              @keydown.exact.meta.enter="handleEnterKey"
              @keydown="updateSelectionRange"
              @keyup="updateSelectionRange"
              @click="updateSelectionRange"
              @blur="handleBlur"
              @compositionend="updateSelectionRange"
              @keydown.exact.ctrl.enter="handleEnterKey"
              :data-placeholder="t('editor.placeholder')"
              :class="
                isMobile()
                  ? 'empty:before:content-[attr(data-placeholder)] before:text-(12px #777) p-2 min-h-2rem ps-10px! text-14px! bg-white! rounded-10px! max-h-8rem! flex items-center'
                  : 'empty:before:content-[attr(data-placeholder)] before:text-(12px #777) p-2'
              "></div>
          </n-scrollbar>
        </ContextMenu>

        <!-- 전송 버튼 -->
        <div
          v-if="!isMobile()"
          class="flex-shrink-0 max-h-52px p-4px pr-12px border-t border-gray-200/50 flex justify-end mb-4px">
          <n-config-provider :theme="lightTheme">
            <n-button-group size="small">
              <n-button
                color="#13987f"
                :disabled="props.isAIMode && props.isAIStreaming ? false : disabledSend"
                class="w-65px"
                @click="handleDesktopSend">
                {{ props.isAIMode && props.isAIStreaming ? '생각 중지' : t('editor.send') }}
              </n-button>
              <n-button color="#13987f" class="p-[0_6px]">
                <template #icon>
                  <n-config-provider :theme="themes.content === ThemeEnum.DARK ? darkTheme : lightTheme">
                    <n-popselect
                      v-model:show="arrow"
                      v-model:value="chatKey"
                      :options="sendOptions"
                      trigger="click"
                      placement="top-end">
                      <svg @click="arrow = true" v-if="!arrow" class="w-22px h-22px mt-2px outline-none">
                        <use href="#down"></use>
                      </svg>
                      <svg @click="arrow = false" v-else class="w-22px h-22px mt-2px outline-none">
                        <use href="#up"></use>
                      </svg>
                      <template #action>
                        <n-flex
                          justify="center"
                          align="center"
                          :size="4"
                          class="text-(12px #777) cursor-default tracking-1 select-none">
                          <i18n-t keypath="editor.send_or_newline">
                            <template #send>
                              <span v-if="chatKey !== 'Enter'">
                                {{ isMac() ? MacOsKeyEnum['⌘'] : WinKeyEnum.CTRL }}
                              </span>
                              <svg class="size-12px">
                                <use href="#Enter"></use>
                              </svg>
                            </template>
                            <template #newline>
                              <n-flex align="center" :size="0">
                                {{ isMac() ? MacOsKeyEnum['⇧'] : WinKeyEnum.SHIFT }}
                                <svg class="size-12px">
                                  <use href="#Enter"></use>
                                </svg>
                              </n-flex>
                            </template>
                          </i18n-t>
                        </n-flex>
                      </template>
                    </n-popselect>
                  </n-config-provider>
                </template>
              </n-button>
            </n-button-group>
          </n-config-provider>
        </div>

        <!-- @ 멘션 박스  -->
        <div v-if="ait && activeItem?.type === RoomTypeEnum.GROUP && personList.length > 0" class="ait-options">
          <n-virtual-list
            id="image-chat-ait"
            ref="virtualListInst-ait"
            style="max-height: 180px"
            :item-size="36"
            :items="personList"
            v-model:selectedKey="selectedAitKey">
            <template #default="{ item }">
              <n-flex
                @mouseover="() => (selectedAitKey = item.uid)"
                :class="{ active: selectedAitKey === item.uid }"
                @click="handleAit(item)"
                :key="item.uid"
                align="center"
                class="ait-item">
                <n-avatar
                  lazy
                  round
                  :size="22"
                  :src="AvatarUtils.getAvatarUrl(item.avatar)"
                  :color="themes.content === ThemeEnum.DARK ? '' : '#fff'"
                  :fallback-src="themes.content === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'"
                  :render-placeholder="() => null"
                  :intersection-observer-options="{
                    root: '#image-chat-ait'
                  }" />
                <span>{{ item.myName || item.name }}</span>
              </n-flex>
            </template>
          </n-virtual-list>
        </div>

        <!-- / 멘션 박스  -->
        <div
          v-if="aiDialogVisible && activeItem?.type === RoomTypeEnum.GROUP && groupedAIModels.length > 0"
          class="AI-options">
          <n-virtual-list
            ref="virtualListInst-AI"
            style="max-height: 180px"
            :item-size="36"
            :items="groupedAIModels"
            v-model:selectedKey="selectedAIKey">
            <template #default="{ item }">
              <n-flex
                @mouseover="() => (selectedAIKey = item.uid)"
                :class="{ active: selectedAIKey === item.uid }"
                @click="handleAI(item)"
                align="center"
                class="AI-item">
                <n-flex align="center" justify="space-between" class="w-full pr-6px">
                  <n-flex align="center">
                    <img class="size-18px object-contain" :src="item.avatar" alt="" />
                    <p class="text-(14px [--chat-text-color])">{{ item.name }}</p>
                  </n-flex>

                  <n-flex align="center" :size="6">
                    <div
                      class="ml-6px p-[4px_8px] size-fit bg-[--bate-bg] rounded-6px text-(11px [--bate-color] center)">
                      Beta
                    </div>
                    <n-tag size="small" class="text-10px" :bordered="false" type="success">128k</n-tag>
                  </n-flex>
                </n-flex>
              </n-flex>
            </template>
          </n-virtual-list>
        </div>

        <div
          v-if="isMobile()"
          class="grid gap-2 h-2.5rem items-center"
          :class="msgInput ? 'grid-cols-[2rem_3rem]' : 'grid-cols-[2rem_2rem]'">
          <div class="w-full flex-center h-full">
            <svg @click="handleEmojiClick" class="w-25px h-25px mt-2px outline-none iconpark-icon">
              <use :href="mobilePanelState === MobilePanelStateEnum.EMOJI ? '#face' : '#smiling-face'"></use>
            </svg>
          </div>
          <div
            v-if="msgInput"
            class="flex-shrink-0 max-h-62px h-full border-t border-gray-200/50 flex items-center justify-end">
            <n-config-provider class="h-full" :theme="lightTheme">
              <n-button-group size="small" :class="isMobile() ? 'h-full' : 'pr-20px'">
                <n-button
                  color="#13987f"
                  :disabled="props.isAIMode && props.isAIStreaming ? false : disabledSend"
                  class="w-3rem h-full"
                  @click="handleMobileSend">
                  {{ props.isAIMode && props.isAIStreaming ? '생각 중지' : t('editor.send') }}
                </n-button>
              </n-button-group>
            </n-config-provider>
          </div>
          <div v-if="!msgInput" class="flex items-center justify-start h-full">
            <svg
              @click="handleMoreClick"
              :class="mobilePanelState === MobilePanelStateEnum.MORE ? 'rotate-45' : 'rotate-0'"
              class="w-25px h-25px mt-2px outline-none iconpark-icon transition-transform duration-300 ease">
              <use href="#add-one"></use>
            </svg>
          </div>
        </div>
      </div>
    </form>

    <!-- 파일 업로드 팝업 -->
    <FileUploadModal
      v-model:show="showFileModal"
      :files="pendingFiles"
      @confirm="handleFileConfirm"
      @cancel="handleFileCancel" />
  </div>
</template>
<script setup lang="ts">
import { emit } from '@tauri-apps/api/event'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { onKeyStroke } from '@vueuse/core'
import { darkTheme, lightTheme, type VirtualListInst } from 'naive-ui'
import { storeToRefs } from 'pinia'
import type { Ref } from 'vue'
import { MacOsKeyEnum, MittEnum, RoomTypeEnum, ThemeEnum, WinKeyEnum } from '@/enums'
import { useCommon } from '@/hooks/useCommon.ts'
import { useMitt } from '@/hooks/useMitt.ts'
import { useMsgInput } from '@/hooks/useMsgInput.ts'
import { useGlobalStore } from '@/stores/global'
import { useSettingStore } from '@/stores/setting.ts'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { isMac, isMobile } from '@/utils/PlatformConstants'
import { useSendOptions } from '@/views/moreWindow/settings/config.ts'
import { useGroupStore } from '@/stores/group'
import { MobilePanelStateEnum } from '@/enums'
import { useI18n, I18nT } from 'vue-i18n'

interface Props {
  isAIMode?: boolean
  isAIStreaming?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isAIMode: false,
  isAIStreaming: false
})

const { t } = useI18n()
const appWindow = WebviewWindow.getCurrent()
const settingStore = useSettingStore()
const { themes } = storeToRefs(settingStore)
const { handlePaste, processFiles } = useCommon()
const sendOptions = useSendOptions()
/** 전송 버튼 옆 화살표 */
const arrow = ref(false)
/** 입력 상자 DOM 요소 */
const messageInputDom = ref<HTMLElement>()
const gloabalStore = useGlobalStore()
const { currentSession: activeItem } = storeToRefs(gloabalStore)
/** ait 가상 리스트 */
const virtualListInstAit = useTemplateRef<VirtualListInst>('virtualListInst-ait')
/** AI 가상 리스트 */
const virtualListInstAI = useTemplateRef<VirtualListInst>('virtualListInst-AI')
// 녹음 모드 상태
const isVoiceMode = ref(false)
const groupStore = useGroupStore()

// 파일 업로드 팝업 상태
const showFileModal = ref(false)
const pendingFiles = ref<File[]>([])

/** useMsgInput 관련 메서드 가져오기 */
const {
  inputKeyDown,
  handleAit,
  handleAI,
  handleInput,
  msgInput,
  send,
  sendLocationDirect,
  sendFilesDirect,
  sendVoiceDirect,
  sendEmojiDirect,
  personList,
  disabledSend,
  ait,
  aiDialogVisible,
  selectedAIKey,
  chatKey,
  menuList,
  selectedAitKey,
  groupedAIModels,
  updateSelectionRange,
  focusOn,
  getCursorSelectionRange
} = useMsgInput(messageInputDom)

/** 폼 제출 처리 함수 */
const handleFormSubmit = async (e: Event) => {
  e.preventDefault()
  await send()
}

/** 입력창 포커스 함수 */
const focusInput = () => {
  if (messageInputDom.value) {
    focusOn(messageInputDom.value)
    setIsFocus(true) // 모바일 적응형
  }
}

/** 입력창 포커스 해제 처리 함수 */
const handleBlur = () => {
  setIsFocus(false) // 모바일 적응형
}

/** 채팅 대상 전환 시 다시 포커스 */
watch(activeItem, () => {
  nextTick(() => {
    // 모바일에서는 자동 포커스 끄기
    if (!isMobile()) {
      const inputDiv = document.getElementById('message-input')
      inputDiv?.focus()
      setIsFocus(true)
    }
  })
})

/** ait 사용자 목록 변경 시 항상 첫 번째 선택 */
watch(personList, (newList) => {
  if (newList.length > 0) {
    /** 스크롤바를 첫 번째로 이동 설정 */
    virtualListInstAit.value?.scrollTo({ key: newList[0].uid })
    selectedAitKey.value = newList[0].uid
  } else {
    // 일치하는 사용자가 없을 때 즉시 @ 상태 닫고, 엔터 키를 놓아 사용자가 메시지를 보낼 수 있게 함
    ait.value = false
  }
})

// /** AI 목록 변경 시 항상 첫 번째 선택 */
// watch(groupedAIModels, (newList) => {
//   if (newList.length > 0) {
//     /** 스크롤바를 첫 번째로 이동 설정 */
//     virtualListInstAI.value?.scrollTo({ key: newList[0].uid })
//     selectedAIKey.value = newList[0].uid
//   }
// })
const handleInternalInput = (e: Event) => {
  handleInput(e)
  selfEmitter('input', e)
}

// 파일 팝업 표시 콜백 함수
const showFileModalCallback = (files: File[]) => {
  pendingFiles.value = files
  showFileModal.value = true
}

const onPaste = async (e: ClipboardEvent) => {
  if (messageInputDom.value) await handlePaste(e, messageInputDom.value, showFileModalCallback)
}

// 팝업 확인 처리
const handleFileConfirm = async (files: File[]) => {
  try {
    await sendFilesDirect(files)
  } catch (error) {
    console.error('팝업 파일 전송 실패:', error)
  }
  showFileModal.value = false
  pendingFiles.value = []
}

// 팝업 취소 처리
const handleFileCancel = () => {
  showFileModal.value = false
  pendingFiles.value = []
}

/** 위치 선택 완료 콜백 */
const handleLocationSelected = async (locationData: any) => {
  await sendLocationDirect(locationData)
}

/** 키보드 상하 키로 멘션 항목 전환 처리 */
const handleAitKeyChange = (
  direction: 1 | -1,
  list: Ref<any[]>,
  virtualListInst: VirtualListInst,
  key: Ref<number | string | null>
) => {
  const currentIndex = list.value.findIndex((item) => item.uid === key.value)
  const newIndex = Math.max(0, Math.min(currentIndex + direction, list.value.length - 1))
  key.value = list.value[newIndex].uid
  // 새 선택 항목의 인덱스를 가져와 해당 위치로 스크롤 (key를 사용하여 위치 지정)
  virtualListInst?.scrollTo({ index: newIndex })
}

const closeMenu = (event: any) => {
  /** 클릭한 요소가 .context-menu 클래스가 아닐 때만 메뉴 닫기 */
  if (!event.target.matches('#message-input, #message-input *')) {
    ait.value = false
  }
}

/** 브라우저 기본 전체 선택 단축키 비활성화, 입력창에 내용이 있거나 포커스된 경우 제외 */
const disableSelectAll = (e: KeyboardEvent) => {
  if (e.ctrlKey && e.key === 'a') {
    const inputDiv = document.getElementById('message-input')
    // 입력창 존재 여부, 내용 유무, 포커스 여부 확인
    const hasFocus = document.activeElement === inputDiv
    const hasContent = inputDiv && inputDiv.textContent && inputDiv.textContent.trim().length > 0

    // 입력창이 포커스되지 않았거나 내용이 없을 때만 기본 동작 방지
    if (!hasFocus || !hasContent) {
      e.preventDefault()
    }
  }
}

// 음성 녹음 관련 이벤트 처리
const handleVoiceCancel = () => {
  isVoiceMode.value = false
}

// Enum을 사용하여 모바일 패널 상태 관리
const mobilePanelState = ref<MobilePanelStateEnum>(MobilePanelStateEnum.NONE)

// 공통 타입 정의
interface ClickState {
  panelState: MobilePanelStateEnum
}

interface AISendData {
  content: string
}

/**
 * 사용자 정의 이벤트
 * clickMore: 더보기 버튼 클릭
 * clickEmoji: 이모티콘 버튼 클릭
 * clickVoice: 음성 버튼 클릭
 */
const selfEmitter = defineEmits<{
  (e: 'clickMore', data: ClickState): void
  (e: 'clickEmoji', data: ClickState): void
  (e: 'clickVoice', data: ClickState): void
  (e: 'customFocus', data: ClickState): void
  (e: 'send', data: ClickState): void
  (e: 'input', event: Event): void
  (e: 'send-ai', data: AISendData): void
  (e: 'stop-ai'): void
}>()

/** 포커스 상태 설정 */
const setIsFocus = (value: boolean) => {
  // 모바일: 현재 패널이 열려있는 상태(이모티콘, 음성, 더보기)라면 포커스로 인해 패널을 닫지 않음
  if (
    isMobile() &&
    !value &&
    (mobilePanelState.value === MobilePanelStateEnum.EMOJI ||
      mobilePanelState.value === MobilePanelStateEnum.VOICE ||
      mobilePanelState.value === MobilePanelStateEnum.MORE)
  ) {
    // 현재 패널 상태 유지, 닫지 않음
    return
  }

  mobilePanelState.value = value ? MobilePanelStateEnum.FOCUS : MobilePanelStateEnum.NONE

  selfEmitter('customFocus', {
    panelState: mobilePanelState.value
  })
}

/** 더보기 버튼 클릭 */
const handleMoreClick = () => {
  mobilePanelState.value =
    mobilePanelState.value === MobilePanelStateEnum.MORE ? MobilePanelStateEnum.NONE : MobilePanelStateEnum.MORE

  selfEmitter('clickMore', {
    panelState: mobilePanelState.value
  })
}

/** 이모티콘 버튼 클릭 */
const handleEmojiClick = () => {
  mobilePanelState.value =
    mobilePanelState.value === MobilePanelStateEnum.EMOJI ? MobilePanelStateEnum.NONE : MobilePanelStateEnum.EMOJI

  selfEmitter('clickEmoji', {
    panelState: mobilePanelState.value
  })
}

/** 음성 버튼 클릭 */
const handleVoiceClick = () => {
  mobilePanelState.value =
    mobilePanelState.value === MobilePanelStateEnum.VOICE ? MobilePanelStateEnum.NONE : MobilePanelStateEnum.VOICE

  selfEmitter('clickVoice', {
    panelState: mobilePanelState.value
  })
}

const getInputContent = (): string => {
  if (messageInputDom.value) {
    const innerHTML = messageInputDom.value.innerHTML || ''

    // 이모티콘이 있는지 확인
    if (innerHTML.includes('data-type="emoji"')) {
      return 'emoji' // 비어있지 않은 문자열 반환하여 내용 있음을 표시
    }

    // 이미지가 있는지 확인
    if (innerHTML.includes('<img') || innerHTML.includes('data-type=')) {
      return 'image' // 비어있지 않은 문자열 반환하여 내용 있음을 표시
    }

    // 텍스트 내용 반환
    return messageInputDom.value.textContent?.trim() || ''
  }
  return ''
}

/**
 * 판단 로직:
 * 1. 선택된 AI 모델이 있는 경우 -> AI 전송 [미구현]
 * 2. 현재 AI 대화 모드인 경우 -> AI 전송
 * 3. 기본 -> IM 전송
 */
const determineSendType = (): 'ai' | 'im' => {
  if (props.isAIMode) {
    return 'ai'
  }
  return 'im'
}

// 모바일 전송 로직
const handleMobileSend = async () => {
  const isAi = determineSendType() === 'ai'
  if (isAi && props.isAIStreaming) {
    selfEmitter('stop-ai')
    return
  }
  const content = getInputContent()
  if (!content.trim()) {
    window.$message.warning('메시지 내용을 입력하세요')
    return
  }
  if (isAi) {
    await handleAISend()
  } else {
    await send()
  }

  // 전송 후 패널 닫지 않고 현재 상태 유지
  selfEmitter('send', {
    panelState: mobilePanelState.value
  })

  // 모바일에서 메시지 전송 후 입력창 다시 포커스
  if (isMobile()) {
    focusInput()
  }
}

// 입력창 비우기
const clearInput = () => {
  if (messageInputDom.value) {
    messageInputDom.value.textContent = ''
    // 입력 이벤트 트리거하여 상태 업데이트
    const event = new Event('input', { bubbles: true })
    messageInputDom.value.dispatchEvent(event)
  }
}

// AI 전송 로직
const handleAISend = async () => {
  const content = getInputContent()
  if (!content.trim()) {
    window.$message.warning('메시지 내용을 입력하세요')
    return
  }

  selfEmitter('send-ai', {
    content: content
  })
  clearInput()
}

// 데스크톱 전송 로직
const handleDesktopSend = async () => {
  const isAi = determineSendType() === 'ai'
  if (isAi && props.isAIStreaming) {
    selfEmitter('stop-ai')
    return
  }
  const content = getInputContent()
  if (!content.trim()) {
    window.$message.warning('메시지 내용을 입력하세요')
    return
  }
  if (isAi) {
    await handleAISend()
  } else {
    await send()
  }
}

const handleEnterKey = (e: KeyboardEvent) => {
  if (determineSendType() === 'ai') {
    e.preventDefault()
    e.stopPropagation()
    if (props.isAIStreaming) {
      selfEmitter('stop-ai')
      return
    }
    handleAISend()
  } else {
    inputKeyDown(e)
  }
}

/** 모바일 패널 닫기 리스너 */
const listenMobilePanelHandler = () => {
  mobilePanelState.value = MobilePanelStateEnum.NONE
}

/** 모바일 패널 닫기 리스너 */
const listenMobileClosePanel = () => {
  useMitt.on(MittEnum.MOBILE_CLOSE_PANEL, listenMobilePanelHandler)
}

/** 모바일 패널 닫기 제거 */
const removeMobileClosePanel = () => {
  useMitt.off(MittEnum.MOBILE_CLOSE_PANEL, listenMobilePanelHandler)
}

/** 컴포넌트 메서드 및 속성 내보내기 */
defineExpose({
  messageInputDom,
  updateSelectionRange,
  focus: () => focusInput(),
  getLastEditRange: () => getCursorSelectionRange(),
  showFileModal: showFileModalCallback,
  isVoiceMode: readonly(isVoiceMode),
  handleVoiceCancel,
  sendVoiceDirect,
  sendFilesDirect,
  sendEmojiDirect,
  handleLocationSelected
})

/** 모바일 전용 어댑터 이벤트 (종료) */

onMounted(async () => {
  if (isMobile()) {
    listenMobileClosePanel()
  }
  onKeyStroke('Enter', () => {
    if (ait.value && Number(selectedAitKey.value) > -1) {
      const item = personList.value.find((item) => item.uid === selectedAitKey.value)
      if (item) {
        handleAit(item)
      }
    }
    // } else if (aiDialogVisible.value && Number(selectedAIKey.value) > -1) {
    //   const item = groupedAIModels.value.find((item) => item.uid === selectedAIKey.value)
    //   if (item) {
    //     handleAI(item)
    //   }
    // }
  })
  onKeyStroke('ArrowUp', (e) => {
    e.preventDefault()
    if (ait.value) {
      handleAitKeyChange(-1, personList, virtualListInstAit.value!, selectedAitKey)
    } else if (aiDialogVisible.value) {
      handleAitKeyChange(-1, groupedAIModels, virtualListInstAI.value!, selectedAIKey)
    }
  })
  onKeyStroke('ArrowDown', (e) => {
    e.preventDefault()
    if (ait.value) {
      handleAitKeyChange(1, personList, virtualListInstAit.value!, selectedAitKey)
    } else if (aiDialogVisible.value) {
      handleAitKeyChange(1, groupedAIModels, virtualListInstAI.value!, selectedAIKey)
    }
  })
  // TODO: 독립 창 채팅 기능은 일시적으로 비활성화됨
  emit('aloneWin')
  nextTick(() => {
    // 모바일에서는 자동 포커스 끄기
    if (!isMobile()) {
      const inputDiv = document.getElementById('message-input')
      inputDiv?.focus()
      setIsFocus(true)
    }
  })
  // TODO 열린 창의 item을 set에 저장해야 함. 입력창과 메시지 표시의 조합을 수정해야 함. 입력창과 메시지 표시 모듈은 일체형이어야 하며 각 사용자마다 독립적이어야 함. 그래야 이 사용자 상자를 클릭하여 메시지를 입력할 때 정보를 임시 저장할 수 있고, 각 메시지 상자가 그룹 채팅인지 개인 채팅인지 유형을 판단할 수 있음. 그렇지 않으면 예를 들어 @ 상자가 개인 채팅 상자에 나타날 수 있음 (nyh -> 2024-04-09 01:03:59)
  /** 독립 창이 아닐 때, 즉 컴포넌트 간 통신 후 정보 대화 변화를 감지할 때 */
  useMitt.on(MittEnum.AT, (event: any) => {
    handleAit(groupStore.getUserInfo(event)!)
  })
  // 녹음 모드 전환 이벤트 리스너
  useMitt.on(MittEnum.VOICE_RECORD_TOGGLE, () => {
    isVoiceMode.value = !isVoiceMode.value
  })

  // ESC 키로 음성 모드 종료 추가
  onKeyStroke('Escape', () => {
    if (isVoiceMode.value) {
      isVoiceMode.value = false
    }
  })
  appWindow.listen('screenshot', async (e: any) => {
    // 입력창 포커스 확인
    if (messageInputDom.value) {
      messageInputDom.value.focus()
      try {
        // ArrayBuffer 배열에서 Blob 객체 재구성
        const buffer = new Uint8Array(e.payload.buffer)
        const blob = new Blob([buffer], { type: e.payload.mimeType })
        const file = new File([blob], 'screenshot.png', { type: e.payload.mimeType })

        await processFiles([file], messageInputDom.value, showFileModalCallback)
      } catch (error) {
        console.error('스크린샷 처리 실패:', error)
      }
    }
  })
  window.addEventListener('click', closeMenu, true)
  window.addEventListener('keydown', disableSelectAll)
})

onUnmounted(() => {
  window.removeEventListener('click', closeMenu, true)
  window.removeEventListener('keydown', disableSelectAll)

  if (isMobile()) {
    removeMobileClosePanel()
  }
})

watch(
  () => props.isAIMode,
  (newValue) => {
    if (!newValue) {
      selectedAIKey.value = null
    }
  }
)
</script>

<style scoped lang="scss">
@use '@/styles/scss/msg-input';
// 자식 컴포넌트에 props 전달 시 div가 추가되어 스타일 적용
.msg-input-container {
  display: contents;
}
</style>
