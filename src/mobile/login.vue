<template>
  <MobileLayout :backgroundImage="'/login_bg.png'" :safeAreaTop="false" :safeAreaBottom="false">
    <div class="h-full flex-col-center gap-40px">
      <div class="flex-center absolute top-13vh left-36px">
        <p class="text-(20px #333)">HI, 환영합니다</p>
        <img src="@/assets/mobile/2.svg" alt="" class="w-80px h-20px" />
      </div>

      <!-- 탭 네비게이션 -->
      <div class="w-80% h-40px absolute top-20vh flex-center">
        <div class="flex w-200px relative">
          <div
            @click="activeTab = 'login'"
            :class="[
              'z-999 w-100px text-center transition-all duration-300 ease-out',
              activeTab === 'login' ? 'text-(18px #000)' : 'text-(16px #666)'
            ]">
            로그인
          </div>
          <div
            @click="activeTab = 'register'"
            :class="[
              'z-999 w-100px text-center transition-all duration-300 ease-out',
              activeTab === 'register' ? 'text-(18px #000)' : 'text-(16px #666)'
            ]">
            회원가입
          </div>
          <!-- 선택 바 -->
          <div
            style="border-radius: 24px 42px 4px 24px"
            :class="[
              'z-10 absolute bottom--4px h-6px w-34px bg-#13987f transition-all duration-300 ease-out',
              activeTab === 'login' ? 'left-[33px]' : 'left-[133px]'
            ]"></div>
        </div>
      </div>

      <!-- 프로필 사진 -->
      <img v-if="activeTab === 'login'" :src="userInfo.avatar" alt="logo" class="size-86px rounded-full" />

      <!-- 로그인 폼 -->
      <n-flex v-if="activeTab === 'login'" class="text-center w-80%" vertical :size="16">
        <n-input
          :class="{ 'pl-22px': loginHistories.length > 0 }"
          size="large"
          v-model:value="userInfo.account"
          type="text"
          spellCheck="false"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          :placeholder="accountPH"
          @focus="accountPH = ''"
          @blur="accountPH = 'HuLa 계정 입력'"
          clearable>
          <template #suffix>
            <n-flex v-if="loginHistories.length > 0" @click="arrowStatus = !arrowStatus">
              <svg v-if="!arrowStatus" class="down w-18px h-18px color-#505050">
                <use href="#down"></use>
              </svg>
              <svg v-else class="down w-18px h-18px color-#505050"><use href="#up"></use></svg>
            </n-flex>
          </template>
        </n-input>

        <!-- 계정 선택 상자 -->
        <div
          style="border: 1px solid rgba(70, 70, 70, 0.1)"
          v-if="loginHistories.length > 0 && arrowStatus"
          class="account-box absolute w-80% max-h-140px bg-#fdfdfd mt-45px z-99 rounded-8px p-8px box-border">
          <n-scrollbar style="max-height: 120px" trigger="none">
            <n-flex
              vertical
              v-for="item in loginHistories"
              :key="item.account"
              @click="giveAccount(item)"
              class="p-8px hover:bg-#f3f3f3 hover:rounded-6px">
              <div class="flex-between-center">
                <n-avatar :src="AvatarUtils.getAvatarUrl(item.avatar)" class="size-28px bg-#ccc rounded-50%" />
                <p class="text-14px color-#505050">{{ item.account }}</p>
                <svg @click.stop="delAccount(item)" class="w-12px h-12px">
                  <use href="#close"></use>
                </svg>
              </div>
            </n-flex>
          </n-scrollbar>
        </div>

        <n-input
          class="pl-22px mt-8px"
          size="large"
          show-password-on="click"
          v-model:value="userInfo.password"
          type="password"
          spellCheck="false"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          :placeholder="passwordPH"
          @focus="passwordPH = ''"
          @blur="passwordPH = 'HuLa 비밀번호 입력'"
          clearable />

        <n-flex justify="flex-end" :size="6">
          <n-button text color="#13987f" @click="handleForgetPassword">비밀번호 찾기</n-button>
        </n-flex>

        <n-button
          :loading="loading"
          :disabled="loginDisabled"
          tertiary
          style="color: #fff"
          class="w-full mt-8px mb-50px gradient-button"
          @click="normalLogin('MOBILE', true, false)">
          <span>{{ loginText }}</span>
        </n-button>

        <!-- 약관 -->
        <n-flex align="center" justify="center" :style="agreementStyle" :size="6" class="absolute bottom-0 w-[80%]">
          <n-checkbox v-model:checked="protocol" />
          <div class="text-12px color-#909090 cursor-default lh-14px">
            <span>읽었으며 동의합니다</span>
            <span @click.stop="toServiceAgreement" class="color-#13987f cursor-pointer">서비스 약관</span>
            <span> 및 </span>
            <span @click.stop="toPrivacyAgreement" class="color-#13987f cursor-pointer">HuLa 개인정보 보호 가이드</span>
          </div>
        </n-flex>
      </n-flex>

      <!-- 회원가입 폼 - 1단계: 닉네임 및 비밀번호 -->
      <n-flex v-if="activeTab === 'register' && currentStep === 1" class="text-center w-80%" vertical :size="16">
        <n-input
          size="large"
          maxlength="8"
          minlength="1"
          v-model:value="registerInfo.nickName"
          type="text"
          spellCheck="false"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          :allow-input="noSideSpace"
          :placeholder="registerNamePH"
          @focus="registerNamePH = ''"
          @blur="registerNamePH = 'HuLa 닉네임 입력'"
          clearable />

        <n-input
          class="pl-16px"
          size="large"
          minlength="6"
          show-password-on="click"
          v-model:value="registerInfo.password"
          type="password"
          spellCheck="false"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          :allow-input="noSideSpace"
          :placeholder="registerPasswordPH"
          @focus="registerPasswordPH = ''"
          @blur="registerPasswordPH = '비밀번호 설정'"
          clearable />

        <n-input
          class="pl-16px"
          size="large"
          minlength="6"
          show-password-on="click"
          v-model:value="registerInfo.confirmPassword"
          type="password"
          spellCheck="false"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          :allow-input="noSideSpace"
          :placeholder="confirmPasswordPH"
          @focus="confirmPasswordPH = ''"
          @blur="confirmPasswordPH = '비밀번호 확인'"
          clearable />

        <!-- 비밀번호 힌트 정보 -->
        <n-flex vertical v-if="registerInfo.password" :size="10" class="mt-8px">
          <Validation :value="registerInfo.password" message="최소 6자" :validator="validateMinLength" />
          <Validation :value="registerInfo.password" message="영문 및 숫자 조합" :validator="validateAlphaNumeric" />
          <Validation :value="registerInfo.password" message="특수 문자 포함 필수" :validator="validateSpecialChar" />
        </n-flex>

        <!-- 약관 -->
        <n-flex align="center" justify="center" :size="6" class="mt-10px">
          <n-checkbox v-model:checked="registerProtocol" />
          <div class="text-12px color-#909090 cursor-default lh-14px">
            <span>읽었으며 동의합니다</span>
            <span @click.stop="toServiceAgreement" class="color-#13987f cursor-pointer">서비스 약관</span>
            <span> 및 </span>
            <span @click.stop="toPrivacyAgreement" class="color-#13987f cursor-pointer">HuLa 개인정보 보호 가이드</span>
          </div>
        </n-flex>

        <n-button
          :loading="registerLoading"
          :disabled="!isStep1Valid"
          tertiary
          style="color: #fff"
          class="w-full mt-8px mb-50px gradient-button"
          @click="handleRegisterStep">
          <span>다음</span>
        </n-button>
      </n-flex>

      <!-- 회원가입 폼 - 2단계: 이메일 및 이미지 인증코드 -->
      <n-flex v-if="activeTab === 'register' && currentStep === 2" class="text-center w-80%" vertical :size="16">
        <n-auto-complete
          size="large"
          v-model:value="registerInfo.email"
          :placeholder="registerEmailPH"
          :options="commonEmailDomains"
          :get-show="getShow"
          clearable
          type="text"
          @focus="registerEmailPH = ''"
          @blur="registerEmailPH = '이메일 입력'" />

        <!-- 이메일 인증코드 -->
        <div class="flex justify-between items-center gap-10px">
          <n-input
            size="large"
            maxlength="6"
            v-model:value="registerInfo.code"
            type="text"
            spellCheck="false"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            :allow-input="noSideSpace"
            :placeholder="registerCodePH"
            @focus="registerCodePH = ''"
            @blur="registerCodePH = '이메일 인증코드 입력'"
            clearable />

          <n-button
            tertiary
            style="color: #fff"
            class="flex-shrink-0 gradient-button"
            :loading="sendCodeLoading"
            :disabled="sendCodeDisabled"
            @click="handleSendEmailCode">
            <span>{{ sendCodeButtonText }}</span>
          </n-button>
        </div>

        <n-button
          :loading="registerLoading"
          :disabled="!isStep2Valid"
          tertiary
          style="color: #fff"
          class="w-full mt-8px mb-50px gradient-button"
          @click="handleRegisterStep">
          <span>注册</span>
        </n-button>
      </n-flex>
    </div>
  </MobileLayout>
