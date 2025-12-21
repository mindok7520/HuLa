<template>
  <!-- 메인 컨테이너는 600px 최소 너비를 유지하여 채팅 사이드 정보가 지나치게 압축되지 않도록 함 -->
  <main data-tauri-drag-region class="flex-1 bg-[--right-bg-color] flex flex-col min-h-0 min-w-600px">
    <div
      :style="{ background: shouldShowChat ? 'var(--right-theme-bg-color)' : '' }"
      data-tauri-drag-region
      class="flex-1 flex flex-col min-h-0">
      <ActionBar :current-label="appWindow.label" />

      <!-- 현재 라우트가 정보 상세 인터페이스인지 확인 필요 -->
      <div class="flex-1 min-h-0 flex flex-col">
        <ChatBox v-if="shouldShowChat" />

        <Details :content="detailsContent" v-else-if="detailsShow && isDetails && detailsContent?.type !== 'apply'" />

        <!-- 친구 신청 목록 -->
        <ApplyList
          v-else-if="detailsContent && isDetails && detailsContent.type === 'apply'"
          :type="detailsContent.applyType" />

        <!-- 채팅 인터페이스 배경 아이콘 -->
        <div v-else class="flex-center size-full select-none">
          <img class="w-150px h-140px" src="/logoD.png" alt="" />
        </div>
      </div>
    </div>
  </main>
</template>
<script setup lang="ts">
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { MittEnum, ThemeEnum } from '@/enums'
import { useMitt } from '@/hooks/useMitt.ts'
import router from '@/router'
import type { DetailsContent } from '@/services/types'
import { useSettingStore } from '@/stores/setting.ts'
import { useGlobalStore } from '@/stores/global'

const appWindow = WebviewWindow.getCurrent()
const settingStore = useSettingStore()
const { themes } = storeToRefs(settingStore)
const globalStore = useGlobalStore()
const { currentSessionRoomId } = storeToRefs(globalStore)
const detailsShow = ref(false)
const detailsContent = ref<DetailsContent>()
const imgTheme = ref<ThemeEnum>(themes.value.content)
const prefers = matchMedia('(prefers-color-scheme: dark)')
const isChatRoute = computed(() => router.currentRoute.value.path.includes('/message'))
// 라우트가 메시지 페이지에 있고 세션이 선택되어 있으면(세션 세부 정보가 아직 동기화되지 않았더라도) ChatBox 표시
const shouldShowChat = computed(() => isChatRoute.value && !!currentSessionRoomId.value)
const isDetails = computed(() => {
  return router.currentRoute.value.path.includes('/friendsList')
})

/** 시스템 테마 모드를 따라 테마 전환 */
const followOS = () => {
  imgTheme.value = prefers.matches ? ThemeEnum.DARK : ThemeEnum.LIGHT
}

watchEffect(() => {
  if (themes.value.pattern === ThemeEnum.OS) {
    followOS()
    prefers.addEventListener('change', followOS)
  } else {
    imgTheme.value = themes.value.content || ThemeEnum.LIGHT
    prefers.removeEventListener('change', followOS)
  }
})

onMounted(() => {
  // 친구 상세 페이지는 mitt를 통해 주체로부터 전달된 선택 정보 수신
  if (isDetails) {
    useMitt.on(MittEnum.APPLY_SHOW, (event: { context: DetailsContent }) => {
      detailsContent.value = event.context
    })
    useMitt.on(MittEnum.DETAILS_SHOW, (event: any) => {
      detailsContent.value = event.context
      detailsShow.value = event.detailsShow as boolean
    })
  }
})
</script>
