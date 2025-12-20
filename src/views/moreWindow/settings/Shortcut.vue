<template>
  <n-flex vertical :size="40">
    <!-- 글로벌 단축키 마스터 스위치 -->
    <n-flex vertical class="text-(14px [--text-color])" :size="16">
      <span class="pl-10px">{{ t('setting.shortcut.global_shortcut_title') }}</span>

      <n-flex class="item" align="center" justify="space-between">
        <n-flex vertical :size="8">
          <span>{{ t('setting.shortcut.enable_global_shortcuts') }}</span>
          <span class="text-(12px #909090)">{{ t('setting.shortcut.enable_global_shortcuts_hint') }}</span>
        </n-flex>

        <n-switch v-model:value="globalShortcutEnabled" @update:value="handleGlobalShortcutToggle" size="small" />
      </n-flex>
    </n-flex>

    <!-- 캡처 단축키 설정 -->
    <n-flex vertical class="text-(14px [--text-color])" :size="16">
      <span class="pl-10px">{{ t('setting.shortcut.function_shortcut_title') }}</span>

      <n-flex class="item" :size="12" vertical>
        <!-- 캡처 단축키 -->
        <n-flex align="center" justify="space-between">
          <n-flex vertical :size="8">
            <span>{{ shortcutConfigs.screenshot.displayName }}</span>
            <!-- <span>{{ t('setting.shortcut.screenshot') }}</span> -->
            <span class="text-(12px #909090)">{{ t('setting.shortcut.screenshot_hint') }}</span>
          </n-flex>

          <n-flex align="center" :size="12">
            <n-tag v-if="shortcutRegistered !== null" :type="shortcutRegistered ? 'success' : 'error'" size="small">
              {{ shortcutRegistered ? t('setting.shortcut.bound') : t('setting.shortcut.unbound') }}
            </n-tag>
            <n-input
              :value="screenshotShortcutDisplay"
              :placeholder="screenshotShortcutDisplay"
              style="width: 130px"
              class="border-(1px solid #90909080)"
              readonly
              size="small"
              :disabled="!globalShortcutEnabled"
              @keydown="handleShortcutInput"
              @focus="handleScreenshotFocus"
              @blur="handleScreenshotBlur">
              <template #suffix>
                <n-tooltip trigger="hover">
                  <template #trigger>
                    <svg
                      @click="resetScreenshotShortcut"
                      class="size-14px"
                      :class="globalShortcutEnabled ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'">
                      <use href="#return"></use>
                    </svg>
                  </template>
                  <span>{{ t('setting.shortcut.reset') }}</span>
                </n-tooltip>
              </template>
            </n-input>
          </n-flex>
        </n-flex>

        <span class="w-full h-1px bg-[--line-color]"></span>

        <!-- 메인 패널 열기 단축키 -->
        <n-flex align="center" justify="space-between">
          <n-flex vertical :size="8">
            <span>{{ shortcutConfigs.openMainPanel.displayName }}</span>
            <!-- <span>{{ t('setting.shortcut.panel_switch') }}</span> -->
            <span class="text-(12px #909090)">{{ t('setting.shortcut.panel_switch_hint') }}</span>
          </n-flex>

          <n-flex align="center" :size="12">
            <n-tag
              v-if="openMainPanelShortcutRegistered !== null"
              :type="openMainPanelShortcutRegistered ? 'success' : 'error'"
              size="small">
              {{ openMainPanelShortcutRegistered ? t('setting.shortcut.bound') : t('setting.shortcut.unbound') }}
            </n-tag>
            <n-input
              :value="openMainPanelShortcutDisplay"
              :placeholder="openMainPanelShortcutDisplay"
              style="width: 130px"
              class="border-(1px solid #90909080)"
              readonly
              size="small"
              :disabled="!globalShortcutEnabled"
              @keydown="handleOpenMainPanelShortcutInput"
              @focus="handleOpenMainPanelFocus"
              @blur="handleOpenMainPanelBlur">
              <template #suffix>
                <n-tooltip trigger="hover">
                  <template #trigger>
                    <svg
                      @click="resetOpenMainPanelShortcut"
                      class="size-14px"
                      :class="globalShortcutEnabled ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'">
                      <use href="#return"></use>
                    </svg>
                  </template>
                  <span>{{ t('setting.shortcut.reset') }}</span>
                </n-tooltip>
              </template>
            </n-input>
          </n-flex>
        </n-flex>
      </n-flex>
    </n-flex>

    <!-- 메시지 단축키 설정 -->
    <n-flex vertical class="text-(14px [--text-color])" :size="16">
      <span class="pl-10px">{{ t('setting.shortcut.message_title') }}</span>

      <n-flex class="item" align="center" justify="space-between">
        <n-flex vertical :size="8">
          <span>{{ t('setting.shortcut.send_message_shortcut') }}</span>
          <span class="text-(12px #909090)">{{ t('setting.shortcut.send_message_shortcut_hint') }}</span>
        </n-flex>

        <n-flex align="center" :size="12">
          <n-select
            v-model:value="sendMessageShortcut"
            class="w-200px"
            size="small"
            label-field="label"
            :options="sendOptions"
            @blur="handleSendMessageBlur" />
        </n-flex>
      </n-flex>
    </n-flex>
  </n-flex>
