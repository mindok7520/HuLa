<template>
  <!-- 화면 잠금 페이지 -->
  <div
    data-tauri-drag-region
    class="login-box overflow-y-hidden rounded-8px select-none absolute top-0 left-0 w-full h-full z-9999 transition-all duration-300 ease-in-out">
    <ActionBar class="absolute top-0 right-0 z-99999" :current-label="appWindow.label" :shrink="false" />

    <Transition name="slide-fade" appear>
      <!-- 배경 화면 인터페이스 -->
      <div v-if="!isUnlockPage" @click.stop="isUnlockPage = true" class="size-full rounded-8px">
        <n-flex vertical align="center" :size="120" class="size-full mt-10%">
          <n-flex vertical align="center" :size="20" class="will-change-auto will-change-contents">
            <p class="text-(100px [--chat-text-color]) font-500">{{ currentTime }}</p>
            <n-flex align="center" :size="30" class="text-(30px [--chat-text-color])">
              <p>{{ currentMonthAndDate }}</p>
              <p>{{ currentWeekday }}</p>
            </n-flex>
          </n-flex>

          <n-flex vertical justify="center" align="center" :size="20" class="tips">
            <svg><use href="#search"></use></svg>
            <p class="text-(16px [--chat-text-color]) text-center leading-24px">
              {{ t('message.lock_screen.tip_description') }}
            </p>
          </n-flex>
        </n-flex>
      </div>

      <!-- 잠금 해제 인터페이스 -->
      <n-flex
        v-else
        data-tauri-drag-region
        vertical
        align="center"
        justify="center"
        :size="16"
        class="h-full backdrop-blur-md rounded-8px">
        <n-flex vertical align="center" justify="center" :size="30" class="mt--75px">
          <n-avatar
            round
            style="border: 2px solid #f1f1f1"
            :size="120"
            :src="AvatarUtils.getAvatarUrl(userStore.userInfo!.avatar!)" />
          <p class="text-(24px [--chat-text-color]) font-500">{{ userStore.userInfo!.name }}</p>

          <!-- 비밀번호 입력란 -->
          <n-config-provider :theme="lightTheme">
            <n-input
              v-if="!isLogining && !isWrongPassword"
              ref="inputInstRef"
              style="
                width: 320px;
                border: 2px solid rgba(255, 255, 255, 0.1);
                border-bottom-color: rgba(19, 152, 127, 1);
                background-color: #404040;
                color: #fff;
              "
              spellCheck="false"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              :placeholder="t('message.lock_screen.password_placeholder')"
              show-password-on="click"
              type="password"
              @keyup.enter.prevent="unlock"
              v-model:value="password">
              <template #suffix>
                <n-popover trigger="hover">
                  <template #trigger>
                    <svg
                      @click.stop="unlock"
                      class="size-16px color-#e3e3e3 mr-6px p-[4px_6px] rounded-8px cursor-pointer transition-all duration-300 ease-in-out hover:bg-#13987fe6">
                      <use href="#arrow-right"></use>
                    </svg>
                  </template>
                  <p>{{ t('message.lock_screen.enter_system_tooltip') }}</p>
                </n-popover>
              </template>
            </n-input>
          </n-config-provider>

          <!-- 로그인 시 표시되는 텍스트 -->
          <n-flex vertical align="center" justify="center" :size="30" v-if="isLogining && !isWrongPassword">
            <img class="size-42px" src="@/assets/img/loading-one.svg" alt="" />
            <p class="text-(20px [--chat-text-color])">{{ t('message.lock_screen.unlocking') }}</p>
          </n-flex>

          <!-- 비밀번호가 틀렸을 때 표시 -->
          <n-flex v-if="isWrongPassword" vertical justify="center" align="center" :size="30">
            <p class="text-(18px [--chat-text-color])">{{ t('message.lock_screen.wrong_password') }}</p>
            <p
              @click="init"
              class="w-120px bg-[rgba(255,255,255,0.1)] backdrop-blur-xl cursor-pointer p-10px rounded-8px text-(14px #323232 center) font-500">
              {{ t('message.lock_screen.confirm_button') }}
            </p>
          </n-flex>
        </n-flex>

        <n-flex
          v-if="!isLogining && !isWrongPassword"
          justify="space-around"
          align="center"
          :size="0"
          class="options text-(14px [--chat-text-color])">
          <p @click="isUnlockPage = false">{{ t('message.lock_screen.return_action') }}</p>
          <p @click="logout">{{ t('message.lock_screen.logout_action') }}</p>
          <p>{{ t('message.lock_screen.forgot_password') }}</p>
          <p @click="unlock">{{ t('message.lock_screen.enter_system_action') }}</p>
        </n-flex>
      </n-flex>
    </Transition>
  </div>
</template>
<script setup lang="ts">
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { onKeyStroke } from '@vueuse/core'
import dayjs from 'dayjs'
import { type InputInst, lightTheme } from 'naive-ui'
import { useLogin } from '@/hooks/useLogin.ts'
import { useSettingStore } from '@/stores/setting.ts'
import { useUserStore } from '@/stores/user.ts'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { getWeekday } from '@/utils/ComputedTime'
import { useI18n } from 'vue-i18n'

