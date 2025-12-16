<template>
  <n-flex
    vertical
    :size="0"
    class="flex-1 truncate border-l-(1px solid [--line-color]) custom-shadow select-none text-[--text-color]">
    <!-- 오른쪽 상단 작업 표시줄 -->
    <ActionBar
      :shrink="false"
      :current-label="WebviewWindow.getCurrent().label"
      :top-win-label="WebviewWindow.getCurrent().label" />

    <!-- ✅ keep-alive를 사용하여 Chat.vue 캐싱, 중복 마운트 방지 -->
    <RouterView v-slot="{ Component }">
      <keep-alive>
        <component :is="Component" />
      </keep-alive>
    </RouterView>
  </n-flex>
</template>
<script setup lang="ts">
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
</script>
