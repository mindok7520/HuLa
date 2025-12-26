import { defineStore } from 'pinia'
import { PluginEnum, StoresEnum } from '@/enums'
import { usePluginsList } from '@/layout/left/config.tsx'

export const usePluginsStore = defineStore(
  StoresEnum.PLUGINS,
  () => {
    const pluginsList = usePluginsList()
    /** 플러그인 내용 */
    const plugins = ref(pluginsList.value.filter((p) => p.state === PluginEnum.BUILTIN) as STO.Plugins<PluginEnum>[])
    /** 플러그인 보기 모드 */
    const viewMode = ref<string>('card')

    /**
     * 플러그인 설정
     * @param newPlugin 플러그인 데이터
     * @param newPlugin 플러그인 데이터
     */
    const addPlugin = (newPlugin: STO.Plugins<PluginEnum>) => {
      const index = plugins.value.findIndex((i) => i.url === newPlugin.url)
      index === -1 && plugins.value.push(newPlugin)
    }

    /**
     * 플러그인 삭제
     * @param p 플러그인 데이터
     * @param p 플러그인 데이터
     */
    const removePlugin = (p: STO.Plugins<PluginEnum>) => {
      const index = plugins.value.findIndex((i: STO.Plugins<PluginEnum>) => i.url === p.url)
      plugins.value.splice(index, 1)
    }

    /**
     * 플러그인 상태 업데이트
     * @param p 플러그인
     */
    const updatePlugin = (p: STO.Plugins<PluginEnum>) => {
      const index = plugins.value.findIndex((i) => i.url === p.url)
      index !== -1 && (plugins.value[index] = p)
    }

    const syncPluginsWithLocale = (latest: STO.Plugins<PluginEnum>[]) => {
      plugins.value = plugins.value.map((plugin) => {
        const updated = latest.find((p) => p.url === plugin.url)
        return updated
          ? {
            ...plugin,
            size: updated.size ? { ...plugin.size, ...updated.size } : plugin.size,
            window: updated.window ? { ...plugin.window, ...updated.window } : plugin.window,
            title: updated.title,
            shortTitle: updated.shortTitle
          }
          : plugin
      })
    }

    watch(pluginsList, (latest) => syncPluginsWithLocale(latest), { immediate: true })

    onBeforeMount(() => {
      // 로컬 스토리지에 저장된 플러그인 데이터 읽기
      if (localStorage.getItem(StoresEnum.PLUGINS)) {
        plugins.value = []
        JSON.parse(localStorage.getItem(StoresEnum.PLUGINS)!)['plugins']?.map((item: STO.Plugins<PluginEnum>) =>
          plugins.value.push(item)
        )
        syncPluginsWithLocale(pluginsList.value)
      }
    })

    return {
      plugins,
      viewMode,
      addPlugin,
      removePlugin,
      updatePlugin
    }
  },
  {
    share: {
      enable: true,
      initialize: true
    }
  }
)
