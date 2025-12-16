import { invoke } from '@tauri-apps/api/core'
import { LogicalPosition, LogicalSize } from '@tauri-apps/api/dpi'
import { emitTo, listen } from '@tauri-apps/api/event'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { register, unregister } from '@tauri-apps/plugin-global-shortcut'
import { useSettingStore } from '@/stores/setting.ts'
import { isMac } from '@/utils/PlatformConstants'

// 단축키 설정 인터페이스
type ShortcutConfig = {
  /** 설정 키 이름, store에서 설정을 읽는 데 사용 */
  key: keyof NonNullable<ReturnType<typeof useSettingStore>['shortcuts']>
  /** 기본 단축키 값 */
  defaultValue: string
  /** 단축키 처리 함수 */
  handler: () => Promise<void>
  /** 수신할 업데이트 이벤트 이름 */
  updateEventName: string
  /** 등록 상태를 보낼 이벤트 이름 */
  registrationEventName: string
}

// 전역 단축키 상태 관리
const globalShortcutStates = new Map<string, string>()

// 디바운스 상태 관리
let togglePanelTimeout: ReturnType<typeof setTimeout> | null = null
let lastToggleTime = 0
const isMacPlatform = isMac()

/**
 * 전역 단축키 관리 Hook
 * 전역 단축키 등록, 등록 취소 및 관리를 담당
 * 설정 기반 방식을 사용하여 새로운 단축키 확장이 용이함
 */
