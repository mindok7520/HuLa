<template>
  <main class="flex-1 rounded-8px bg-[--right-bg-color] h-full w-100vw">
    <div style="background: var(--right-theme-bg-color); height: 100%">
      <ActionBar :shrink="false" :current-label="appWindow.label" />

      <ChatBox />
    </div>
  </main>
</template>
<script setup lang="ts">
import { emit } from '@tauri-apps/api/event'
import { getCurrentWebviewWindow, WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { EventEnum } from '@/enums'

const appWindow = WebviewWindow.getCurrent()

/**! 새 창을 생성한 후 통신을 통해 데이터를 전달해야 할 때는 페이지 생성 완료 이벤트를 전송해야 합니다. 그렇지 않으면 데이터를 수신할 수 없습니다. */
onMounted(async () => {
  await getCurrentWebviewWindow().show()
  await emit(EventEnum.ALONE)
})
</script>