</template>

<script setup lang="ts">
import { emit, listen } from '@tauri-apps/api/event'
import { isRegistered } from '@tauri-apps/plugin-global-shortcut'
import { MacOsKeyEnum } from '@/enums'
import { useGlobalShortcut } from '@/hooks/useGlobalShortcut.ts'
import { useSettingStore } from '@/stores/setting.ts'
import { isMac } from '@/utils/PlatformConstants'
import { useSendOptions } from './config.ts'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const sendOptions = useSendOptions()
// 단축키 구성 관리
type ShortcutConfig = {
  key: 'screenshot' | 'openMainPanel'
  value: Ref<string>
  isCapturing: Ref<boolean>
  isRegistered: Ref<boolean | null>
  original: Ref<string>
  defaultValue: string
  eventName: string
  registrationEventName: string
  displayName: string
}

const settingStore = useSettingStore()
const { getDefaultShortcuts } = useGlobalShortcut()
const isMacPlatform = isMac()

// 통합 단축키 구성
const shortcutConfigs: Record<string, ShortcutConfig> = {
  screenshot: {
    key: 'screenshot',
    value: ref(settingStore.shortcuts?.screenshot),
    isCapturing: ref(false),
    isRegistered: ref<boolean | null>(null),
    original: ref(settingStore.shortcuts?.screenshot),
    defaultValue: getDefaultShortcuts().screenshot,
    eventName: 'shortcut-updated',
    registrationEventName: 'shortcut-registration-updated',
    displayName: t('setting.shortcut.screenshot')
  },
  openMainPanel: {
    key: 'openMainPanel',
    value: ref(settingStore.shortcuts?.openMainPanel),
    isCapturing: ref(false),
    isRegistered: ref<boolean | null>(null),
    original: ref(settingStore.shortcuts?.openMainPanel),
    defaultValue: getDefaultShortcuts().openMainPanel,
    eventName: 'open-main-panel-shortcut-updated',
    registrationEventName: 'open-main-panel-shortcut-registration-updated',
    displayName: t('setting.shortcut.panel_switch')
  }
}

watchEffect(() => {
  shortcutConfigs.screenshot.displayName = t('setting.shortcut.screenshot')
  shortcutConfigs.openMainPanel.displayName = t('setting.shortcut.panel_switch')
})

// 하위 호환성을 위한 별칭 (템플릿에 사용된 것만 유지)
const screenshotShortcut = shortcutConfigs.screenshot.value
const openMainPanelShortcut = shortcutConfigs.openMainPanel.value
const shortcutRegistered = shortcutConfigs.screenshot.isRegistered
const openMainPanelShortcutRegistered = shortcutConfigs.openMainPanel.isRegistered

// 글로벌 단축키 스위치 상태
const globalShortcutEnabled = ref(settingStore.shortcuts?.globalEnabled ?? false)

// 메시지 전송 단축키 별도 처리
const sendMessageShortcut = ref(settingStore.chat?.sendKey)

