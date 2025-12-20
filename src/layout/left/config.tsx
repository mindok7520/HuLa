import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { MittEnum, ModalEnum, PluginEnum } from '@/enums'
import { useLogin } from '@/hooks/useLogin.ts'
import { useMitt } from '@/hooks/useMitt.ts'
import { useWindow } from '@/hooks/useWindow.ts'
import { useSettingStore } from '@/stores/setting'
import * as ImRequestUtils from '@/utils/ImRequestUtils'

/**
 * 여기 상단 작업 표시줄은 pinia를 사용하여 localstorage에 기록했습니다.
 */
/** 하단 작업 표시줄 구성 */
const baseItemsBottom: Array<Omit<OPT.L.Common, 'title' | 'shortTitle'>> = [
  {
    url: 'fileManager',
    icon: 'file',
    iconAction: 'file-action',
    size: {
      width: 840,
      height: 600
    },
    window: {
      resizable: false
    }
  },
  {
    url: 'mail',
    icon: 'collect',
    iconAction: 'collect-action',
    size: {
      width: 840,
      height: 600
    },
    window: {
      resizable: true
    }
  }
]

const useItemsBottom = () =>
  (() => {
    const { t } = useI18n()
    return computed<OPT.L.Common[]>(() => [
      {
        ...baseItemsBottom[0],
        title: t('home.action.file_manager'),
        shortTitle: t('home.action.file_manager_short_title')
      },
      {
        ...baseItemsBottom[1],
        title: t('home.action.favorite'),
        shortTitle: t('home.action.favorite_short_title')
      }
    ])
  })()
/** 설정 목록 메뉴 항목 */
const useMoreList = () => {
  const { t } = useI18n()
  const { createWebviewWindow } = useWindow()
  const settingStore = useSettingStore()
  const { login } = storeToRefs(settingStore)
  const { logout, resetLoginState } = useLogin()

  return computed<OPT.L.MoreList[]>(() => [
    {
      label: t('menu.check_update'),
      icon: 'arrow-circle-up',
      click: () => {
        useMitt.emit(MittEnum.LEFT_MODAL_SHOW, {
          type: ModalEnum.CHECK_UPDATE
        })
      }
    },
    {
      label: t('menu.lock_screen'),
      icon: 'lock',
      click: () => {
        useMitt.emit(MittEnum.LEFT_MODAL_SHOW, {
          type: ModalEnum.LOCK_SCREEN
        })
      }
    },
    {
      label: t('menu.settings'),
      icon: 'settings',
      click: async () => {
        await createWebviewWindow('설정', 'settings', 840, 840, '', true, 840, 600)
      }
    },
    {
      label: t('menu.about'),
      icon: 'info',
      click: async () => {
        await createWebviewWindow('정보', 'about', 360, 480)
      }
    },
    {
      label: t('menu.sign_out'),
      icon: 'power',
      click: async () => {
        try {
          await ImRequestUtils.logout({ autoLogin: login.value.autoLogin })
          await resetLoginState()
          await logout()
        } catch (error) {
          console.error('로그아웃 실패:', error)
          window.$message.error('로그아웃 실패, 다시 시도해 주세요')
        }
      }
    }
  ])
}

/** 플러그인 목록 */
const basePluginsList: Array<Omit<STO.Plugins<PluginEnum>, 'title' | 'shortTitle'>> = [
  {
    url: 'dynamic',
    icon: 'fire',
    iconAction: 'fire-action',
    state: PluginEnum.BUILTIN,
    isAdd: true,
    dot: false,
    progress: 0,
    size: {
      width: 600,
      height: 800,
      minWidth: 600,
      minHeight: 550
    },
    window: {
      resizable: true
    },
    miniShow: false
  },
  {
    icon: 'robot',
    iconAction: 'GPT',
    url: 'robot',
    state: PluginEnum.BUILTIN,
    isAdd: true,
    dot: false,
    progress: 0,
    size: {
      minWidth: 1240,
      width: 1380,
      height: 800
    },
    window: {
      resizable: true
    },
    miniShow: false
  }
  // {
  //   icon: 'Music',
  //   url: 'music',
  //   title: 'HuLa 클라우드 뮤직',
  //   shortTitle: '클라우드 뮤직',
  //   tip: 'HuLa 클라우드 뮤직 개발 중, 기대해 주세요',
  //   state: PluginEnum.NOT_INSTALLED,
  //   version: 'v1.0.0-Alpha',
  //   isAdd: false,
  //   dot: true,
  //   progress: 0,
  //   size: {
  //     minWidth: 780,
  //     width: 980,
  //     height: 800
  //   },
  //   window: {
  //     resizable: true
  //   },
  //   miniShow: false
  // },
  // {
  //   icon: 'UimSlack',
  //   url: 'collaboration',
  //   title: 'HuLa 협업',
  //   shortTitle: '협업',
  //   tip: 'HuLa 협업 개발 중, 기대해 주세요',
  //   state: PluginEnum.NOT_INSTALLED,
  //   version: 'v1.0.0-Alpha',
  //   isAdd: false,
  //   dot: true,
  //   progress: 0,
  //   size: {
  //     minWidth: 780,
  //     width: 980,
  //     height: 800
  //   },
  //   window: {
  //     resizable: true
  //   },
  //   miniShow: false
  // },
  // {
  //   icon: 'vigo',
  //   url: 'collaboration',
  //   title: 'HuLa 숏폼',
  //   shortTitle: '숏폼',
  //   tip: 'HuLa 숏폼 개발 중, 기대해 주세요',
  //   state: PluginEnum.NOT_INSTALLED,
  //   version: 'v1.0.0-Alpha',
  //   isAdd: false,
  //   dot: true,
  //   progress: 0,
  //   size: {
  //     minWidth: 780,
  //     width: 980,
  //     height: 800
  //   },
  //   window: {
  //     resizable: true
  //   },
  //   miniShow: false
  // }
]

const usePluginsList = () =>
  (() => {
    const { t } = useI18n()
    return computed<STO.Plugins<PluginEnum>[]>(() => [
      {
        ...basePluginsList[0],
        title: t('home.plugins.dynamic'),
        shortTitle: t('home.plugins.dynamic_short_title')
      },
      {
        ...basePluginsList[1],
        title: t('home.plugins.chatbot'),
        shortTitle: t('home.plugins.chatbot_short_title')
      }
    ])
  })()

export { useItemsBottom, useMoreList, usePluginsList }