const appWindow = WebviewWindow.getCurrent()
const settingStore = useSettingStore()
const userStore = useUserStore()
const { lockScreen } = storeToRefs(settingStore)
const { logout } = useLogin()
const { t } = useI18n()
/** 잠금 해제 비밀번호 */
const password = ref('')
/** 잠금 해제 페이지 여부 */
const isUnlockPage = ref(false)
/** 로그인 중 여부 */
const isLogining = ref(false)
/** 비밀번호가 틀렸을 때 표시 */
const isWrongPassword = ref(false)
/** 현재 시간 */
const currentTime = ref(dayjs().format('HH:mm'))
/** 현재 월/일 */
const currentMonthAndDate = ref(dayjs().format('MM/DD'))
// const currentMonthAndDate = ref(new Date().toLocaleDateString('chinese', { month: 'long', day: 'numeric' }))
/** 현재 요일 */
const currentWeekday = ref(getWeekday(new Date().toLocaleString()))
/** 현재 시간 계산 타이머 */
let intervalId: NodeJS.Timeout | null = null
/** 비밀번호 입력란 인스턴스 */
const inputInstRef = ref<InputInst | null>(null)
/** 화이트리스트 창 (잠금 시 숨기지 않는 창) */
const whitelistWindows = ['home', 'tray', 'capture', 'checkupdate', 'notify']
/** 숨겨진 창 목록 */
const hiddenWindows = ref<string[]>([])

watch(isUnlockPage, (val) => {
  if (val) {
    /** Enter 키 이벤트 중복 트리거 방지를 위해 300ms 지연 후 포커스 자동 획득 */
    setTimeout(() => {
      inputInstRef.value?.focus()
    }, 300)
  }
})

watch(isWrongPassword, (val) => {
  if (val) {
    onKeyStroke('Enter', (e) => {
      e.preventDefault()
      init()
    })
  }
})

/** 잠금 해제 */
const unlock = () => {
  if (password.value === '') {
    window.$message.error(t('message.lock_screen.toast_empty_password'))
  } else {
    isLogining.value = true
    if (password.value === lockScreen.value.password) {
      setTimeout(() => {
        lockScreen.value.enable = false
        isLogining.value = false
      }, 1000)
    } else {
      setTimeout(() => {
        isWrongPassword.value = true
      }, 300)
    }
  }
}

/** 로그인 상태 초기화 */
const init = () => {
  if (isWrongPassword.value) {
    isWrongPassword.value = false
    isLogining.value = false
    setTimeout(() => {
      inputInstRef.value?.focus()
    }, 600)
    password.value = ''
  }
}

/** 다른 창 숨기기 */
const hideOtherWindows = async () => {
  const allWindows = await WebviewWindow.getAll()
  const windowsToHide = allWindows.filter(
    (window) => !whitelistWindows.includes(window.label) && window.label !== 'lockScreen'
  )

  for (const window of windowsToHide) {
    await window.hide()
    hiddenWindows.value.push(window.label)
  }
}

/** 이전에 숨겨진 창 표시 */
const showHiddenWindows = async () => {
  for (const windowLabel of hiddenWindows.value) {
    const window = await WebviewWindow.getByLabel(windowLabel)
    if (window) {
      await window.show()
    }
  }
  hiddenWindows.value = []
}

// 잠금 화면 상태 변화 감지
watchEffect(() => {
  if (!lockScreen.value.enable) {
    // 잠금 해제 시 이전에 숨겨진 창 표시
    showHiddenWindows()
  }
})

onMounted(() => {
  intervalId = setInterval(() => {
    currentTime.value = dayjs().format('HH:mm')
    currentMonthAndDate.value = dayjs().format('MM/DD')
    currentWeekday.value = getWeekday(new Date().toLocaleString())
  }, 1000)

  if (!isUnlockPage.value) {
    onKeyStroke('Enter', (e) => {
      e.preventDefault()
      isUnlockPage.value = true
    })
  }

  // 잠금 시 다른 창을 숨기고 해제 시 표시
  hideOtherWindows()
})

onUnmounted(() => {
  if (intervalId) {
    clearInterval(intervalId)
  }
})
</script>
<style scoped lang="scss">
@use '@/styles/scss/global/login-bg';

.options {
  @apply w-320px;
  p {
    @apply cursor-pointer select-none;
  }
}

.tips {
  @apply cursor-pointer w-240px p-12px rounded-8px transition-all duration-300 ease-in-out;
  svg {
    @apply size-24px color-#f1f1f1 p-4px bg-#80808080 rounded-8px;
  }
}

:deep(.hover-box),
:deep(.action-close) {
  svg {
    color: #fff;
  }
}
:deep(.hover-box) {
  &:hover {
    background-color: #464646;
  }
}
:deep(.n-input .n-input__input-el, .n-input .n-input__textarea-el) {
  color: #fff;
}

/*
  애니메이션 시작과 종료 시 서로 다른 시간 및 속도 곡선을 사용할 수 있습니다.
*/
.slide-fade-enter-active {
  transition: all 0.2s ease-in-out;
}

.slide-fade-leave-active {
  transition: all 0.6s cubic-bezier(1, 0.5, 0.8, 1);
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateY(20px);
  opacity: 0;
}
</style>
