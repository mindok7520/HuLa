<template>
  <n-config-provider :theme="naiveTheme" data-tauri-drag-region class="login-box size-full rounded-8px select-none">
    <!--상단 작업 표시줄-->
    <ActionBar :max-w="false" :shrink="false" proxy data-tauri-drag-region />

    <n-flex justify="center" class="mt-15px" data-tauri-drag-region>
      <img src="/hula.png" class="w-140px h-60px drop-shadow-xl" alt="" data-tauri-drag-region />
    </n-flex>

    <!-- QR 코드 -->
    <n-flex justify="center" class="mt-25px" data-tauri-drag-region>
      <n-skeleton v-if="loading" style="border-radius: 12px" :width="204" :height="204" :sharp="false" size="medium" />
      <div v-else class="relative">
        <n-qr-code
          :size="180"
          class="rounded-12px"
          :class="{ blur: scanStatus.show || refreshing }"
          :value="qrCodeValue"
          :color="qrCodeColor"
          :bg-color="qrCodeBgColor"
          :type="qrCodeType"
          :icon-src="qrCodeIcon"
          :icon-size="36"
          :icon-margin="2"
          :error-correction-level="qrErrorCorrectionLevel"
          @click="refreshQRCode" />
        <!-- QR 코드 상태 -->
        <n-flex
          v-if="scanStatus.show"
          vertical
          :size="12"
          align="center"
          class="w-full absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
          style="pointer-events: none">
          <svg class="size-42px animate-pulse">
            <use :href="`#${scanStatus.icon}`"></use>
          </svg>
          <span class="text-(14px #e3e3e3)">{{ scanStatusText }}</span>
        </n-flex>

        <n-flex
          v-if="refreshing"
          vertical
          :size="12"
          align="center"
          class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
          style="pointer-events: none">
          <n-spin size="small" />
          <span class="text-(16px #e3e3e3)">{{ t('login.qr.overlay.refreshing') }}</span>
        </n-flex>
      </div>
    </n-flex>

    <n-flex justify="center" class="mt-15px text-(14px #808080)">
      {{ loadText }}
    </n-flex>

    <!-- 하단 작업 표시줄 -->
    <n-flex justify="center" class="text-14px mt-48px" data-tauri-drag-region>
      <div class="color-#13987f cursor-pointer" @click="router.push('/login')">
        {{ t('login.qr.actions.account_login') }}
      </div>
      <div class="w-1px h-14px bg-#ccc dark:bg-#707070"></div>
      <div
        class="color-#13987f cursor-pointer"
        @click="createWebviewWindow(t('login.qr.actions.register_title'), 'register', 600, 600)">
        {{ t('login.qr.actions.register') }}
      </div>
    </n-flex>
  </n-config-provider>
</template>
<script setup lang="ts">
import { invoke } from '@tauri-apps/api/core'
import { darkTheme, lightTheme } from 'naive-ui'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useWindow } from '@/hooks/useWindow.ts'
import router from '@/router'
import { getEnhancedFingerprint } from '@/services/fingerprint'
import { loginCommand } from '@/services/tauriCommand'
import { TauriCommand } from '@/enums'
import { useGlobalStore } from '@/stores/global'
import { useSettingStore } from '@/stores/setting'
import { checkQRStatus, generateQRCode } from '@/utils/ImRequestUtils'

const globalStore = useGlobalStore()
const settingStore = useSettingStore()
const { themes } = storeToRefs(settingStore)
const naiveTheme = computed(() => (themes.value.content === 'dark' ? darkTheme : lightTheme))
const { createWebviewWindow } = useWindow()
const { isTrayMenuShow } = storeToRefs(globalStore)
const { t } = useI18n()
type LoadTextKey = 'loading' | 'refreshing' | 'scan_hint' | 'login' | 'retry' | 'auth_pending'
type ScanStatusTextKey = 'success' | 'error' | 'auth' | 'expired' | 'fetch_failed' | 'generate_fail' | 'general_error'
const loadTextKey = ref<LoadTextKey>('loading')
const loadText = computed(() => t(`login.qr.load_text.${loadTextKey.value}`))
const loading = ref(true)
const refreshing = ref(false) // 새로고침 중 여부
const qrCodeValue = ref('')
const qrCodeResp = ref()
const qrCodeColor = ref('#000000')
const qrCodeBgColor = ref('#FFFFFF')
const qrCodeType = ref('canvas' as const)
const qrCodeIcon = ref('/logo.png')
const qrErrorCorrectionLevel = ref('H' as const)
const pollInterval = ref<NodeJS.Timeout | null>(null)
const pollStartAt = ref<number | null>(null)
const MAX_POLL_DURATION = 5 * 60 * 1000 // 5분 타임아웃, 장시간 메모리 점유 방지
const pollingRequesting = ref(false)
const confirmedHandled = ref(false)

const scanStatus = ref<{
  status: 'error' | 'success' | 'auth'
  icon: 'cloudError' | 'success' | 'Security'
  textKey: ScanStatusTextKey | ''
  show: boolean
}>({ status: 'success', icon: 'success', textKey: '', show: false })

