<template>
  <!-- user-select: none 요소 선택 불가 -->
  <div
    :data-tauri-drag-region="isDrag"
    :class="isCompatibility() ? 'flex justify-end select-none' : 'h-24px select-none w-full'">
    <!-- win 및 linux DOM -->
    <template v-if="isCompatibility()">
      <div class="w-full flex items-center justify-between" data-tauri-drag-region>
        <!-- 사용자 정의 아이콘: Windows/Linux는 왼쪽에 배치 -->
        <div class="h-24px flex items-center gap-10px pl-8px">
          <slot></slot>
        </div>

        <div class="flex items-center">
          <!-- 로그인 창의 프록시 버튼 -->
          <div
            v-if="proxy"
            @click="router.push('/network')"
            :class="{ network: isWindows() }"
            class="w-30px h-24px flex-center hover-box">
            <svg
              :class="[iconColor !== '' ? `color-${iconColor}` : 'color-[--action-bar-icon-color]']"
              class="size-16px cursor-pointer">
              <use href="#settings"></use>
            </svg>
          </div>
          <!-- 최상단 고정 -->
          <div v-if="topWinLabel !== void 0" @click="handleAlwaysOnTop" class="hover-box">
            <n-popover trigger="hover">
              <template #trigger>
                <svg
                  v-if="alwaysOnTopStatus"
                  :class="[iconColor !== '' ? `color-${iconColor}` : 'color-[--action-bar-icon-color]']"
                  class="size-14px outline-none cursor-pointer">
                  <use href="#onTop"></use>
                </svg>
                <svg
                  v-else
                  :class="[iconColor !== '' ? `color-${iconColor}` : 'color-[--action-bar-icon-color]']"
                  class="size-16px outline-none cursor-pointer">
                  <use href="#notOnTop"></use>
                </svg>
              </template>
              <span v-if="alwaysOnTopStatus">{{ t('components.actionBar.always_on_top.enabled') }}</span>
              <span v-else>{{ t('components.actionBar.always_on_top.disabled') }}</span>
            </n-popover>
          </div>
          <!-- 페이지 축소 -->
          <div v-if="shrink" @click="shrinkWindow" class="hover-box">
            <svg
              :class="[iconColor !== '' ? `color-${iconColor}` : 'color-[--action-bar-icon-color]']"
              class="size-16px cursor-pointer">
              <use href="#left-bar"></use>
            </svg>
          </div>
          <!-- 최소화 -->
          <div v-if="minW" @click="appWindow.minimize()" class="hover-box">
            <svg
              :class="[iconColor !== '' ? `color-${iconColor}` : 'color-[--action-bar-icon-color]']"
              class="size-24px opacity-66 cursor-pointer">
              <use href="#maximize"></use>
            </svg>
          </div>
          <!-- 최대화 -->
          <div v-if="maxW" @click="restoreWindow" class="hover-box">
            <svg
              v-show="!windowMaximized"
              :class="[iconColor !== '' ? `color-${iconColor}` : 'color-[--action-bar-icon-color]']"
              class="size-18px cursor-pointer">
              <use href="#rectangle-small"></use>
            </svg>
            <svg
              v-show="windowMaximized"
              :class="[iconColor !== '' ? `color-${iconColor}` : 'color-[--action-bar-icon-color]']"
              class="size-16px cursor-pointer">
              <use href="#internal-reduction"></use>
            </svg>
          </div>
          <!-- 창 닫기 -->
          <div
            v-if="closeW"
            @click="handleCloseWin"
            :class="{ windowMaximized: 'rounded-rt-8px' }"
            class="action-close">
            <svg
              :class="[iconColor !== '' ? `color-${iconColor}` : 'color-[--action-bar-icon-color]']"
              class="size-14px cursor-pointer">
              <use href="#close"></use>
            </svg>
          </div>
        </div>
      </div>
    </template>
    <template v-else>
      <div class="h-24px w-full flex items-center justify-end pr-8px select-none" data-tauri-drag-region>
        <div class="drag-fill" data-tauri-drag-region></div>
        <div class="flex items-center gap-10px">
          <slot></slot>
        </div>
      </div>
    </template>
    <!-- 트레이로 최소화 알림 창 -->
    <n-modal v-if="!tips.notTips" v-model:show="tipsRef.show" class="rounded-8px">
      <div class="bg-[--bg-popover] w-290px h-full p-6px box-border flex flex-col">
        <svg @click="tipsRef.show = false" class="size-12px ml-a cursor-pointer select-none">
          <use href="#close"></use>
        </svg>
        <n-flex vertical :size="20" class="p-[22px_10px_10px_22px] select-none">
          <span class="text-16px">{{ t('components.actionBar.close_prompt.title') }}</span>
          <label class="text-(14px #707070) flex gap-6px lh-16px items-center">
            <n-radio :checked="tipsRef.type === CloseBxEnum.HIDE" @change="tipsRef.type = CloseBxEnum.HIDE" />
            <span>{{ t('components.actionBar.close_prompt.hide_to_tray') }}</span>
          </label>
          <label class="text-(14px #707070) flex gap-6px lh-16px items-center">
            <n-radio :checked="tipsRef.type === CloseBxEnum.CLOSE" @change="tipsRef.type = CloseBxEnum.CLOSE" />
            <span>{{ t('components.actionBar.close_prompt.exit_app') }}</span>
          </label>
          <label class="text-(12px #909090) flex gap-6px justify-end items-center">
            <n-checkbox size="small" v-model:checked="tipsRef.notTips" />
            <span>{{ t('components.actionBar.close_prompt.no_prompt') }}</span>
          </label>

          <n-flex justify="end">
            <n-button @click="handleConfirm" class="w-78px" color="#13987f">
              {{ t('components.common.confirm') }}
            </n-button>
            <n-button @click="tipsRef.show = false" class="w-78px" secondary>
              {{ t('components.common.cancel') }}
            </n-button>
          </n-flex>
        </n-flex>
      </div>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { emit } from '@tauri-apps/api/event'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { info } from '@tauri-apps/plugin-log'
