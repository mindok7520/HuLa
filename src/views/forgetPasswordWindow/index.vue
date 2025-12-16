<template>
  <n-config-provider
    :theme="naiveTheme"
    class="size-full bg-#fff dark:bg-#202020 rounded-8px select-none cursor-default">
    <!--상단 작업 표시줄-->
    <ActionBar :max-w="false" :shrink="false" />

    <n-flex vertical class="w-full size-full">
      <!-- 제목 -->
      <n-flex justify="center" class="w-full">
        <p class="text-(18px [--text-color]) select-none">{{ t('auth.forget.title') }}</p>
      </n-flex>

      <!-- 단계 표시줄 -->
      <n-steps size="small" class="w-full px-40px mt-20px" :current="currentStep" :status="stepStatus">
        <n-step :title="t('auth.forget.steps.verify.title')" :description="t('auth.forget.steps.verify.desc')" />
        <n-step :title="t('auth.forget.steps.reset.title')" :description="t('auth.forget.steps.reset.desc')" />
        <n-step :title="t('auth.forget.steps.done.title')" :description="t('auth.forget.steps.done.desc')" />
      </n-steps>

      <!-- 1단계: 이메일 인증 -->
      <div v-if="currentStep === 1" class="w-full max-w-300px mx-auto mt-30px">
        <n-form ref="formRef" :model="formData" :rules="emailRules">
          <!-- 이메일 입력 -->
          <n-form-item path="email" :label="t('auth.forget.form.email_label')">
            <n-input
              :allow-input="noSideSpace"
              class="border-(1px solid #90909080) no-indent-input w-300px!"
              v-model:value="formData.email"
              :placeholder="t('auth.forget.form.email_placeholder')"
              spellCheck="false"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              clearable />
          </n-form-item>

          <!-- 이메일 인증 코드 -->
          <n-form-item path="emailCode" :label="t('auth.forget.form.code_label')">
            <n-flex :size="8">
              <n-input
                :allow-input="noSideSpace"
                class="border-(1px solid #90909080) no-indent-input w-300px!"
                v-model:value="formData.emailCode"
                :placeholder="t('auth.forget.form.code_placeholder')"
                spellCheck="false"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                maxlength="6" />
              <n-button
                color="#13987f"
                ghost
                :disabled="sendBtnDisabled"
                :loading="sendingEmailCode"
                @click="sendEmailCode"
                class="min-w-100px w-fit h-34px">
                {{ emailCodeBtnText }}
              </n-button>
            </n-flex>
          </n-form-item>

          <n-button
            :loading="verifyLoading"
            :disabled="nextDisabled"
            tertiary
            style="color: #fff"
            @click="verifyEmail"
            class="mt-10px w-full gradient-button">
            {{ t('auth.forget.buttons.next') }}
          </n-button>
        </n-form>
      </div>

      <!-- 2단계: 새 비밀번호 설정 -->
      <div v-if="currentStep === 2" class="w-full max-w-300px mx-auto mt-30px">
        <n-form ref="passwordFormRef" :model="passwordForm" :rules="passwordRules">
          <!-- 새 비밀번호 -->
          <n-form-item path="password" :label="t('auth.forget.form.password_label')">
            <n-flex vertical :size="8" class="w-full">
              <n-input
                :allow-input="noSideSpace"
                class="border-(1px solid #90909080) w-full no-indent-input"
                v-model:value="passwordForm.password"
                type="password"
                show-password-on="click"
                :placeholder="t('auth.forget.form.password_placeholder')"
                maxlength="16"
                spellCheck="false"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                minlength="6" />
              <n-flex vertical :size="4" class="space-y-4px">
                <Validation
                  :value="passwordForm.password"
                  :message="t('auth.forget.password_hints.length')"
                  :validator="validateMinLength" />
                <Validation
                  :value="passwordForm.password"
                  :message="t('auth.forget.password_hints.alpha_numeric')"
                  :validator="validateAlphaNumeric" />
                <Validation
                  :value="passwordForm.password"
                  :message="t('auth.forget.password_hints.special_char')"
                  :validator="validateSpecialChar" />
              </n-flex>
            </n-flex>
          </n-form-item>

          <!-- 비밀번호 확인 -->
          <n-form-item path="confirmPassword" :label="t('auth.forget.form.confirm_label')">
            <n-flex vertical :size="8" class="w-full">
              <n-input
                :allow-input="noSideSpace"
                class="border-(1px solid #90909080) w-full no-indent-input"
                v-model:value="passwordForm.confirmPassword"
                type="password"
                show-password-on="click"
                :placeholder="t('auth.forget.form.confirm_placeholder')"
                spellCheck="false"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                maxlength="16"
                minlength="6" />
              <n-flex vertical :size="4">
                <Validation
                  :value="passwordForm.confirmPassword"
                  :message="t('auth.forget.password_hints.confirm_match')"
                  :validator="(value: string) => value === passwordForm.password && value !== ''" />
              </n-flex>
            </n-flex>
          </n-form-item>

          <n-flex :size="16" class="mt-30px">
            <n-button @click="goBack" class="flex-1">{{ t('auth.forget.buttons.prev') }}</n-button>
            <n-button
              :loading="submitLoading"
              tertiary
              style="color: #fff"
              @click="submitNewPassword"
              class="flex-1 gradient-button">
              {{ t('auth.forget.buttons.submit') }}
            </n-button>
          </n-flex>
        </n-form>
      </div>

      <!-- 3단계: 완료 -->
      <div v-if="currentStep === 3" class="w-full max-w-300px mx-auto mt-100px text-center">
        <!-- <n-icon size="64" class="text-#13987f">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <path fill="currentColor" d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z" />
          </svg>
        </n-icon> -->
        <img class="size-98px" src="/emoji/party-popper.webp" alt="" />

        <div class="mt-16px text-18px">{{ t('auth.forget.success.title') }}</div>
        <div class="mt-16px text-14px text-#666">{{ t('auth.forget.success.desc') }}</div>
      </div>
    </n-flex>
  </n-config-provider>
