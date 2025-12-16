import { defineStore } from 'pinia'
import { StoresEnum } from '@/enums'

export const useGuideStore = defineStore(
  StoresEnum.GUIDE,
  () => {
    /** 가이드 완료 상태 */
    const isGuideCompleted = ref(false)

    /**
     * 가이드를 완료로 표시
     */
    const markGuideCompleted = () => {
      isGuideCompleted.value = true
    }

    /**
     * 가이드 상태 초기화
     */
    const resetGuideStatus = () => {
      isGuideCompleted.value = false
    }

    return {
      isGuideCompleted,
      markGuideCompleted,
      resetGuideStatus
    }
  },
  {
    share: {
      enable: true,
      initialize: true
    }
  }
)