import { exit } from '@tauri-apps/plugin-process'
import { CloseBxEnum, EventEnum, MittEnum } from '@/enums'
import { useMitt } from '@/hooks/useMitt.ts'
import { useWindow } from '@/hooks/useWindow.ts'
import router from '@/router'
import { useAlwaysOnTopStore } from '@/stores/alwaysOnTop.ts'
import { useSettingStore } from '@/stores/setting.ts'
import { isCompatibility, isMac, isWindows } from '@/utils/PlatformConstants'

const { t } = useI18n()
const appWindow = WebviewWindow.getCurrent()
const {
  topWinLabel,
  proxy = false,
  minW = true,
  maxW = true,
  closeW = true,
  shrink = true,
  shrinkStatus = true,
  isDrag = true,
  iconColor = ''
} = defineProps<{
  minW?: boolean
  maxW?: boolean
  closeW?: boolean
  shrink?: boolean
  topWinLabel?: string
  currentLabel?: string
  shrinkStatus?: boolean
  proxy?: boolean
  isDrag?: boolean
  iconColor?: string
}>()
const { getWindowTop, setWindowTop } = useAlwaysOnTopStore()
const settingStore = useSettingStore()
const { tips, escClose } = storeToRefs(settingStore)
const { resizeWindow } = useWindow()
const tipsRef = reactive({
  type: tips.value.type,
  notTips: tips.value.notTips,
  show: false
})
// 창 최대화 상태 여부
const windowMaximized = ref(false)
// 창 최상단 고정 상태 여부
const alwaysOnTopStatus = computed(() => {
  if (topWinLabel === void 0) return false
  return getWindowTop(topWinLabel)
})

// macOS 닫기 버튼 가로채기 unlisten 함수
let unlistenCloseRequested: (() => void) | null = null
// resized 이벤트 unlisten 함수
let unlistenResized: (() => void) | null = null
// 프로그램 내부에서 트리거된 닫기 작업인지 여부
let isProgrammaticClose = false
const handleEscKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && escClose.value) {
    handleCloseWin()
  }
}

watchEffect((onCleanup) => {
  tipsRef.type = tips.value.type
  if (alwaysOnTopStatus.value) {
    appWindow.setAlwaysOnTop(alwaysOnTopStatus.value as boolean)
  }
  if (escClose.value && isWindows()) {
    window.addEventListener('keydown', handleEscKeyDown)
    onCleanup(() => {
      window.removeEventListener('keydown', handleEscKeyDown)
    })
  } else {
    window.removeEventListener('keydown', handleEscKeyDown)
  }
})