// 단축키를 플랫폼에 맞는 표시 텍스트로 변환
const formatShortcutDisplay = (shortcut: string) => {
  if (isMacPlatform) {
    // Mac 플랫폼 특수 처리: 표준 순서에 따라 보조 키 배열
    const keys = shortcut.split('+').map((key) => key.trim())

    const displayKeys: string[] = []
    const mainKeys: string[] = []

    // 키 유형 분석
    keys.forEach((key) => {
      if (['Cmd', 'Command'].includes(key)) {
        displayKeys.push(MacOsKeyEnum['⌘'])
      } else if (key === 'Ctrl') {
        displayKeys.push(MacOsKeyEnum['^'])
      } else if (key === 'Alt') {
        displayKeys.push(MacOsKeyEnum['⌥'])
      } else if (key === 'Shift') {
        displayKeys.push(MacOsKeyEnum['⇧'])
      } else {
        mainKeys.push(key.toLowerCase())
      }
    })

    // Mac 표준 순서: ⌘ -> ^ -> ⌥ -> ⇧
    const orderedKeys: string[] = []
    if (displayKeys.includes(MacOsKeyEnum['⌘'])) orderedKeys.push(MacOsKeyEnum['⌘'])
    if (displayKeys.includes(MacOsKeyEnum['^'])) orderedKeys.push(MacOsKeyEnum['^'])
    if (displayKeys.includes(MacOsKeyEnum['⌥'])) orderedKeys.push(MacOsKeyEnum['⌥'])
    if (displayKeys.includes(MacOsKeyEnum['⇧'])) orderedKeys.push(MacOsKeyEnum['⇧'])

    // 메인 키 추가
    orderedKeys.push(...mainKeys)

    return orderedKeys.join(' + ')
  }

  // 기타 플랫폼 처리
  return shortcut
    .split('+')
    .map((key) => key.trim())
    .map((key) => {
      if (['Ctrl', 'Command', 'Alt', 'Shift'].includes(key)) {
        return key.toLowerCase()
      }
      return key.toLowerCase()
    })
    .join(' + ')
}

// 입력 필드에 표시되는 단축키 텍스트 (표시용이며 바인딩용 아님)
const screenshotShortcutDisplay = computed(() => {
  return formatShortcutDisplay(screenshotShortcut.value)
})

const openMainPanelShortcutDisplay = computed(() => {
  return formatShortcutDisplay(openMainPanelShortcut.value)
})

// 공통 store 변경 감지
const createShortcutWatcher = (config: ShortcutConfig, storeGetter: () => string | undefined) => {
  return watch(
    storeGetter,
    (newValue) => {
      if (newValue && !config.isCapturing.value) {
        config.value.value = newValue
        config.original.value = newValue
      }
    },
    { immediate: true }
  )
}

// 데이터 동기화를 위해 store 변경 감지
createShortcutWatcher(shortcutConfigs.screenshot, () => settingStore.shortcuts?.screenshot)
createShortcutWatcher(shortcutConfigs.openMainPanel, () => settingStore.shortcuts?.openMainPanel)

watch(
  () => settingStore.chat?.sendKey,
  (newValue) => {
    if (newValue) {
      sendMessageShortcut.value = newValue
    }
  },
  { immediate: true }
)

// store의 글로벌 단축키 스위치 상태 변화 감지
watch(
  () => settingStore.shortcuts?.globalEnabled,
  (newValue) => {
    if (newValue !== undefined) {
      globalShortcutEnabled.value = newValue
    }
  },
  { immediate: true }
)

// 공통 단축키 바인딩 확인
const checkShortcutRegistration = async (config: ShortcutConfig) => {
  // 글로벌 단축키가 꺼져 있으면 바인딩 해제 상태로 표시
  if (!globalShortcutEnabled.value) {
    config.isRegistered.value = false
    return
  }

  config.isRegistered.value = await isRegistered(config.value.value)
}

