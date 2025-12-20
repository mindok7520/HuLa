<template>
  <!-- 시스템 메시지 -->
  <main class="w-full flex-center h-62px">
    <p class="select-none cursor-default text-(12px #909090)">
      {{ props.body }}
    </p>
  </main>
</template>

<script setup lang="ts">
const props = defineProps<{
  body: string
  fromUserUid: string
}>()
</script>