</template>

<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import { invoke } from '@tauri-apps/api/core'
import Validation from '@/components/common/Validation.vue'
import router from '@/router'
import type { RegisterUserReq, UserInfoType } from '@/services/types'
import { useLoginHistoriesStore } from '@/stores/loginHistory.ts'
import { useMobileStore } from '@/stores/mobile'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { register, sendCaptcha } from '@/utils/ImRequestUtils'
import { isAndroid, isIOS } from '@/utils/PlatformConstants'
import { validateAlphaNumeric, validateSpecialChar } from '@/utils/Validate'
import { useMitt } from '../hooks/useMitt'
import { WsResponseMessageType } from '../services/wsType'
import { useSettingStore } from '../stores/setting'
import { clearListener } from '../utils/ReadCountQueue'
import { useLogin } from '../hooks/useLogin'

// 로컬 회원가입 정보 타입, 비밀번호 확인을 포함하도록 API 타입 확장
interface LocalRegisterInfo extends RegisterUserReq {}

const loginHistoriesStore = useLoginHistoriesStore()
const { loginHistories } = loginHistoriesStore
const mobileStore = useMobileStore()
const safeArea = computed(() => mobileStore.safeArea)
const settingStore = useSettingStore()
const { login } = storeToRefs(settingStore)