// 공통 단축키 입력 처리
const createShortcutInputHandler = (config: ShortcutConfig) => {
  return (event: KeyboardEvent) => {
    if (!config.isCapturing.value || !globalShortcutEnabled.value) return

    event.preventDefault()
    event.stopPropagation()

    const keys: string[] = []

    // 보조 키 확인
    if (isMacPlatform) {
      // Mac에서는 Control 키와 Command 키를 구분함
      if (event.ctrlKey) {
        keys.push('Ctrl')
      }
      if (event.metaKey) {
        keys.push('Cmd')
      }
    } else {
      // 기타 플랫폼은 Ctrl 키만 사용함
      if (event.ctrlKey) {
        keys.push('Ctrl')
      }
    }

    if (event.altKey) {
      keys.push('Alt')
    }
    if (event.shiftKey) {
      keys.push('Shift')
    }

    // 메인 키 가져오기
    const mainKey = event.key
    if (mainKey && !['Control', 'Alt', 'Shift', 'Meta', 'Cmd'].includes(mainKey)) {
      keys.push(mainKey.toUpperCase())
    }

    // 최소 하나 이상의 보조 키와 하나의 메인 키가 필요함
    if (keys.length >= 2) {
      config.value.value = keys.join('+')
    }
  }
}

// 구체적인 처리 함수 생성
const handleShortcutInput = createShortcutInputHandler(shortcutConfigs.screenshot)
const handleOpenMainPanelShortcutInput = createShortcutInputHandler(shortcutConfigs.openMainPanel)

// 공통 포커스 처리
const createFocusHandler = (config: ShortcutConfig) => {
  return async () => {
    // 글로벌 단축키가 꺼져 있으면 편집 모드 진입 불허
    if (!globalShortcutEnabled.value) {
      return
    }

    config.isCapturing.value = true
    config.original.value = config.value.value
    console.log(`开始编辑${config.displayName}`)
  }
}

const createBlurHandler = (config: ShortcutConfig, saveFunction: () => Promise<void>) => {
  return async () => {
    config.isCapturing.value = false
    console.log(`结束编辑${config.displayName}`)

    // 단축키가 변경된 경우 저장
    if (config.value.value !== config.original.value) {
      await saveFunction()
    }
  }
}

// 创建具体的焦点处理函数
const handleScreenshotFocus = createFocusHandler(shortcutConfigs.screenshot)
const handleOpenMainPanelFocus = createFocusHandler(shortcutConfigs.openMainPanel)

// 메시지 전송 단축키 포커스 해제 이벤트 처리 (자동 저장)
const handleSendMessageBlur = async () => {
  // 단축키가 변경된 경우 저장
  const currentSendKey = settingStore.chat?.sendKey || 'Enter'
  if (sendMessageShortcut.value !== currentSendKey) {
    await saveSendMessageShortcut()
  }
}

// 공통 단축키 저장 방법
const createSaveShortcutFunction = (config: ShortcutConfig) => {
  return async () => {
    try {
      console.log(`[Settings] 开始保存${config.displayName}: ${config.value.value}`)

      // 단축키 유형에 따라 해당 store 메서드 호출
      if (config.key === 'screenshot') {
        settingStore.setScreenshotShortcut(config.value.value)
      } else if (config.key === 'openMainPanel') {
        settingStore.setOpenMainPanelShortcut(config.value.value)
      }

      config.original.value = config.value.value
      console.log(`[Settings] 已保存到 Pinia store`)

      // 메인 창에 단축키 업데이트 알림 (창 간 이벤트)
      console.log(`[Settings] 发送 ${config.eventName} 事件到主窗口`)
      await emit(config.eventName, { shortcut: config.value.value })
      console.log(`[Settings] ${config.eventName} 事件已发送`)

      window.$message.success(t('config.shortcut.shortcut_update_result', { name: config.displayName }))
    } catch (error) {
      console.error(`Failed to save ${config.key} shortcut:`, error)
      window.$message.error(t('config.shortcut.shortcut_setting_failed', { name: config.displayName }))

      // 기존 단축키 복구
      config.value.value = config.original.value
    }
  }
}

// 공통 단축키 초기화 방법
const createResetShortcutFunction = (config: ShortcutConfig, saveFunction: () => Promise<void>) => {
  return async () => {
    // 글로벌 단축키가 꺼져 있으면 초기화 작업 미수행
    if (!globalShortcutEnabled.value) {
      return
    }

    config.value.value = config.defaultValue
    await saveFunction()
  }
}