export const useGlobalShortcut = () => {
  const settingStore = useSettingStore()
  // 플랫폼에 맞는 기본 단축키 가져오기
  const getDefaultShortcuts = () => {
    return {
      screenshot: isMac() ? 'Cmd+Ctrl+H' : 'Ctrl+Alt+H',
      openMainPanel: isMac() ? 'Cmd+Ctrl+P' : 'Ctrl+Alt+P'
    }
  }

  /**
   * capture 창이 존재하는지 확인
   * 존재하지 않으면 생성하고, 존재하면 닫기 차단이 설정되어 있는지 확인
   */
  const ensureCaptureWindow = async () => {
    const captureWindow = await WebviewWindow.getByLabel('capture')

    if (captureWindow) {
      // 닫기 차단 설정 - 닫기를 숨기기로 전환
      captureWindow.onCloseRequested(async (event) => {
        event.preventDefault()
        await captureWindow.hide()
        // 초기화 이벤트 트리거, Screenshot 컴포넌트가 다시 초기화되도록 함
        await captureWindow.emit('capture-reset', {})
      })
      // 초기 상태는 숨김
      await captureWindow.hide()
    }

    return captureWindow
  }

  /**
   * 스크린샷 처리 함수
   */
  const handleScreenshot = async () => {
    try {
      const homeWindow = await WebviewWindow.getByLabel('home')
      if (!homeWindow) return

      const captureWindow = await WebviewWindow.getByLabel('capture')
      if (!captureWindow) return

      // home 창을 숨겨야 하는지 확인
      if (settingStore.screenshot.isConceal) {
        await homeWindow.hide()
        // 창이 숨겨질 때까지 대기
        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      // 창이 전체 화면을 덮도록 설정 (메뉴바 포함)
      const screenWidth = window.screen.width * window.devicePixelRatio
      const screenHeight = window.screen.height * window.devicePixelRatio

      // 창 수준 설정을 통해 메뉴바를 덮도록 보장
      await captureWindow.setSize(new LogicalSize(screenWidth, screenHeight))
      await captureWindow.setPosition(new LogicalPosition(0, 0))

      // macOS에서 메뉴바를 덮도록 창 수준 설정
      if (isMacPlatform) {
        await invoke('set_window_level_above_menubar', { windowLabel: 'capture' })
      }

      await captureWindow.show()
      await captureWindow.setFocus()
      await captureWindow.emit('capture', true)

      console.log('스크린샷 창이 시작되었습니다')
    } catch (error) {
      console.error('Failed to open screenshot window:', error)
    }
  }

  /**
   * 메인 패널 표시 상태 전환
   * - 창이 이미 표시되어 있으면 숨김
   * - 창이 숨겨져 있거나 최소화되어 있으면 표시하고 포커스
   */
  const handleOpenMainPanel = async () => {
    const currentTime = Date.now()

    // 디바운스: 마지막 작업 후 500ms 미만이면 무시
    if (currentTime - lastToggleTime < 500) {
      return
    }

    // 이전 지연 작업 지우기
    if (togglePanelTimeout) {
      clearTimeout(togglePanelTimeout)
      togglePanelTimeout = null
    }

    lastToggleTime = currentTime

    try {
      const homeWindow = await WebviewWindow.getByLabel('home')
      if (!homeWindow) {
        console.warn('Home window not found')
        return
      }

      // 현재 창 상태 가져오기
      const isVisible = await homeWindow.isVisible()
      const isMinimized = await homeWindow.isMinimized()

      console.log(`단축키 트리거 - 창 상태: 표시됨=${isVisible}, 최소화됨=${isMinimized}`)

      if (isVisible && !isMinimized) {
        // 창이 현재 표시되어 있고 최소화되지 않은 경우 바로 숨김
        await homeWindow.hide()
      } else {
        // 최소화 상태 처리
        if (isMinimized) {
          await homeWindow.unminimize()
        }

        // 창 표시
        await homeWindow.show()

        // 포커스 설정 지연, 창이 완전히 표시되도록 보장
        togglePanelTimeout = setTimeout(async () => {
          await homeWindow.setFocus()
        }, 50)
      }
    } catch (error) {
      console.error('Failed to toggle main panel:', error)
    }
  }

  // 단축키 설정 배열 - 새 단축키는 여기에 설정을 추가하기만 하면 됨
  const shortcutConfigs: ShortcutConfig[] = [
    {
      key: 'screenshot',
      defaultValue: getDefaultShortcuts().screenshot,
      handler: handleScreenshot,
      updateEventName: 'shortcut-updated',
      registrationEventName: 'shortcut-registration-updated'
    },
    {
      key: 'openMainPanel',
      defaultValue: getDefaultShortcuts().openMainPanel,
      handler: handleOpenMainPanel,
      updateEventName: 'open-main-panel-shortcut-updated',
      registrationEventName: 'open-main-panel-shortcut-registration-updated'
    }
  ]

  /**
   * 일반 단축키 등록 함수
   * @param config 단축키 설정
   * @param shortcut 단축키 문자열
   */
  const registerShortcut = async (config: ShortcutConfig, shortcut: string): Promise<boolean> => {
    try {
      const currentShortcut = globalShortcutStates.get(config.key)

      // 현재 단축키 정리
      if (currentShortcut) {
        await unregister(currentShortcut)
        console.log(`단축키 정리 [${config.key}]: ${currentShortcut}`)
      }

      // 대상 단축키 예방적 정리
      if (!currentShortcut) {
        try {
          await unregister(shortcut)
          console.log(`단축키 예방적 정리 [${config.key}]: ${shortcut}`)
        } catch (_e) {
          console.log(`단축키 [${config.key}] 미등록: ${shortcut}`)
        }
      }

      // 새 단축키 등록
      await register(shortcut, config.handler)
      globalShortcutStates.set(config.key, shortcut)
      console.log(`단축키 등록됨 [${config.key}]: ${shortcut}`)
      return true
    } catch (error) {
      console.error(`단축키 등록 실패 [${config.key}]:`, error)
      return false
    }
  }

  /**
   * 단축키 등록 취소
   * @param shortcut 등록 취소할 단축키 문자열
   */
  const unregisterShortcut = async (shortcut: string) => {
    try {
      await unregister(shortcut)
      console.log(`단축키 등록 취소 성공: ${shortcut}`)
    } catch (error) {
      console.error(`단축키 등록 취소 실패: ${shortcut}`, error)
    }
  }

  /**
   * 단축키 잔여물 강제 정리
   */
  const forceCleanupShortcuts = async (shortcuts: string[]) => {
    for (const shortcut of shortcuts) {
      try {
        await unregister(shortcut)
      } catch (_e) {
        console.log(`${shortcut} 강제 정리 (미등록 상태일 수 있음)`)
      }
    }
  }

  /**
   * 일반 단축키 업데이트 처리 함수
   * @param config 단축키 설정
   * @param newShortcut 새 단축키
   */
  const handleShortcutUpdate = async (config: ShortcutConfig, newShortcut: string) => {
    const oldShortcut = globalShortcutStates.get(config.key)

    // 이전 단축키 강제 정리
    const shortcutsToClean = [oldShortcut, newShortcut].filter(Boolean) as string[]
    await forceCleanupShortcuts(shortcutsToClean)

    // 상태 지우기, 재등록 준비
    globalShortcutStates.delete(config.key)

    // 새 단축키 등록 시도
    console.log(`[Home] 새 단축키 등록 시작 [${config.key}]: ${newShortcut}`)
    const success = await registerShortcut(config, newShortcut)

    // 등록 실패 및 이전 단축키가 있는 경우 롤백 시도
    if (!success && oldShortcut) {
      globalShortcutStates.delete(config.key)
      const rollbackSuccess = await registerShortcut(config, oldShortcut)
      console.log(`[Home] 단축키 롤백 결과 [${config.key}]: ${rollbackSuccess ? '성공' : '실패'}`)
    }

    // 설정 페이지에 등록 상태 업데이트 알림
    await emitTo('settings', config.registrationEventName, {
      shortcut: newShortcut,
      registered: success
    })
    console.log(`[Home] settings 창에 단축키 상태 업데이트 알림 [${config.key}]: ${success ? '등록됨' : '미등록'}`)
  }

  /**
   * 전역 단축키 스위치 상태 변경 처리
   * @param enabled 전역 단축키 활성화 여부
   */
  const handleGlobalShortcutToggle = async (enabled: boolean) => {
    if (enabled) {
      // 켜져 있을 때 모든 단축키를 다시 등록하고 설정 페이지에 알림
      for (const config of shortcutConfigs) {
        const savedShortcut = settingStore.shortcuts?.[config.key] || config.defaultValue
        const success = await registerShortcut(config, savedShortcut as string)

        // 설정 페이지에 등록 상태 업데이트 알림
        await emitTo('settings', config.registrationEventName, {
          shortcut: savedShortcut,
          registered: success
        })
      }
    } else {
      // 꺼져 있을 때 모든 단축키 등록 취소 및 설정 페이지에 미바인딩 상태 알림
      for (const config of shortcutConfigs) {
        const savedShortcut = settingStore.shortcuts?.[config.key] || config.defaultValue

        // 설정 페이지에 등록 상태를 미바인딩으로 업데이트 알림
        await emitTo('settings', config.registrationEventName, {
          shortcut: savedShortcut,
          registered: false
        })
      }

      // 모든 단축키 등록 취소
      await cleanupGlobalShortcut()
    }
  }

  /**
   * 전역 단축키 초기화
   * 설정에 따라 모든 단축키를 자동 등록하고 업데이트 이벤트 수신
   */
  const initializeGlobalShortcut = async () => {
    // capture 창 존재 확인
    await ensureCaptureWindow()

    // 전역 단축키 활성화 여부 확인, 기본값은 비활성화
    const globalEnabled = settingStore.shortcuts?.globalEnabled ?? false

    // 활성화된 경우에만 단축키 등록
    if (globalEnabled) {
      // 설정된 모든 단축키 일괄 등록
      for (const config of shortcutConfigs) {
        const savedShortcut = settingStore.shortcuts?.[config.key] || config.defaultValue
        await registerShortcut(config, savedShortcut as string)
      }
    }

    // 전역 단축키 스위치 변경 감지
    listen('global-shortcut-enabled-changed', (event) => {
      const enabled = (event.payload as any)?.enabled
      if (typeof enabled === 'boolean') {
        handleGlobalShortcutToggle(enabled)
      } else {
        console.warn(`[Home] 유효하지 않은 전역 단축키 스위치 이벤트 수신:`, event.payload)
      }
    })

    // 각 단축키 업데이트 이벤트 감지
    for (const config of shortcutConfigs) {
      listen(config.updateEventName, (event) => {
        const newShortcut = (event.payload as any)?.shortcut
        if (newShortcut) {
          // 전역 단축키가 켜져 있을 때만 업데이트 처리
          const globalEnabled = settingStore.shortcuts?.globalEnabled ?? false
          if (globalEnabled) {
            handleShortcutUpdate(config, newShortcut)
          } else {
            console.log(`[Home] 전역 단축키가 꺼져 있어 단축키 업데이트 건너뜀 [${config.key}]`)
          }
        } else {
          console.warn(`[Home] 유효하지 않은 단축키 업데이트 이벤트 수신 [${config.key}]:`, event.payload)
        }
      })
    }
  }

  /**
   * 전역 단축키 정리
   * 모든 단축키 등록 취소 및 상태 정리
   */
  const cleanupGlobalShortcut = async () => {
    // 디바운스 타이머 정리
    if (togglePanelTimeout) {
      clearTimeout(togglePanelTimeout)
      togglePanelTimeout = null
    }

    // 등록된 모든 단축키 등록 취소
    for (const shortcut of globalShortcutStates.values()) {
      await unregisterShortcut(shortcut)
    }
    // 상태 정리
    globalShortcutStates.clear()
  }

  return {
    // 처리 함수
    handleScreenshot,
    handleOpenMainPanel,

    // 핵심 기능
    initializeGlobalShortcut,
    cleanupGlobalShortcut,
    ensureCaptureWindow,

    // 도구 함수
    registerShortcut: (config: ShortcutConfig, shortcut: string) => registerShortcut(config, shortcut),
    unregisterShortcut,
    getDefaultShortcuts,

    // 설정 정보 (외부 접근용)
    shortcutConfigs
  }
}
