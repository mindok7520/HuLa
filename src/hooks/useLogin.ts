import { emit } from '@tauri-apps/api/event'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useRouter } from 'vue-router'
import { EventEnum, MittEnum, TauriCommand } from '@/enums'
import { useWindow } from '@/hooks/useWindow.ts'
import { useChatStore } from '@/stores/chat'
import { useGlobalStore } from '@/stores/global.ts'
import { LoginStatus, useWsLoginStore } from '@/stores/ws'
import { isDesktop, isMac, isMobile } from '@/utils/PlatformConstants'
import { clearListener } from '@/utils/ReadCountQueue'
import { ErrorType, invokeSilently, invokeWithErrorHandler } from '@/utils/TauriInvokeHandler.ts'
import { useSettingStore } from '../stores/setting'
import { useGroupStore } from '../stores/group'
import { useCachedStore } from '../stores/cached'
import { useConfigStore } from '../stores/config'
import { useUserStatusStore } from '../stores/userStatus'
import { useUserStore } from '../stores/user'
import { useLoginHistoriesStore } from '../stores/loginHistory'
import rustWebSocketClient from '@/services/webSocketRust'
import { useEmojiStore } from '@/stores/emoji'
import { getAllUserState, getUserDetail } from '../utils/ImRequestUtils'
import { useNetwork } from '@vueuse/core'
import { UserInfoType } from '../services/types'
import { getEnhancedFingerprint } from '../services/fingerprint'
import { invoke } from '@tauri-apps/api/core'
import { useMitt } from './useMitt'
import { info as logInfo } from '@tauri-apps/plugin-log'
import { ensureAppStateReady } from '@/utils/AppStateReady'
import { useI18nGlobal } from '../services/i18n'
import { useInitialSyncStore } from '@/stores/initialSync'