const scanStatusText = computed(() =>
  scanStatus.value.textKey ? t(`login.qr.overlay.${scanStatus.value.textKey}`) : ''
)

/** QR 코드 새로고침 */
const refreshQRCode = () => {
  if (scanStatus.value.status !== 'error' && scanStatus.value.status !== 'auth') {
    return
  }

  refreshing.value = true
  loadTextKey.value = 'refreshing'

  scanStatus.value = {
    status: 'success',
    icon: 'success',
    textKey: '',
    show: false
  }

  // 이전 폴링 먼저 지우기
  if (pollInterval.value) {
    clearInterval(pollInterval.value)
    pollInterval.value = null
  }
  pollStartAt.value = null
  pollingRequesting.value = false
  confirmedHandled.value = false
  // QR 코드 재생성
  handleQRCodeLogin()
}

const clearPolling = () => {
  if (pollInterval.value) {
    clearInterval(pollInterval.value)
    pollInterval.value = null
  }
  pollStartAt.value = null
}

const handleConfirmed = async (res: any) => {
  if (confirmedHandled.value) {
    return
  }
  confirmedHandled.value = true
  clearPolling()
  try {
    await invoke(TauriCommand.UPDATE_TOKEN, {
      req: {
        uid: res.data.uid,
        token: res.data.token,
        refreshToken: res.data.refreshToken || ''
      }
    })

    await loginCommand({ uid: res.data.uid }, true).then(() => {
      scanStatus.value = {
        status: 'success',
        icon: 'success',
        textKey: 'success',
        show: true
      }
      loadTextKey.value = 'login'
    })
  } catch (error) {
    console.error('사용자 상세 정보 가져오기 실패:', error)
    confirmedHandled.value = false
    handleError('fetch_failed')
  }
}

const startPolling = () => {
  if (pollInterval.value) {
    clearInterval(pollInterval.value)
  }
  pollStartAt.value = Date.now()
  pollInterval.value = setInterval(async () => {
    // 타임아웃 보호: 5분 초과 시 자동 중지 및 팁 표시
    if (pollStartAt.value && Date.now() - pollStartAt.value > MAX_POLL_DURATION) {
      clearPolling()
      handleError('expired')
      return
    }

    if (pollingRequesting.value || confirmedHandled.value) {
      return
    }
    pollingRequesting.value = true
    try {
      const res: any = await checkQRStatus({
        qrId: qrCodeResp.value.qrId,
        clientId: localStorage.getItem('clientId') as string,
        deviceHash: qrCodeResp.value.deviceHash,
        deviceType: 'PC'
      })
      switch (res.status) {
        case 'PENDING':
          // 대기 중
          break
        case 'SCANNED':
          // 스캔됨, 확인 대기 중
          handleAuth()
          break
        case 'CONFIRMED':
          await handleConfirmed(res)
          break
        case 'EXPIRED':
          clearPolling()
          handleError('expired')
          break
        default:
          break
      }
    } catch (error) {
      if (!confirmedHandled.value) {
        handleQRCodeLogin()
      }
    } finally {
      if (!confirmedHandled.value) {
        pollingRequesting.value = false
      }
    }
  }, 2000)
}

/** QR 코드 표시 및 새로고침 처리 */
const handleQRCodeLogin = async () => {
  try {
    qrCodeResp.value = await generateQRCode()
    qrCodeValue.value = JSON.stringify({ type: 'login', qrId: qrCodeResp.value.qrId })
    loadTextKey.value = 'scan_hint'
    loading.value = false
    refreshing.value = false

    if (scanStatus.value.show) {
      scanStatus.value.show = false
      scanStatus.value.textKey = ''
    }

    // 폴링 시작
    confirmedHandled.value = false
    pollingRequesting.value = false
    startPolling()
  } catch (error) {
    handleError('generate_fail')
  }
}

/** 실패 시나리오 처리 */
const handleError = (key: ScanStatusTextKey = 'general_error') => {
  loading.value = false
  scanStatus.value = {
    status: 'error',
    icon: 'cloudError',
    textKey: key,
    show: true
  }
  loadTextKey.value = 'retry'
}

onUnmounted(() => {
  // 컴포넌트 언마운트 시 폴링 지우기
  clearPolling()
})

/** 권한 부여 시나리오 처리 */
const handleAuth = () => {
  loading.value = false
  scanStatus.value = {
    status: 'auth',
    icon: 'Security',
    textKey: 'auth',
    show: true
  }
  loadTextKey.value = 'auth_pending'
}

onMounted(async () => {
  isTrayMenuShow.value = false
  // 이번 로그인 장치 지문 저장
  const clientId = await getEnhancedFingerprint()
  localStorage.setItem('clientId', clientId)

  handleQRCodeLogin()
})
</script>

<style scoped lang="scss">
@use '@/styles/scss/global/login-bg';
</style>
