<template>
  <div class="size-full rounded-8px bg-[--right-bg-color]">
    <ActionBar :shrink="false" :current-label="WebviewWindow.getCurrent().label" />

    <n-alert title="공지" type="warning">이 기능은 개발 중입니다. 개발자에게 문의하세요.</n-alert>
  </div>
</template>
<script setup lang="ts">
import { getCurrentWebviewWindow, WebviewWindow } from '@tauri-apps/api/webviewWindow'

onMounted(async () => {
  await getCurrentWebviewWindow().show()
})
</script>
