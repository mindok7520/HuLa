<template>
  <!-- n-config-provider를 별도로 사용하여 테마 전환이 필요 없는 인터페이스를 감쌈 -->
  <n-config-provider
    :theme="naiveTheme"
    data-tauri-drag-region
    class="login-box size-full rounded-8px select-none flex flex-col">
    <!--상단 작업 표시줄-->
    <ActionBar :max-w="false" :shrink="false" />

    <n-flex vertical justify="center" :size="25" class="w-full mt--40px flex-1 pointer-events-none">
      <!-- 회원가입 메뉴 -->
      <n-flex class="ma text-center w-260px pointer-events-auto" vertical :size="16">
        <n-flex justify="center" align="center">
          <span class="text-(24px #70938c) textFont">{{ t('auth.register.title') }}</span>
          <img class="w-100px h-40px" src="/hula.png" alt="" />
        </n-flex>
        <n-form :model="info" :rules="rules" ref="registerForm">
          <!-- 회원가입 정보 -->
          <div>
            <n-form-item path="name">
              <n-input
                :class="[{ 'pr-20px': info.nickName }, { 'pr-16px': showNamePrefix && !info.nickName }]"
                maxlength="8"
                minlength="1"
                size="large"
                v-model:value="info.nickName"
                type="text"
                spellCheck="false"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                :allow-input="noSideSpace"
                :placeholder="showNamePrefix ? '' : t('auth.register.placeholders.nickname')"
                @focus="handleInputState($event, 'nickName')"
                @blur="handleInputState($event, 'nickName')"
                clearable>
                <template #prefix v-if="showNamePrefix || info.nickName">
                  <p class="text-12px">{{ t('auth.register.labels.nickname') }}</p>
                </template>
              </n-input>
            </n-form-item>

            <n-form-item path="password">
              <n-input
                :class="{ 'pl-16px': !showPasswordPrefix && !info.password }"
                maxlength="16"
                minlength="6"
                size="large"
                spellCheck="false"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                show-password-on="click"
                v-model:value="info.password"
                type="password"
                :allow-input="noSideSpace"
                :placeholder="showPasswordPrefix ? '' : t('auth.register.placeholders.password')"
                @focus="handleInputState($event, 'password')"
                @blur="handleInputState($event, 'password')"
                clearable>
                <template #prefix v-if="showPasswordPrefix || info.password">
                  <p class="text-12px">{{ t('auth.register.labels.password') }}</p>
                </template>
              </n-input>
            </n-form-item>

            <n-form-item path="confirmPassword">
              <n-input
                :class="{ 'pl-16px': !showConfirmPasswordPrefix && !confirmPassword }"
                maxlength="16"
                minlength="6"
                size="large"
                spellCheck="false"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                show-password-on="click"
                v-model:value="confirmPassword"
                type="password"
                :allow-input="noSideSpace"
                :placeholder="showConfirmPasswordPrefix ? '' : t('auth.register.placeholders.confirm_placeholder')"
                @focus="handleInputState($event, 'confirmPassword')"
                @blur="handleInputState($event, 'confirmPassword')"
                clearable>
                <template #prefix v-if="showConfirmPasswordPrefix || confirmPassword">
                  <p class="text-12px">{{ t('auth.register.labels.confirm') }}</p>
                </template>
              </n-input>
            </n-form-item>

            <n-form-item path="email">
              <n-auto-complete
                size="large"
                v-model:value="info.email"
                :placeholder="showemailPrefix ? '' : t('auth.register.placeholders.email')"
                :options="commonEmailDomains"
                :get-show="getShow"
                :append="true"
                clearable
                type="text"
                spellCheck="false"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                @focus="handleInputState($event, 'email')"
                @blur="handleInputState($event, 'email')">
                <template #prefix v-if="showemailPrefix || info.email">
                  <p class="text-12px">{{ t('auth.register.labels.email') }}</p>
                </template>
              </n-auto-complete>
            </n-form-item>

            <!-- 비밀번호 힌트 정보 -->
            <n-flex vertical v-if="info.password">
              <n-flex vertical :size="4">
                <Validation
                  :value="info.password"
                  :message="t('auth.register.password_hints.min_length')"
                  :validator="validateMinLength" />
                <Validation
                  :value="info.password"
                  :message="t('auth.register.password_hints.alpha_numeric')"
                  :validator="validateAlphaNumeric" />
                <Validation
                  :value="info.password"
                  :message="t('auth.register.password_hints.special_char')"
                  :validator="validateSpecialChar" />
              </n-flex>
            </n-flex>

            <!-- 약관 -->
            <n-flex align="center" justify="center" :size="6" class="mt-10px">
              <n-checkbox v-model:checked="protocol" />
              <div class="text-12px color-#909090 cursor-default lh-14px">
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
          </div>
        </n-form>

        <n-button
          :loading="loading"
          :disabled="btnEnable"
          tertiary
          style="color: #fff"
          class="w-full mt-8px gradient-button"
          @click="handleStepAction">
          {{ btnText }}
        </n-button>
        <p v-if="sendCodeCooldown > 0" class="text-(12px #13987f) ml--8px mt-6px whitespace-nowrap">
          {{ t('auth.register.tips.reopen_code') }}
        </p>
      </n-flex>
    </n-flex>

    <!-- 하단 바 -->
    <n-flex
      class="text-(12px #909090) w-full absolute bottom-20px left-1/2 transform -translate-x-1/2"
      :size="8"
      justify="center">
      <span>Copyright {{ currentYear - 1 }}-{{ currentYear }} HuLaSpark All Rights Reserved.</span>
    </n-flex>

    <!-- 별표 팁 모달 -->
    <n-modal v-model:show="starTipsModal" :mask-closable="false" class="rounded-8px" transform-origin="center">
      <div class="bg-[--bg-edit] w-380px h-fit box-border flex flex-col">
        <n-flex vertical class="w-full h-fit">
          <video class="w-full h-240px rounded-t-8px object-cover" src="@/assets/video/star.mp4" autoplay loop />
          <n-flex vertical :size="10" class="p-14px">
            <p class="text-(16px #303030)">{{ t('auth.register.modal.title') }}</p>
            <p class="text-(12px #808080) leading-5">{{ t('auth.register.modal.desc') }}</p>

            <n-flex :size="10" class="ml-auto">
              <a
                target="_blank"
                rel="noopener noreferrer"
                @click="handleStar"
                href="https://github.com/HuLaSpark/HuLa"
                class="bg-#363636 cursor-pointer w-70px h-30px rounded-8px flex-center text-(12px #f1f1f1) outline-none no-underline">
                {{ t('auth.register.modal.cta') }}
              </a>
            </n-flex>
          </n-flex>
        </n-flex>
      </div>
    </n-modal>

    <!-- 이메일 인증 코드 입력 팝업 -->
    <n-modal v-model:show="emailCodeModal" :mask-closable="false" class="rounded-8px" transform-origin="center">
      <div class="bg-#f0f0f0 w-380px h-fit box-border flex flex-col">
        <div
          v-if="isMac()"
          @click="emailCodeModal = false"
          class="mac-close z-999 size-13px shadow-inner bg-#ed6a5eff rounded-50% select-none absolute top-3px left-4px">
          <svg class="hidden size-7px color-#000 select-none absolute top-3px left-3px">
            <use href="#close"></use>
          </svg>
        </div>

        <svg
          v-if="isWindows()"
          @click="emailCodeModal = false"
          class="w-12px h-12px ml-a mr-4px mt-4px cursor-pointer select-none">
          <use href="#close"></use>
        </svg>
        <n-flex vertical class="w-full h-fit">
          <n-flex vertical :size="10" class="p-24px">
            <p class="text-(16px #303030) mb-10px">{{ t('auth.register.email_modal.title') }}</p>
            <p class="text-(12px #808080) leading-5 mb-10px">
              {{ t('auth.register.email_modal.desc', { email: info.email }) }}
            </p>

            <!-- PIN 입력 상자 -->
            <div class="mb-20px">
              <PinInput v-model="emailCode" @complete="register" ref="pinInputRef" />
            </div>

            <n-button
              :loading="registerLoading"
              :disabled="!isEmailCodeComplete"
              tertiary
              style="color: #fff"
              class="w-full gradient-button"
              @click="register">
              {{ t('auth.register.actions.submit') }}
            </n-button>
          </n-flex>
        </n-flex>
      </div>
    </n-modal>
  </n-config-provider>