</template>

<script setup lang="ts">
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { darkTheme, lightTheme } from 'naive-ui'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import Validation from '@/components/common/Validation.vue'
import { useSettingStore } from '@/stores/setting'
import { forgetPassword, getCaptcha, sendCaptcha } from '@/utils/ImRequestUtils'
import { validateAlphaNumeric, validateSpecialChar } from '@/utils/Validate'

const settingStore = useSettingStore()
const { themes } = storeToRefs(settingStore)
const naiveTheme = computed(() => (themes.value.content === 'dark' ? darkTheme : lightTheme))
const { t } = useI18n()

// Web Worker 가져오기
const timerWorker = new Worker(new URL('../../workers/timer.worker.ts', import.meta.url))

// 단계 상태
const currentStep = ref(1)
const stepStatus = ref<'error' | 'finish' | 'process' | 'wait' | undefined>('process')

// 1단계 양식 데이터
const formRef = ref(null)
const formData = ref({
  email: '',
  emailCode: '',
  uuid: '' // 이미지 인증 코드 uuid
})

// 이미지 인증 코드 관련
const captchaImage = ref('')
const sendBtnDisabled = ref(false)
const emailCodeBtnText = ref(t('auth.forget.actions.send_code'))
const countDown = ref(60)
const verifyLoading = ref(false)
// 인증 코드 전송 로딩 상태
const sendingEmailCode = ref(false)
// 마지막 이미지 인증 코드 가져온 시간
const lastCaptchaTime = ref(0)
// 이미지 인증 코드 가져오기 간격 (밀리초)
const captchaInterval = 10000
// 이미지 인증 코드 쿨다운 중 여부
const captchaInCooldown = ref(false)
// 이미지 인증 코드 쿨다운 남은 시간
const captchaCooldownRemaining = ref(0)
// 인증 코드 타이머 고유 ID
const EMAIL_TIMER_ID = 'email_verification_timer'
// 이미지 인증 코드 제한 타이머 ID
const CAPTCHA_TIMER_ID = 'captcha_cooldown_timer'