const isJumpDirectly = ref(false)

/** 현재 활성화된 탭 */
const activeTab = ref<'login' | 'register'>('login')

/** 현재 회원가입 단계 */
const currentStep = ref(1)

/** 회원가입 계정 정보 */
const registerInfo = ref<LocalRegisterInfo>({
  nickName: '',
  email: '',
  password: '',
  confirmPassword: '',
  code: '',
  uuid: '',
  avatar: '',
  key: 'REGISTER_EMAIL',
  systemType: 2
})

// 로그인 관련 플레이스홀더 및 상태
const accountPH = ref('HuLa 계정 입력')
const passwordPH = ref('HuLa 비밀번호 입력')
const protocol = ref(true)
const arrowStatus = ref(false)

// 회원가입 관련 플레이스홀더 및 상태
const registerNamePH = ref('HuLa 닉네임 입력')
const registerEmailPH = ref('이메일 입력')
const registerPasswordPH = ref('비밀번호 설정')
const confirmPasswordPH = ref('비밀번호 확인')
const registerCodePH = ref('이메일 인증코드 입력')
const registerProtocol = ref(true)
const registerLoading = ref(false)
const sendCodeLoading = ref(false)
const sendCodeCountdown = ref(0)
const MOBILE_EMAIL_TIMER_ID = 'mobile_register_email_timer'
const timerWorker = new Worker(new URL('@/workers/timer.worker.ts', import.meta.url))
const { normalLogin, loading, loginText, loginDisabled, info: userInfo } = useLogin()