</template>

<script setup lang="ts">
import { getCurrentWebviewWindow, WebviewWindow } from '@tauri-apps/api/webviewWindow'
import dayjs from 'dayjs'
import { darkTheme, lightTheme, type FormInst } from 'naive-ui'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import PinInput from '@/components/common/PinInput.vue'
import Validation from '@/components/common/Validation.vue'
import { useWindow } from '@/hooks/useWindow'
import type { RegisterUserReq } from '@/services/types.ts'
import { useSettingStore } from '@/stores/setting'
import * as ImRequestUtils from '@/utils/ImRequestUtils'
import { isMac, isWindows } from '@/utils/PlatformConstants'
import { validateAlphaNumeric, validateSpecialChar } from '@/utils/Validate'

// 입력 상자 유형 정의
type InputType = 'nickName' | 'email' | 'password' | 'confirmPassword'

const settingStore = useSettingStore()
const { themes } = storeToRefs(settingStore)
const naiveTheme = computed(() => (themes.value.content === 'dark' ? darkTheme : lightTheme))
const { t } = useI18n()

/** 회원가입 정보 */
const info = unref(
  ref<RegisterUserReq>({
    avatar: '',
    email: '',
    password: '',
    nickName: '',
    code: '',
    uuid: '',
    key: 'REGISTER_EMAIL',
    confirmPassword: '',
    systemType: 2
  })
)