// 구체적인 저장 함수 생성
const saveScreenshotShortcut = createSaveShortcutFunction(shortcutConfigs.screenshot)
const saveOpenMainPanelShortcut = createSaveShortcutFunction(shortcutConfigs.openMainPanel)

// 구체적인 초기화 함수 생성
const resetScreenshotShortcut = createResetShortcutFunction(shortcutConfigs.screenshot, saveScreenshotShortcut)
const resetOpenMainPanelShortcut = createResetShortcutFunction(shortcutConfigs.openMainPanel, saveOpenMainPanelShortcut)

// 포커스 해제 처리 함수 생성
const handleScreenshotBlur = createBlurHandler(shortcutConfigs.screenshot, saveScreenshotShortcut)
const handleOpenMainPanelBlur = createBlurHandler(shortcutConfigs.openMainPanel, saveOpenMainPanelShortcut)

// 글로벌 단축키 스위치 전환 처리
const handleGlobalShortcutToggle = async (enabled: boolean) => {
  try {
    console.log(`[Settings] 全局快捷键开关切换为: ${enabled ? '开启' : '关闭'}`)

    // store에 저장
    settingStore.setGlobalShortcutEnabled(enabled)

    // 메인 창에 글로벌 단축키 상태 업데이트 알림
    await emit('global-shortcut-enabled-changed', { enabled })

    window.$message.success(enabled ? t('setting.shortcut.global_enable') : t('setting.shortcut.global_disable'))
  } catch (error) {
    console.error('Failed to toggle global shortcut:', error)
    window.$message.error(t('setting.shortcut.global_toggle_failed'))

    // 기존 값 복구
    globalShortcutEnabled.value = !enabled
  }
}

// 메시지 전송 단축키 설정 저장
const saveSendMessageShortcut = async () => {
  try {
    // pinia store에 저장
    settingStore.setSendMessageShortcut(sendMessageShortcut.value)

    window.$message.success(t('setting.shortcut.send_message_updated'))
  } catch (error) {
    console.error('Failed to save send message shortcut:', error)
    window.$message.error('发送消息快捷键设置失败')
    window.$message.success(t('setting.shortcut.send_message_failed'))

    // 기존 값 복구
    sendMessageShortcut.value = settingStore.chat?.sendKey || 'Enter'
  }
}

// 공통 이벤트 리스너 생성
const createRegistrationListener = (config: ShortcutConfig) => {
  return listen(config.registrationEventName, (event: any) => {
    const { shortcut, registered } = event.payload
    console.log(`[Settings] 收到${config.displayName}状态更新: ${shortcut} -> ${registered ? '已绑定' : '未绑定'}`)

    // 현재 단축키가 일치하는 경우에만 상태 업데이트
    if (shortcut === config.value.value) {
      console.log(`[Settings] ${config.displayName}匹配，更新状态为: ${registered ? '已绑定' : '未绑定'}`)
      config.isRegistered.value = registered
    } else {
      console.log(`[Settings] ${config.displayName}不匹配，忽略状态更新`)
    }
  })
}

onMounted(async () => {
  // 모든 단축키의 바인딩 상태 확인
  await Promise.all([
    checkShortcutRegistration(shortcutConfigs.screenshot),
    checkShortcutRegistration(shortcutConfigs.openMainPanel)
  ])

  // 이벤트 리스너 생성
  const unlistenScreenshot = await createRegistrationListener(shortcutConfigs.screenshot)
  const unlistenOpenMainPanel = await createRegistrationListener(shortcutConfigs.openMainPanel)

  // 컴포넌트 언마운트 시 리스너 해제
  onUnmounted(() => {
    unlistenScreenshot()
    unlistenOpenMainPanel()
  })
})
</script>

<style scoped lang="scss">
.item {
  @apply bg-[--bg-setting-item] rounded-12px size-full p-12px box-border border-(solid 1px [--line-color]) custom-shadow;
}

:deep(.n-input.n-input--focus) {
  border-width: 2px;
  border-color: #13987f !important;
}
</style>