const sendCodeButtonText = computed(() => {
  if (sendCodeCountdown.value > 0) {
    return `${sendCodeCountdown.value}초 후 재전송`
  }
  return '인증코드 전송'
})

const sendCodeDisabled = computed(() => {
  return sendCodeLoading.value || sendCodeCountdown.value > 0 || !registerInfo.value.email || !isEmailValid.value
})

const agreementStyle = computed(() => {
  const inset = safeArea.value.bottom || 0
  if (isAndroid()) {
    return { bottom: `${inset + 10}px` }
  }
  if (inset > 0) {
    return { bottom: `${inset}px` }
  }
  return { bottom: 'var(--safe-area-inset-bottom)' }
})

const stopSendCodeCountdown = () => {
  timerWorker.postMessage({
    type: 'clearTimer',
    msgId: MOBILE_EMAIL_TIMER_ID
  })
  sendCodeCountdown.value = 0
}

const startSendCodeCountdown = () => {
  sendCodeCountdown.value = 60
  timerWorker.postMessage({
    type: 'startTimer',
    msgId: MOBILE_EMAIL_TIMER_ID,
    duration: 60 * 1000
  })
}

timerWorker.onmessage = (e) => {
  const { type, msgId, remainingTime } = e.data
  if (msgId !== MOBILE_EMAIL_TIMER_ID) return

  if (type === 'debug') {
    sendCodeCountdown.value = Math.max(0, Math.ceil(remainingTime / 1000))
  } else if (type === 'timeout') {
    sendCodeCountdown.value = 0
  }
}

timerWorker.onerror = () => {
  sendCodeCountdown.value = 0
}

watch(activeTab, () => {
  stopSendCodeCountdown()
  sendCodeLoading.value = false
})

// 자주 사용하는 이메일 접미사
const commonEmailDomains = computed(() => {
  return ['@gmail.com', '@163.com', '@qq.com'].map((suffix) => {
    const prefix = registerInfo.value.email.split('@')[0]
    return {
      label: prefix + suffix,
      value: prefix + suffix
    }
  })
})

/** 공백 입력 허용 안 함 */
const noSideSpace = (value: string) => !value.startsWith(' ') && !value.endsWith(' ')

/** 이메일 형식 확인 */
const isEmailValid = computed(() => {
  const email = registerInfo.value.email.trim()
  if (!email) return false
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)
})

/** 비밀번호 검증 함수 */
const validateMinLength = (value: string) => value.length >= 6

/** 비밀번호가 모든 조건을 충족하는지 확인 */
const isPasswordValid = computed(() => {
  const password = registerInfo.value.password
  return validateMinLength(password) && validateAlphaNumeric(password) && validateSpecialChar(password)
})

/** 1단계 진행 가능 여부 확인 */
const isStep1Valid = computed(() => {
  return (
    registerInfo.value.nickName &&
    isPasswordValid.value &&
    registerInfo.value.confirmPassword === registerInfo.value.password &&
    registerProtocol.value
  )
})

/** 2단계 진행 가능 여부 확인 */
const isStep2Valid = computed(() => {
  return isEmailValid.value && !!registerInfo.value.code.trim()
})

const getShow = (value: string) => {
  if (value.endsWith('@')) {
    return true
  }
  return false
}

// 로그인 폼 변경 감지
watchEffect(() => {
  loginDisabled.value = !(userInfo.value.account && userInfo.value.password && protocol.value)
  // 계정 삭제 시 기본 프로필 사진 설정
  if (!userInfo.value.account) {
    userInfo.value.avatar = '/logo.png'
  }
})

