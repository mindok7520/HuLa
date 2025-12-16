<template>
  <main class="size-full flex select-none">
    <!-- 사이드바 옵션 -->
    <section class="left-bar" data-tauri-drag-region>
      <div class="menu-list relative">
        <div v-for="(item, index) in sideOptions" :key="index">
          <div class="menu-item" :class="{ active: activeItem === item.url }" @click="pageJumps(item.url)">
            <n-flex align="center">
              <svg><use :href="`#${item.icon}`"></use></svg>
              {{ item.label }}
            </n-flex>
            <Transition>
              <div
                v-if="item.versionStatus && activeItem !== item.url"
                class="bg-[--danger-bg] p-[2px_6px] rounded-6px text-(12px [--danger-text])">
                {{ t(item.versionStatus) }}
              </div>
            </Transition>
          </div>
        </div>
      </div>

      <div class="absolute bottom-20px left-60px select-none cursor-default flex items-center gap-10px">
        <p class="text-(12px #666)">{{ t('setting.common.provider_label') }}:</p>
        <a
          target="_blank"
          rel="noopener noreferrer"
          href="https://github.com/HuLaSpark/HuLa"
          class="text-(12px #13987f) cursor-pointer no-underline">
          {{ t('setting.common.provider_name') }}
        </a>
      </div>
    </section>

    <!-- 오른쪽 콘텐츠 -->
    <section class="bg-[--right-bg-color] relative rounded-r-8px flex-1 border-l-(1px solid [--line-color])">
      <ActionBar :shrink="false" :max-w="true" />

      <header class="header" data-tauri-drag-region>
        {{ title }}
      </header>

      <n-scrollbar
        style="max-height: calc(100vh / var(--page-scale, 1) - 70px)"
        :class="{ 'shadow-inner': page.shadow }"
        data-tauri-drag-region>
        <n-flex vertical class="p-24px" :size="12" justify="center" v-if="skeleton">
          <n-skeleton class="rounded-8px" height="26px" text style="width: 30%" />
          <n-skeleton class="rounded-8px" height="26px" text :repeat="5" />
          <n-skeleton class="rounded-8px" height="26px" text style="width: 60%" />
        </n-flex>
        <template v-else>
          <div class="flex-1 p-24px"><router-view /></div>

          <Foot />
        </template>
      </n-scrollbar>
    </section>
  </main>
</template>
<script setup lang="ts">
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import router from '@/router'
import { useScannerStore } from '@/stores/scanner.ts'
import { useSettingStore } from '@/stores/setting.ts'
import Foot from '@/views/moreWindow/settings/Foot.vue'
import { useSideOptions } from './config.ts'
import { useI18n } from 'vue-i18n'

const settingStore = useSettingStore()
const scannerStore = useScannerStore()
const skeleton = ref(true)
const { page } = storeToRefs(settingStore)
const sideOptions = useSideOptions()
const { t } = useI18n()
/** 현재 선택된 요소, 기본적으로 itemsTop의 첫 번째 항목 선택 */
const activeItem = ref<string>('/general')
const title = ref<string>('')

watch(
  sideOptions,
  (options) => {
    if (!options.length) return
    const current = options.find((item) => item.url === activeItem.value) ?? options[0]
    activeItem.value = current.url
    title.value = current.label
  },
  { immediate: true }
)

/**
 * 통합 라우팅 점프 메서드
 * @param url 점프할 라우트
 * @param label 페이지 제목
 * */
const pageJumps = (url: string) => {
  const matched = sideOptions.value.find((item) => item.url === url)
  if (matched) {
    activeItem.value = matched.url
    title.value = matched.label
  }
  router.push(url)
}

onMounted(async () => {
  await getCurrentWebviewWindow().show()

  // 스캐너 상태 초기화
  scannerStore.resetState()

  setTimeout(() => {
    skeleton.value = false
  }, 300)
  pageJumps(activeItem.value)
})

// 설정 창이 닫힐 때 스캐너 리소스 정리
onUnmounted(async () => {
  await scannerStore.cleanup()
})
</script>

<style scoped lang="scss">
@use '@/styles/scss/global/variable' as *;
.left-bar {
  @include menu-list();
  background: var(--bg-left-menu);
  width: 200px;
  padding: 24px 12px;
  box-sizing: border-box;
  color: var(--text-color);
  .menu-item {
    padding: 8px 10px;
    border-radius: 10px;
    margin-top: 6px;
    font-size: 14px;
    display: flex;
    justify-content: space-between;
    svg {
      width: 18px;
      height: 18px;
    }
    &:not(.active):hover {
      background-color: var(--bg-left-menu-hover);
    }
    &:hover {
      background-color: var(--bg-left-active);
      svg {
        animation: none;
      }
    }
  }
}

.active {
  background-color: var(--bg-left-active);
}

.header {
  @apply w-full h-42px flex items-center pl-40px select-none text-18px color-[--text-color] border-b-(1px solid [--line-color]);
}

.v-enter-active,
.v-leave-active {
  transition: opacity 0.5s ease;
}

.v-enter-from,
.v-leave-to {
  opacity: 0;
}
</style>
