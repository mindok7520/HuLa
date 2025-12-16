import { invoke } from '@tauri-apps/api/core'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import rustWebSocketClient from '@/services/webSocketRust'
import { TauriCommand } from '../enums'
import { useLogin } from '../hooks/useLogin'
import { useWindow } from '../hooks/useWindow'
import { useLoginHistoriesStore } from '../stores/loginHistory'
import { useSettingStore } from '../stores/setting'
import { useUserStore } from '../stores/user'
import { useUserStatusStore } from '../stores/userStatus'
import { getAllUserState, getUserDetail } from '../utils/ImRequestUtils'
import { ErrorType, invokeWithErrorHandler } from '../utils/TauriInvokeHandler'
import { getEnhancedFingerprint } from './fingerprint'
import { ensureAppStateReady } from '@/utils/AppStateReady'
import type { UserInfoType } from './types'

export type Settings = {
  database: {
    sqlite_file: string
  }
  backend: {
    base_url: string
    ws_url: string
  }
  youdao?: {
    app_key: string
    app_secret: string
  }
  tencent?: {
    api_key: string
    secret_id: string
    map_key: string
  }
  minio?: {
    endpoint: string
    bucket: string
    access_key: string
    secret_key: string
    region: string
    download_domain: string
  }
  ice_server?: {
    urls: string[]
    username: string
    credential: string
  }
}

export type UpdateSettingsParams = {
  baseUrl: string
  wsUrl: string
}

export const getSettings = async (): Promise<Settings> => {
  return await invoke('get_settings')
}

export const updateSettings = async (settings: UpdateSettingsParams) => {
  return await invoke('update_settings', { settings })
}

export const loginCommand = async (
  info: Partial<{
    account: string
    password: string
    avatar: string
    name: string
    uid: string
  }>,
  auto: boolean = false
) => {
  const userStore = useUserStore()
  const settingStore = useSettingStore()

  const loginInfo = settingStore.login.autoLogin ? (userStore.userInfo as UserInfoType) : info
  // 이번 로그인 장치 지문 저장
  const clientId = await getEnhancedFingerprint()

  await ensureAppStateReady()

  await invoke('login_command', {
    data: {
      account: loginInfo.account ? loginInfo.account : '',
      password: loginInfo.password ? loginInfo.password : '',
      deviceType: 'PC',
      systemType: '2',
      clientId: clientId,
      grantType: 'PASSWORD',
      isAutoLogin: auto,
      asyncData: false,
      uid: info.uid
    }
  }).then(async (res: any) => {
    // ws 연결 시작
    await rustWebSocketClient.initConnect()
    await loginProcess(res.token, res.refreshToken, res.client)
  })
}

const loginProcess = async (token: string, refreshToken: string, client: string) => {
  const userStatusStore = useUserStatusStore()
  const userStore = useUserStore()
  const loginHistoriesStore = useLoginHistoriesStore()
  const { setLoginState } = useLogin()

  userStatusStore.stateList = await getAllUserState()

  const userDetail: any = await getUserDetail()
  userStatusStore.stateId = userDetail.userStateId

  const account = {
    ...userDetail,
    token,
    refreshToken,
    client
  }
  userStore.userInfo = account

  loginHistoriesStore.addLoginHistory(account)

  // sqlite에 사용자 정보 저장
  await invokeWithErrorHandler(
    TauriCommand.SAVE_USER_INFO,
    {
      userInfo: userDetail
    },
    {
      customErrorMessage: '사용자 정보 저장 실패',
      errorType: ErrorType.Client
    }
  )

  await setLoginState()
  await openHomeWindow()
}

const openHomeWindow = async () => {
  const { createWebviewWindow } = useWindow()
  const registerWindow = await WebviewWindow.getByLabel('register')
  if (registerWindow) {
    await registerWindow.close().catch((error) => {
      console.warn('등록 창 닫기 실패:', error)
    })
  }
  await createWebviewWindow('HuLa', 'home', 960, 720, 'login', true, 330, 480, undefined, false)
}
