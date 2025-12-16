import { type Config, type Driver, type DriveStep, driver } from 'driver.js'
import { useGuideStore } from '@/stores/guide'
import 'driver.js/dist/driver.css'
import '@/styles/scss/global/driver.scss'

/**
 * Driver.js 단계 설정 인터페이스
 */
export interface DriverStepConfig extends Omit<DriveStep, 'popover'> {
  element: string
  /** 포커스된 요소의 상호 작용 비활성화 여부 (단계 수준 설정, 전역 설정 덮어씀) */
  disableActiveInteraction?: boolean
  popover?: {
    title?: string
    description?: string
    side?: 'top' | 'right' | 'bottom' | 'left'
    align?: 'start' | 'center' | 'end'
    onNextClick?: () => void
    onPrevClick?: () => void
    onCloseClick?: () => void
    onDestroyed?: () => void
  }
}

/**
 * Driver.js 설정 옵션 인터페이스
 */
export interface DriverConfig extends Omit<Config, 'steps'> {
  nextBtnText?: string
  prevBtnText?: string
  doneBtnText?: string
  showButtons?: Array<'next' | 'previous' | 'close'>
  showProgress?: boolean
  allowClose?: boolean
  popoverClass?: string
  progressText?: string
  /** 포커스된 요소의 상호 작용 비활성화 여부 (클릭 이벤트 등) */
  disableActiveInteraction?: boolean
}

/**
 * useDriver hooks 반환값 인터페이스
 */
export interface UseDriverReturn {
  /** Driver 인스턴스 */
  driverInstance: Driver | null
  /** 가이드 시작 */
  startTour: () => void
  /** 가이드 중지 */
  stopTour: () => void
  /** 다음 단계로 이동 */
  moveNext: () => void
  /** 이전 단계로 이동 */
  movePrevious: () => void
  /** 지정된 단계로 이동 */
  moveTo: (stepIndex: number) => void
  /** 가이드 다시 초기화 */
  reinitialize: (newSteps: DriverStepConfig[], newConfig?: Partial<DriverConfig>) => void
}

/**
 * Driver.js 가이드 기능 hooks
 * @param steps 가이드 단계 설정 배열
 * @param config 선택적 Driver 설정
 * @returns useDriver 반환 객체
 */
export const useDriver = (steps: DriverStepConfig[], config: DriverConfig = {}): UseDriverReturn => {
  let driverInstance: Driver | null = null
  const guideStore = useGuideStore()

  // 기본 설정
  const defaultConfig: DriverConfig = {
    progressText: '{{current}}/{{total}}',
    nextBtnText: '다음',
    prevBtnText: '이전',
    doneBtnText: '완료',
    showButtons: ['next', 'previous'],
    showProgress: true,
    allowClose: false,
    popoverClass: 'driverjs-theme',
    disableActiveInteraction: true // 기본적으로 포커스된 요소의 클릭 이벤트 비활성화
  }

  // 설정 병합
  const mergedConfig = {
    ...defaultConfig,
    ...config,
    onDestroyed: () => {
      guideStore.markGuideCompleted()
    }
  }

  /**
   * 단계 내 사용자 정의 클릭 이벤트 처리
   * @param step 단계 설정
   * @returns 처리된 단계 설정
   */
  const processStep = (step: DriverStepConfig): DriveStep => {
    const processedStep: DriveStep = {
      element: step.element,
      disableActiveInteraction: step.disableActiveInteraction,
      popover: step.popover
        ? {
          title: step.popover.title,
          description: step.popover.description,
          side: step.popover.side,
          align: step.popover.align
        }
        : undefined
    }

    // 사용자 정의 클릭 이벤트 처리
    if (step.popover?.onNextClick) {
      processedStep.popover = {
        ...processedStep.popover,
        onNextClick: () => {
          step.popover!.onNextClick!()
          // 사용자 정의 onNextClick이 있는 경우, nextTick 후 수동으로 다음 단계로 이동해야 함
          nextTick(() => {
            if (driverInstance) {
              driverInstance.moveNext()
            }
          })
        }
      }
    }

    if (step.popover?.onPrevClick) {
      processedStep.popover = {
        ...processedStep.popover,
        onPrevClick: step.popover.onPrevClick
      }
    }

    if (step.popover?.onCloseClick) {
      processedStep.popover = {
        ...processedStep.popover,
        onCloseClick: step.popover.onCloseClick
      }
    }

    return processedStep
  }

  /**
   * Driver 인스턴스 초기화
   */
  const initializeDriver = () => {
    const processedSteps = steps.map(processStep)

    driverInstance = driver({
      ...mergedConfig,
      steps: processedSteps
    })
  }

  /**
   * 가이드 시작
   */
  const startTour = () => {
    if (!driverInstance) {
      initializeDriver()
    }
    driverInstance?.drive()
  }

  /**
   * 가이드 중지
   */
  const stopTour = () => {
    driverInstance?.destroy()
    driverInstance = null
  }

  /**
   * 다음 단계로 이동
   */
  const moveNext = () => {
    driverInstance?.moveNext()
  }

  /**
   * 이전 단계로 이동
   */
  const movePrevious = () => {
    driverInstance?.movePrevious()
  }

  /**
   * 지정된 단계로 이동
   * @param stepIndex 단계 인덱스 (0부터 시작)
   */
  const moveTo = (stepIndex: number) => {
    driverInstance?.moveTo(stepIndex)
  }

  /**
   * 가이드 다시 초기화
   * @param newSteps 새로운 단계 설정
   * @param newConfig 새로운 설정 (선택 사항)
   */
  const reinitialize = (newSteps: DriverStepConfig[], newConfig?: Partial<DriverConfig>) => {
    // 기존 인스턴스 파괴
    stopTour()

    // 단계 및 설정 업데이트
    steps.splice(0, steps.length, ...newSteps)
    if (newConfig) {
      Object.assign(mergedConfig, newConfig)
    }

    // 다시 초기화
    initializeDriver()
  }

  // Driver 인스턴스 초기화
  initializeDriver()

  return {
    driverInstance,
    startTour,
    stopTour,
    moveNext,
    movePrevious,
    moveTo,
    reinitialize
  }
}
