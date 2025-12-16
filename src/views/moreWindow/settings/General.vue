<template>
  <n-flex vertical :size="40">
    <!-- 일반 설정 -->
    <n-flex vertical class="text-(14px [--text-color])" :size="16">
      <span class="pl-10px">{{ t('setting.general.appearance.title') }}</span>
      <n-flex align="center" :size="20" class="item">
        <n-flex
          vertical
          align="center"
          class="w-120px h-100px"
          :size="0"
          @click="activeItem = item.code"
          v-for="(item, index) in topicsList"
          :key="index">
          <div
            @click="handleTheme(item.code)"
            class="size-full rounded-8px cursor-pointer custom-shadow"
            :class="{ 'outline outline-2 outline-[--border-active-color] outline-offset': activeItem === item.code }">
            <component :is="item.model" />
          </div>
          <span class="text-12px pt-8px color-[--text-color]">{{ item.title }}</span>
        </n-flex>
      </n-flex>
    </n-flex>

    <!-- 시스템 설정 -->
    <n-flex v-if="isWindows()" vertical class="text-(14px [--text-color])" :size="16">
      <span class="pl-10px">시스템</span>

      <n-flex class="item" :size="12" vertical>
        <!-- 패널 닫기 -->
        <n-flex v-if="isWindows()" align="center" justify="space-between">
          <span>메인 패널 닫기</span>

          <label class="text-(14px #707070) flex gap-6px lh-16px items-center">
            <n-radio :value="CloseBxEnum.HIDE" />
            <span>시스템 트레이로 최소화</span>
          </label>
          <label class="text-(14px #707070) flex gap-6px lh-16px items-center">
            <n-radio :value="CloseBxEnum.CLOSE" />
            <span>프로그램 바로 종료</span>
          </label>

          <label class="text-(12px #909090) flex gap-6px justify-end items-center">
            <n-checkbox size="small" v-model:checked="tips.notTips" />
            <span>알림 끄기</span>
          </label>
        </n-flex>

        <span v-if="isWindows()" class="w-full h-1px bg-[--line-color]"></span>

        <!-- ESC로 패널 닫기 -->
        <n-flex v-if="isWindows()" align="center" justify="space-between">
          <span>ESC로 창 닫기 활성화</span>

          <n-switch size="small" v-model:value="escClose" />
        </n-flex>
      </n-flex>
    </n-flex>

    <!-- 채팅 설정 -->
    <n-flex vertical class="text-(14px [--text-color])" :size="16">
      <span class="pl-10px">{{ t('setting.general.chat.title') }}</span>

      <n-flex class="item" :size="12" vertical>
        <!-- 더블 클릭으로 독립 세션 열기 -->
        <!-- <n-flex align="center" justify="space-between">
          <span>세션 목록 더블 클릭으로 독립 채팅 창 열기</span>

          <n-switch size="small" v-model:value="chat.isDouble" />
        </n-flex> -->

        <!-- 번역 API 옵션 -->
        <n-flex align="center" justify="space-between">
          <span>{{ t('setting.general.chat.translate_service') }}</span>

          <n-select
            class="w-140px"
            size="small"
            label-field="label"
            v-model:value="chat.translate"
            :options="translateOptions" />
        </n-flex>
      </n-flex>
    </n-flex>

    <!-- 인터페이스 설정 -->
    <n-flex vertical class="text-(14px [--text-color])" :size="16">
      <span class="pl-10px">{{ t('setting.general.ui.title') }}</span>

      <n-flex class="item" :size="12" vertical>
        <!-- 폰트 -->
        <n-flex align="center" justify="space-between">
          <span>{{ t('setting.general.ui.language') }}</span>
          <n-select class="w-140px" size="small" label-field="label" v-model:value="page.lang" :options="langOptions" />
        </n-flex>

        <span class="w-full h-1px bg-[--line-color]"></span>

        <n-flex align="center" justify="space-between">
          <span>{{ t('setting.general.ui.blur') }}</span>

          <n-switch size="small" v-model:value="page.blur" />
        </n-flex>

        <span class="w-full h-1px bg-[--line-color]"></span>

        <n-flex align="center" justify="space-between">
          <span>{{ t('setting.general.ui.shadow') }}</span>

          <n-switch size="small" v-model:value="page.shadow" />
        </n-flex>

        <span class="w-full h-1px bg-[--line-color]"></span>

        <!-- 폰트 -->
        <n-flex align="center" justify="space-between">
          <span>{{ t('setting.general.ui.font') }}</span>
          <n-select
            class="w-140px"
            size="small"
            label-field="label"
            v-model:value="page.fonts"
            :options="fontOptions" />
        </n-flex>

        <span class="w-full h-1px bg-[--line-color]"></span>

        <!-- 메뉴 표시 모드 -->
        <n-flex align="center" justify="space-between">
          <span>{{ t('setting.general.ui.menu_name') }}</span>

          <n-switch size="small" v-model:value="showText" />
        </n-flex>
      </n-flex>
    </n-flex>
  </n-flex>
</template>
<script setup lang="tsx">
import { invoke } from '@tauri-apps/api/core'
import { emitTo } from '@tauri-apps/api/event'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { NSwitch } from 'naive-ui'
import { CloseBxEnum, ShowModeEnum } from '@/enums'
import { useSettingStore } from '@/stores/setting.ts'
import { isWindows } from '@/utils/PlatformConstants'
import { useFontOptions, useTranslateOptions, langOptions } from './config.ts'
import { useTopicsList } from './model.tsx'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const appWindow = WebviewWindow.getCurrent()
const settingStore = useSettingStore()
const { themes, tips, chat, page } = settingStore
const { showMode, escClose } = storeToRefs(settingStore)
const activeItem = ref<string>(themes.pattern)
const topicsList = useTopicsList()
const translateOptions = useTranslateOptions()
const fontOptions = useFontOptions()

const showText = computed({
  get: () => showMode.value === ShowModeEnum.TEXT,
  set: async (v: any) => {
    settingStore.setShowMode(v ? ShowModeEnum.TEXT : ShowModeEnum.ICON)
    await setHomeHeight()
    await emitTo(appWindow.label, 'startResize')
  }
})

/** 테마 전환 */
const handleTheme = (code: string) => {
  if (code === themes.pattern) return
  settingStore.toggleTheme(code)
}

/** 메인 인터페이스 높이 조정 */
const setHomeHeight = async () => {
  invoke('set_height', { height: showMode.value === ShowModeEnum.TEXT ? 505 : 423 })
}
</script>
<style scoped lang="scss">
.item {
  @apply bg-[--bg-setting-item] rounded-12px size-full p-12px box-border border-(solid 1px [--line-color]) custom-shadow;
}
</style>