/** 비밀번호 확인 */
const confirmPassword = ref('')

/** 약관 */
const protocol = ref(true)
const btnEnable = ref(false)
const loading = ref(false)
const registerLoading = ref(false)

// 플레이스홀더
// 접두사 표시 상태
const showNamePrefix = ref(false)
const showemailPrefix = ref(false)
const showPasswordPrefix = ref(false)
const showConfirmPasswordPrefix = ref(false)
const { createModalWindow } = useWindow()
// 자주 사용하는 이메일 접미사
const commonEmailDomains = computed(() => {
  return ['gmail.com', '163.com', 'qq.com'].map((suffix) => {
    return {
      label: suffix,
      value: suffix
    }
  })
})

/** 인증 코드 전송 쿨타임(초) */
const sendCodeCooldown = ref(0)
/** 인증 코드 카운트다운 메시지 ID */
const EMAIL_TIMER_ID = 'register_window_email_timer'
/** 카운트다운 타이머 Worker */
const timerWorker = new Worker(new URL('@/workers/timer.worker.ts', import.meta.url))
/** 인증 코드 전송 버튼 텍스트 */
const btnText = computed(() => {
  if (loading.value) {
    return t('auth.register.actions.sending')
  }
  if (sendCodeCooldown.value > 0) {
    return t('auth.register.actions.retry_in', { seconds: sendCodeCooldown.value })
  }
  return t('auth.register.actions.send_code')
})
// day.js를 사용하여 현재 연도 가져오기
const currentYear = dayjs().year()
const registerForm = ref<FormInst | null>(null)
const starTipsModal = ref(false)
const emailCodeModal = ref(false)

// 이메일 인증 코드 PIN 입력
const emailCode = ref('')
const pinInputRef = ref()
const isEmailCodeComplete = computed(() => emailCode.value.length === 6)
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const isEmailValid = computed(() => emailPattern.test(info.email.trim()))

// 유효성 검사 규칙
const rules = {
  nickName: {
    required: true,
    message: t('auth.register.form.rules.nickname_required'),
    trigger: 'blur'
  },
  email: {
    required: true,
    trigger: ['blur', 'input'],
    validator(_: unknown, value: string) {
      const email = (value || '').trim()
      if (!email) {
        return new Error(t('auth.register.form.rules.email_required'))
      }
      if (!emailPattern.test(email)) {
        return new Error(t('auth.register.form.rules.email_format'))
      }
      return true
    }
  },
  password: {
    required: true,
    message: t('auth.register.form.rules.password_required'),
    trigger: ['blur', 'input']
  },
  confirmPassword: {
    required: true,
    message: t('auth.register.form.rules.confirm_mismatch'),
    trigger: 'blur',
    validator() {
      if (confirmPassword.value !== info.password) {
        return false
      }
      return true
    }
  }
}

const getShow = (value: string) => {
  if (value.endsWith('@')) {
    return true
  }
  return false
}

/** 서비스 약관 창 열기 */
const openServiceAgreement = async () => {
  await createModalWindow(t('login.term.checkout.text2'), 'modal-serviceAgreement', 600, 600, 'login')
}

/** 개인정보 보호 정책 창 열기 */
const openPrivacyAgreement = async () => {
  await createModalWindow(t('login.term.checkout.text4'), 'modal-privacyAgreement', 600, 600, 'login')
}

/** 공백 입력 허용 안 함 */
const noSideSpace = (value: string) => !value.startsWith(' ') && !value.endsWith(' ')

/** 비밀번호 검증 함수 */
const validateMinLength = (value: string) => value.length >= 6

/** 비밀번호가 모든 조건을 충족하는지 확인 */
const isPasswordValid = computed(() => {
  const password = info.password
  return validateMinLength(password) && validateAlphaNumeric(password) && validateSpecialChar(password)
})

