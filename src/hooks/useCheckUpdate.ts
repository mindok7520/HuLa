import { getVersion } from '@tauri-apps/api/app'
import { check } from '@tauri-apps/plugin-updater'
import { useSettingStore } from '@/stores/setting.ts'
import { MittEnum } from '../enums'
import { useMitt } from './useMitt'
import { isMobile } from '@/utils/PlatformConstants'

/**
 * 업데이트 확인
 */
export const useCheckUpdate = () => {
  const settingStore = useSettingStore()
  // 업데이트 확인주기
  const CHECK_UPDATE_TIME = 30 * 60 * 1000
  // 로그인하지 않은 경우 확인 주기 단축
  const CHECK_UPDATE_LOGIN_TIME = 5 * 60 * 1000
  const isProduction = import.meta.env.PROD && !isMobile()

  /**
   * 업데이트 확인
   * @param closeWin 닫을 창
   * @param initialCheck 초기 확인 여부, 기본값은 false. 초기 확인 시 강제 업데이트 알림만 표시하고 일반 업데이트 알림은 표시하지 않음
   */
  const checkUpdate = async (closeWin: string, initialCheck: boolean = false) => {
    await check({
      timeout: 5000 /* API 요청 시간 5초 */,
      headers: {
        'X-AccessKey': 'geShj8UB7zd1DyrM_YFNdg' // UpgradeLink의 AccessKey
      }
    })
      .then(async (e) => {
        if (!e?.available) {
          return
        }

        const newVersion = e.version
        const newMajorVersion = newVersion.substring(0, newVersion.indexOf('.'))
        const newMiddleVersion = newVersion.substring(
          newVersion.indexOf('.') + 1,
          newVersion.lastIndexOf('.') === -1 ? newVersion.length : newVersion.lastIndexOf('.')
        )
        const currenVersion = await getVersion()
        const currentMajorVersion = currenVersion.substring(0, currenVersion.indexOf('.'))
        const currentMiddleVersion = currenVersion.substring(
          currenVersion.indexOf('.') + 1,
          currenVersion.lastIndexOf('.') === -1 ? currenVersion.length : currenVersion.lastIndexOf('.')
        )
        const requireForceUpdate =
          isProduction &&
          (newMajorVersion > currentMajorVersion ||
            (newMajorVersion === currentMajorVersion && newMiddleVersion > currentMiddleVersion))
        if (requireForceUpdate) {
          useMitt.emit(MittEnum.DO_UPDATE, { close: closeWin })
        } else if (newVersion !== currenVersion && settingStore.update.dismiss !== newVersion && !initialCheck) {
          // 초기 확인이 아닐 때만 일반 업데이트 알림 표시
          useMitt.emit(MittEnum.CHECK_UPDATE)
        }
      })
      .catch((e) => {
        console.log(e)
      })
  }

  return {
    checkUpdate,
    CHECK_UPDATE_TIME,
    CHECK_UPDATE_LOGIN_TIME
  }
}
