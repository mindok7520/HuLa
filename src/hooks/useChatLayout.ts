import { FOOTER_HEIGHT } from '@/common/constants'

/**
 * 채팅 페이지 레이아웃 관리
 */
export const useChatLayout = () => {
  const footerHeight = ref(FOOTER_HEIGHT)

  const setFooterHeight = (height: number) => {
    footerHeight.value = height
  }

  return {
    footerHeight: readonly(footerHeight),
    setFooterHeight
  }
}

// 전역 인스턴스 생성
const chatLayoutInstance = useChatLayout()

// 전역 인스턴스 메서드 내보내기
export const useChatLayoutGlobal = () => chatLayoutInstance
