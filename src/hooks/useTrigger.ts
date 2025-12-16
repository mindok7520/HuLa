import { nextTick, type Ref } from 'vue'
import { TriggerEnum } from '@/enums'

// 선택자 상수 추가
const SELECTORS = {
  MENTION: '.ait-options',
  AI: '.AI-options',
  TOPIC: '.topic-options'
} as const

interface TriggerContext {
  range: Range
  selection: Selection
  keyword: string
}

export const useTrigger = (
  personList: Ref<unknown[]>,
  groupedAIModels: Ref<unknown[]>,
  topicList: Ref<unknown[]>,
  ait: Ref<boolean>,
  aitKey: Ref<string>,
  aiDialogVisible: Ref<boolean>,
  aiKeyword: Ref<string>,
  topicDialogVisible: Ref<boolean>,
  topicKeyword: Ref<string>
) => {
  // 제품 단계에서는 / 로 AI 호출을 사용하지 않음, 나중에 빠르게 복구할 수 있도록 스위치 유지
  const enableAITrigger = false

  /** 모든 상태 초기화 */
  const resetAllStates = () => {
    ait.value = false
    aitKey.value = ''
    aiDialogVisible.value = false
    aiKeyword.value = ''
    topicDialogVisible.value = false
    topicKeyword.value = ''
  }

  /** @ 멘션 처리 */
  const handleMention = async (context: TriggerContext) => {
    if (personList.value.length === 0) {
      resetAllStates()
      return
    }

    ait.value = true
    aitKey.value = context.keyword

    const res = context.range.getBoundingClientRect()
    await nextTick(() => {
      const dom = document.querySelector(SELECTORS.MENTION) as HTMLElement
      if (!dom) return
      dom.style.position = 'fixed'
      dom.style.height = 'auto'
      dom.style.maxHeight = '190px'
      dom.style.left = `${res.x - 20}px`
      dom.style.top = `${res.y - (dom.offsetHeight + 5)}px`
    })
  }

  /** AI 대화 처리 */
  const handleAI = async (context: TriggerContext) => {
    if (!enableAITrigger) {
      // 기능이 꺼져 있으면 팝업 상태가 다시 열리지 않도록 바로 반환
      return
    }

    if (groupedAIModels.value.length === 0) {
      resetAllStates()
      return
    }

    const keyword = context.keyword?.trim?.() ?? ''
    if (!keyword) {
      resetAllStates()
      return
    }

    aiKeyword.value = keyword

    const res = context.range.getBoundingClientRect()
    await nextTick()
    if (groupedAIModels.value.length === 0) {
      resetAllStates()
      return
    }
    aiDialogVisible.value = true
    const dom = document.querySelector(SELECTORS.AI) as HTMLElement
    if (!dom) return
    dom.style.position = 'fixed'
    dom.style.height = 'auto'
    dom.style.maxHeight = '190px'
    dom.style.left = `${res.x - 20}px`
    dom.style.top = `${res.y - (dom.offsetHeight + 5)}px`
  }

  /** 토픽 태그 처리 */
  const handleTopic = async (context: TriggerContext) => {
    if (topicList.value.length === 0) {
      resetAllStates()
      return
    }

    topicDialogVisible.value = true
    topicKeyword.value = context.keyword

    const res = context.range.getBoundingClientRect()
    await nextTick(() => {
      const dom = document.querySelector(SELECTORS.TOPIC) as HTMLElement
      if (!dom) return
      dom.style.position = 'fixed'
      dom.style.height = 'auto'
      dom.style.maxHeight = '190px'
      dom.style.left = `${res.x - 20}px`
      dom.style.top = `${res.y - (dom.offsetHeight + 5)}px`
    })
  }

  /** 트리거 여부 확인 */
  const shouldTrigger = (text: string, cursorPosition: number, triggerSymbol: string) => {
    try {
      // 유효한 텍스트 및 커서 위치 확인
      if (!text || cursorPosition === undefined || cursorPosition < 0) {
        return false
      }

      const searchStr = text.slice(0, cursorPosition)
      const pattern = new RegExp(`\\${triggerSymbol}([^\\${triggerSymbol}]*)$`)
      return pattern.test(searchStr)
    } catch (err) {
      console.error('트리거 조건 확인 오류:', err)
      return false
    }
  }

  /** 키워드 추출 */
  const extractKeyword = (text: string, cursorPosition: number, triggerSymbol: string) => {
    try {
      if (!text || cursorPosition === undefined || cursorPosition < 0) {
        return null
      }

      const searchStr = text.slice(0, cursorPosition)
      const pattern = new RegExp(`\\${triggerSymbol}([^\\${triggerSymbol}]*)$`)
      const matches = pattern.exec(searchStr)
      return matches && matches.length > 1 ? matches[1] : null
    } catch (err) {
      console.error('키워드 추출 오류:', err)
      return null
    }
  }

  /** 트리거 처리 */
  const handleTrigger = async (text: string, cursorPosition: number, context: TriggerContext) => {
    try {
      let hasTriggered = false

      // @멘션 확인
      if (shouldTrigger(text, cursorPosition, TriggerEnum.MENTION)) {
        const keyword = extractKeyword(text, cursorPosition, TriggerEnum.MENTION)
        if (keyword !== null) {
          await handleMention({ ...context, keyword })
          hasTriggered = ait.value
        }
      }
      // AI 대화 확인
      // 스위치가 켜져 있을 때만 / 트리거 해석, 비활성화된 로직 오작동 방지
      else if (enableAITrigger && shouldTrigger(text, cursorPosition, TriggerEnum.AI)) {
        const keyword = extractKeyword(text, cursorPosition, TriggerEnum.AI)
        if (keyword !== null) {
          await handleAI({ ...context, keyword })
          hasTriggered = aiDialogVisible.value
        }
      }
      // 토픽 태그 확인
      else if (shouldTrigger(text, cursorPosition, TriggerEnum.TOPIC)) {
        const keyword = extractKeyword(text, cursorPosition, TriggerEnum.TOPIC)
        if (keyword !== null) {
          await handleTopic({ ...context, keyword })
          hasTriggered = topicDialogVisible.value
        }
      }

      if (!hasTriggered) {
        resetAllStates()
      }

      return hasTriggered
    } catch (err) {
      console.error('트리거 이벤트 처리 오류:', err)
      resetAllStates()
      return false
    }
  }

  return {
    handleTrigger,
    resetAllStates
  }
}