// 탭 전환 감지, 상태 초기화
watch(activeTab, (newTab) => {
  if (newTab === 'login') {
    // 로그인으로 전환 시 회원가입 상태 초기화
    resetRegisterForm()
  } else {
    // 회원가입으로 전환 시 로그인 폼 초기화
    resetLoginForm()
  }
})

// 계정 입력 감지
watch(
  () => userInfo.value.account,
  (newAccount) => {
    if (!newAccount) {
      userInfo.value.avatar = '/logo.png'
      return
    }

    refreshAvatar(newAccount)
  }
)

/** 로그인 폼 초기화 */
const resetLoginForm = () => {
  userInfo.value = {
    account: '',
    password: '',
    avatar: '',
    uid: '',
    name: ''
  }
  accountPH.value = 'HuLa 계정 입력'
  passwordPH.value = 'HuLa 비밀번호 입력'
  arrowStatus.value = false
}

/** 회원가입 폼 초기화 */
const resetRegisterForm = () => {
  registerInfo.value = {
    nickName: '',
    email: '',
    password: '',
    confirmPassword: '',
    code: '',
    uuid: '',
    avatar: '',
    systemType: 2,
    key: 'REGISTER_EMAIL'
  } as LocalRegisterInfo
  currentStep.value = 1
  registerNamePH.value = 'HuLa 닉네임 입력'
  registerEmailPH.value = '이메일 입력'
  registerPasswordPH.value = '비밀번호 설정'
  confirmPasswordPH.value = '비밀번호 확인'
  registerCodePH.value = '이메일 인증코드 입력'
  sendCodeLoading.value = false
  stopSendCodeCountdown()
}

/** 회원가입 단계 처리 */
const handleRegisterStep = async () => {
  if (currentStep.value === 1) {
    // 2단계 진입
    currentStep.value = 2
    return
  }
  await handleRegisterComplete()
}

/** 이메일 인증코드 전송 */
const handleSendEmailCode = async () => {
  if (!isEmailValid.value) {
    window.$message.warning('올바른 이메일을 입력해주세요')
    return
  }

  if (sendCodeCountdown.value > 0 || sendCodeLoading.value) {
    return
  }

  sendCodeLoading.value = true
  try {
    await sendCaptcha({
      email: registerInfo.value.email,
      operationType: 'register',
      templateCode: 'REGISTER_EMAIL'
    })
    window.$message.success('인증코드가 전송되었습니다. 이메일을 확인해주세요')
    startSendCodeCountdown()
  } catch (error) {
    console.error('인증코드 전송 오류:', error)
    window.$message.error('인증코드 전송 실패, 잠시 후 다시 시도해주세요')
  } finally {
    sendCodeLoading.value = false
  }
}

/** 회원가입 완료 */
const handleRegisterComplete = async () => {
  if (!isStep2Valid.value) {
    window.$message.warning('정보를 모두 입력한 후 가입해주세요')
    return
  }

  try {
    registerLoading.value = true
    registerInfo.value.email = registerInfo.value.email.trim()
    registerInfo.value.code = registerInfo.value.code.trim()
    // 랜덤 프로필 사진 번호 생성
    const avatarNum = Math.floor(Math.random() * 21) + 1
    const avatarId = avatarNum.toString().padStart(3, '0')
    registerInfo.value.avatar = avatarId

    // 회원가입 - API에 필요한 필드만 전달
    const { ...apiRegisterInfo } = registerInfo.value

    await register(apiRegisterInfo)

    // 팝업 닫기 및 로그인 페이지로 전환
    activeTab.value = 'login'
    userInfo.value.account = registerInfo.value.nickName || registerInfo.value.email

    window.$message.success('회원가입 성공')

    // 重置注册表单
    resetRegisterForm()
  } catch (error) {
    // 회원가입 실패 처리
    window.$message.error((error as any) || '회원가입 실패')
    console.error(error)
  } finally {
    registerLoading.value = false
  }
}

/**
 * 계정 값 할당
 * @param item 계정 정보
 * */
