<template>
  <!-- 테마 전환이 필요 없는 인터페이스를 감싸기 위해 n-config-provider를 별도로 사용 -->
  <n-config-provider :theme="naiveTheme" data-tauri-drag-region class="login-box size-full rounded-8px select-none">
    <!-- 상단 조작 바 -->
    <ActionBar :max-w="false" :shrink="false" proxy />

    <!--  수동 로그인 스타일  -->
    <n-flex vertical :size="25" v-if="uiState === 'manual'">
      <!-- 아바타 -->
      <n-flex justify="center" class="w-full pt-35px" data-tauri-drag-region>
        <n-avatar
          class="welcome size-80px rounded-50% border-(2px solid #fff) dark:border-(2px solid #606060)"
          :color="themes.content === ThemeEnum.DARK ? '#282828' : '#fff'"
          :fallback-src="themes.content === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'"
          :src="AvatarUtils.getAvatarUrl(info.avatar)" />
      </n-flex>

      <!-- 로그인 메뉴 -->
      <n-flex class="ma text-center h-full w-260px" vertical :size="16">
        <n-input
          :class="{ 'pl-16px': loginHistories.length > 0 }"
          size="large"
          v-model:value="info.account"
          type="text"
          :placeholder="accountPH"
          @focus="accountPH = ''"
          @blur="accountPH = t('login.input.account.placeholder')"
          spellCheck="false"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          clearable>
          <template #suffix>
            <n-flex v-if="loginHistories.length > 0" @click="arrowStatus = !arrowStatus">
              <svg v-if="!arrowStatus" class="down w-18px h-18px color-#505050 dark:color-#909090 cursor-pointer">
                <use href="#down"></use>
              </svg>
              <svg v-else class="down w-18px h-18px color-#505050 dark:color-#909090 cursor-pointer">
                <use href="#up"></use>
              </svg>
            </n-flex>
          </template>
        </n-input>

        <!-- 계정 선택창 -->
        <div
          style="border: 1px solid rgba(70, 70, 70, 0.1)"
          v-if="loginHistories.length > 0 && arrowStatus"
          class="account-box absolute w-260px max-h-140px bg-#fdfdfd98 dark:bg-#48484e98 backdrop-blur-sm mt-45px z-99 rounded-8px p-8px box-border">
          <n-scrollbar style="max-height: 120px" trigger="none">
            <n-flex
              vertical
              v-for="item in loginHistories"
              :key="item.account"
              @click="giveAccount(item)"
              class="p-8px cursor-pointer hover:bg-#90909020 dark:hover:bg-#90909030 hover:rounded-6px">
              <div class="flex-between-center">
                <n-avatar :src="AvatarUtils.getAvatarUrl(item.avatar)" color="#fff" class="size-28px rounded-50%" />
                <p class="text-14px color-#505050 dark:color-#fefefe">{{ item.account }}</p>
                <svg @click.stop="delAccount(item)" class="w-12px h-12px dark:color-#fefefe">
                  <use href="#close"></use>
                </svg>
              </div>
            </n-flex>
          </n-scrollbar>
        </div>

        <n-input
          class="pl-16px"
          maxlength="16"
          minlength="6"
          size="large"
          show-password-on="click"
          v-model:value="info.password"
          type="password"
          spellCheck="false"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          :placeholder="passwordPH"
          @focus="passwordPH = ''"
          @blur="passwordPH = t('login.input.pass.placeholder')"
          clearable />

        <!-- 약관 -->
        <n-flex align="center" justify="center" :size="6">
          <n-checkbox v-model:checked="protocol" />
          <div class="text-12px color-#909090 cursor-default lh-14px agreement">
            <span>{{ t('login.term.checkout.text1') }}</span>
            <span class="color-#13987f cursor-pointer" @click.stop="openServiceAgreement">
              {{ t('login.term.checkout.text2') }}
            </span>
            <span>{{ t('login.term.checkout.text3') }}</span>
            <span class="color-#13987f cursor-pointer" @click.stop="openPrivacyAgreement">
              {{ t('login.term.checkout.text4') }}
            </span>
          </div>
        </n-flex>

        <n-button
          :loading="loading"
          :disabled="loginDisabled"
          tertiary
          style="color: #fff"
          class="gradient-button w-full mt-8px mb-50px"
          @click="normalLogin('PC', true, false)">
          <span>{{ loginText }}</span>
        </n-button>
      </n-flex>
    </n-flex>

    <!-- 자동 로그인 스타일 -->
    <n-flex v-else-if="uiState === 'auto'" vertical :size="29" data-tauri-drag-region>
      <n-flex justify="center" class="mt-15px">
        <img src="/hula.png" class="w-140px h-60px" alt="" />
      </n-flex>
      <n-flex :size="30" vertical>
        <!-- 아바타 -->
        <n-flex justify="center">
          <n-avatar
            round
            :size="110"
            :color="themes.content === ThemeEnum.DARK ? '#282828' : '#fff'"
            :fallback-src="themes.content === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'"
            :src="AvatarUtils.getAvatarUrl(userStore.userInfo?.avatar ?? '')" />
        </n-flex>

        <n-flex justify="center">
          <n-ellipsis style="max-width: 200px" class="text-(18px [--chat-text-color])">
            {{ userStore.userInfo?.name || '' }}
          </n-ellipsis>
        </n-flex>
      </n-flex>

      <n-flex justify="center">
        <n-button
          :loading="loading"
          :disabled="loginDisabled"
          tertiary
          style="color: #fff"
          class="gradient-button w-200px mt-12px mb-40px"
          @click="normalLogin('PC', true, true)">
          <span>{{ loginText }}</span>
        </n-button>
      </n-flex>
    </n-flex>

    <!-- 하단 조작 바 -->
    <div class="text-14px grid grid-cols-[1fr_auto_1fr] items-center gap-x-12px w-full" id="bottomBar">
      <div
        class="color-#13987f cursor-pointer justify-self-end text-right"
        :title="qrCodeTitle"
        @click="router.push('/qrCode')">
        {{ qrCodeLabel }}
      </div>
      <div class="w-1px h-14px bg-#ccc dark:bg-#707070 justify-self-center"></div>
      <div
        v-if="uiState === 'auto'"
        class="color-#13987f cursor-pointer justify-self-start text-left"
        :title="removeAccountTitle"
        @click="removeToken">
        {{ removeAccountLabel }}
      </div>
      <div v-else class="justify-self-start text-left">
        <n-popover
          trigger="click"
          id="moreShow"
          class="bg-#fdfdfd98! dark:bg-#48484e98! backdrop-blur-sm"
          v-model:show="moreShow"
          :show-checkmark="false"
          :show-arrow="false">
          <template #trigger>
            <div class="color-#13987f cursor-pointer" :title="moreTitle">{{ moreLabel }}</div>
          </template>
          <n-flex vertical :size="2">
            <div
              class="register text-14px cursor-pointer hover:bg-#90909030 hover:rounded-6px p-8px"
              @click="createWebviewWindow('회원가입', 'register', 600, 600)">
              {{ t('login.register') }}
            </div>
            <div
              class="text-14px cursor-pointer hover:bg-#90909030 hover:rounded-6px p-8px"
              @click="createWebviewWindow('비밀번호 찾기', 'forgetPassword', 600, 600)">
              {{ t('login.option.items.forget') }}
            </div>
            <div
              v-if="!isCompatibility()"
              @click="router.push('/network')"
              :class="{ network: isMac() }"
              class="text-14px cursor-pointer hover:bg-#90909030 hover:rounded-6px p-8px">
              {{ t('login.option.items.network_setting') }}
            </div>
          </n-flex>
        </n-popover>
      </div>
    </div>
  </n-config-provider>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useNetwork } from '@vueuse/core'
