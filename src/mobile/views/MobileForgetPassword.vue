<template>
  <MobileLayout :safeAreaTop="true" class="overflow-hidden" :safeAreaBottom="true">
    <HeaderBar
      :isOfficial="false"
      :hidden-right="true"
      :enable-default-background="false"
      :enable-shadow="false"
      room-name="비밀번호 찾기" />

    <n-config-provider :theme="lightTheme" class="bg-#fff rounded-8px select-none cursor-default">
      <n-flex vertical class="w-full size-full">
        <!-- 단계 표시줄 -->
        <n-steps size="small" class="w-full px-40px mt-20px" :current="currentStep" :status="stepStatus">
          <n-step title="이메일 인증" description="" />
          <n-step title="새 비밀번호 설정" description="" />
          <n-step title="완료" description="" />
        </n-steps>

        <!-- 1단계: 이메일 인증 -->
        <div v-if="currentStep === 1" class="w-full max-w-300px mx-auto mt-30px">
          <n-form ref="formRef" :model="formData" :rules="emailRules">
            <!-- 이메일 입력 -->
            <n-form-item path="email" label="이메일 계정">
              <n-input
                :allow-input="noSideSpace"
                class="border-(1px solid #90909080)"
                v-model:value="formData.email"
                placeholder="이메일을 입력하세요"
                spellCheck="false"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                clearable />
            </n-form-item>

            <!-- 이메일 인증 코드 -->
            <n-form-item path="emailCode" label="이메일 인증 코드">
              <n-flex :size="8">
                <n-input
                  :allow-input="noSideSpace"
                  class="border-(1px solid #90909080)"
                  v-model:value="formData.emailCode"
                  placeholder="이메일 인증 코드를 입력하세요"
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
              다음
            </n-button>
          </n-form>
        </div>

        <!-- 2단계: 새 비밀번호 설정 -->
        <div v-if="currentStep === 2" class="w-full max-w-300px mx-auto mt-30px">
          <n-form ref="passwordFormRef" :model="passwordForm" :rules="passwordRules">
            <!-- 새 비밀번호 -->
            <n-form-item path="password" label="새 비밀번호">
              <n-flex vertical :size="8" class="w-full">
                <n-input
                  :allow-input="noSideSpace"
                  class="border-(1px solid #90909080) w-full"
                  v-model:value="passwordForm.password"
                  type="password"
                  show-password-on="click"
                  placeholder="6-16자 새 비밀번호를 입력하세요"
                  maxlength="16"
                  spellCheck="false"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  minlength="6" />
                <n-flex vertical :size="4" class="space-y-4px">
                  <Validation
                    :value="passwordForm.password"
                    message="비밀번호 길이는 6-16자여야 합니다"
                    :validator="validateMinLength" />
                  <Validation
                    :value="passwordForm.password"
                    message="영문과 숫자로 구성되어야 합니다"
                    :validator="validateAlphaNumeric" />
                  <Validation
                    :value="passwordForm.password"
                    message="특수 문자가 하나 이상 포함되어야 합니다"
                    :validator="validateSpecialChar" />
                </n-flex>
              </n-flex>
            </n-form-item>

            <!-- 비밀번호 확인 -->
            <n-form-item path="confirmPassword" label="비밀번호 확인">
              <n-flex vertical :size="8" class="w-full">
                <n-input
                  :allow-input="noSideSpace"
                  class="border-(1px solid #90909080) w-full"
                  v-model:value="passwordForm.confirmPassword"
                  type="password"
                  show-password-on="click"
                  placeholder="비밀번호를 다시 입력하세요"
                  spellCheck="false"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  maxlength="16"
                  minlength="6" />
                <n-flex vertical :size="4">
                  <Validation
                    :value="passwordForm.confirmPassword"
                    message="두 비밀번호가 일치해야 합니다"
                    :validator="(value: string) => value === passwordForm.password && value !== ''" />
                </n-flex>
              </n-flex>
            </n-form-item>

            <n-flex :size="16" class="mt-30px">
              <n-button @click="goBack" class="flex-1">이전 단계</n-button>
              <n-button
                :loading="submitLoading"
                tertiary
                style="color: #fff"
                @click="submitNewPassword"
                class="flex-1 gradient-button">
                제출
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

          <div class="mt-16px text-18px">비밀번호 수정 성공</div>
          <div class="mt-16px text-14px text-#666">비밀번호가 성공적으로 재설정되었습니다. 새 비밀번호로 로그인할 수 있습니다</div>
        </div>
      </n-flex>
    </n-config-provider>
  </MobileLayout>
</template>

<script setup lang="ts">
import { lightTheme } from 'naive-ui'
import Validation from '@/components/common/Validation.vue'
import { forgetPassword, getCaptcha, sendCaptcha } from '@/utils/ImRequestUtils'
import { validateAlphaNumeric, validateSpecialChar } from '@/utils/Validate'
import router from '@/router'

// Web Worker 가져오기
const timerWorker = new Worker(new URL('../../workers/timer.worker.ts', import.meta.url))

// 단계 상태
const currentStep = ref(1)
const stepStatus = ref<'error' | 'finish' | 'process' | 'wait' | undefined>('process')

// 1단계 폼 데이터
const formRef = ref(null)
const formData = ref({
  email: '',
  emailCode: '',
  uuid: '' // 이미지 인증 코드 uuid
})