const giveAccount = (item: UserInfoType) => {
  const { account, avatar, name, uid } = item
  userInfo.value.account = account || ''
  userInfo.value.avatar = avatar
  userInfo.value.name = name
  userInfo.value.uid = uid
  arrowStatus.value = false
}

/** 계정 목록 내용 삭제 */
const delAccount = (item: UserInfoType) => {
  // 삭제 전 계정 목록 길이 가져오기
  const lengthBeforeDelete = loginHistories.length
  loginHistoriesStore.removeLoginHistory(item)
  // 마지막 항목이 삭제되었는지 확인하고 arrowStatus 업데이트
  if (lengthBeforeDelete === 1 && loginHistories.length === 0) {
    arrowStatus.value = false
  }
  userInfo.value.account = ''
  userInfo.value.password = ''
  userInfo.value.avatar = '/logo.png'
}

const handleForgetPassword = () => {
  router.push({
    name: 'mobileForgetPassword'
  })
}

const closeMenu = (event: MouseEvent) => {
  const target = event.target as Element
  if (!target.matches('.account-box, .account-box *, .down')) {
    arrowStatus.value = false
  }
}

onBeforeMount(async () => {
  // const token = localStorage.getItem('TOKEN')
  // const refreshToken = localStorage.getItem('REFRESH_TOKEN')

  if (!login.value.autoLogin) {
    localStorage.removeItem('TOKEN')
    localStorage.removeItem('REFRESH_TOKEN')
    clearListener()
    return
  }

  // 자동 로그인이 아닌 경우에만 토큰을 검증하고 메인 창을 직접 엽니다
  // if (token && refreshToken && !login.value.autoLogin) {
  //   isJumpDirectly.value = true
  //   try {
  //     // await openHomeWindow()
  //     return // 직접 반환, 이후 로그인 관련 로직 실행 안 함
  //   } catch (error) {
  //     isJumpDirectly.value = false
  //     // 토큰 무효, 토큰 제거 및 상태 초기화
  //     localStorage.removeItem('TOKEN')
  //     localStorage.removeItem('REFRESH_TOKEN')
  //     userStore.userInfo = undefined
  //   }
  // }
})

const toServiceAgreement = () => {
  router.push({
    name: 'mobileServiceAgreement'
  })
}

const toPrivacyAgreement = () => {
  router.push({
    name: 'mobilePrivacyAgreement'
  })
}

const refreshAvatar = useDebounceFn((newAccount: string) => {
  const matchedAccount = loginHistories.find(
    (history) => history.account === newAccount || history.email === newAccount
  )
  if (matchedAccount) {
    userInfo.value.avatar = AvatarUtils.getAvatarUrl(matchedAccount.avatar)
  } else {
    userInfo.value.avatar = '/logo.png'
  }
}, 300)

onMounted(async () => {
  window.addEventListener('click', closeMenu, true)
  if (isIOS()) {
    invoke('set_webview_keyboard_adjustment', { enabled: false })
  }
  // 로그인이 필요한 경우에만 로그인 창 표시
  if (isJumpDirectly.value) {
    loading.value = false
    router.push('/mobile/message')
    return
  }

  // 로그인 페이지 진입 시 스플래시 화면 즉시 숨김, 로그인 성공/실패 여부와 관계없이 로그인 화면이 보이도록 함
  await invoke('hide_splash_screen')

  useMitt.on(WsResponseMessageType.NO_INTERNET, () => {
    loginDisabled.value = true
    loginText.value = '서비스 연결 끊김'
  })

  if (login.value.autoLogin) {
    normalLogin('MOBILE', true, true)
  } else {
    loginHistories.length > 0 && giveAccount(loginHistories[0])
  }
})

onUnmounted(() => {
  window.removeEventListener('click', closeMenu, true)
  stopSendCodeCountdown()
  timerWorker.terminate()
  if (isIOS()) {
    invoke('set_webview_keyboard_adjustment', { enabled: false })
  }
})
</script>

<style scoped lang="scss">
@use '@/styles/scss/login';
</style>