import { darkTheme, lightTheme } from 'naive-ui'
import { storeToRefs } from 'pinia'
import { useCheckUpdate } from '@/hooks/useCheckUpdate'
import { type DriverStepConfig, useDriver } from '@/hooks/useDriver'
import { useMitt } from '@/hooks/useMitt'
import { useWindow } from '@/hooks/useWindow.ts'
import router from '@/router'
import type { UserInfoType } from '@/services/types.ts'
import { WsResponseMessageType } from '@/services/wsType'
import { useGlobalStore } from '@/stores/global'
import { useGuideStore } from '@/stores/guide'
import { useLoginHistoriesStore } from '@/stores/loginHistory.ts'
import { useSettingStore } from '@/stores/setting.ts'
import { useUserStore } from '@/stores/user.ts'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { isCompatibility, isDesktop, isMac } from '@/utils/PlatformConstants'
import { clearListener } from '@/utils/ReadCountQueue'
import { useLogin } from '@/hooks/useLogin'
import { formatBottomText } from '@/utils/Formatting'
import { ThemeEnum } from '@/enums'

const { t } = useI18n()

const settingStore = useSettingStore()
const { themes } = storeToRefs(settingStore)
const naiveTheme = computed(() => (themes.value.content === 'dark' ? darkTheme : lightTheme))
const userStore = useUserStore()
const globalStore = useGlobalStore()
const guideStore = useGuideStore()
const { isTrayMenuShow } = storeToRefs(globalStore)
const { isGuideCompleted } = storeToRefs(guideStore)
/** 네트워크 연결 정상 여부 */
const { isOnline } = useNetwork()
const loginHistoriesStore = useLoginHistoriesStore()
const { loginHistories } = loginHistoriesStore
const { login } = storeToRefs(settingStore)
/** 약관 */
const protocol = ref(true)
const arrowStatus = ref(false)
const moreShow = ref(false)
const { createWebviewWindow, createModalWindow, getWindowPayload } = useWindow()
const { checkUpdate, CHECK_UPDATE_LOGIN_TIME } = useCheckUpdate()
const { normalLogin, loading, loginText, loginDisabled, info, uiState } = useLogin()

