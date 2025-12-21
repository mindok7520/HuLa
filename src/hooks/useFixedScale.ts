import { invoke } from '@tauri-apps/api/core'
import { useDebounceFn } from '@vueuse/core'
export type FixedScaleMode = 'zoom' | 'transform'

export type UseFixedScaleOptions = {
  /** 대상 컨테이너: CSS 선택자 또는 요소, 기본값 '#app' */
  target?: string | HTMLElement
  /** 기본값 'zoom' */
  mode?: FixedScaleMode
  /** 사용자 정의 배율 계산 방법, 기본적으로 1 / devicePixelRatio 반환 */
  getScale?: () => number
  /** 최소 배율 제한 */
  minScale?: number
  /** 최대 배율 제한 */
  maxScale?: number
  /** Windows 텍스트 배율 감지 활성화 여부 */
  enableWindowsTextScaleDetection?: boolean
}

type FixedScaleController = {
  enable: () => void
  disable: () => void
  getCurrentScale: () => number
  forceUpdate: () => void
  /** 현재 활성화 여부 */
  readonly isEnabled: ComputedRef<boolean>
  /** 현재 배율 */
  readonly currentScale: ComputedRef<number>
  /** 현재 DPR */
  readonly devicePixelRatio: ComputedRef<number>
}

const clamp = (n: number, min?: number, max?: number) => {
  let x = n
  if (typeof min === 'number') x = Math.max(min, x)
  if (typeof max === 'number') x = Math.min(max, x)
  return x
}

const resolveElement = (target?: string | HTMLElement): HTMLElement => {
  if (!target) return (document.getElementById('app') || document.body || document.documentElement) as HTMLElement
  if (typeof target === 'string') {
    const el = document.querySelector(target)
    return (el as HTMLElement) || (document.getElementById('app') as HTMLElement) || document.body
  }
  return target
}

// zoom 스타일 지원 여부 확인
const supportsZoom = (() => {
  const testEl = document.createElement('div')
  testEl.style.zoom = '1'
  return testEl.style.zoom === '1'
})()

/**
 * 다양한 시스템 디스플레이 배율(DPI)에서 페이지의 시각적 크기를 일관되게 유지하는 컴포저블 함수
 * - 시스템 디스플레이 배율이 125%, 150%, 200% 등으로 window.devicePixelRatio(DPR)가 변경될 때, 페이지를 자동으로 역배율 조정하여 UI 시각적 크기 유지
 * - 기본적으로 zoom 방식 사용 (데스크톱 Chromium/Edge/Tauri 환경에서 비교적 안정적)
 * - transform 방식을 대체 수단으로 제공 (zoom을 지원하지 않거나 호환성 문제가 있는 환경에서 전환 가능)
 * - 윈도우 resize / visualViewport 변경 및 DPR 미디어 쿼리 변경을 감지하여 동적으로 적용
 * - 활성화/비활성화 인터페이스 제공, 언마운트 시 스타일 및 이벤트 복구 보장
 * @param options 구성 옵션
 */