/** 이메일 인증 코드를 전송할 수 있는지 확인 */
const canSendCode = computed(() => {
  return (
    !!info.nickName &&
    isPasswordValid.value &&
    confirmPassword.value === info.password &&
    protocol.value &&
    isEmailValid.value
  )
})

watchEffect(() => {
  btnEnable.value = loading.value || !canSendCode.value
})

/**
 * 입력 상자 상태 변경 처리
 * @param type 입력 상자 유형: name-닉네임 / email-이메일 / password-비밀번호 / confirmPassword-비밀번호 확인
 * @param event 이벤트 객체
 */
const handleInputState = (event: FocusEvent, type: InputType): void => {
  const prefixMap: Record<InputType, Ref<boolean>> = {
    nickName: showNamePrefix,
    email: showemailPrefix,
    password: showPasswordPrefix,
    confirmPassword: showConfirmPasswordPrefix
  }
  prefixMap[type].value = event.type === 'focus'
}

/** 단계 작업 처리 */
const handleStepAction = async () => {
  if (btnEnable.value || loading.value) return

  try {
    await registerForm.value?.validate?.()
  } catch (error) {
    return
  }

  if (sendCodeCooldown.value > 0) {
    emailCodeModal.value = true
    nextTick(() => {
      pinInputRef.value?.focus()
    })
    return
  }

  loading.value = true
  try {
    const email = info.email.trim()
    info.email = email
    await ImRequestUtils.sendCaptcha({
      email,
      operationType: 'register',
      templateCode: 'REGISTER_EMAIL'
    })
    startSendCodeCountdown()
    window.$message.success(t('auth.register.messages.code_sent'))
    emailCodeModal.value = true
    emailCode.value = ''
    nextTick(() => {
      pinInputRef.value?.focus()
    })
  } catch (error) {
    console.error('인증 코드 전송 실패', error)
  } finally {
    loading.value = false
  }
}

const startSendCodeCountdown = () => {
  sendCodeCooldown.value = 60
  timerWorker.postMessage({
    type: 'startTimer',
    msgId: EMAIL_TIMER_ID,
    duration: 60 * 1000
  })
}

timerWorker.onmessage = (e) => {
  const { type, msgId, remainingTime } = e.data
  if (msgId !== EMAIL_TIMER_ID) return

  if (type === 'debug') {
    sendCodeCooldown.value = Math.max(0, Math.ceil(remainingTime / 1000))
  } else if (type === 'timeout') {
    sendCodeCooldown.value = 0
  }
}

timerWorker.onerror = () => {
  sendCodeCooldown.value = 0
}

/** 이메일 회원가입 */
const register = async () => {
  registerLoading.value = true

  // 인증 코드 병합
  info.code = emailCode.value
  info.email = info.email.trim()

  try {
    // 아바타 번호 무작위 생성
    const avatarNum = Math.floor(Math.random() * 21) + 1
    const avatarId = avatarNum.toString().padStart(3, '0')
    info.avatar = avatarId

    info.confirmPassword = confirmPassword.value

    // 회원가입
    await ImRequestUtils.register({ ...info })
    window.$message.success(t('auth.register.messages.register_success'))

    // 팝업 닫기 및 로그인 페이지로 이동
    emailCodeModal.value = false
    setTimeout(() => {
      WebviewWindow.getByLabel('login').then((win) => {
        win?.setFocus()
      })
      WebviewWindow.getCurrent().close()
    }, 1200)
  } catch (error) {
    window.$message.error(t('auth.register.messages.register_fail'))
  } finally {
    registerLoading.value = false
  }
}

const handleStar = () => {
  starTipsModal.value = false
  localStorage.setItem('star', '1')
}

onMounted(async () => {
  await getCurrentWebviewWindow().show()
  await nextTick(() => {
    starTipsModal.value = localStorage.getItem('star') !== '1'
  })
})

// 컴포넌트 언마운트 시 타이머 정리
onUnmounted(() => {
  timerWorker.postMessage({
    type: 'clearTimer',
    msgId: EMAIL_TIMER_ID
  })
  timerWorker.terminate()
  sendCodeCooldown.value = 0
})
</script>

<style scoped lang="scss">
@use '@/styles/scss/global/login-bg';
@use '@/styles/scss/login';

.textFont {
  font-family: AliFangYuan, sans-serif !important;
}

:deep(.n-form-item.n-form-item--top-labelled) {
  grid-template-rows: none;
}
</style>
