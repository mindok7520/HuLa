import { defineStore } from 'pinia'
import { PluginEnum, StoresEnum } from '@/enums'
import { useI18n } from 'vue-i18n'

export const useMenuTopStore = defineStore(
  StoresEnum.MENUTOP,
  () => {
    const { t } = useI18n()
    // 초기 구성, 텍스트는 i18n에 의해 동적으로 주입되어 언어 전환 시 실시간 업데이트 보장
    const baseMenuTop: Array<Omit<STO.Plugins<PluginEnum>, 'title' | 'shortTitle'>> = [
      {
        url: 'message',
        icon: 'message',
        iconAction: 'message-action',
        state: PluginEnum.BUILTIN,
        isAdd: true,
        dot: false,
        progress: 0,
        miniShow: false
      },
      {
        url: 'friendsList',
        icon: 'avatar',
        iconAction: 'avatar-action',
        state: PluginEnum.BUILTIN,
        isAdd: true,
        dot: false,
        progress: 0,
        miniShow: false
      }
    ]

    const menuTop = computed<STO.Plugins<PluginEnum>[]>(() => [
      {
        ...baseMenuTop[0],
        title: t('home.action.message'),
        shortTitle: t('home.action.message_short_title')
      },
      {
        ...baseMenuTop[1],
        title: t('home.action.contact'),
        shortTitle: t('home.action.contact_short_title')
      }
    ])

    return {
      menuTop
    }
  },
  {
    share: {
      enable: true,
      initialize: true
    }
  }
)