// 이메일 유효성 검사 규칙
const emailRules = {
  email: [
    { required: true, message: t('auth.forget.rules.email_required'), trigger: 'blur' },
    {
      pattern: /^[a-zA-Z0-9_-]+@[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)+$/,
      message: t('auth.forget.rules.email_format'),
      trigger: 'blur'
    }
  ],
  emailCode: [
    { required: true, message: t('auth.forget.rules.code_required'), trigger: 'input' },
    { min: 6, max: 6, message: t('auth.forget.rules.code_length'), trigger: 'blur' }
  ]
}

// 2단계 비밀번호 양식
const passwordFormRef = ref(null)
const passwordForm = ref({
  password: '',
  confirmPassword: ''
})
const submitLoading = ref(false)

// 비밀번호 유효성 검사 규칙
const passwordRules = {
  password: [
    { required: true, message: t('auth.forget.rules.password_required'), trigger: 'blur' },
    { min: 6, max: 16, message: t('auth.forget.rules.password_length'), trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: t('auth.forget.rules.confirm_required'), trigger: 'blur' },
    {
      validator: (_: any, value: string) => {
        return value === passwordForm.value.password
      },
      message: t('auth.forget.rules.confirm_mismatch'),
      trigger: 'blur'
    }
  ]
}

// 다음 단계 버튼 비활성화 상태
const nextDisabled = computed(() => {
  return !(formData.value.email && formData.value.emailCode)
})

/** 공백 입력 허용 안 함 */
const noSideSpace = (value: string) => !value.startsWith(' ') && !value.endsWith(' ')

/** 비밀번호 검증 함수 */
const validateMinLength = (value: string) => value.length >= 6

// 이미지 인증 코드 가져오기
const getCaptchaImage = async () => {
  // 새 인증 코드를 가져올 수 있는지 확인
  if (captchaInCooldown.value) {
    // 남은 쿨다운 시간 표시
    window.$message.warning(t('auth.forget.messages.captcha_cooldown', { seconds: captchaCooldownRemaining.value }))
    return
  }

  try {
    // 마지막 가져온 시간 업데이트 및 쿨다운 상태 설정
    lastCaptchaTime.value = Date.now()
    captchaInCooldown.value = true

    const result = await getCaptcha()
    captchaImage.value = result.img
    formData.value.uuid = result.uuid

    // 성공적으로 가져온 후 쿨다운 타이머 시작
    timerWorker.postMessage({
      type: 'startTimer',
      msgId: CAPTCHA_TIMER_ID,
      duration: captchaInterval // 설정된 쿨다운 시간 사용
    })
  } catch (error) {
    console.error('인증 코드 가져오기 실패', error)
    // 가져오기 실패 시 쿨다운 상태 해제, 재시도 허용
    captchaInCooldown.value = false
  }
}

// 이메일 인증 코드 전송
const sendEmailCode = async () => {
  // 이메일 유효성 검사
  if (!formData.value.email) {
    window.$message.warning(t('auth.forget.messages.enter_email'))
    return
  }

  if (!/^[a-zA-Z0-9_-]+@[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)+$/.test(formData.value.email)) {
    window.$message.warning(t('auth.forget.messages.email_format'))
    return
  }

  // 로딩 상태 설정
  sendingEmailCode.value = true

  try {
    await sendCaptcha({
      email: formData.value.email,
      uuid: formData.value.uuid,
      operationType: 'forgot',
      templateCode: 'PASSWORD_EDIT'
    })

    window.$message.success(t('auth.forget.messages.code_sent'))

    // 인터페이스가 성공적으로 반환된 후에만 카운트다운 시작 - Web Worker 사용
    sendBtnDisabled.value = true
    countDown.value = 60
    emailCodeBtnText.value = t('auth.forget.actions.retry_in', { seconds: countDown.value })

    // Worker에 메시지를 보내 타이머 시작
    timerWorker.postMessage({
      type: 'startTimer',
      msgId: EMAIL_TIMER_ID,
      duration: 60 * 1000 // 60초, 단위 밀리초
    })
  } catch (error) {
    console.error('인증 코드 전송 실패', error)
    // 인증 코드가 잘못되었을 수 있으므로 이미지 인증 코드 새로고침
    getCaptchaImage()
  } finally {
    // 성공 또는 실패 여부에 관계없이 로딩 상태 닫기
    sendingEmailCode.value = false
  }
}