// 이미지 인증 코드 관련
const captchaImage = ref('')
const sendBtnDisabled = ref(false)
const emailCodeBtnText = ref('인증 코드 전송')
const countDown = ref(60)
const verifyLoading = ref(false)
// 인증 코드 전송 로딩 상태
const sendingEmailCode = ref(false)
// 마지막 이미지 인증 코드 가져온 시간
const lastCaptchaTime = ref(0)
// 이미지 인증 코드 가져오기 간격 시간(밀리초)
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
    { required: true, message: '이메일 주소를 입력해주세요', trigger: 'blur' },
    {
      pattern: /^[a-zA-Z0-9_-]+@[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)+$/,
      message: '올바른 이메일 형식을 입력해주세요',
      trigger: 'blur'
    }
  ],
  emailCode: [
    { required: true, message: '이메일 인증 코드를 입력해주세요', trigger: 'input' },
    { min: 6, max: 6, message: '인증 코드는 6자리입니다', trigger: 'blur' }
  ]
}

// 2단계 비밀번호 폼
const passwordFormRef = ref(null)
const passwordForm = ref({
  password: '',
  confirmPassword: ''
})
const submitLoading = ref(false)

// 비밀번호 유효성 검사 규칙
const passwordRules = {
  password: [
    { required: true, message: '새 비밀번호를 입력해주세요', trigger: 'blur' },
    { min: 6, max: 16, message: '비밀번호 길이는 6-16자여야 합니다', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '비밀번호를 확인해주세요', trigger: 'blur' },
    {
      validator: (_: any, value: string) => {
        return value === passwordForm.value.password
      },
      message: '두 번 입력한 비밀번호가 일치하지 않습니다',
      trigger: 'blur'
    }
  ]
}

// 다음 단계 버튼 비활성화 상태
const nextDisabled = computed(() => {
  return !(formData.value.email && formData.value.emailCode)
})

/** 공백 입력 불가 */
const noSideSpace = (value: string) => !value.startsWith(' ') && !value.endsWith(' ')

/** 비밀번호 검증 함수 */
const validateMinLength = (value: string) => value.length >= 6

// 이미지 인증 코드 가져오기
const getCaptchaImage = async () => {
  // 새 인증 코드를 가져올 수 있는지 확인
  if (captchaInCooldown.value) {
    // 남은 쿨다운 시간 표시
    window.$message.warning(`요청이 너무 빈번합니다. ${captchaCooldownRemaining.value}초 후에 다시 시도해주세요`)
    return
  }

  try {
    // 마지막 가져온 시간 업데이트 및 쿨다운 상태 설정
    lastCaptchaTime.value = Date.now()
    captchaInCooldown.value = true

    const result = await getCaptcha()
    captchaImage.value = result.img
    formData.value.uuid = result.uuid

    // 가져오기 성공 후 쿨다운 타이머 시작
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
    window.$message.warning('이메일을 먼저 입력해주세요')
    return
  }

  if (!/^[a-zA-Z0-9_-]+@[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)+$/.test(formData.value.email)) {
    window.$message.warning('올바른 이메일 형식을 입력해주세요')
    return
  }

  // loading 상태 설정
  sendingEmailCode.value = true

  try {
    await sendCaptcha({
      email: formData.value.email,
      uuid: formData.value.uuid,
      operationType: 'forgot',
      templateCode: 'PASSWORD_EDIT'
    })

    window.$message.success('인증 코드가 이메일로 전송되었습니다')

    // 인터페이스가 성공적으로 반환된 후에만 카운트다운 시작 - Web Worker 사용
    sendBtnDisabled.value = true
    countDown.value = 60
    emailCodeBtnText.value = `${countDown.value}초 후 다시 받기`

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
    // 성공 또는 실패 여부에 관계없이 loading 상태를 닫아야 함
    sendingEmailCode.value = false
  }
}

// 이메일 인증
const verifyEmail = async () => {
  if (!formRef.value) return

  try {
    await (formRef.value as any).validate()
    verifyLoading.value = true

    // 여기서는 폼만 검증하고, 실제로 백엔드 인터페이스를 호출할 필요 없이 바로 다음 단계로 이동
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

    setTimeout(() => {
      router.push('/mobile/login')
    }, 2000)
  } catch (error) {
    console.error('비밀번호 재설정 실패', error)
    submitLoading.value = false
  }
}

// Worker 메시지 수신
timerWorker.onmessage = (e) => {
  const { type, msgId, remainingTime } = e.data

  if (msgId === EMAIL_TIMER_ID) {
    // 이메일 인증 코드 타이머 메시지 처리
    if (type === 'debug') {
      // 카운트다운 표시 업데이트
      const secondsRemaining = Math.ceil(remainingTime / 1000)
      countDown.value = secondsRemaining
      emailCodeBtnText.value = `${secondsRemaining}초 후 다시 받기`
    } else if (type === 'timeout') {
      // 타이머 종료
      sendBtnDisabled.value = false
      emailCodeBtnText.value = '다시 받기'
    }
  } else if (msgId === CAPTCHA_TIMER_ID) {
    // 이미지 인증 코드 쿨다운 타이머 메시지 처리
    if (type === 'debug') {
      // 남은 쿨다운 시간 업데이트, 사용자가 클릭할 때 표시
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
  emailCodeBtnText.value = '다시 받기'
}

// 페이지 로드 시 인증 코드 가져오기
onMounted(async () => {
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
</style>
