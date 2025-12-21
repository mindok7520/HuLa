import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { appCacheDir, join } from '@tauri-apps/api/path'
import { BaseDirectory, exists, mkdir, writeFile } from '@tauri-apps/plugin-fs'
import { info } from '@tauri-apps/plugin-log'
import GraphemeSplitter from 'grapheme-splitter'
import type { Ref } from 'vue'
import { LimitEnum, MittEnum, MsgEnum } from '@/enums'
import { useMessage } from '@/hooks/useMessage.ts'
import { useMitt } from '@/hooks/useMitt.ts'
import router from '@/router'
import { useChatStore } from '@/stores/chat.ts'
import { useGlobalStore } from '@/stores/global.ts'
import { useUserStore } from '@/stores/user.ts'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { removeTag } from '@/utils/Formatting'
import { getSessionDetailWithFriends } from '@/utils/ImRequestUtils'

import { isMobile } from '@/utils/PlatformConstants'
import { invokeWithErrorHandler } from '../utils/TauriInvokeHandler'

export interface SelectionRange {
  range: Range
  selection: Selection
}
const domParser = new DOMParser()

const REPLY_NODE_ID = 'replyDiv'

/**
 * DOM의 지정된 id 텍스트 반환
 * @param dom 지정된 dom
 * @param id 요소 id
 */
export const parseInnerText = (dom: string, id: string): string | undefined => {
  const doc = domParser.parseFromString(dom, 'text/html')
  return doc.getElementById(id)?.innerText
}