const driverSteps = computed<DriverStepConfig[]>(() => [
  {
    element: '.welcome',
    popover: {
      title: t('login.guide.welcome.title'),
      description: t('login.guide.welcome.desc'),
      side: 'bottom',
      align: 'center'
    }
  },
  {
    element: '.agreement',
    popover: {
      title: t('login.guide.privacy.title'),
      description: t('login.guide.privacy.desc'),
      onNextClick: () => {
        if (isMac()) {
          moreShow.value = true
        }
      }
    }
  },
  {
    element: '.network',
    popover: {
      title: t('login.guide.network.title'),
      description: t('login.guide.network.desc'),
      onNextClick: () => {
        moreShow.value = true
      }
    }
  },
  {
    element: '.register',
    popover: {
      title: t('login.guide.register.title'),
      description: t('login.guide.register.desc')
    }
  }
])

const driverConfig = computed(() => ({
  nextBtnText: t('login.guide.actions.next'),
  prevBtnText: t('login.guide.actions.prev'),
  doneBtnText: t('login.guide.actions.done'),
  progressText: t('login.guide.actions.progress', {
    current: '{{current}}',
    total: '{{total}}'
  })
}))

const { startTour, reinitialize } = useDriver(driverSteps.value, driverConfig.value)

watch([driverSteps, driverConfig], ([steps, config]) => {
  reinitialize(steps, config)
})

// 입력창 placeholder
const accountPH = ref(t('login.input.account.placeholder'))
const passwordPH = ref(t('login.input.pass.placeholder'))

// 하단 조작 바 다국어가 6자를 초과할 경우 생략 부호 표시
const MAX_BOTTOM_TEXT_LEN = 6
const qrCodeText = computed(() => t('login.button.qr_code'))
const moreText = computed(() => t('login.option.more'))
const removeAccountText = computed(() => t('login.button.remove_account'))
const qrCodeLabel = computed(() => formatBottomText(qrCodeText.value, MAX_BOTTOM_TEXT_LEN))
const moreLabel = computed(() => formatBottomText(moreText.value, MAX_BOTTOM_TEXT_LEN))
const removeAccountLabel = computed(() => formatBottomText(removeAccountText.value, MAX_BOTTOM_TEXT_LEN))
const qrCodeTitle = computed(() => (qrCodeLabel.value !== qrCodeText.value ? qrCodeText.value : undefined))
const moreTitle = computed(() => (moreLabel.value !== moreText.value ? moreText.value : undefined))
const removeAccountTitle = computed(() =>
  removeAccountLabel.value !== removeAccountText.value ? removeAccountText.value : undefined
)

/** 직접 이동 여부 */
const isJumpDirectly = ref(false)

// Web Worker 가져오기
const timerWorker = new Worker(new URL('../../workers/timer.worker.ts', import.meta.url))

// 오류 처리 추가
timerWorker.onerror = (error) => {
  console.error('[Worker Error]', error)
}

// Worker 메시지 감지
timerWorker.onmessage = (e) => {
  const { type } = e.data
  if (type === 'timeout') {
    checkUpdate('login')
  }
}

watchEffect(() => {
  loginDisabled.value = !(info.value.account && info.value.password && protocol.value && isOnline.value)
})

watch(isOnline, (v) => {
  loginDisabled.value = !v
  loginText.value = v ? t('login.button.login.default') : t('login.button.login.network_error')
})

// 계정 입력 감지
watch(
  () => info.value.account,
  (newAccount) => {
    if (!newAccount) {
      info.value.avatar = '/logoD.png'
      return
    }

    // 로그인 기록에서 일치하는 계정 찾기
    const matchedAccount = loginHistories.find(
      (history) => history.account === newAccount || history.email === newAccount
    )
    if (matchedAccount) {
      info.value.avatar = matchedAccount.avatar
    } else {
      info.value.avatar = '/logoD.png'
    }
  }
)

const openRemoteLoginModal = async (ip?: string) => {
  if (!isDesktop()) {
    return
  }
  const payloadIp = ip ?? '알 수 없는 IP'
  await createModalWindow(
    '타지역 로그인 알림',
    'modal-remoteLogin',
    350,
    310,
    'login',
    {
      ip: payloadIp
    },
    {
      minWidth: 350,
      minHeight: 310
    }
  )
}

