import { defineStore } from 'pinia'
import { CloseBxEnum, ShowModeEnum, StoresEnum, ThemeEnum } from '@/enums'
import { isDesktop, isMac } from '@/utils/PlatformConstants'

// 플랫폼에 해당하는 기본 단축키 가져오기
const getDefaultShortcuts = () => {
  return {
    screenshot: isMac() ? 'Cmd+Ctrl+H' : 'Ctrl+Alt+H',
    openMainPanel: isMac() ? 'Cmd+Ctrl+P' : 'Ctrl+Alt+P',
    globalEnabled: false // 기본적으로 전역 단축키 비활성화
  }
}

// TODO indexDB 또는 sqlite를 사용하여 데이터를 캐시하고, 각 계정에 따라 구성해야 함 (nyh -> 2024-03-26 01:22:12)
const isDesktopComputed = computed(() => isDesktop())
export const useSettingStore = defineStore(StoresEnum.SETTING, {
  state: (): STO.Setting => ({
    themes: {
      content: '',
      pattern: '',
      versatile: isDesktopComputed.value ? 'default' : 'simple'
    },
    escClose: true,
    showMode: ShowModeEnum.ICON,
    lockScreen: {
      enable: false,
      password: ''
    },
    tips: {
      type: CloseBxEnum.HIDE,
      notTips: false
    },
    login: {
      autoLogin: false,
      autoStartup: false
    },
    chat: {
      sendKey: 'Enter',
      isDouble: true,
      translate: 'youdao'
    },
    shortcuts: getDefaultShortcuts(),
    page: {
      shadow: true,
      fonts: 'PingFang',
      blur: true,
      lang: 'AUTO'
    },
    update: {
      dismiss: ''
    },
    screenshot: {
      isConceal: false
    },
    notification: {
      messageSound: true
    }
  }),
  actions: {
    /** 테마 초기화 */
    initTheme(theme: string) {
      this.themes.content = theme
      document.documentElement.dataset.theme = theme
      this.themes.pattern = theme
    },
    /** 테마 전환 */
    toggleTheme(theme: string) {
      if (theme === ThemeEnum.OS) {
        this.themes.pattern = theme
        const os = matchMedia('(prefers-color-scheme: dark)').matches ? ThemeEnum.DARK : ThemeEnum.LIGHT
        document.documentElement.dataset.theme = os
        this.themes.content = os
      } else {
        this.themes.content = theme
        document.documentElement.dataset.theme = theme
        this.themes.pattern = theme
      }
    },
    /** 로그인 설정 전환 */
    toggleLogin(autoLogin: boolean, autoStartup: boolean) {
      this.login.autoLogin = autoLogin
      this.login.autoStartup = autoStartup
    },

    setAutoLogin(autoLogin: boolean) {
      this.login.autoLogin = autoLogin
    },
    /** 메뉴 표시 모드 설정 */
    setShowMode(showMode: ShowModeEnum) {
      this.showMode = showMode
    },
    /** 스크린샷 단축키 설정 */
    setScreenshotShortcut(shortcut: string) {
      if (!this.shortcuts) {
        this.shortcuts = getDefaultShortcuts()
      }
      this.shortcuts.screenshot = shortcut
    },
    /** 메인 패널 열기 단축키 설정 */
    setOpenMainPanelShortcut(shortcut: string) {
      if (!this.shortcuts) {
        this.shortcuts = getDefaultShortcuts()
      }
      this.shortcuts.openMainPanel = shortcut
    },
    /** 메시지 전송 단축키 설정 */
    setSendMessageShortcut(shortcut: string) {
      if (!this.chat) {
        this.chat = { sendKey: 'Enter', isDouble: true, translate: 'youdao' }
      }
      this.chat.sendKey = shortcut
    },
    /** 전역 단축키 활성화 상태 설정 */
    setGlobalShortcutEnabled(enabled: boolean) {
      if (!this.shortcuts) {
        this.shortcuts = getDefaultShortcuts()
      }
      this.shortcuts.globalEnabled = enabled
    },
    closeAutoLogin() {
      this.login.autoLogin = false
    },
    /** 스크린샷 시 창 숨김 여부 설정 */
    setScreenshotConceal(isConceal: boolean) {
      if (!this.screenshot) {
        this.screenshot = { isConceal: false }
      }
      this.screenshot.isConceal = isConceal
    },
    /** 메시지 알림음 스위치 설정 */
    setMessageSoundEnabled(enabled: boolean) {
      if (!this.notification) {
        this.notification = { messageSound: true }
      }
      this.notification.messageSound = enabled
    }
  },
  share: {
    enable: true,
    initialize: true
  }
})