export const useLogin = () => {
  const { resizeWindow } = useWindow()
  const globalStore = useGlobalStore()
  const loginStore = useWsLoginStore()
  const chatStore = useChatStore()
  const settingStore = useSettingStore()
  const { isTrayMenuShow } = storeToRefs(globalStore)
  const groupStore = useGroupStore()
  const cachedStore = useCachedStore()
  const configStore = useConfigStore()
  const userStatusStore = useUserStatusStore()
  const userStore = useUserStore()
  const loginHistoriesStore = useLoginHistoriesStore()
  const initialSyncStore = useInitialSyncStore()
  const { createWebviewWindow } = useWindow()

  const { t } = useI18nGlobal()

  /**
   * composable 초기화 시 router 인스턴스 가져오기
   * 주의: useRouter()는 컴포넌트 setup 컨텍스트 내에서 호출해야 합니다.
   * 비동기 콜백 내에서는 Vue 컴포넌트 컨텍스트를 잃어버리므로 useRouter()를 호출할 수 없습니다.
   * 따라서 여기서 미리 router 인스턴스를 가져와 저장하여 후속 비동기 작업에서 사용합니다.
   */
  let router: ReturnType<typeof useRouter> | null = null
  try {
    router = useRouter()
  } catch (e) {
    console.warn('[useLogin] router 인스턴스를 가져올 수 없습니다. 컴포넌트 컨텍스트에 없을 수 있습니다:', e)
  }

  /** 네트워크 연결 상태 */
  const { isOnline } = useNetwork()
  const loading = ref(false)
  /** 로그인 버튼 텍스트 내용 */
  const loginText = ref(isOnline.value ? t('login.button.login.default') : t('login.button.login.network_error'))
  const loginDisabled = ref(!isOnline.value)
  /** 계정 정보 */
  const info = ref({
    account: '',
    password: '',
    avatar: '',
    name: '',
    uid: ''
  })
  const uiState = ref<'manual' | 'auto'>('manual')
  /**
   * 로그인 상태 설정 (시스템 트레이 아이콘, 시스템 트레이 메뉴 옵션)
   */
  const setLoginState = async () => {
    // 로그인 성공 후 로컬 저장소의 wsLogin 삭제, 사용자가 QR 코드 페이지에서 QR 코드를 새로 고침했지만 QR 코드로 로그인하지 않아 QR 코드가 만료되거나 로그인 실패하는 것을 방지
    if (localStorage.getItem('wsLogin')) {
      localStorage.removeItem('wsLogin')
    }
    isTrayMenuShow.value = true
    if (!isMobile()) {
      await resizeWindow('tray', 130, 356)
    }
  }

  /**
   * 로그아웃
   */
  const logout = async () => {
    globalStore.updateCurrentSessionRoomId('')
    const sendLogoutEvent = async () => {
      // ws 연결 종료
      await invokeSilently('ws_disconnect')
      await invokeSilently(TauriCommand.REMOVE_TOKENS)
      await invokeSilently(TauriCommand.UPDATE_USER_LAST_OPT_TIME)
    }

    if (isDesktop()) {
      const { createWebviewWindow } = useWindow()
      isTrayMenuShow.value = false
      try {
        await sendLogoutEvent()
        // 로그인 창 생성
        await createWebviewWindow('로그인', 'login', 320, 448, undefined, false, 320, 448)
        // 로그아웃 이벤트 전송
        await emit(EventEnum.LOGOUT)

        // 트레이 크기 조정
        await resizeWindow('tray', 130, 44)
      } catch (error) {
        console.error('로그인 창 생성 실패:', error)
      }
    } else {
      try {
        await sendLogoutEvent()
        // 로그아웃 이벤트 전송
        await emit(EventEnum.LOGOUT)
      } catch (error) {
        console.error('로그아웃 실패:', error)
        window.$message.error('로그아웃 실패')
      }
    }
  }

  /** 로그인 상태 초기화 */
  const resetLoginState = async (isAutoLogin = false) => {
    // 메시지 읽음 카운트 리스너 정리
    clearListener()
    // 1. 로컬 저장소 정리
    if (!isAutoLogin) {
      // TODO 나중에 계정을 구분하여 다른 account로 전환해야 함; 다른 REFRESH_TOKEN으로 호출
      localStorage.removeItem('user')
      localStorage.removeItem('TOKEN')
      localStorage.removeItem('REFRESH_TOKEN')
    }
    settingStore.closeAutoLogin()
    loginStore.loginStatus = LoginStatus.Init
    globalStore.updateCurrentSessionRoomId('')
    // 2. 시스템 트레이 아이콘의 읽지 않은 수 지우기
    if (isMac()) {
      await invokeWithErrorHandler('set_badge_count', { count: undefined })
    }
  }

  // 전체 동기화
  const runFullSync = async (preserveSession?: string) => {
    await chatStore.getSessionList(true)
    // 유지해야 할 세션이 있고 해당 세션이 목록에 여전히 존재하는 경우 선택 상태 복원
    if (preserveSession) {
      const sessionExists = chatStore.sessionList.some((s) => s.roomId === preserveSession)
      if (sessionExists) {
        // 세션 존재, 선택 상태 유지
      } else {
        // 세션이 존재하지 않음, 선택 해제
        globalStore.updateCurrentSessionRoomId('')
      }
    } else {
      // 유지할 세션 없음, 초기화
      globalStore.updateCurrentSessionRoomId('')
    }

    // 모든 그룹의 멤버 데이터 로드
    const groupSessions = chatStore.getGroupSessions()
    await Promise.all([
      ...groupSessions.map((session) => groupStore.getGroupUserList(session.roomId, true)),
      groupStore.setGroupDetails(),
      chatStore.setAllSessionMsgList(20),
      cachedStore.getAllBadgeList()
    ])
  }

  // 증분 동기화
  const runIncrementalSync = async (preserveSession?: string) => {
    // 세션 목록의 최신 메시지와 읽지 않은 수 우선 보장: 세션을 가져오면 읽지 않음/최신 메시지 준비 완료
    await chatStore.getSessionList(true)
    // 유지해야 할 세션이 있고 해당 세션이 목록에 여전히 존재하는 경우 선택 상태 유지
    if (preserveSession) {
      const sessionExists = chatStore.sessionList.some((s) => s.roomId === preserveSession)
      if (!sessionExists) {
        // 세션이 존재하지 않음, 선택 해제
        globalStore.updateCurrentSessionRoomId('')
      }
      // 세션이 존재하면 현재 상태 유지
    }
    // 유지할 세션이 없을 때도 현재 상태 유지 (증분 동기화는 초기화하지 않음)

    // 백그라운드 메시지 동기화: 로그인 명령이 이미 전체/오프라인 동기화를 한 번 트리거했으므로 중복 가져오기 방지; 필요할 때만 명시적으로 호출
    // 메시지 프리패치 및 기타 예열을 백그라운드에 배치하여 UI 차단 방지
    await Promise.allSettled([
      chatStore.setAllSessionMsgList(20),
      groupStore.setGroupDetails(),
      cachedStore.getAllBadgeList()
    ]).catch((error) => {
      console.warn('[useLogin] 증분 예열 작업 실패:', error)
    })
  }

  const init = async (options?: { isInitialSync?: boolean }) => {
    const emojiStore = useEmojiStore()
    // 현재 선택된 세션 저장, 동기화 시 사용자의 선택 상태 손실 방지
    const previousSessionRoomId = globalStore.currentSessionRoomId
    // ws 연결
    await rustWebSocketClient.initConnect()

    // 사용자 관련 데이터 초기화
    userStatusStore.stateList = await getAllUserState()
    const userDetail: any = await getUserDetail()
    userStatusStore.stateId = userDetail.userStateId
    const account = {
      ...userDetail,
      client: isDesktop() ? 'PC' : 'MOBILE'
    }
    userStore.userInfo = account
    loginHistoriesStore.addLoginHistory(account)
    // 이모티콘 목록 초기화 및 백그라운드에서 로컬 캐시 프리패치 (워커 + 동시성 제한 사용)
    void emojiStore.initEmojis().catch((error) => {
      console.warn('[login] 이모티콘 초기화 실패:', error)
    })

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

    // 데이터 초기화
    const cachedConfig = localStorage.getItem('config')
    if (cachedConfig) {
      configStore.config = JSON.parse(cachedConfig).config
    } else {
      await configStore.initConfig()
    }
    const isInitialSync = options?.isInitialSync ?? !initialSyncStore.isSynced(account.uid)

    // 로그인 후 즉시 이모티콘 로컬 캐시 예열 (비동기, 후속 프로세스 차단 안 함)
    void emojiStore.prefetchEmojiToLocal().catch((error) => {
      console.warn('[login] 이모티콘 캐시 예열 실패:', error)
    })

    if (isInitialSync) {
      chatStore.syncLoading = true
      try {
        await runFullSync(previousSessionRoomId)
      } finally {
        chatStore.syncLoading = false
      }
    } else {
      chatStore.syncLoading = true
      try {
        await runIncrementalSync(previousSessionRoomId)
      } finally {
        // 증분 로그인은 세션 준비만 기다리고 팁을 닫으며, 백그라운드 동기화는 계속 진행됨
        chatStore.syncLoading = false
      }
    }
    // 강제 지속성
    chatStore.$persist?.()
    cachedStore.$persist?.()
    globalStore.$persist?.()

    await setLoginState()
  }

  /**
   * 플랫폼 유형에 따라 다른 점프 로직 실행
   * 데스크톱: 메인 창 생성
   * 모바일: 라우터로 홈 페이지 이동
   */
  const routerOrOpenHomeWindow = async () => {
    if (isDesktop()) {
      const registerWindow = await WebviewWindow.getByLabel('register')
      if (registerWindow) {
        await registerWindow.close().catch((error) => {
          console.warn('등록 창 닫기 실패:', error)
        })
      }
      await createWebviewWindow('HuLa', 'home', 960, 720, 'login', true, 330, 480, undefined, false)
      // home 창이 성공적으로 생성되고 로그인된 경우에만 트레이 메뉴 표시
      globalStore.isTrayMenuShow = true
    } else {
      // 모바일은 라우터 점프 사용
      router?.push('/mobile/home')
    }
  }

  const normalLogin = async (
    deviceType: 'PC' | 'MOBILE',
    syncRecentMessages: boolean,
    auto: boolean = settingStore.login.autoLogin
  ) => {
    loading.value = true
    loginText.value = t('login.status.logging_in')
    loginDisabled.value = true
    const hasStoredUserInfo = !!userStore.userInfo && !!userStore.userInfo.account
    if (auto && !hasStoredUserInfo) {
      loading.value = false
      loginDisabled.value = false
      loginText.value = isOnline.value ? t('login.button.login.default') : t('login.button.login.network_error')
      uiState.value = 'manual'
      settingStore.setAutoLogin(false)
      logInfo('자동 로그인 정보가 만료되었습니다. 수동으로 로그인해주세요.')
      return
    }

    // auto 매개변수에 따라 로그인 정보를 가져올 위치 결정
    const loginInfo = auto && userStore.userInfo ? (userStore.userInfo as UserInfoType) : info.value
    const account = loginInfo?.account
    const password = loginInfo?.password ?? info.value.password
    if (!account) {
      loading.value = false
      loginDisabled.value = false
      loginText.value = isOnline.value ? '로그인' : '네트워크 오류'
      if (auto) {
        uiState.value = 'manual'
        settingStore.setAutoLogin(false)
      }
      logInfo('계정 정보가 누락되었습니다. 다시 입력해주세요.')
      return
    }

    // 이번 로그인 디바이스 지문 저장
    const clientId = await getEnhancedFingerprint()
    localStorage.setItem('clientId', clientId)

    await ensureAppStateReady()

    invoke('login_command', {
      data: {
        account: account,
        password: password,
        deviceType: deviceType,
        systemType: '2',
        clientId: clientId,
        grantType: 'PASSWORD',
        isAutoLogin: auto,
        asyncData: syncRecentMessages,
        uid: auto ? userStore.userInfo!.uid : null
      }
    })
      .then(async (_: any) => {
        loginDisabled.value = true
        loading.value = false
        loginText.value = t('login.status.success_redirect')

        // 모바일에서 처음 수동 로그인할 때만 자동 로그인 스위치를 기본적으로 켬
        if (!auto && isMobile()) {
          settingStore.setAutoLogin(true)
        }

        // 모바일 로그인 후 데이터 초기화
        if (isMobile()) {
          await init()
          await invoke('hide_splash_screen') // 초기화 완료 후 스플래시 화면 닫기
        }
        ; +useMitt.emit(MittEnum.MSG_INIT)

        await routerOrOpenHomeWindow()
      })
      .catch((e: any) => {
        console.error('로그인 예외:', e)
        window.$message.error(e)
        loading.value = false
        loginDisabled.value = false
        loginText.value = t('login.button.login.default')
        // 자동 로그인 실패 시 수동 로그인 화면으로 전환하고 버튼 상태 초기화
        if (auto) {
          uiState.value = 'manual'
          loginDisabled.value = false
          loginText.value = t('login.button.login.default')
          // 자동 로그인 취소
          settingStore.setAutoLogin(false)
          // 이전에 로그인 시도한 계정 정보를 수동 로그인 양식에 자동 채우기
          if (userStore.userInfo) {
            info.value.account = userStore.userInfo.account || userStore.userInfo.email || ''
            info.value.avatar = userStore.userInfo.avatar
            info.value.name = userStore.userInfo.name
            info.value.uid = userStore.userInfo.uid
          }
          // 토큰 만료 시 모바일은 로그인 페이지로 이동
          if (isMobile()) {
            router?.replace('/mobile/login')
          }
        }
      })
  }

  return {
    resetLoginState,
    setLoginState,
    logout,
    normalLogin,
    loading,
    loginText,
    loginDisabled,
    info,
    uiState,
    init
  }
}
