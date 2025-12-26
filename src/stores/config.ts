import { defineStore } from 'pinia'
import { StoresEnum } from '@/enums'
import type { ConfigType } from '@/services/types'
import * as ImRequestUtils from '@/utils/ImRequestUtils'

export const useConfigStore = defineStore(StoresEnum.CONFIG, () => {
  const config = ref<ConfigType>({} as any)

  /** 설정 초기화 */
  const initConfig = async () => {
    const res = await ImRequestUtils.initConfig()
    config.value = res
  }

  /** QiNiu 설정 가져오기 */
  const getQiNiuConfig = () => config.value.qiNiu

  return { config, initConfig, getQiNiuConfig }
})
