import { Channel, invoke } from '@tauri-apps/api/core'
import { readImage, readText } from '@tauri-apps/plugin-clipboard-manager'
import { useDebounceFn } from '@vueuse/core'
import pLimit from 'p-limit'
import { storeToRefs } from 'pinia'
import type { Ref } from 'vue'
import { nextTick } from 'vue'
import { LimitEnum, MessageStatusEnum, MittEnum, MsgEnum, TauriCommand, UploadSceneEnum } from '@/enums'
import { useMitt } from '@/hooks/useMitt.ts'
import type { AIModel } from '@/services/types.ts'
import type { BaseUserItem } from '@/stores/cached.ts'
import { useChatStore } from '@/stores/chat.ts'
import { useGlobalStore } from '@/stores/global.ts'
import { useGroupStore } from '@/stores/group.ts'
import { useSettingStore } from '@/stores/setting.ts'
import { messageStrategyMap } from '@/strategy/MessageStrategy.ts'
import { fixFileMimeType, getMessageTypeByFile } from '@/utils/FileType.ts'
import { generateVideoThumbnail } from '@/utils/VideoThumbnail'
import { processClipboardImage } from '@/utils/ImageUtils.ts'
import { getReplyContent } from '@/utils/MessageReply.ts'
import { isMac, isMobile, isWindows } from '@/utils/PlatformConstants'
import { type SelectionRange, useCommon } from './useCommon.ts'
import { globalFileUploadQueue } from './useFileUploadQueue.ts'
import { useTrigger } from './useTrigger'
import { UploadProviderEnum, useUpload } from './useUpload.ts'
import { useI18n } from 'vue-i18n'

/**
 * 커서 관리자
 */
export function useCursorManager() {
  /**
   * 현재 커서 범위 기록
   */
  let cursorSelectionRange: SelectionRange | null = null
  /**
   * 현재 에디터의 선택 범위 기록
   */
  const updateSelectionRange = (sr: SelectionRange | null) => {
    cursorSelectionRange = sr
  }

  const getCursorSelectionRange = () => {
    return cursorSelectionRange
  }

  /**
   * 지정된 에디터 요소에 포커스
   * @param editor 포커스할 에디터 요소
   */
  const focusOn = (editor: HTMLElement) => {
    editor.focus()

    const selection = window.getSelection()
    if (!selection) return
    const selectionRange = getCursorSelectionRange()
    if (!selectionRange) return

    const range = document.createRange()
    range.selectNodeContents(editor)
    range.collapse(false)
    selection?.removeAllRanges()
    selection?.addRange(selectionRange.range)
  }

  return { getCursorSelectionRange, updateSelectionRange, focusOn }
}