/** 공통 유틸리티 클래스 */
export const useCommon = () => {
  const globalStore = useGlobalStore()
  const chatStore = useChatStore()
  const userStore = useUserStore()
  const { handleMsgClick } = useMessage()
  /** 현재 로그인한 사용자의 uid */
  const userUid = computed(() => userStore.userInfo!.uid)
  /** 답장 메시지 */
  const reply = ref({
    avatar: '',
    accountName: '',
    content: '',
    key: 0,
    imgCount: 0
  })

  // ... (saveCacheFile logic remains, no comments to change in English parts, checking for logs)

  /**
   * URL이 안전한지 확인
   * @param url URL 문자열
   * @returns 안전 여부
   */
  const isSafeUrl = (url: string) => {
    // http/https 프로토콜만 허용하며, javascript: 또는 data: 포함 불가
    return /^(https?:\/\/|\/)/.test(url) && !/^javascript:/i.test(url) && !/^data:/i.test(url)
  }

  /**
   * 현재 커서 선택 정보 가져오기 (비어 있는지 확인 필요)
   */
  const getEditorRange = () => {
    if (window.getSelection) {
      const selection = window.getSelection()
      // rangeCount가 없으면 입력 상자의 마지막 자식 노드 가져오기 시도
      if (!selection || selection.rangeCount === 0) {
        const inputElement = document.getElementById('message-input')
        if (inputElement) {
          inputElement.focus()
          const range = document.createRange()
          // 커서를 입력 상자의 마지막으로 이동
          range.selectNodeContents(inputElement)
          range.collapse(false) // 끝으로 접기
          selection?.removeAllRanges()
          selection?.addRange(range)
        }
      }

      // 재확인
      if (selection && selection.rangeCount) {
        const range = selection.getRangeAt(0)
        return { range, selection }
      }
    }
    return null
  }

  /**
   * messageInputDom 입력 상자의 콘텐츠 유형 가져오기
   * @param messageInputDom 입력 상자 dom
   */
  const getMessageContentType = (messageInputDom: Ref): MsgEnum => {
    let hasText = false
    let hasImage = false
    let hasVideo = false
    let hasFile = false
    let hasEmoji = false
    let hasVoice = false

    const elements = messageInputDom.value.childNodes
    for (const element of elements) {
      if (element.nodeType === Node.TEXT_NODE && element.nodeValue.trim() !== '') {
        hasText = true
      } else if (element.tagName === 'IMG') {
        if (element.dataset.type === 'file-canvas') {
          hasFile = true
        } else if (element.dataset.type === 'emoji') {
          // 이모티콘 이미지인지 확인
          hasEmoji = true
        } else {
          hasImage = true
        }
      } else if (element.tagName === 'VIDEO' || (element.tagName === 'A' && element.href.match(/\.(mp4|webm)$/i))) {
        hasVideo = true
      } else if (element.tagName === 'DIV' && element.className === 'voice-message-placeholder') {
        hasVoice = true
      }
    }

    if (hasVoice) {
      return MsgEnum.VOICE
    } else if (hasFile) {
      return MsgEnum.FILE
    } else if (hasVideo) {
      return MsgEnum.VIDEO
    } else if (hasEmoji && !hasText && !hasImage) {
      // 이모티콘만 있고 다른 텍스트나 이미지가 없는 경우 EMOJI 유형 반환
      return MsgEnum.EMOJI
    } else if ((hasText && hasImage) || (hasText && hasEmoji)) {
      return MsgEnum.MIXED
    } else if (hasImage) {
      return MsgEnum.IMAGE
    } else {
      return MsgEnum.TEXT
    }
  }

  /**
   * 입력 상자 이벤트 트리거 (붙여넣기 시 이 메서드를 다시 트리거해야 함)
   * @param element 입력 상자 dom
   */
  const triggerInputEvent = (element: HTMLElement) => {
    if (element) {
      const event = new Event('input', {
        bubbles: true,
        cancelable: true
      })
      element.dispatchEvent(event)
    }
  }

  /**
   * 지정된 노드를 커서 위치에 삽입
   * @param { MsgEnum } type 삽입 유형
   * @param dom dom 노드
   * @param target 대상 노드
   */
  const insertNode = (type: MsgEnum, dom: any, target: HTMLElement) => {
    const sr = getEditorRange()!
    if (!sr) return

    insertNodeAtRange(type, dom, target, sr)
  }

  /**
   * 지정된 노드를 커서 위치에 삽입
   * @param { MsgEnum } type 삽입 유형
   * @param dom dom 노드
   * @param target 대상 노드
   * @param sr 선택 영역
   */
  const insertNodeAtRange = (type: MsgEnum, dom: any, _target: HTMLElement, sr: SelectionRange) => {
    const { range, selection } = sr

    // 선택된 내용 삭제
    range?.deleteContents()

    // 범위를 노드 앞에 추가
    if (type === MsgEnum.AIT) {
      // @ 노드에 표시 이름과 uid 저장, 나중에 atUidList 추출 시 구조화된 데이터에 직접 의존하여 오판 방지
      const mentionText = typeof dom === 'object' && dom !== null ? dom.name || dom.text || dom.label || '' : dom || ''
      const mentionUid = typeof dom === 'object' && dom !== null ? dom.uid : undefined
      // span 태그 노드 생성
      const spanNode = document.createElement('span')
      spanNode.id = 'aitSpan' // id를 aitSpan으로 설정
      spanNode.contentEditable = 'false' // 편집 불가로 설정
      spanNode.classList.add('text-#13987f')
      spanNode.classList.add('select-none')
      spanNode.classList.add('cursor-default')
      spanNode.style.userSelect = 'text' // 전체 선택 허용
      if (mentionUid) {
        spanNode.dataset.aitUid = String(mentionUid)
      }
      spanNode.appendChild(document.createTextNode(`@${mentionText}`))
      // span 태그를 커서 위치에 삽입
      range?.insertNode(spanNode)
      // 커서를 Range 끝으로 접기 (true는 시작 위치, false는 끝 위치)
      range?.collapse(false)
      // 공백 텍스트 노드 생성
      const spaceNode = document.createTextNode('\u00A0')
      // 공백 텍스트 노드를 커서 위치에 삽입
      range?.insertNode(spaceNode)
    } else if (type === MsgEnum.TEXT) {
      range?.insertNode(document.createTextNode(dom))
    } else if (type === MsgEnum.REPLY) {
      // 메시지 입력 상자 요소 가져오기
      const inputElement = document.getElementById('message-input')
      if (!inputElement) return

      // 입력 상자에 포커스 확인
      inputElement.focus()

      // 답장 노드 생성
      const replyNode = createReplyDom(dom)

      // 이미 답장 상자가 존재하면 교체
      const preReplyNode = document.getElementById('replyDiv')
      if (preReplyNode) {
        preReplyNode.replaceWith(replyNode)
      } else {
        // 입력 상자에 내용이 있는지 확인
        const hasChildNodes =
          inputElement.childNodes.length > 0 &&
          !(
            inputElement.childNodes.length === 1 &&
            inputElement.childNodes[0].nodeType === Node.TEXT_NODE &&
            !inputElement.childNodes[0].textContent?.trim()
          )
        // 답장 노드 삽입
        inputElement.insertBefore(replyNode, inputElement.firstChild)

        // 입력 상자에 이미 내용이 있으면 커서 위치 확인 필요
        if (hasChildNodes) {
          // 답장 상자 뒤의 첫 번째 텍스트 노드 가져오기
          let nextNode = replyNode.nextSibling
          let position = 0

          // 선택 범위를 답장 상자 뒤로 설정
          if (nextNode) {
            if (nextNode.nodeType === Node.TEXT_NODE) {
              position = 0 // 텍스트 노드의 시작 위치
            } else {
              // 텍스트 노드가 아니면 다음 텍스트 노드 찾기
              while (nextNode && nextNode.nodeType !== Node.TEXT_NODE) {
                nextNode = nextNode.nextSibling
              }
              if (!nextNode) {
                // 텍스트 노드를 찾지 못하면 생성
                nextNode = document.createTextNode(' ')
                inputElement.appendChild(nextNode)
              }
              position = 0
            }

            // 선택 영역을 답장 상자 뒤로 설정
            selection.removeAllRanges()
            const rangeAfter = document.createRange()
            rangeAfter.setStart(nextNode, position)
            rangeAfter.setEnd(nextNode, position)
            selection.addRange(rangeAfter)
          } else {
            // 후속 노드가 없으면 생성
            nextNode = document.createTextNode(' ')
            inputElement.appendChild(nextNode)

            // 선택 영역을 새로 생성된 노드로 설정
            selection.removeAllRanges()
            const rangeAfter = document.createRange()
            rangeAfter.setStart(nextNode, 0)
            rangeAfter.setEnd(nextNode, 0)
            selection.addRange(rangeAfter)
          }
        } else {
          // 입력 상자에 내용이 없으면 공백 노드를 추가하여 후속 편집 용이하게 함
          const spaceNode = document.createElement('span')
          spaceNode.textContent = '\u00A0'
          spaceNode.contentEditable = 'false'
          spaceNode.style.userSelect = 'none'

          // 답장 상자 뒤에 공백 노드 삽입
          const afterRange = document.createRange()
          afterRange.selectNode(replyNode)
          afterRange.collapse(false) // 끝 위치로 접기
          afterRange.insertNode(spaceNode)

          // 공백 노드 뒤에 빈 텍스트 노드를 삽입하여 커서 위치 지정 용이하게 함
          const textNode = document.createTextNode('')
          afterRange.selectNode(spaceNode)
          afterRange.collapse(false)
          afterRange.insertNode(textNode)

          // 커서 위치를 텍스트 노드에 설정
          selection.removeAllRanges()
          const newRangeAfter = document.createRange()
          newRangeAfter.setStart(textNode, 0)
          newRangeAfter.setEnd(textNode, 0)
          selection.addRange(newRangeAfter)
        }
      }

      // 입력 이벤트 트리거하여 UI 업데이트 확인
      triggerInputEvent(inputElement)
      return
    } else if (type === MsgEnum.AI) {
      // 트리거 문자 "/" 삭제
      const startContainer = range.startContainer
      if (startContainer.nodeType === Node.TEXT_NODE) {
        const text = startContainer.textContent || ''
        const lastIndex = text.lastIndexOf('/')
        if (lastIndex !== -1) {
          startContainer.textContent = text.substring(0, lastIndex)
        }
      }

      // div 태그 노드 생성
      const divNode = document.createElement('div')
      divNode.id = 'AIDiv' // id를 replyDiv로 설정 (주석은 replyDiv지만 코드는 AIDiv)
      divNode.contentEditable = 'false' // 편집 불가로 설정
      divNode.tabIndex = -1 // 포커스 방지
      divNode.style.cssText = `
      background-color: var(--reply-bg);
      font-size: 12px;
      padding: 4px 6px;
      width: fit-content;
      max-height: 86px;
      border-radius: 8px;
      margin-bottom: 2px;
      user-select: none;
      pointer-events: none; /* 마우스 이벤트 방지 */
      cursor: default;
      outline: none; /* 포커스 시 윤곽선 제거 */
    `
      // dom의 value 값을 답장 작성자로, content를 답장 내용으로 사용
      const author = dom.name
      // img 태그 노드 생성하여 아바타로 사용
      const imgNode = document.createElement('img')
      const avatarUrl = AvatarUtils.getAvatarUrl(dom.avatar)
      if (isSafeUrl(avatarUrl)) {
        imgNode.src = avatarUrl
      } else {
        // 기본 아바타 또는 빈 값으로 설정
        imgNode.src = '/avatar/001.png'
      }
      imgNode.style.cssText = `
      width: 20px;
      height: 20px;
      border-radius: 50%;
      object-fit: contain;
      `
      // div 태그 노드 생성하여 답장 정보의 헤더로 사용
      const headerNode = document.createElement('div')
      headerNode.style.cssText = `
      line-height: 1.5;
      font-size: 12px;
      padding: 0 4px;
      color: rgba(19, 152, 127);
      cursor: default;
      user-select: none;
      pointer-events: none;
    `
      headerNode.appendChild(document.createTextNode(author))
      // 답장 메시지 오른쪽에 닫기 버튼 추가
      const closeBtn = document.createElement('span')
      closeBtn.id = 'closeBtn'
      closeBtn.style.cssText = `
      display: flex;
      align-items: center;
      font-size: 12px;
      color: #999;
      cursor: pointer;
      margin-left: 10px;
      flex-shrink: 0;
      user-select: none;
      pointer-events: auto; /* 닫기 버튼 클릭 가능하도록 보장 */
    `
      closeBtn.textContent = '닫기'
      closeBtn.addEventListener('click', () => {
        // 먼저 답장 노드 제거
        divNode.remove()

        // 메시지 입력 상자 가져오기
        const messageInput = document.getElementById('message-input') as HTMLElement
        if (!messageInput) return

        // 입력 상자에 포커스 보장
        messageInput.focus()

        // reply 상태 완전히 초기화
        reply.value = { avatar: '', imgCount: 0, accountName: '', content: '', key: 0 }

        // 커서 처리 최적화
        const selection = window.getSelection()
        if (selection) {
          const range = document.createRange()

          // 입력 상자 내용 처리, 공백만 있으면 비우기
          if (messageInput.textContent && messageInput.textContent.trim() === '') {
            messageInput.textContent = ''
          }

          // 커서를 입력 상자의 끝으로 이동
          range.selectNodeContents(messageInput)
          range.collapse(false) // 끝으로 접기

          selection.removeAllRanges()
          selection.addRange(range)

          // UI 상태 업데이트를 위해 입력 이벤트 트리거
          triggerInputEvent(messageInput)
        }
      })
      // 아바타와 제목을 위한 컨테이너 생성
      const headerContainer = document.createElement('div')
      headerContainer.style.cssText = `
      display: flex;
      align-items: center;
      gap: 2px;
      `
      // 컨테이너에 아바타와 제목 추가
      headerContainer.appendChild(imgNode)
      headerContainer.appendChild(headerNode)
      headerContainer.appendChild(closeBtn)

      // 주 div에 컨테이너 추가
      divNode.appendChild(headerContainer)
      // div 태그 노드를 커서 위치에 삽입
      range?.insertNode(divNode)
      // 커서를 Range 끝으로 접기 (true는 시작 위치, false는 끝 위치)
      range?.collapse(false)
      // 공백용 span 노드 생성
      const spaceNode = document.createElement('span')
      spaceNode.textContent = '\u00A0'
      // 편집 불가 설정
      spaceNode.contentEditable = 'false'
      // 선택 불가
      spaceNode.style.userSelect = 'none'
      // 줄바꿈용 br 태그 노드 삽입
      const brNode = document.createElement('br')
      // br 태그 노드를 커서 위치에 삽입
      range?.insertNode(brNode)
      // 공백 노드를 커서 위치에 삽입
      range?.insertNode(spaceNode)
      range?.collapse(false)
    } else {
      range?.insertNode(dom)
      range?.collapse(false)
    }
    // 커서를 선택 범위의 맨 뒤로 이동
    selection?.collapseToEnd()
  }

  /**
   * create a reply element
   */
  function createReplyDom(dom: { accountName: string; content: string; avatar: string }) {
    // div 태그 노드 생성
    const replyNode = document.createElement('div')
    replyNode.id = REPLY_NODE_ID // id를 replyDiv로 설정
    replyNode.contentEditable = 'false' // 편집 불가로 설정
    replyNode.tabIndex = -1 // 포커스 방지
    replyNode.style.cssText = `
      background-color: var(--reply-bg);
      font-size: 12px;
      padding: 4px 6px;
      width: fit-content;
      max-height: 86px;
      border-radius: 8px;
      margin-bottom: 2px;
      user-select: none;
      pointer-events: none; /* 마우스 이벤트 방지 */
      cursor: default;
      outline: none; /* 포커스 시 윤곽선 제거 */
      `
    if (isMobile()) {
      replyNode.style.cssText += `max-width: 170px;`
    }
    // dom의 value 값을 답장 작성자로, content를 답장 내용으로 사용
    const author = dom.accountName + '：'
    let content = dom.content
    // img 태그 노드 생성하여 아바타로 사용
    const imgNode = document.createElement('img')
    const avatarUrl = AvatarUtils.getAvatarUrl(dom.avatar)
    if (isSafeUrl(avatarUrl)) {
      imgNode.src = avatarUrl
    } else {
      // 기본 아바타 또는 빈 값으로 설정
      imgNode.src = 'avatar/001.png'
    }
    imgNode.style.cssText = `
      width: 20px;
      height: 20px;
      border-radius: 50%;
      `
    // div 태그 노드 생성하여 답장 정보의 헤더로 사용
    const headerNode = document.createElement('div')
    headerNode.style.cssText = `
      line-height: 1.5;
      font-size: 12px;
      padding: 0 4px;
      color: rgba(19, 152, 127);
      cursor: default;
      user-select: none;
      pointer-events: none;
    `
    headerNode.appendChild(document.createTextNode(author))
    // 본문 내용을 감싸는 div 태그 노드 생성
    const contentNode = document.createElement('div')
    contentNode.style.cssText = `
      display: flex;
      justify-content: space-between;
      border-radius: 8px;
      padding: 2px;
      margin-top: 4px;
      min-width: 0;
    `
    let contentBox
    // content 내용이 data:image/ 로 시작하는 배열인지 확인
    if (Array.isArray(content)) {
      // 총 이미지 개수 획득
      const imageCount = content.length
      // 첫 번째 data:image/ 로 시작하는 이미지 획득
      content = content.find((item: string) => item.startsWith('data:image/'))
      reply.value.imgCount = imageCount
    }

    // todo: 임시로 http로 시작하는 이미지로 판단, 나중에 최적화 필요
    if (content.startsWith('http')) {
      // img 태그 노드를 생성하고 src 속성을 base64 인코딩된 이미지로 설정
      contentBox = document.createElement('img')
      contentBox.src = content
      contentBox.style.cssText = `
        max-width: 55px;
        max-height: 55px;
        border-radius: 4px;
        cursor: default;
        user-select: none;
        pointer-events: none;
      `
      // img 태그 노드를 div 태그 노드에 삽입
      replyNode.appendChild(contentBox)
      // 이미지를 reply의 content 속성에 전달
      reply.value.content = content
    } else {
      // @ 태그가 있는지 확인
      if (content.includes('id="aitSpan"')) {
        // content에서 태그 제거
        content = removeTag(content)
      }
      // 본문을 span 태그에 넣고 스타일 설정
      contentBox = document.createElement('span')
      contentBox.style.cssText = `
      font-size: 12px;
      color: var(--text-color);
      cursor: default;
      width: fit-content;
      max-width: 350px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      user-select: none;
      pointer-events: none;
    `
      contentBox.appendChild(document.createTextNode(content))
    }
    // 답장 메시지 오른쪽에 닫기 버튼 추가
    const closeBtn = document.createElement('span')
    closeBtn.id = 'closeBtn'
    closeBtn.style.cssText = `
      display: flex;
      align-items: center;
      font-size: 12px;
      color: #999;
      cursor: pointer;
      margin-left: 10px;
      flex-shrink: 0;
      user-select: none;
      pointer-events: auto; /* 닫기 버튼 클릭 가능하도록 보장 */
    `
    closeBtn.textContent = '닫기'
    closeBtn.addEventListener('click', () => {
      // 먼저 답장 노드 제거
      replyNode.remove()

      // 메시지 입력 상자 가져오기
      const messageInput = document.getElementById('message-input') as HTMLElement
      if (!messageInput) return

      // 입력 상자에 포커스 보장
      messageInput.focus()

      // reply 상태 완전히 초기화
      reply.value = { avatar: '', imgCount: 0, accountName: '', content: '', key: 0 }

      // 커서 처리 최적화
      const selection = window.getSelection()
      if (selection) {
        const range = document.createRange()

        // 입력 상자 내용 처리, 공백만 있으면 비우기
        if (messageInput.textContent && messageInput.textContent.trim() === '') {
          messageInput.textContent = ''
        }

        // 将光标移动到输入框的末尾
        range.selectNodeContents(messageInput)
        range.collapse(false) // 折叠到末尾

        selection.removeAllRanges()
        selection.addRange(range)

        // 触发输入事件以更新UI状态
        triggerInputEvent(messageInput)
      }
    })
    // 为头像和标题创建容器
    const headerContainer = document.createElement('div')
    headerContainer.style.cssText = `
      display: flex;
      align-items: center;
      gap: 2px;
      `
    // 在容器中添加头像和标题
    headerContainer.appendChild(imgNode)
    headerContainer.appendChild(headerNode)

    // 将容器添加到主div中
    replyNode.appendChild(headerContainer)
    replyNode.appendChild(contentNode)
    contentNode.appendChild(contentBox)
    contentNode.appendChild(closeBtn)
    return replyNode
  }

  /**
   * 이미지 붙여넣기 이벤트 처리
   * @param file 이미지 파일
   * @param dom 입력 상자 dom
   */
  const imgPaste = async (file: any, dom: HTMLElement) => {
    // file이 blob URL 형식인 경우
    if (typeof file === 'string' && file.startsWith('blob:')) {
      const url = file.replace('blob:', '') // blob: 접두사 제거
      console.log(url)

      const img = document.createElement('img')
      img.src = url
      img.style.maxHeight = '88px'
      img.style.maxWidth = '140px'
      img.style.marginRight = '6px'

      // MsgInput 컴포넌트에서 노출된 lastEditRange 가져오기
      const lastEditRange = (dom as any).getLastEditRange?.()

      // dom에 포커스 확인
      dom.focus()

      let range: Range
      if (!lastEditRange) {
        range = document.createRange()
        range.selectNodeContents(dom)
        range.collapse(false)
      } else {
        range = lastEditRange
      }

      const selection = window.getSelection()
      if (selection) {
        range.deleteContents()
        range.insertNode(img)
        range.setStartAfter(img)
        range.setEndAfter(img)
        selection.removeAllRanges()
        selection.addRange(range)
      }

      triggerInputEvent(dom)
      return
    }

    // 파일 캐시
    const cachePath = await saveCacheFile(file, 'img')

    // 기존 File 객체 처리 로직
    const reader = new FileReader()
    reader.onload = (e: any) => {
      const img = document.createElement('img')
      img.src = e.target.result
      img.style.maxHeight = '88px'
      img.style.maxWidth = '140px'
      img.style.marginRight = '6px'
      // ID 설정, 캐시 경로를 ID로 사용하여 parseInnerText가 찾을 수 있도록 함
      img.id = 'temp-image'
      img.setAttribute('data-path', cachePath)

      // MsgInput 컴포넌트에서 노출된 lastEditRange 가져오기
      const lastEditRange = (dom as any).getLastEditRange?.()

      // dom에 포커스 확인
      dom.focus()

      let range: Range
      if (!lastEditRange) {
        range = document.createRange()
        range.selectNodeContents(dom)
        range.collapse(false)
      } else {
        range = lastEditRange
      }

      const selection = window.getSelection()
      if (selection) {
        range.deleteContents()
        range.insertNode(img)
        range.setStartAfter(img)
        range.setEndAfter(img)
        selection.removeAllRanges()
        selection.addRange(range)
      }

      triggerInputEvent(dom)
    }
    // 파일 읽기
    reader.readAsDataURL(file)
  }

  /**
   * 비디오 또는 파일 붙여넣기 이벤트 처리
   * @param file 파일
   * @param type 유형
   * @param dom 입력 상자 dom
   */
  const FileOrVideoPaste = async (file: File) => {
    const reader = new FileReader()
    if (file.size > 1024 * 1024 * 50) {
      window.$message.warning('파일 크기는 50MB를 초과할 수 없습니다. 다시 선택해 주세요')
      return
    }
    await saveCacheFile(file, 'video')
    reader.readAsDataURL(file)
  }

  /**
   * 확인된 파일 목록 처리 (팝업에서)
   * @param files 파일 목록
   * @param dom 입력 상자 dom
   */
  const handleConfirmFiles = async (files: File[]) => {
    for (const file of files) {
      await FileOrVideoPaste(file)
    }
  }

  /**
   * 붙여넣기 이벤트 처리
   * @param e 이벤트 객체
   * @param dom 입력 상자 dom
   * @param showFileModal 파일 팝업 표시 콜백 함수
   */
  const handlePaste = async (e: any, dom: HTMLElement, showFileModal?: (files: File[]) => void) => {
    e.preventDefault()
    if (e.clipboardData.files.length > 0) {
      // 일반 파일 처리 함수 사용
      await processFiles(Array.from(e.clipboardData.files), dom, showFileModal)
    } else {
      // 파일이 없고 텍스트인 경우 순수 텍스트 붙여넣기 처리
      const plainText = e.clipboardData.getData('text/plain')
      insertNode(MsgEnum.TEXT, plainText, dom)
      triggerInputEvent(dom)
    }
  }

  /** 문자 길이 계산 */
  const countGraphemes = (value: string) => {
    const splitter = new GraphemeSplitter()
    return splitter.countGraphemes(value)
  }

  /**
   * 메시지 세션 열기(우클릭 메시지 전송 기능)
   * @param uid 사용자 id
   * @param type
   */
  const openMsgSession = async (uid: string, type: number = 2) => {
    // home 윈도우 인스턴스 가져오기
    const label = WebviewWindow.getCurrent().label
    if (router.currentRoute.value.name !== '/message' && label === 'home') {
      router.push('/message')
    }

    info('메시지 세션 열기')
    const res = await getSessionDetailWithFriends({ id: uid, roomType: type })
    // 숨겨진 세션 먼저 표시
    try {
      await invokeWithErrorHandler('hide_contact_command', { data: { roomId: res.roomId, hide: false } })
    } catch (_error) {
      window.$message.error('세션 표시 실패')
    }

    // 세션이 이미 존재하는지 먼저 확인
    const existingSession = chatStore.getSession(res.roomId)
    if (!existingSession) {
      // 세션이 존재하지 않을 때만 세션 목록 순서 업데이트
      chatStore.updateSessionLastActiveTime(res.roomId)
      // 세션이 존재하지 않으면 세션 목록을 다시 가져오되, 현재 선택된 세션은 유지
      await chatStore.getSessionList(true)
    }
    globalStore.updateCurrentSessionRoomId(res.roomId)

    // 메시지 위치 지정
    useMitt.emit(MittEnum.LOCATE_SESSION, { roomId: res.roomId })
    handleMsgClick(res as any)
    useMitt.emit(MittEnum.TO_SEND_MSG, { url: 'message' })
  }

  /**
   * 일반 파일 처리 함수
   * @param files 파일 목록
   * @param dom 입력 상자 DOM 요소
   * @param showFileModal 파일 팝업 표시 콜백 함수
   * @param resetCallback 초기화 콜백 함수 (선택 사항)
   */
  const processFiles = async (
    files: File[],
    dom: HTMLElement,
    showFileModal?: (files: File[]) => void,
    resetCallback?: () => void
  ) => {
    if (!files) return

    // 파일 수량 확인
    if (files.length > LimitEnum.COM_COUNT) {
      window.$message.warning(`한 번에 ${LimitEnum.COM_COUNT}개의 파일 또는 이미지만 업로드할 수 있습니다`)
      return
    }

    // 파일 분류: 이미지 또는 기타 파일
    const imageFiles: File[] = []
    const otherFiles: File[] = []

    for (const file of files) {
      // 파일 크기 확인
      const fileSizeInMB = file.size / 1024 / 1024
      if (fileSizeInMB > 100) {
        window.$message.warning(`파일 ${file.name} 크기가 100MB를 초과합니다`)
        continue
      }

      const fileType = file.type

      // mime 타입이 아닐 때 처리 로직을 위한 보조 판단으로 includes 추가
      if (fileType.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(fileType)) {
        imageFiles.push(file)
      } else {
        // 비디오 및 기타 파일은 팝업을 통해 처리
        otherFiles.push(file)
      }
    }

    // 이미지 파일 처리 (입력 상자에 직접 삽입)
    for (const file of imageFiles) {
      await imgPaste(file, dom)
    }

    // 기타 파일 처리 (팝업 표시)
    if (otherFiles.length > 0 && showFileModal) {
      showFileModal(otherFiles)
    }

    // 초기화 콜백 실행
    resetCallback?.()
  }

  /**
   * 파일 캐시 저장
   * @param file 파일 객체
   * @param subDir 하위 디렉토리
   */
  const saveCacheFile = async (file: File, subDir: string): Promise<string> => {
    const uid = userUid.value
    const relativeDir = `${uid}/${subDir}`
    try {
      if (!(await exists(relativeDir, { baseDir: BaseDirectory.Cache }))) {
        await mkdir(relativeDir, { baseDir: BaseDirectory.Cache, recursive: true })
      }

      const timestamp = new Date().getTime()
      const ext = file.name.split('.').pop() || ''
      const filename = `${timestamp}.${ext}`
      const filePath = `${relativeDir}/${filename}`

      const arrayBuffer = await file.arrayBuffer()
      await writeFile(filePath, new Uint8Array(arrayBuffer), { baseDir: BaseDirectory.Cache })

      const cacheDir = await appCacheDir()
      return await join(cacheDir, filePath)
    } catch (error) {
      console.error('파일 캐시 저장 실패:', error)
      return ''
    }
  }

  return {
    imgPaste,
    getEditorRange,
    getMessageContentType,
    insertNode,
    triggerInputEvent,
    handlePaste,
    FileOrVideoPaste,
    handleConfirmFiles,
    countGraphemes,
    openMsgSession,
    insertNodeAtRange,
    reply,
    userUid,
    processFiles,
    saveCacheFile
  }
}