const handlePendingRemoteLoginPayload = async () => {
  if (!isDesktop()) {
    return
  }
  try {
    const payload = await getWindowPayload<{ remoteLogin?: { ip?: string } }>('login')
    if (payload?.remoteLogin) {
      openRemoteLoginModal(payload.remoteLogin.ip)
    }
  } catch (error) {
    console.error('타지역 로그인 페이로드 처리 실패:', error)
  }
}

/** 계정 목록 내용 삭제 */
const delAccount = (item: UserInfoType) => {
  // 삭제 전 계정 목록의 길이 가져오기
  const lengthBeforeDelete = loginHistories.length
  loginHistoriesStore.removeLoginHistory(item)
  // 마지막 항목이 삭제되었는지 확인하고 arrowStatus 업데이트
  if (lengthBeforeDelete === 1 && loginHistories.length === 0) {
    arrowStatus.value = false
  }
  info.value.account = ''
  info.value.password = ''
  info.value.avatar = '/logoD.png'
}

/**
 * 계정에 값 할당
 * @param item 계정 정보
 * */
const giveAccount = (item: UserInfoType) => {
  const { account, password, avatar, name, uid } = item
  info.value.account = account || ''
  info.value.password = password || ''
  info.value.avatar = avatar
  info.value.name = name
  info.value.uid = uid
  arrowStatus.value = false
}

/** 로그인된 계정 제거 */
const removeToken = () => {
  localStorage.removeItem('TOKEN')
  localStorage.removeItem('REFRESH_TOKEN')
  userStore.userInfo = undefined
}

/** 서비스 약관 창 열기 */
const openServiceAgreement = async () => {
  await createModalWindow('서비스 약관', 'modal-serviceAgreement', 600, 600, 'login')
}

/** 개인정보 보호 정책 창 열기 */
const openPrivacyAgreement = async () => {
  await createModalWindow('개인정보 보호 정책', 'modal-privacyAgreement', 600, 600, 'login')
}

const closeMenu = (event: MouseEvent) => {
  const target = event.target as Element
  if (!target.matches('.account-box, .account-box *, .down')) {
    arrowStatus.value = false
  }
  if (!target.matches('#moreShow')) {
    moreShow.value = false
  }
}

const enterKey = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !loginDisabled.value) {
    normalLogin('PC', true, false)
  }
}

onBeforeMount(async () => {
  // 로그인 페이지 초기화 시 현재 세션을 비워 재시작 후 이전 세션이 기본으로 선택되는 것 방지
  globalStore.updateCurrentSessionRoomId('')
  await handlePendingRemoteLoginPayload()
  // 트레이 메뉴 상태를 항상 false로 초기화
  isTrayMenuShow.value = false

  if (!login.value.autoLogin) {
    // 자동 로그인 모드가 아닌 경우 수동 로그인 인터페이스를 직접 표시
    uiState.value = 'manual'
    localStorage.removeItem('TOKEN')
    localStorage.removeItem('REFRESH_TOKEN')
    clearListener()
    return
  }
})

onMounted(async () => {
  // 가이드 상태를 확인하고 완료되지 않은 경우에만 가이드 시작
  if (!isGuideCompleted.value) {
    startTour()
  }

  // 로그인이 필요한 경우에만 로그인 창 표시
  if (!isJumpDirectly.value) {
    await getCurrentWebviewWindow().show()
  }

  useMitt.on(WsResponseMessageType.NO_INTERNET, () => {
    loginDisabled.value = true
    loginText.value = t('login.status.service_disconnected')
  })

  // 자동 로그인 시 자동 로그인 인터페이스를 표시하고 로그인 트리거
  if (login.value.autoLogin) {
    uiState.value = 'auto'
    normalLogin('PC', true, true)
  } else {
    // 수동 로그인 모드, 첫 번째 기록된 계정 자동 입력
    uiState.value = 'manual'
    loginHistories.length > 0 && giveAccount(loginHistories[0])
  }

  window.addEventListener('click', closeMenu, true)
  window.addEventListener('keyup', enterKey)
  await checkUpdate('login', true)
  timerWorker.postMessage({
    type: 'startTimer',
    msgId: 'checkUpdate',
    duration: CHECK_UPDATE_LOGIN_TIME
  })
})

onUnmounted(() => {
  window.removeEventListener('click', closeMenu, true)
  window.removeEventListener('keyup', enterKey)
  // Web Worker 타이머 해제
  timerWorker.postMessage({
    type: 'clearTimer',
    msgId: 'checkUpdate'
  })
  timerWorker.terminate()
})
</script>

<style scoped lang="scss">
@use '@/styles/scss/global/login-bg';
@use '@/styles/scss/login';
</style>
