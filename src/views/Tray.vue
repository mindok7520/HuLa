<template>
  <n-flex v-if="isTrayMenuShow" vertical :size="6" class="tray">
    <n-flex vertical :size="6">
      <n-flex
        v-for="item in stateList.slice(0, 6)"
        :key="item.id"
        v-memo="[item.id, item.title, item.url, stateId]"
        align="center"
        :size="10"
        @click="toggleStatus(item)"
        class="p-6px rounded-4px hover:bg-[--tray-hover]">
        <img class="size-14px" :src="item.url" alt="" />
        <span class="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
          {{ translateStateTitle(item.title) }}
        </span>
      </n-flex>
      <n-flex
        @click="createWebviewWindow(t('message.tray.online_status_window_title'), 'onlineStatus', 320, 480)"
        align="center"
        :size="10"
        class="p-6px rounded-4px hover:bg-[--tray-hover]"
        v-once>
        <svg class="size-14px">
          <use href="#more"></use>
        </svg>
        <span class="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{{ t('message.tray.more_status') }}</span>
      </n-flex>

      <component :is="division" />
      <n-flex
        @click="toggleMessageSound"
        align="center"
        :size="10"
        class="p-[8px_6px] rounded-4px hover:bg-[--tray-hover]">
        <span>{{ messageSound ? t('message.tray.mute_all') : t('message.tray.unmute_all') }}</span>
      </n-flex>

      <component :is="division" />
      <n-flex
        @click="checkWinExist('home')"
        align="center"
        :size="10"
        class="p-[8px_6px] rounded-4px hover:bg-[--tray-hover]"
        v-once>
        <span>{{ t('message.tray.open_main_panel') }}</span>
      </n-flex>

      <component :is="division" />
      <n-flex
        @click="handleExit"
        align="center"
        :size="10"
        class="p-[8px_6px] rounded-4px hover:bg-[--tray-hover-e]"
        v-once>
        <span>{{ t('message.tray.exit') }}</span>
      </n-flex>
    </n-flex>
  </n-flex>

  <n-flex v-else vertical :size="6" class="tray">
    <n-flex
      @click="handleExit"
      align="center"
      :size="10"
      class="p-[8px_6px] rounded-4px hover:bg-[--tray-hover-e]"
      v-once>
      <span>{{ t('message.tray.exit') }}</span>
    </n-flex>
  </n-flex>
</template>
<script setup lang="tsx">
import { TrayIcon } from '@tauri-apps/api/tray'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { exit } from '@tauri-apps/plugin-process'
import { useWindow } from '@/hooks/useWindow.ts'
import type { UserState } from '@/services/types'
import { useGlobalStore } from '@/stores/global.ts'
import { useSettingStore } from '@/stores/setting.ts'
import { useUserStore } from '@/stores/user'
import { useUserStatusStore } from '@/stores/userStatus'
import { changeUserState } from '@/utils/ImRequestUtils'
import { isWindows } from '@/utils/PlatformConstants'
import { useI18n } from 'vue-i18n'

const appWindow = WebviewWindow.getCurrent()
const { checkWinExist, createWebviewWindow, resizeWindow } = useWindow()
const userStatusStore = useUserStatusStore()
const userStore = useUserStore()
const settingStore = useSettingStore()
const globalStore = useGlobalStore()
const { lockScreen } = storeToRefs(settingStore)
const { stateList, stateId } = storeToRefs(userStatusStore)
const { tipVisible, isTrayMenuShow } = storeToRefs(globalStore)
const { t } = useI18n()
const isFocused = ref(false)
// 상태 표시줄 아이콘 표시 여부
const iconVisible = ref(false)

// 메시지 알림음 상태
const messageSound = computed({
  get: () => settingStore.notification.messageSound,
  set: (value: boolean) => {
    settingStore.setMessageSoundEnabled(value)
  }
})

const division = () => {
  return <div class={'h-1px bg-[--line-color] w-full'}></div>
}

const translateStateTitle = (title?: string) => {
  if (!title) return ''
  const key = `auth.onlineStatus.states.${title}`
  const translated = t(key)
  return translated === key ? title : translated
}

const handleExit = () => {
  /** 종료 시 잠금 화면 끄기 */
  lockScreen.value.enable = false
  if (localStorage.getItem('wsLogin')) {
    localStorage.removeItem('wsLogin')
  }
  exit(0)
}

const toggleStatus = async (item: UserState) => {
  try {
    await changeUserState({ id: item.id })

    stateId.value = item.id
    userStore.userInfo!.userStateId = item.id
    appWindow.hide()
  } catch (error) {
    console.error('상태 업데이트 실패:', error)
    appWindow.hide()
  }
}

const toggleMessageSound = () => {
  appWindow.hide()
  nextTick(() => {
    messageSound.value = !messageSound.value
  })
}

let blinkTask: NodeJS.Timeout | null = null
let homeFocusUnlisten: (() => void) | null = null
let homeBlurUnlisten: (() => void) | null = null

const startBlinkTask = () => {
  blinkTask = setInterval(async () => {
    // 타이머 트리거 시 아이콘 상태 전환
    const tray = await TrayIcon.getById('tray')
    tray?.setIcon(iconVisible.value ? 'tray/icon.png' : null)
    iconVisible.value = !iconVisible.value
  }, 500)
}

const stopBlinkTask = async () => {
  if (blinkTask) {
    clearInterval(blinkTask)
    blinkTask = null

    // 아이콘이 사라지는 것을 방지하기 위해 트레이 아이콘을 기본 상태로 복원
    try {
      const tray = await TrayIcon.getById('tray')
      await tray?.setIcon('tray/icon.png')
    } catch (e) {
      console.warn('[Tray] 트레이 아이콘 복원 실패:', e)
    }
    iconVisible.value = false
  }
}

watchEffect(async () => {
  if (isWindows()) {
    if (tipVisible.value && !isFocused.value) {
      startBlinkTask()
    } else {
      stopBlinkTask() // 아이콘 깜박임 중지
    }
  }
})

// 트레이 창 크기 조정 이벤트 수신
const handleTrayResize = async () => {
  const islogin = await WebviewWindow.getByLabel('home')
  await resizeWindow('tray', 130, islogin ? 356 : 44)
}

onMounted(async () => {
  // 시스템 배율 변경 이벤트 수신, 트레이 창 크기 자동 조정
  window.addEventListener('resize-needed', handleTrayResize)

  if (isWindows()) {
    homeFocusUnlisten = await appWindow.listen('home_focus', async () => {
      isFocused.value = true
      await stopBlinkTask()
    })

    homeBlurUnlisten = await appWindow.listen('home_blur', () => {
      isFocused.value = false
    })
  }
})

onUnmounted(() => {
  window.removeEventListener('resize-needed', handleTrayResize)
  if (homeFocusUnlisten) {
    homeFocusUnlisten()
    homeFocusUnlisten = null
  }
  if (homeBlurUnlisten) {
    homeBlurUnlisten()
    homeBlurUnlisten = null
  }
  stopBlinkTask()
})
</script>

<style scoped lang="scss">
.tray {
  @apply bg-[--center-bg-color] size-full p-8px box-border select-none text-[--text-color] text-12px;
}
</style>