// TODO: win10 다중 모니터 고해상도 환경에서 여전히 문제 발생, 당분간 시스템 텍스트 확대로 인한 콘텐츠 미표시 문제 해결에 이 훅 사용 안 함
export const useFixedScale = (options: UseFixedScaleOptions = {}): FixedScaleController => {
  const {
    target = '#app',
    mode = 'zoom',
    getScale,
    minScale = 0.1,
    maxScale = 3.0,
    enableWindowsTextScaleDetection = false
  } = options

  const isEnabled = ref(false)
  const currentDPR = ref(window.devicePixelRatio || 1)
  const targetElement = ref<HTMLElement | null>(null)

  // Windows 배율 정보
  const windowsScaleInfo = ref<{
    system_dpi: number
    system_scale: number
    text_scale: number
    has_text_scaling: boolean
  } | null>(null)

  // 복구 편의를 위해 진입 전 스타일 저장
  const originalStyles: Partial<CSSStyleDeclaration> = {}

  // 이벤트 리스너 관리 - Map을 사용하여 리스너 추적
  const eventListeners = new Map<string, () => void>()
  const mediaQueryListeners = new Set<MediaQueryList>()

  // Windows 배율 감지 함수
  const checkWindowsScale = async () => {
    if (!enableWindowsTextScaleDetection) return

    try {
      const scaleInfo = (await invoke('get_windows_scale_info')) as {
        system_dpi: number
        system_scale: number
        text_scale: number
        has_text_scaling: boolean
      }

      // 변경 사항 확인
      const oldTextScale = windowsScaleInfo.value?.text_scale
      const newTextScale = scaleInfo.text_scale

      windowsScaleInfo.value = scaleInfo

      // text_scale이 변경되면 resize-needed 이벤트 트리거
      if (oldTextScale && Math.abs(newTextScale - oldTextScale) > 0.001) {
        window.dispatchEvent(
          new CustomEvent('resize-needed', {
            detail: {
              type: 'text-scale-change',
              oldScale: oldTextScale,
              newScale: newTextScale,
              scaleInfo
            }
          })
        )
      }
    } catch (error) {
      console.warn('Failed to get Windows scale info:', error)
    }
  }

  // 개선된 배율 계산 로직 - 다양한 배율에 최적화
  const calculateOptimalScale = (): number => {
    const dpr = currentDPR.value

    if (getScale) {
      return getScale()
    }

    // Windows 텍스트 배율 감지가 활성화되어 있고 배율 정보가 있는 경우
    if (enableWindowsTextScaleDetection && windowsScaleInfo.value && windowsScaleInfo.value.has_text_scaling) {
      const textScaleCompensation = 1 / windowsScaleInfo.value.text_scale
      return textScaleCompensation
    }

    // 일반적인 시스템 배율에 대한 최적화 계산
    // 부동 소수점 정밀도 처리를 위해 더 정확한 값 사용
    if (Math.abs(dpr - 2.0) < 0.01) {
      // 200% 배율: 정확한 0.5
      return 0.5
    } else if (Math.abs(dpr - 1.5) < 0.01) {
      // 150% 배율: 정확한 2/3
      return 2 / 3
    } else if (Math.abs(dpr - 1.25) < 0.01) {
      // 125% 배율: 정확한 0.8
      return 0.8
    }

    // 기본 역배율, 더 안전한 계산 사용
    const scale = 1 / dpr
    return scale
  }

  // 계산된 속성 - Vue 반응형 시스템의 장점
  const currentScale = computed(() => clamp(calculateOptimalScale(), minScale, maxScale))
  const devicePixelRatio = computed(() => currentDPR.value)

  const applyZoom = (scale: number) => {
    if (!targetElement.value) return
    const el = targetElement.value
    ;(el.style as any).zoom = String(scale)
    el.style.transformOrigin = ''
    el.style.transform = ''
    el.style.width = ''
    el.style.height = ''
  }

  const applyTransform = (scale: number) => {
    if (!targetElement.value) return
    const el = targetElement.value
    el.style.transformOrigin = '0 0'
    el.style.transform = `scale(${scale})`
    // 가시 영역을 채우기 위해 컨테이너 크기를 역으로 확대해야 함
    el.style.width = `${100 / scale}%`
    el.style.height = `${100 / scale}%`
    // 중첩 방지를 위해 zoom 정리
    ;(el.style as any).zoom = ''
  }

  const apply = () => {
    if (!targetElement.value) return

    const scale = currentScale.value
    // 다른 컴포넌트에서 사용할 CSS 사용자 정의 속성 설정
    document.documentElement.style.setProperty('--page-scale', String(scale))
    document.documentElement.style.setProperty('--device-pixel-ratio', String(currentDPR.value))

    // 모드 확인 및 해당 배율 메서드 적용
    const effectiveMode = mode === 'zoom' && !supportsZoom ? 'transform' : mode

    if (effectiveMode === 'zoom') {
      applyZoom(scale)
    } else {
      applyTransform(scale)
    }

    // 창 크기 조정 이벤트 트리거
    window.dispatchEvent(
      new CustomEvent('resize-needed', {
        detail: { scale, devicePixelRatio: currentDPR.value }
      })
    )
  }

  // 개선된 DPR 업데이트 함수
  const updateDPR = () => {
    const newDPR = window.devicePixelRatio || 1
    if (Math.abs(newDPR - currentDPR.value) > 0.001) {
      // 부동 소수점 비교 문제 방지
      currentDPR.value = newDPR
      if (isEnabled.value) {
        // 반응형 업데이트 완료 후 적용되도록 nextTick 사용
        nextTick(() => {
          apply()
        })
      }
    }
  }

  const setupListeners = () => {
    // 디바운스 함수로 빈번한 트리거 방지
    const debounceApply = useDebounceFn(() => {
      updateDPR()
    }, 100)

    const debounceCheckWindowsScale = useDebounceFn(() => {
      checkWindowsScale()
    }, 200)

    // 사용자 정의 resize-needed 이벤트 수신
    const customResizeHandler = (e: CustomEvent) => {
      if (e.detail?.type === 'text-scale-change') {
        // 텍스트 배율 변경 시 강제 업데이트
        nextTick(() => {
          // 이전에 텍스트 배율이 있었는지 여부에 관계없이 이제 새 배율을 적용해야 함
          apply()
        })
      }
    }
    eventListeners.set('resize-needed', () => {
      window.removeEventListener('resize-needed', customResizeHandler as EventListener)
    })
    window.addEventListener('resize-needed', customResizeHandler as EventListener)

    // window.resize 리스너
    const resizeHandler = () => {
      debounceApply()
      if (enableWindowsTextScaleDetection) {
        debounceCheckWindowsScale()
      }
    }
    eventListeners.set('resize', resizeHandler)
    window.addEventListener('resize', resizeHandler, { passive: true })

    // visualViewport 리스너
    if (window.visualViewport) {
      const viewportHandler = () => {
        debounceApply()
        if (enableWindowsTextScaleDetection) {
          debounceCheckWindowsScale()
        }
      }

      window.visualViewport.addEventListener('resize', viewportHandler, { passive: true })
      window.visualViewport.addEventListener('scroll', viewportHandler, { passive: true })

      eventListeners.set('visualViewport', () => {
        window.visualViewport?.removeEventListener('resize', viewportHandler)
        window.visualViewport?.removeEventListener('scroll', viewportHandler)
      })
    }

    // 더 정확한 DPR 수신 - 더 포괄적인 범위 사용
    const dprValues = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 3.5, 4]

    dprValues.forEach((dpr) => {
      try {
        const mql = matchMedia(`(resolution: ${dpr}dppx)`)
        if (mql) {
          const handler = (e: MediaQueryListEvent) => {
            if (e.matches) {
              debounceApply()
              if (enableWindowsTextScaleDetection) {
                debounceCheckWindowsScale()
              }
            }
          }

          mql.addEventListener('change', handler)
          mediaQueryListeners.add(mql)

          // 정리 함수 저장
          eventListeners.set(`mql-${dpr}`, () => {
            mql.removeEventListener('change', handler)
          })
        }
      } catch (error) {
        console.log(`Failed to create media query for ${dpr}dppx:`, error)
      }
    })
  }

  const removeListeners = () => {
    // 모든 이벤트 리스너 제거
    eventListeners.forEach((cleanup, key) => {
      try {
        if (key === 'resize') {
          window.removeEventListener('resize', cleanup as EventListener)
        } else if (key === 'resize-needed') {
          window.removeEventListener('resize-needed', cleanup as EventListener)
        } else {
          cleanup()
        }
      } catch (error) {
        console.log(`Error removing listener ${key}:`, error)
      }
    })

    eventListeners.clear()
    mediaQueryListeners.clear()
  }

  const saveOriginal = () => {
    if (!targetElement.value) return
    const el = targetElement.value
    originalStyles.zoom = (el.style as any).zoom
    originalStyles.transform = el.style.transform
    originalStyles.transformOrigin = el.style.transformOrigin
    originalStyles.width = el.style.width
    originalStyles.height = el.style.height
  }

  const restoreOriginal = () => {
    if (!targetElement.value) return
    const el = targetElement.value

    // CSS 사용자 정의 속성 제거
    document.documentElement.style.removeProperty('--page-scale')
    document.documentElement.style.removeProperty('--device-pixel-ratio')

    // 원본 스타일 복원
    if (originalStyles.zoom !== undefined) (el.style as any).zoom = originalStyles.zoom
    if (originalStyles.transform !== undefined) el.style.transform = originalStyles.transform
    if (originalStyles.transformOrigin !== undefined) el.style.transformOrigin = originalStyles.transformOrigin
    if (originalStyles.width !== undefined) el.style.width = originalStyles.width
    if (originalStyles.height !== undefined) el.style.height = originalStyles.height
  }

  const enable = async () => {
    if (isEnabled.value) {
      return
    }

    const el = resolveElement(target)
    if (!el) {
      return
    }

    targetElement.value = el
    currentDPR.value = window.devicePixelRatio || 1

    // Windows 텍스트 배율 감지가 활성화된 경우 먼저 배율 정보 가져오기
    if (enableWindowsTextScaleDetection) {
      await checkWindowsScale()
    }

    saveOriginal()
    setupListeners()

    // 텍스트 배율이 감지된 경우에만 배율 적용, 하지만 리스너는 항상 설정
    if (!enableWindowsTextScaleDetection || windowsScaleInfo.value?.has_text_scaling) {
      apply()
    }

    isEnabled.value = true
  }

  const disable = () => {
    if (!isEnabled.value) {
      return
    }

    removeListeners()
    restoreOriginal()
    isEnabled.value = false
    targetElement.value = null
  }

  // Vue 생명주기 관리
  onBeforeUnmount(() => {
    disable()
  })

  return {
    enable,
    disable,
    getCurrentScale: () => currentScale.value,
    forceUpdate: () => {
      updateDPR()
      apply()
    },
    isEnabled: computed(() => isEnabled.value),
    currentScale,
    devicePixelRatio
  }
}
