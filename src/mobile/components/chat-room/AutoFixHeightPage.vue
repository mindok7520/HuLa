<template>
  <div class="flex flex-col flex-1 min-h-0">
    <!-- 페이지 컨테이너 -->
    <div class="flex w-full items-start flex-col flex-1 min-h-0">
      <div class="w-full">
        <slot name="header"></slot>
      </div>
      <!-- 메시지 콘텐츠 영역 -->
      <div class="w-full flex-1 overflow-y-hidden min-h-0">
        <slot name="container"></slot>
      </div>
    </div>

    <div class="bg-#FAFAFA">
      <slot name="footer"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps({
  showFooter: {
    type: Boolean,
    default: true
  }
})
</script>

<style lang="scss"></style>