export const useMsgInput = (messageInputDom: Ref) => {
  const { t } = useI18n()
  const groupStore = useGroupStore()
  const chatStore = useChatStore()
  const globalStore = useGlobalStore()
  const { uploadToQiniu } = useUpload()
  const { getCursorSelectionRange, updateSelectionRange, focusOn } = useCursorManager()
  const {
    triggerInputEvent,
    insertNode,
    getMessageContentType,
    getEditorRange,
    imgPaste,
    saveCacheFile,
    reply,
    userUid
  } = useCommon()
  const settingStore = useSettingStore()
  const { chat } = storeToRefs(settingStore)
  /** 멘션(@) 옵션의 key */
  const chatKey = ref(chat.value.sendKey)
  /** 입력 상자 내용 */
  const msgInput = ref('')
  /** 보내기 버튼 비활성화 여부 */
  const disabledSend = computed(() => {
    const plainText = stripHtml(msgInput.value)
    return (
      plainText.length === 0 ||
      plainText
        .replace(/&nbsp;/g, ' ')
        .replace(/\u00A0/g, ' ')
        .trim().length === 0
    )
  })
  // @멘션 팝업
  const ait = ref(false)
  const aitKey = ref('')
  // AI 팝업
  const aiDialogVisible = ref(false)
  const aiKeyword = ref('')
  const aiModelList = ref<AIModel[]>([
    {
      uid: '1',
      type: 'Ollama',
      name: 'DeepSeek-Chat',
      value: 'deepseek-chat',
      avatar: '/AI/deepseek.png'
    },
    {
      uid: '1b',
      type: 'Ollama',
      name: 'DeepSeek-Reasoner',
      value: 'deepseek-reasoner',
      avatar: '/AI/deepseek.png'
    },
    {
      uid: '2',
      type: 'Ollama',
      name: 'Tongyi Qianwen-Plus',
      value: 'qwen-plus',
      avatar: '/AI/QW.png'
    },
    {
      uid: '3',
      type: 'OpenAI',
      name: 'ChatGPT-4',
      value: 'ChatGPT-4',
      avatar: '/AI/openai.svg'
    }
  ])
  // 계산된 속성을 사용하여 그룹화된 데이터 가져오기
  const groupedAIModels = computed(() => {
    if (aiKeyword.value && !isChinese.value) {
      return aiModelList.value.filter((i) => i.name?.startsWith(aiKeyword.value))
    } else {
      return aiModelList.value
    }
  })
  /** 현재 선택된 AI 옵션 key 기록 */
  // /로 패널이 닫힐 때 현재 선택 항목을 비워야 하므로 null 허용
  const selectedAIKey = ref<string | null>(groupedAIModels.value[0]?.uid ?? null)

  // #토픽 팝업
  const topicDialogVisible = ref(false)
  const topicKeyword = ref('')
  const topicList = ref([
    {
      uid: '1',
      label: '토픽1',
      value: '토픽1'
    },
    {
      uid: '2',
      label: '토픽2',
      value: '토픽2'
    }
  ])

  /** 병음 입력 중인지 여부 */
  const isChinese = ref(false)
  // 에디터 커서 위치 기록
  const editorRange = ref<{ range: Range; selection: Selection } | null>(null)
  /** @ 후보 목록 */
  const personList = computed(() => {
    if (aitKey.value && !isChinese.value) {
      return groupStore.userList.filter((user) => {
        // 그룹 닉네임(myName)과 원래 이름(name)을 모두 일치시킴
        const displayName = user.myName || user.name
        return displayName?.startsWith(aitKey.value) && user.uid !== userUid.value
      })
    } else {
      // 현재 로그인한 사용자 필터링
      return groupStore.userList.filter((user) => user.uid !== userUid.value)
    }
  })
  /** 현재 선택된 멘션 항목 key 기록 */
  const selectedAitKey = ref(personList.value[0]?.uid ?? null)
  /** 우클릭 메뉴 목록 */
  const menuList = ref([
    { label: () => t('editor.menu.cut'), icon: 'screenshot', disabled: true },
    { label: () => t('editor.menu.copy'), icon: 'copy', disabled: true },
    {
      label: () => t('editor.menu.paste'),
      icon: 'intersection',
      click: async () => {
        try {
          let imageProcessed = false

          // Tauri의 readImage API를 사용하여 클립보드 이미지 가져오기
          const clipboardImage = await readImage().catch(() => null)
          if (clipboardImage) {
            try {
              // 유틸리티 함수를 사용하여 클립보드 이미지 데이터 처리
              const file = await processClipboardImage(clipboardImage)

              messageInputDom.value.focus()
              nextTick(() => {
                // File 객체를 사용하여 캐시 메커니즘 트리거
                imgPaste(file, messageInputDom.value)
              })

              imageProcessed = true
            } catch (error) {
              console.error('Tauri 이미지 데이터 처리 실패:', error)
            }
          }

          // 이미지가 없으면 텍스트 읽기 시도
          if (!imageProcessed) {
            const content = await readText().catch(() => null)
            if (content) {
              messageInputDom.value.focus()
              nextTick(() => {
                insertNode(MsgEnum.TEXT, content, {} as HTMLElement)
                triggerInputEvent(messageInputDom.value)
              })
              return
            } else {
              // 이미지도 텍스트도 없을 때 메시지 표시
              alert('클립보드에서 지원하는 형식의 내용을 가져올 수 없습니다. ctrl/command + v를 사용해 주세요')
            }
          }
        } catch (error) {
          console.error('붙여넣기 실패:', error)
        }
      }
    },
    { label: () => t('editor.menu.save_as'), icon: 'Importing', disabled: true },
    { label: () => t('editor.menu.select_all'), icon: 'check-one' }
  ])

  // useTrigger 초기화를 여기로 이동
  const { handleTrigger, resetAllStates } = useTrigger(
    personList,
    groupedAIModels,
    topicList,
    ait,
    aitKey,
    aiDialogVisible,
    aiKeyword,
    topicDialogVisible,
    topicKeyword
  )

  watchEffect(() => {
    chatKey.value = chat.value.sendKey
    if (!ait.value && personList.value.length > 0) {
      selectedAitKey.value = personList.value[0]?.uid
    }
    if (groupedAIModels.value.length === 0) {
      // 선택 가능한 모델이 없을 때 팝업을 닫고 커서를 비워 Enter 키 오작동 방지
      selectedAIKey.value = null
      aiDialogVisible.value = false
    } else if (!aiDialogVisible.value) {
      selectedAIKey.value = groupedAIModels.value[0]?.uid
    }
    // 입력 상자에 값이 없으면 답장 내용 지우기
    if (msgInput.value === '') {
      reply.value = { avatar: '', imgCount: 0, accountName: '', content: '', key: 0 }
    }
  })

  watch(chatKey, (v) => {
    chat.value.sendKey = v
  })

  /**
   * HTML 내용에서 @ 사용자의 uid 추출
   * @param content HTML 형식의 메시지 내용
   * @param userList 사용자 목록
   * @returns @된 사용자의 uid 배열
   */
  const extractAtUserIds = (content: string, userList: BaseUserItem[]): string[] => {
    const atUserIds: string[] = []

    // HTML 파싱을 위한 임시 DOM 요소 생성
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = content

    // @ 태그 노드를 통해 우선 추출
    // uid가 있는 @ 노드를 우선 읽어 실제로 선택된 멤버만 집계
    const mentionNodes = tempDiv.querySelectorAll<HTMLElement>('#aitSpan, [data-ait-uid]')
    mentionNodes.forEach((node) => {
      const uid = node.dataset.aitUid
      if (uid) {
        atUserIds.push(uid)
        return
      }
      const name = node.textContent?.replace(/^@/, '')?.trim()
      if (!name) return
      const user = userList.find((u) => u.name === name)
      if (user) {
        atUserIds.push(user.uid)
      }
    })

    if (atUserIds.length > 0) {
      return [...new Set(atUserIds)]
    }

    // 일반 텍스트 내용 가져오기
    const textContent = tempDiv.textContent || ''

    // 더 정확한 정규식을 사용하여 @ 사용자 일치
    // @ 뒤의 공백이 아닌 문자를 일치시키고, 공백 문자나 문자열 끝을 만날 때까지
    const regex = /@([^\s]+)/g
    const matches = textContent.match(regex)

    if (matches) {
      matches.forEach((match) => {
        const username = match.slice(1) // @ 기호 제거
        const user = userList.find((u) => u.name === username)
        if (user) {
          atUserIds.push(user.uid)
        }
      })
    }

    // 중복 제거 후 반환
    return [...new Set(atUserIds)]
  }

  // HTML 문자열을 Document 객체로 안전하게 파싱
  const parseHtmlSafely = (html: string) => {
    if (!html) return null

    if (typeof DOMParser !== 'undefined') {
      return new DOMParser().parseFromString(html, 'text/html')
    }

    return null
  }

  /** html 태그 제거 (답장 시 입력 내용이 있는지 확인하기 위함) */
  const stripHtml = (html: string) => {
    try {
      // 이모티콘인지 확인
      if (html.includes('data-type="emoji"')) {
        const doc = parseHtmlSafely(html)
        const imgElement = doc?.querySelector<HTMLImageElement>('img[data-type]')
        if (imgElement) {
          const serverUrl = imgElement.dataset?.serverUrl
          if (serverUrl) {
            return (msgInput.value = serverUrl)
          }
          if (imgElement.src) {
            return (msgInput.value = imgElement.src)
          }
        }
      }
      // 비디오인지 확인
      if (html.includes('data-type="video"')) {
        return html
      }

      const doc = parseHtmlSafely(html)
      if (!doc || !doc.body) {
        let sanitized = html
        let previous
        do {
          previous = sanitized
          sanitized = sanitized.replace(/<[^>]*>/g, '')
        } while (sanitized !== previous)
        return sanitized.trim()
      }

      const replyDiv = doc.querySelector('#replyDiv')
      replyDiv?.remove()

      // 붙여넣은 이미지가 포함되어 있는지 확인 (temp-image id가 있는 이미지 요소)
      const pastedImage = doc.querySelector('#temp-image')
      if (pastedImage) {
        return 'image' // 내용이 있음을 나타내는 비어 있지 않은 문자열 반환
      }

      const textContent = doc.body.textContent?.trim()
      if (textContent) return textContent

      const innerText = (doc.body as HTMLElement).innerText?.trim?.()
      if (innerText) return innerText

      return ''
    } catch (error) {
      console.error('stripHtml 오류:', error)
      return ''
    }
  }

  /** 입력 상자 내용 초기화 */
  const resetInput = () => {
    try {
      msgInput.value = ''
      messageInputDom.value.innerHTML = ''
      // 모든 공백 문자를 완전히 제거
      messageInputDom.value.textContent = ''
      reply.value = { avatar: '', imgCount: 0, accountName: '', content: '', key: 0 }
    } catch (error) {
      console.error('resetInput 오류:', error)
    }
  }

  const retainRawContent = (type: MsgEnum) => [MsgEnum.EMOJI, MsgEnum.IMAGE].includes(type)

  /** 정보 전송 이벤트 처리 */
  // TODO 메시지를 전환할 때 이전에 입력 상자에 있던 내용을 기록해야 함 (nyh -> 2024-03-01 07:03:43)
  const send = async () => {
    const targetRoomId = globalStore.currentSessionRoomId
    // 입력 상자의 이미지 또는 파일 수가 제한을 초과하는지 확인
    if (messageInputDom.value.querySelectorAll('img').length > LimitEnum.COM_COUNT) {
      window.$message.warning(`한 번에 ${LimitEnum.COM_COUNT}개의 파일 또는 이미지만 업로드할 수 있습니다`)
      return
    }
    const contentType = getMessageContentType(messageInputDom)
    // 메시지 유형에 따른 메시지 처리 전략 가져오기
    const messageStrategy = messageStrategyMap[contentType]
    if (!messageStrategy) {
      window.$message.warning('해당 유형의 메시지 전송은 지원되지 않습니다')
      return
    }
    // id="replyDiv" 요소의 내용 제외
    const replyDiv = messageInputDom.value.querySelector('#replyDiv')
    if (replyDiv) {
      replyDiv?.remove()
      // 답장 내용이 링크인 경우 링크 데이터 유지
      if (!retainRawContent(contentType))
        msgInput.value = messageInputDom.value.innerHTML.replace(replyDiv.outerHTML, '')
    }
    const msg = await messageStrategy.getMsg(msgInput.value, reply.value)
    const atUidList = extractAtUserIds(msgInput.value, groupStore.userList)
    const tempMsgId = 'T' + Date.now().toString()

    // 메시지 유형에 따라 메시지 본문 생성
    const messageBody = {
      ...messageStrategy.buildMessageBody(msg, reply),
      atUidList
    }

    // 임시 메시지 객체 생성
    const tempMsg = await messageStrategy.buildMessageType(tempMsgId, messageBody, globalStore, userUid)
    resetInput()

    tempMsg.message.status = MessageStatusEnum.SENDING
    // 메시지 목록에 먼저 추가
    chatStore.pushMsg(tempMsg)

    // 전송 상태 설정 타이머
    chatStore.updateMsg({
      msgId: tempMsgId,
      status: MessageStatusEnum.SENDING
    })

    // 모바일에서 메시지 전송 후 입력 상자에 다시 포커스
    if (isMobile()) {
      nextTick(() => {
        focusOn(messageInputDom.value)
      })
    }

    try {
      // 이미지 또는 이모티콘 메시지인 경우 먼저 파일 업로드 필요
      if (msg.type === MsgEnum.IMAGE || msg.type === MsgEnum.EMOJI) {
        // TODO: 기본 업로드 방식을 사용하면 uploadFile 메소드가 업로드 및 다운로드 링크를 반환하지만, Qiniu 클라우드 업로드 방식을 사용하면 doUpload 메소드를 호출해야 해당 다운로드 링크가 반환됨
        const { uploadUrl, downloadUrl, config } = await messageStrategy.uploadFile(msg.path, {
          provider: UploadProviderEnum.QINIU
        })
        const doUploadResult = await messageStrategy.doUpload(msg.path, uploadUrl, config)
        // 메시지 본문의 URL을 서버 URL로 업데이트 (Qiniu 클라우드인지 기본 업로드 방식인지 판단), provider가 없으면 기본값으로 downloadUrl 할당
        messageBody.url =
          config?.provider && config?.provider === UploadProviderEnum.QINIU ? doUploadResult?.qiniuUrl : downloadUrl
        delete messageBody.path // 임시 경로 삭제

        // 임시 메시지 URL 업데이트
        chatStore.updateMsg({
          msgId: tempMsgId,
          body: {
            ...messageBody
          },
          status: MessageStatusEnum.SENDING
        })
      } else if (msg.type === MsgEnum.VIDEO) {
        // 썸네일 먼저 업로드 (중복 제거 기능 사용)
        let uploadResult: string
        if (messageStrategy.uploadThumbnail && messageStrategy.doUploadThumbnail) {
          const thumbnailUploadInfo = await messageStrategy.uploadThumbnail(msg.thumbnail, {
            provider: UploadProviderEnum.QINIU
          })
          const thumbnailUploadResult = await messageStrategy.doUploadThumbnail(
            msg.thumbnail,
            thumbnailUploadInfo.uploadUrl,
            thumbnailUploadInfo.config
          )
          uploadResult =
            thumbnailUploadInfo.config?.provider === UploadProviderEnum.QINIU
              ? thumbnailUploadResult?.qiniuUrl || thumbnailUploadInfo.downloadUrl
              : thumbnailUploadInfo.downloadUrl
        } else {
          uploadResult = await useUpload()
            .uploadFile(msg.thumbnail, {
              provider: UploadProviderEnum.QINIU,
              scene: UploadSceneEnum.CHAT
            })
            .then((UploadResult) => {
              return UploadResult.downloadUrl
            })
        }

        // 비디오 파일 업로드
        const { uploadUrl, downloadUrl, config } = await messageStrategy.uploadFile(msg.path, {
          provider: UploadProviderEnum.QINIU
        })
        const doUploadResult = await messageStrategy.doUpload(msg.path, uploadUrl, config)
        messageBody.url =
          config?.provider && config?.provider === UploadProviderEnum.QINIU ? doUploadResult?.qiniuUrl : downloadUrl
        delete messageBody.path // 임시 경로 삭제
        messageBody.thumbUrl = uploadResult
        messageBody.thumbSize = msg.thumbnail.size
        messageBody.thumbWidth = 300
        messageBody.thumbHeight = 150

        // 임시 메시지 URL 업데이트
        chatStore.updateMsg({
          msgId: tempMsgId,
          body: {
            ...messageBody
          },
          status: MessageStatusEnum.SENDING
        })
      }
      // 서버로 메시지 전송 - channel 방식 사용
      const successChannel = new Channel<any>()
      const errorChannel = new Channel<string>()

      // 성공 응답 수신
      successChannel.onmessage = (message) => {
        chatStore.updateMsg({
          msgId: message.oldMsgId,
          status: MessageStatusEnum.SUCCESS,
          newMsgId: message.message.id,
          body: message.message.body,
          timeBlock: message.timeBlock
        })
        useMitt.emit(MittEnum.CHAT_SCROLL_BOTTOM)
      }

      // 오류 응답 수신
      errorChannel.onmessage = (msgId) => {
        chatStore.updateMsg({
          msgId: msgId,
          status: MessageStatusEnum.FAILED
        })
        useMitt.emit(MittEnum.CHAT_SCROLL_BOTTOM)
      }

      await invoke(TauriCommand.SEND_MSG, {
        data: {
          id: tempMsgId,
          roomId: targetRoomId,
          msgType: msg.type,
          body: messageBody
        },
        successChannel,
        errorChannel
      })

      // 세션 마지막 활동 시간 업데이트
      chatStore.updateSessionLastActiveTime(targetRoomId)

      // 메시지 전송 성공 후 미리보기 URL 해제
      if ((msg.type === MsgEnum.IMAGE || msg.type === MsgEnum.EMOJI) && msg.url.startsWith('blob:')) {
        URL.revokeObjectURL(msg.url)
      }

      // 비디오 썸네일 로컬 미리보기 URL 해제
      if (msg.type === MsgEnum.VIDEO && messageBody.thumbUrl && messageBody.thumbUrl.startsWith('blob:')) {
        URL.revokeObjectURL(messageBody.thumbUrl)
      }
    } catch (error) {
      console.error('메시지 전송 실패:', error)
      chatStore.updateMsg({
        msgId: tempMsgId,
        status: MessageStatusEnum.FAILED
      })

      // 미리보기 URL 해제
      if ((msg.type === MsgEnum.IMAGE || msg.type === MsgEnum.EMOJI) && msg.url.startsWith('blob:')) {
        URL.revokeObjectURL(msg.url)
      }

      // 비디오 썸네일 로컬 미리보기 URL 해제
      if (msg.type === MsgEnum.VIDEO && messageBody.thumbUrl && messageBody.thumbUrl.startsWith('blob:')) {
        URL.revokeObjectURL(messageBody.thumbUrl)
      }
    }
  }

  /** 입력 상자가 수동으로 값을 입력할 때 input 이벤트 트리거 (vueUse의 debounce 사용) */
  const handleInput = useDebounceFn(async (e: Event) => {
    const inputElement = e.target as HTMLInputElement

    // 입력 상자 내용 확인. 공백 문자, br 태그 또는 빈 요소만 있는 경우 지우기
    const textContent = inputElement.textContent || ''
    const innerHTML = inputElement.innerHTML || ''

    // 실제 내용(이미지, 비디오, 이모티콘 등)이 있는지 확인
    const hasMediaContent =
      innerHTML.includes('<img') || innerHTML.includes('<video') || innerHTML.includes('data-type=')

    // 각종 공백 문자와 빈 태그 정리
    const cleanText = textContent.replace(/[\u00A0\u0020\u2000-\u200B\u2028\u2029]/g, '').trim()
    const hasOnlyEmptyElements =
      innerHTML === '<br>' ||
      innerHTML === '<div><br></div>' ||
      innerHTML.match(/^(<br>|<div><br><\/div>|<p><br><\/p>|\s)*$/)

    // 미디어 내용이 없고 유효한 텍스트도 없는 경우에만 지우기
    if (!hasMediaContent && (cleanText === '' || hasOnlyEmptyElements)) {
      inputElement.innerHTML = ''
      inputElement.textContent = ''
      msgInput.value = ''
      // 입력 상자가 비어있을 때 모든 상태 재설정
      resetAllStates()
      return
    }
    msgInput.value = inputElement.innerHTML || ''

    /** 현재 커서가 있는 노드와 텍스트 내용 가져오기 */
    const { range, selection } = getEditorRange()!
    if (!range || !selection) {
      resetAllStates()
      return
    }

    /** 현재 노드 가져오기 */
    const curNode = range.endContainer
    /** 현재 노드가 텍스트 노드인지 확인 */
    if (!curNode || !curNode.textContent || curNode.nodeName !== '#text') {
      resetAllStates()
      return
    }

    /** 현재 커서 위치와 텍스트 내용 가져오기 */
    const cursorPosition = selection.focusOffset
    const text = curNode.textContent

    await handleTrigger(text, cursorPosition, { range, selection, keyword: '' })
  }, 0)

  /** input의 keydown 이벤트 */
  const inputKeyDown = async (e: KeyboardEvent) => {
    if (disabledSend.value) {
      e.preventDefault()
      e.stopPropagation()
      resetInput()
      return
    }

    // ait 또는 aiDialogVisible이 true일 때 기본 동작 방지
    if (ait.value || aiDialogVisible.value) {
      e?.preventDefault()
      return
    }

    // 병음 입력 중이고 macOS 시스템인 경우
    if (isChinese.value && isMac()) {
      return
    }
    const isWindowsPlatform = isWindows()
    const isEnterKey = e.key === 'Enter'
    const isCtrlOrMetaKey = isWindowsPlatform ? e.ctrlKey : e.metaKey

    const sendKeyIsEnter = chat.value.sendKey === 'Enter'
    const sendKeyIsCtrlEnter = chat.value.sendKey === `${isWindowsPlatform ? 'Ctrl' : '⌘'}+Enter`

    // 현재 시스템이 mac인 경우, 현재 chat.value.sendKey가 Enter인지 판단하고, 현재 ⌘+Enter를 눌렀는지 판단
    if (!isWindowsPlatform && chat.value.sendKey === 'Enter' && e.metaKey && e.key === 'Enter') {
      // 줄바꿈 작업 수행
      e.preventDefault()
      insertNode(MsgEnum.TEXT, '\n', {} as HTMLElement)
      triggerInputEvent(messageInputDom.value)
    }
    if (msgInput.value === '' || msgInput.value.trim() === '' || ait.value) {
      e?.preventDefault()
      return
    }
    if (!isWindowsPlatform && e.ctrlKey && isEnterKey && sendKeyIsEnter) {
      e?.preventDefault()
      return
    }
    if ((sendKeyIsEnter && isEnterKey && !isCtrlOrMetaKey) || (sendKeyIsCtrlEnter && isCtrlOrMetaKey && isEnterKey)) {
      e?.preventDefault()
      // send를 직접 호출하는 대신 form 제출 트리거
      const form = document.getElementById('message-form') as HTMLFormElement
      if (form) {
        form.requestSubmit()
      }
      resetAllStates()
    }
  }

  /** @ 멘션 클릭 이벤트 처리 */
  const handleAit = (item: BaseUserItem) => {
    // 병음 입력 중이면 메시지 보내지 않음
    if (isChinese.value) {
      return
    }
    // 입력 상자에 포커스 확인
    focusOn(messageInputDom.value)
    // 현재 에디터 범위 먼저 가져오고 저장
    const { range: currentRange, selection: currentSelection } = getEditorRange()!
    editorRange.value = { range: currentRange, selection: currentSelection }

    const myEditorRange = editorRange?.value?.range
    /** 커서 위치의 텍스트 노드 가져오기 */
    const textNode = myEditorRange?.endContainer

    // 텍스트 노드가 있으면 입력 상자 @를 통해 트리거된 것임
    if (textNode) {
      /** 텍스트 노드에서 커서의 오프셋 위치 가져오기 */
      const endOffset = myEditorRange?.endOffset
      /** 텍스트 노드의 값을 가져와 문자열로 변환 */
      const textNodeValue = textNode?.nodeValue as string
      /** 정규식을 사용하여 @ 기호 뒤에 얻은 텍스트 노드 값 일치 */
      const expRes = /@([^@]*)$/.exec(textNodeValue)
      if (expRes) {
        /** 범위의 시작 위치를 텍스트 노드의 @ 기호 위치로 설정 */
        currentRange.setStart(textNode, expRes.index)
        /** 범위의 끝 위치를 커서 위치로 설정 */
        currentRange.setEnd(textNode, endOffset!)
      }
    }

    // 사용자의 전체 정보 가져오기, 그룹 닉네임(myName) 우선 사용, 렌더링 로직과 일치
    const userInfo = groupStore.getUserInfo(item.uid)
    const displayName = userInfo?.myName || item.name

    // 어떤 상황이든 현재 커서 위치에 @멘션 삽입
    insertNode(
      MsgEnum.AIT,
      {
        name: displayName,
        uid: item.uid
      },
      {} as HTMLElement
    )
    triggerInputEvent(messageInputDom.value)
    ait.value = false
  }

  /** / 멘션 클릭 이벤트 처리 */
  const handleAI = (_item: any) => {
    // 병음 입력 중이면 메시지 보내지 않음
    if (isChinese.value) {
      return
    }

    // TODO: (임시 표시) AI 연결 중이라는 힌트 표시
    window.$message.info('현재 AI 연결 중입니다. 기대해 주세요')
    // AI 선택 팝업 닫기
    aiDialogVisible.value = false

    // 입력 상자의 / 트리거 단어 정리
    // 입력 상자에 포커스 확인
    focusOn(messageInputDom.value)
    // 현재 에디터 범위 먼저 가져오고 저장
    const { range: currentRange, selection: currentSelection } = getEditorRange()!
    editorRange.value = { range: currentRange, selection: currentSelection }

    const myEditorRange = editorRange?.value?.range
    /** 커서 위치의 텍스트 노드 가져오기 */
    const textNode = myEditorRange?.endContainer

    // 텍스트 노드가 있으면 입력 상자 /를 통해 트리거된 것임
    if (textNode) {
      /** 텍스트 노드에서 커서의 오프셋 위치 가져오기 */
      const endOffset = myEditorRange?.endOffset
      /** 텍스트 노드의 값을 가져와 문자열로 변환 */
      const textNodeValue = textNode?.nodeValue as string
      /** 정규식을 사용하여 / 기호 뒤에 얻은 텍스트 노드 값 일치 */
      const expRes = /([^/]*)$/.exec(textNodeValue)
      if (expRes) {
        /** 범위의 시작 위치를 텍스트 노드의 / 기호 위치로 설정 */
        currentRange.setStart(textNode, expRes.index)
        /** 범위의 끝 위치를 커서 위치로 설정 */
        currentRange.setEnd(textNode, endOffset!)
        //TODO: (임시 삭제) / 트리거 단어 삭제
        currentRange.deleteContents()
        triggerInputEvent(messageInputDom.value)
      }
    }
  }

  // ==================== 비디오 파일 처리 함수 ====================
  const processVideoFile = async (
    file: File,
    tempMsgId: string,
    messageStrategy: any,
    targetRoomId: string
  ): Promise<void> => {
    const tempMsg = messageStrategy.buildMessageType(
      tempMsgId,
      {
        url: URL.createObjectURL(file),
        size: file.size,
        fileName: file.name,
        thumbUrl: '',
        thumbWidth: 300,
        thumbHeight: 150,
        thumbSize: 0
      },
      globalStore,
      userUid
    )
    tempMsg.message.roomId = targetRoomId
    tempMsg.message.status = MessageStatusEnum.SENDING
    chatStore.pushMsg(tempMsg)

    let isProgressActive = true
    const cleanup = () => {
      isProgressActive = false
    }

    try {
      const [videoPath, thumbnailFile] = await Promise.all([
        saveCacheFile(file, 'video/'),
        generateVideoThumbnail(file)
      ])

      const localThumbUrl = URL.createObjectURL(thumbnailFile)
      chatStore.updateMsg({
        msgId: tempMsgId,
        status: MessageStatusEnum.SENDING,
        body: { ...tempMsg.message.body, thumbUrl: localThumbUrl, thumbSize: thumbnailFile.size }
      })

      const videoUploadResult = await messageStrategy.uploadFile(videoPath, { provider: UploadProviderEnum.QINIU })
      const qiniuConfig = videoUploadResult.config

      const { progress, onChange } = messageStrategy.getUploadProgress()
      onChange((event: string) => {
        if (!isProgressActive || event !== 'progress') return
        chatStore.updateMsg({
          msgId: tempMsgId,
          status: MessageStatusEnum.SENDING,
          uploadProgress: progress.value
        })
      })

      const [videoUploadResponse, thumbnailUploadResponse] = await Promise.all([
        messageStrategy.doUpload(videoPath, videoUploadResult.uploadUrl, {
          provider: UploadProviderEnum.QINIU,
          ...qiniuConfig
        }),
        uploadToQiniu(thumbnailFile, qiniuConfig.scene || 'CHAT', qiniuConfig, true)
      ])

      cleanup()

      const finalVideoUrl = videoUploadResponse?.qiniuUrl || videoUploadResult.downloadUrl
      const finalThumbnailUrl =
        thumbnailUploadResponse?.downloadUrl || `${qiniuConfig.domain}/${thumbnailUploadResponse?.key}`

      const successChannel = new Channel<any>()
      const errorChannel = new Channel<string>()

      successChannel.onmessage = (message) => {
        chatStore.updateMsg({
          msgId: tempMsgId,
          status: MessageStatusEnum.SUCCESS,
          newMsgId: message.message.id,
          body: message.message.body,
          timeBlock: message.timeBlock
        })
        useMitt.emit(MittEnum.CHAT_SCROLL_BOTTOM)
      }

      errorChannel.onmessage = () => {
        chatStore.updateMsg({ msgId: tempMsgId, status: MessageStatusEnum.FAILED })
        useMitt.emit(MittEnum.CHAT_SCROLL_BOTTOM)
      }

      await invoke(TauriCommand.SEND_MSG, {
        data: {
          id: tempMsgId,
          roomId: targetRoomId,
          msgType: MsgEnum.VIDEO,
          body: {
            url: finalVideoUrl,
            size: file.size,
            fileName: file.name,
            thumbUrl: finalThumbnailUrl,
            thumbWidth: 300,
            thumbHeight: 150,
            thumbSize: thumbnailFile.size,
            localPath: videoPath,
            senderUid: userUid.value
          }
        },
        successChannel,
        errorChannel
      })

      URL.revokeObjectURL(tempMsg.message.body.url)
      URL.revokeObjectURL(localThumbUrl)
    } catch (error) {
      cleanup()
      throw error
    }
  }

  // ==================== 이미지 파일 처리 함수 ====================
  const processImageFile = async (
    file: File,
    tempMsgId: string,
    messageStrategy: any,
    targetRoomId: string
  ): Promise<void> => {
    const msg = await messageStrategy.getMsg('', reply, [file])
    const messageBody = messageStrategy.buildMessageBody(msg, reply)

    const tempMsg = messageStrategy.buildMessageType(tempMsgId, messageBody, globalStore, userUid)
    tempMsg.message.roomId = targetRoomId
    tempMsg.message.status = MessageStatusEnum.SENDING
    chatStore.pushMsg(tempMsg)
    const { uploadUrl, downloadUrl, config } = await messageStrategy.uploadFile(msg.path, {
      provider: UploadProviderEnum.QINIU
    })
    const doUploadResult = await messageStrategy.doUpload(msg.path, uploadUrl, config)

    messageBody.url = config?.provider === UploadProviderEnum.QINIU ? doUploadResult?.qiniuUrl : downloadUrl
    delete messageBody.path

    chatStore.updateMsg({
      msgId: tempMsgId,
      body: messageBody,
      status: MessageStatusEnum.SENDING
    })

    const successChannel = new Channel<any>()
    const errorChannel = new Channel<string>()

    successChannel.onmessage = (message) => {
      chatStore.updateMsg({
        msgId: tempMsgId,
        status: MessageStatusEnum.SUCCESS,
        newMsgId: message.message.id,
        body: message.message.body,
        timeBlock: message.timeBlock
      })
      useMitt.emit(MittEnum.CHAT_SCROLL_BOTTOM)
    }

    errorChannel.onmessage = () => {
      chatStore.updateMsg({ msgId: tempMsgId, status: MessageStatusEnum.FAILED })
      useMitt.emit(MittEnum.CHAT_SCROLL_BOTTOM)
    }

    await invoke(TauriCommand.SEND_MSG, {
      data: {
        id: tempMsgId,
        roomId: targetRoomId,
        msgType: MsgEnum.IMAGE,
        body: messageBody
      },
      successChannel,
      errorChannel
    })

    URL.revokeObjectURL(msg.url)
    chatStore.updateSessionLastActiveTime(targetRoomId)
  }

  // ==================== 일반 파일 처리 함수 ====================
  const processGenericFile = async (
    file: File,
    tempMsgId: string,
    messageStrategy: any,
    targetRoomId: string
  ): Promise<void> => {
    const msg = await messageStrategy.getMsg('', reply, [file])
    const messageBody = messageStrategy.buildMessageBody(msg, reply)

    const tempMsg = messageStrategy.buildMessageType(tempMsgId, { ...messageBody, url: '' }, globalStore, userUid)
    tempMsg.message.roomId = targetRoomId
    tempMsg.message.status = MessageStatusEnum.SENDING
    chatStore.pushMsg(tempMsg)

    let isProgressActive = true
    const cleanup = () => {
      isProgressActive = false
    }

    try {
      const { progress, onChange } = messageStrategy.getUploadProgress()
      onChange((event: string) => {
        if (!isProgressActive || event !== 'progress') return
        chatStore.updateMsg({
          msgId: tempMsgId,
          status: MessageStatusEnum.SENDING,
          uploadProgress: progress.value
        })
      })

      const { uploadUrl, downloadUrl, config } = await messageStrategy.uploadFile(msg.path, {
        provider: UploadProviderEnum.QINIU
      })
      const doUploadResult = await messageStrategy.doUpload(msg.path, uploadUrl, config)

      cleanup()

      messageBody.url = config?.provider === UploadProviderEnum.QINIU ? doUploadResult?.qiniuUrl : downloadUrl
      delete messageBody.path

      chatStore.updateMsg({
        msgId: tempMsgId,
        body: messageBody,
        status: MessageStatusEnum.SENDING
      })

      const successChannel = new Channel<any>()
      const errorChannel = new Channel<string>()

      successChannel.onmessage = (message) => {
        chatStore.updateMsg({
          msgId: tempMsgId,
          status: MessageStatusEnum.SUCCESS,
          newMsgId: message.message.id,
          body: message.message.body,
          timeBlock: message.timeBlock
        })
        useMitt.emit(MittEnum.CHAT_SCROLL_BOTTOM)
      }

      errorChannel.onmessage = () => {
        chatStore.updateMsg({ msgId: tempMsgId, status: MessageStatusEnum.FAILED })
        useMitt.emit(MittEnum.CHAT_SCROLL_BOTTOM)
      }

      await invoke(TauriCommand.SEND_MSG, {
        data: {
          id: tempMsgId,
          roomId: targetRoomId,
          msgType: MsgEnum.FILE,
          body: messageBody
        },
        successChannel,
        errorChannel
      })

      chatStore.updateSessionLastActiveTime(targetRoomId)
    } catch (error) {
      cleanup()
      throw error
    }
  }

  onMounted(async () => {
    useMitt.on(MittEnum.RE_EDIT, async (event: string) => {
      messageInputDom.value.focus()
      await nextTick(() => {
        messageInputDom.value.innerHTML = event
        msgInput.value = event
        // 커서를 내용 끝으로 설정
        const selection = window.getSelection()
        const range = document.createRange()
        range.selectNodeContents(messageInputDom.value)
        range.collapse(false)
        selection?.removeAllRanges()
        selection?.addRange(range)
      })
    })

    if (messageInputDom.value) {
      /** 병음 입력 시작 시 트리거 */
      messageInputDom.value.addEventListener('compositionstart', () => {
        isChinese.value = true
      })
      /** 병음 입력 종료 시 트리거 */
      messageInputDom.value.addEventListener('compositionend', (e: CompositionEvent) => {
        setTimeout(() => {
          isChinese.value = false
          aitKey.value = e.data
          aiKeyword.value = e.data
        }, 10)
      })
    }
    /** 답장 메시지 전달 감지 */
    useMitt.on(MittEnum.REPLY_MEG, (event: any) => {
      // 입력 상자가 존재하지 않으면 바로 반환
      if (!messageInputDom.value) return

      try {
        const userInfo = groupStore.getUserInfo(event.fromUser.uid)!
        const accountName = userInfo.name
        const avatar = userInfo.avatar

        // 1단계: 입력 상자가 먼저 포커스를 얻도록 함
        focusOn(messageInputDom.value)

        // 2단계: 기존 답장 상태를 완전히 정리
        // 이미 답장 메시지가 있는 경우 기존 답장 상자를 먼저 제거
        const existingReplyDiv = document.getElementById('replyDiv')
        if (existingReplyDiv) {
          existingReplyDiv.remove()
        }

        // 이전 답장 상태를 완전히 지우기 위해 항상 reply 상태 재설정
        reply.value = { avatar: '', imgCount: 0, accountName: '', content: '', key: 0 }

        // 3단계: 답장 내용 처리
        const content = getReplyContent(event.message)

        // 4단계: 새로운 답장 내용 설정
        reply.value = {
          imgCount: 0,
          avatar: avatar,
          accountName: accountName,
          content: content,
          key: event.message.id
        }

        // 5단계: DOM 업데이트 후 답장 상자 삽입
        nextTick().then(() => {
          try {
            // 다시 입력 상자가 포커스를 얻도록 함
            focusOn(messageInputDom.value)

            // 답장 상자 삽입
            insertNode(
              MsgEnum.REPLY,
              { avatar: avatar, accountName: accountName, content: reply.value.content },
              {} as HTMLElement
            )

            // 커서 위치가 올바른 위치에 있는지 확인
            updateSelectionRange(getEditorRange())
            focusOn(messageInputDom.value)

            // UI 업데이트를 위해 input 이벤트 트리거
            triggerInputEvent(messageInputDom.value)
          } catch (err) {
            console.error('답장 상자 삽입 중 오류:', err)
          }
        })
      } catch (err) {
        console.error('답장_meg 처리기 오류:', err)
      }
    })
  })

  /**
   * 파일 직접 전송 함수 (최적화 버전 - 동시 처리, 순차 표시)
   * @param files 전송할 파일 배열
   */
  const sendFilesDirect = async (files: File[]) => {
    const targetRoomId = globalStore.currentSessionRoomId

    // 파일 업로드 대기열 초기화
    globalFileUploadQueue.initQueue(files)

    // 동시성 제한자 생성 (동시에 3개 파일 처리)
    const limit = pLimit(3)

    // 모든 파일 동시 처리
    const tasks = files.map((file, index) => {
      const fileId = globalFileUploadQueue.queue.items[index]?.id

      return limit(async () => {
        let msgType: MsgEnum = MsgEnum.TEXT
        let tempMsgId = ''

        try {
          // 대기열 상태 업데이트
          if (fileId) {
            globalFileUploadQueue.updateFileStatus(fileId, 'uploading', 0)
          }

          // 파일 유형 처리
          const processedFile = fixFileMimeType(file)
          msgType = getMessageTypeByFile(processedFile)
          if (msgType === MsgEnum.VOICE) msgType = MsgEnum.FILE

          // 고유 메시지 ID 생성
          tempMsgId = `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
          const messageStrategy = messageStrategyMap[msgType]

          // 유형에 따라 해당 처리 함수 호출, 고정된 roomId 전달
          if (msgType === MsgEnum.VIDEO) {
            await processVideoFile(processedFile, tempMsgId, messageStrategy, targetRoomId)
          } else if (msgType === MsgEnum.IMAGE) {
            await processImageFile(processedFile, tempMsgId, messageStrategy, targetRoomId)
          } else if (msgType === MsgEnum.FILE) {
            await processGenericFile(processedFile, tempMsgId, messageStrategy, targetRoomId)
          }

          // 성공 - 대기열 상태 업데이트
          if (fileId) {
            globalFileUploadQueue.updateFileStatus(fileId, 'completed', 100)
          }
        } catch (error) {
          console.error(`${file.name} 전송 실패:`, error)

          // 실패 - 대기열 및 메시지 상태 업데이트
          if (fileId) {
            globalFileUploadQueue.updateFileStatus(fileId, 'failed', 0)
          }

          if (tempMsgId) {
            chatStore.updateMsg({
              msgId: tempMsgId,
              status: MessageStatusEnum.FAILED
            })
          }

          window.$message.error(`${file.name} 전송 실패`)
        }
      })
    })

    // 모든 파일이 완료될 때까지 대기 (UI 차단하지 않음, 파일은 순차적으로 성공 표시됨)
    await Promise.allSettled(tasks)

    // 입력 상자에 자동 전송할 이미지가 있는지 확인
    try {
      await nextTick()
      if (
        messageInputDom.value?.querySelectorAll('img').length > 0 &&
        globalStore.currentSessionRoomId === targetRoomId
      ) {
        const contentType = getMessageContentType(messageInputDom)
        if (contentType === MsgEnum.IMAGE || contentType === MsgEnum.EMOJI) {
          await send()
        }
      }
    } catch (error) {
      console.error('입력 상자 이미지 자동 전송 실패:', error)
    }
  }

  const sendVoiceDirect = async (voiceData: any) => {
    const targetRoomId = globalStore.currentSessionRoomId
    try {
      // 음성 메시지 데이터 생성
      const msg = {
        type: MsgEnum.VOICE,
        path: voiceData.localPath, // 업로드용 로컬 경로
        url: `asset://${voiceData.localPath}`, // 로컬 미리보기 URL
        size: voiceData.size,
        duration: voiceData.duration,
        filename: voiceData.filename
      }
      const tempMsgId = 'T' + Date.now().toString()

      // 메시지 본문 생성 (초기에는 로컬 경로 사용)
      const messageBody = {
        url: msg.url,
        path: msg.path,
        size: msg.size,
        second: Math.round(msg.duration)
      }

      // 임시 메시지 객체 생성
      const userInfo = groupStore.getUserInfo(userUid.value)
      const tempMsg = {
        fromUser: {
          uid: String(userUid.value || 0),
          username: userInfo?.name || '',
          avatar: userInfo?.avatar || '',
          locPlace: userInfo?.locPlace || ''
        },
        message: {
          id: tempMsgId,
          roomId: targetRoomId,
          sendTime: Date.now(),
          status: MessageStatusEnum.PENDING,
          type: MsgEnum.VOICE,
          body: messageBody,
          messageMarks: {}
        },
        sendTime: Date.now(),
        loading: false
      }

      // 메시지 목록에 추가 (로컬 미리보기 표시)
      chatStore.pushMsg(tempMsg)

      // 전송 상태 설정 타이머
      chatStore.updateMsg({
        msgId: tempMsgId,
        status: MessageStatusEnum.SENDING
      })

      try {
        // 음성 메시지 전략 가져오기
        const messageStrategy = messageStrategyMap[MsgEnum.VOICE]
        // Qiniu 클라우드에 음성 파일 업로드
        const { uploadUrl, downloadUrl, config } = await messageStrategy.uploadFile(msg.path, {
          provider: UploadProviderEnum.QINIU
        })
        const doUploadResult = await messageStrategy.doUpload(msg.path, uploadUrl, config)

        // 메시지 본문의 URL을 서버 URL로 업데이트
        const finalUrl =
          config?.provider && config?.provider === UploadProviderEnum.QINIU ? doUploadResult?.qiniuUrl : downloadUrl
        messageBody.url = finalUrl || ''
        delete messageBody.path // 임시 경로 삭제

        // 임시 메시지 URL 업데이트
        chatStore.updateMsg({
          msgId: tempMsgId,
          body: {
            ...messageBody
          },
          status: MessageStatusEnum.SENDING
        })

        const sendData = {
          id: tempMsgId,
          roomId: targetRoomId,
          msgType: MsgEnum.VOICE,
          body: messageBody
        }

        try {
          // 서버로 메시지 전송 - channel 방식 사용
          const voiceSuccessChannel = new Channel<any>()
          const voiceErrorChannel = new Channel<string>()

          // 성공 응답 수신
          voiceSuccessChannel.onmessage = (message) => {
            chatStore.updateMsg({
              msgId: message.oldMsgId,
              status: MessageStatusEnum.SUCCESS,
              newMsgId: message.message.id,
              body: message.message.body,
              timeBlock: message.timeBlock
            })
            useMitt.emit(MittEnum.CHAT_SCROLL_BOTTOM)
          }

          // 오류 응답 수신
          voiceErrorChannel.onmessage = (msgId) => {
            chatStore.updateMsg({
              msgId: msgId,
              status: MessageStatusEnum.FAILED
            })
            useMitt.emit(MittEnum.CHAT_SCROLL_BOTTOM)
          }

          await invoke(TauriCommand.SEND_MSG, {
            data: sendData,
            successChannel: voiceSuccessChannel,
            errorChannel: voiceErrorChannel
          })

          // 세션 마지막 활동 시간 업데이트
          chatStore.updateSessionLastActiveTime(targetRoomId)

          // 로컬 미리보기 URL 해제
          if (msg.url.startsWith('asset://')) {
            // asset:// 프로토콜은 수동 해제 필요 없음
          }
        } catch (apiError: any) {
          chatStore.updateMsg({
            msgId: tempMsgId,
            status: MessageStatusEnum.FAILED
          })
          throw new Error(`메시지 전송 실패: ${apiError.message || apiError}`)
        }
      } catch (uploadError) {
        chatStore.updateMsg({
          msgId: tempMsgId,
          status: MessageStatusEnum.FAILED
        })
        throw uploadError
      }
    } catch (error) {
      console.error('음성 메시지 전송 실패:', error)
    }
  }

  /**
   * 지도 전송 함수
   * @param locationData 지도 데이터
   */
  const sendLocationDirect = async (locationData: any) => {
    const targetRoomId = globalStore.currentSessionRoomId
    try {
      const tempMsgId = 'T' + Date.now().toString()
      const messageStrategy = messageStrategyMap[MsgEnum.LOCATION]

      // 위치 데이터를 JSON 문자열로 변환하여 메시지 내용으로 사용
      const content = JSON.stringify(locationData)

      // 위치 메시지 생성
      const msg = messageStrategy.getMsg(content, reply.value)
      const messageBody = messageStrategy.buildMessageBody(msg, reply)

      // 임시 메시지 객체 생성
      const tempMsg = messageStrategy.buildMessageType(tempMsgId, messageBody, globalStore, userUid)
      tempMsg.message.status = MessageStatusEnum.SENDING

      // 메시지 목록에 추가
      chatStore.pushMsg(tempMsg)

      // 전송 상태 설정
      chatStore.updateMsg({
        msgId: tempMsgId,
        status: MessageStatusEnum.SENDING
      })

      // 서버로 메시지 전송 - channel 방식 사용
      const successChannel = new Channel<any>()
      const errorChannel = new Channel<string>()

      // 성공 응답 수신
      successChannel.onmessage = (message) => {
        chatStore.updateMsg({
          msgId: message.oldMsgId,
          status: MessageStatusEnum.SUCCESS,
          newMsgId: message.message.id,
          body: message.message.body,
          timeBlock: message.timeBlock
        })
        useMitt.emit(MittEnum.CHAT_SCROLL_BOTTOM)
      }

      // 오류 응답 수신
      errorChannel.onmessage = (msgId) => {
        chatStore.updateMsg({
          msgId: msgId,
          status: MessageStatusEnum.FAILED
        })
        useMitt.emit(MittEnum.CHAT_SCROLL_BOTTOM)
      }

      await invoke(TauriCommand.SEND_MSG, {
        data: {
          id: tempMsgId,
          roomId: targetRoomId,
          msgType: MsgEnum.LOCATION,
          body: messageBody
        },
        successChannel,
        errorChannel
      })

      // 세션 마지막 활동 시간 업데이트
      chatStore.updateSessionLastActiveTime(targetRoomId)
    } catch (error) {
      console.error('위치 메시지 전송 실패:', error)
    }
  }

  /**
   * 이모티콘 직접 전송 함수 (모바일 전용)
   * @param emojiUrl 이모티콘 URL
   */
  const sendEmojiDirect = async (emojiUrl: string) => {
    const targetRoomId = globalStore.currentSessionRoomId

    try {
      const tempMsgId = 'T' + Date.now().toString()

      const messageStrategy = messageStrategyMap[MsgEnum.EMOJI]

      // 이모티콘 메시지 생성
      const msg = messageStrategy.getMsg(emojiUrl, reply.value)
      const messageBody = messageStrategy.buildMessageBody(msg, reply)

      // 임시 메시지 객체 생성
      const tempMsg = messageStrategy.buildMessageType(tempMsgId, messageBody, globalStore, userUid)
      tempMsg.message.status = MessageStatusEnum.SENDING

      // 메시지 목록에 추가
      chatStore.pushMsg(tempMsg)

      // 전송 상태 설정
      chatStore.updateMsg({
        msgId: tempMsgId,
        status: MessageStatusEnum.SENDING
      })

      // 서버로 메시지 전송 - channel 방식 사용
      const successChannel = new Channel<any>()
      const errorChannel = new Channel<string>()

      // 성공 응답 수신
      successChannel.onmessage = (message) => {
        chatStore.updateMsg({
          msgId: message.oldMsgId,
          status: MessageStatusEnum.SUCCESS,
          newMsgId: message.message.id,
          body: message.message.body,
          timeBlock: message.timeBlock
        })
        useMitt.emit(MittEnum.CHAT_SCROLL_BOTTOM)
      }

      // 오류 응답 수신
      errorChannel.onmessage = (msgId) => {
        chatStore.updateMsg({
          msgId: msgId,
          status: MessageStatusEnum.FAILED
        })
        useMitt.emit(MittEnum.CHAT_SCROLL_BOTTOM)
      }

      await invoke(TauriCommand.SEND_MSG, {
        data: {
          id: tempMsgId,
          roomId: targetRoomId,
          msgType: MsgEnum.EMOJI,
          body: messageBody
        },
        successChannel,
        errorChannel
      })

      // 세션 마지막 활동 시간 업데이트
      chatStore.updateSessionLastActiveTime(targetRoomId)
    } catch (error) {
      console.error('[useMsgInput] 이모티콘 메시지 전송 실패:', error)
      throw error
    }
  }

  return {
    imgPaste,
    inputKeyDown,
    handleAit,
    handleAI,
    handleInput,
    send,
    stripHtml,
    sendLocationDirect,
    sendFilesDirect,
    sendVoiceDirect,
    sendEmojiDirect,
    personList,
    ait,
    aitKey,
    msgInput,
    chatKey,
    menuList,
    selectedAitKey,
    reply,
    disabledSend,
    aiDialogVisible,
    aiKeyword,
    aiModelList,
    selectedAIKey,
    topicDialogVisible,
    topicKeyword,
    topicList,
    groupedAIModels,
    getCursorSelectionRange,
    updateSelectionRange: () => updateSelectionRange(getEditorRange()),
    focusOn
  }
}