/** 창 크기 복원 */
const restoreWindow = async () => {
  if (windowMaximized.value) {
    await appWindow.unmaximize()
  } else {
    await appWindow.maximize()
  }
}

/** 창 축소 */
const shrinkWindow = async () => {
  /** mitt를 사용하여 형제 컴포넌트 업데이트 */
  useMitt.emit(MittEnum.SHRINK_WINDOW, shrinkStatus)
  if (shrinkStatus) {
    await resizeWindow('home', 310, 720)
  } else {
    await resizeWindow('home', 960, 720)
  }
}

/** 창 최상단 고정 설정 */
const handleAlwaysOnTop = async () => {
  if (topWinLabel !== void 0) {
    const isTop = !alwaysOnTopStatus.value
    setWindowTop(topWinLabel, isTop)
    await appWindow.setAlwaysOnTop(isTop)
  }
}

/** 확인 클릭 시 */
const handleConfirm = async () => {
  tips.value.type = tipsRef.type
  tips.value.notTips = tipsRef.notTips
  tipsRef.show = false
  if (tips.value.type === CloseBxEnum.CLOSE) {
    // 프로그램 내부 닫기 플래그 설정
    isProgrammaticClose = true
    await emit(EventEnum.EXIT)
  } else {
    await nextTick(() => {
      appWindow.hide()
    })
  }
}

// 창 확대 상태 통합 업데이트 (macOS는 "최대화 또는 전체 화면"으로 간주, 다른 플랫폼은 "최대화"만 해당)
const updateWindowMaximized = async () => {
  const maximized = await appWindow.isMaximized()
  if (isMac()) {
    const fullscreen = await appWindow.isFullscreen()
    windowMaximized.value = maximized || fullscreen
  } else {
    windowMaximized.value = maximized
  }
}

/** 창 닫기 이벤트 처리 */
const handleCloseWin = async () => {
  if (appWindow.label === 'home') {
    if (!tips.value.notTips) {
      tipsRef.show = true
    } else {
      if (tips.value.type === CloseBxEnum.CLOSE) {
        await emit(EventEnum.EXIT)
      } else {
        await nextTick(() => {
          appWindow.hide()
        })
      }
    }
  } else if (appWindow.label === 'login') {
    await exit(0)
  } else {
    if (appWindow.label.includes('modal-')) {
      const webviews = await WebviewWindow.getAll()
      const need = webviews.find((item) => item.label === 'home' || item.label === 'login')
      await need?.setEnabled(true)
      await need?.setFocus()
    }
    await emit(EventEnum.WIN_CLOSE, appWindow.label)
    await appWindow.close()
  }
}

useMitt.on('handleCloseWin', handleCloseWin)

onMounted(async () => {
  // 상태 초기화
  await updateWindowMaximized()

  unlistenResized = await appWindow.onResized?.(() => {
    updateWindowMaximized()
  })

  // home 창 닫기 이벤트 수신
  if (appWindow.label === 'home') {
    appWindow.onCloseRequested((event) => {
      info('[ActionBar] [home] 창 닫기 이벤트 수신')
      if (isProgrammaticClose) {
        // 리스너 정리
        info('[ActionBar] [home] 창 리스너 정리')
        exit(0)
      }
      info('[ActionBar] [home] 창 닫기 이벤트 차단')
      event.preventDefault()
      appWindow.hide()
    })
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleEscKeyDown)

  if (unlistenResized) {
    unlistenResized()
    unlistenResized = null
  }

  // macOS 닫기 버튼 이벤트 리스너 정리
  if (unlistenCloseRequested) {
    unlistenCloseRequested()
    unlistenCloseRequested = null
  }
})

// windowMaximized 상태 노출
defineExpose({
  windowMaximized
})
</script>

<style scoped lang="scss">
.hover-box {
  @apply w-28px h-24px flex-center hover:bg-[--icon-hover-color];
}

.action-close {
  @apply w-28px h-24px flex-center cursor-pointer hover:bg-#c22b1c svg:hover:color-[#fff];
}

.n-modal {
  align-self: start;
  margin: 60px auto;
}
</style>