// 이메일 확인
const verifyEmail = async () => {
  if (!formRef.value) return

  try {
    await (formRef.value as any).validate()
    verifyLoading.value = true

    // 여기서는 양식만 검증하며, 실제로 백엔드 인터페이스를 호출할 필요 없이 바로 다음 단계로 이동
    setTimeout(() => {
      currentStep.value = 2
      verifyLoading.value = false
    }, 500)
  } catch (error) {
    console.error('폼 검증 실패', error)
  }
}

// 이전 단계로 돌아가기
const goBack = () => {
  currentStep.value = 1
}

// 새 비밀번호 제출
const submitNewPassword = async () => {
  if (!passwordFormRef.value) return

  try {
    await (passwordFormRef.value as any).validate()
    submitLoading.value = true

    // 비밀번호 찾기 인터페이스 호출
    await forgetPassword({
      email: formData.value.email,
      code: formData.value.emailCode,
      uuid: formData.value.uuid,
      password: passwordForm.value.password,
      confirmPassword: passwordForm.value.confirmPassword,
      key: 'PASSWORD_EDIT'
    })

    currentStep.value = 3
    stepStatus.value = 'finish'
    submitLoading.value = false
  } catch (error) {
    console.error('비밀번호 재설정 실패', error)
    submitLoading.value = false
  }
}

// Worker 메시지 수신 대기
timerWorker.onmessage = (e) => {
  const { type, msgId, remainingTime } = e.data

  if (msgId === EMAIL_TIMER_ID) {
    // 이메일 인증 코드 타이머 메시지 처리
    if (type === 'debug') {
      // 카운트다운 표시 업데이트
      const secondsRemaining = Math.ceil(remainingTime / 1000)
      countDown.value = secondsRemaining
      emailCodeBtnText.value = t('auth.forget.actions.retry_in', { seconds: secondsRemaining })
    } else if (type === 'timeout') {
      // 타이머 종료
      sendBtnDisabled.value = false
      emailCodeBtnText.value = t('auth.forget.actions.resend')
    }
  } else if (msgId === CAPTCHA_TIMER_ID) {
    // 이미지 인증 코드 쿨다운 타이머 메시지 처리
    if (type === 'debug') {
      // 사용자가 클릭할 때 표시할 남은 쿨다운 시간 업데이트
      captchaCooldownRemaining.value = Math.ceil(remainingTime / 1000)
    } else if (type === 'timeout') {
      // 쿨다운 종료
      captchaInCooldown.value = false
      captchaCooldownRemaining.value = 0
    }
  }
}

// Worker 오류 처리
timerWorker.onerror = (error) => {
  console.error('[Timer Worker Error]', error)
  // 오류 발생 시 버튼 상태 복원
  sendBtnDisabled.value = false
  emailCodeBtnText.value = t('auth.forget.actions.resend')
}

// 페이지 로드 시 인증 코드 가져오기
onMounted(async () => {
  await getCurrentWebviewWindow().show()
  getCaptchaImage()
})

// 컴포넌트 소멸 시 타이머 지우기
onBeforeUnmount(() => {
  // Web Worker 타이머 지우기
  timerWorker.postMessage({
    type: 'clearTimer',
    msgId: EMAIL_TIMER_ID
  })

  // 이미지 인증 코드 쿨다운 타이머 지우기
  timerWorker.postMessage({
    type: 'clearTimer',
    msgId: CAPTCHA_TIMER_ID
  })

  // 선택 사항: Worker 종료 (다른 곳에서 사용할 필요가 없는 경우)
  timerWorker.terminate()
})
</script>
<style scoped lang="scss">
@use '@/styles/scss/login';

:deep(.no-indent-input.n-input .n-input__input),
:deep(.no-indent-input.n-input .n-input__textarea) {
  margin-left: 0 !important;
}
</style>
