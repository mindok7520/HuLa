<template>
  <!-- 음성 통화 메시지 -->
  <div class="flex-y-center gap-6px" :class="isCurrentUser ? 'flex-row-reverse' : 'flex-row'">
    <!-- 음성 통화 아이콘 -->
    <svg class="iconpark-icon size-1.2em" :class="isCurrentUser ? 'scale-x-[-1]' : ''">
      <use href="#phone-telephone"></use>
    </svg>

    <!-- 메시지 내용 -->
    <div class="select-none cursor-default" :class="isMobile() ? 'text-16px' : 'text-14px'">
      {{ body }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { useUserStore } from '@/stores/user'
import { isMobile } from '@/utils/PlatformConstants'

const props = defineProps<{
  body: string
  fromUserUid: string
}>()

const userStore = useUserStore()

// 현재 사용자가 보낸 메시지인지 확인
const isCurrentUser = computed(() => {
  return userStore.userInfo!.uid === props.fromUserUid
})
</script>
