<template>
  <div class="flex flex-col flex-1 min-h-0">
    <!-- 헤더 -->
    <ChatHeader />

    <div class="flex-1 flex min-h-0">
      <div class="flex-1 min-h-0">
        <!-- 봇 사용자일 때 Bot 컴포넌트 표시 -->
        <template v-if="isBotUser">
          <Bot />
        </template>
        <n-split
          v-else
          direction="vertical"
          :resize-trigger-size="0"
          class="h-full"
          :min="0.55"
          :max="0.74"
          :default-size="0.74">
          <template #1>
            <ChatMain />
          </template>
          <template #2>
            <!-- 입력 상자 및 작업 목록 -->
            <ChatFooter :detail-id="currentSession?.detailId" />
          </template>
        </n-split>
      </div>
      <!-- 오른쪽 사이드바 자리 표시자: 그룹 채팅 시 Sidebar 마운트 완료까지 너비 예약, 이후 자식 컴포넌트가 너비 제어 (접기 포함) -->
      <ChatSidebar />
    </div>
  </div>
</template>
<script setup lang="ts">
import { useGlobalStore } from '@/stores/global'
import { storeToRefs } from 'pinia'
import { UserType } from '@/enums'

const globalStore = useGlobalStore()
const { currentSession } = storeToRefs(globalStore)

// 봇 사용자 여부
const isBotUser = computed(() => currentSession.value?.account === UserType.BOT)
</script>
<style scoped lang="scss">
:deep(.n-split .n-split__resize-trigger) {
  height: 16px !important;
  cursor: ns-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent !important;
  z-index: 998;
  position: relative;
  // ChatFooter의 상단 테두리를 방해하지 않도록 보장
  margin-top: -7px;

  // 주 표시선 (기본 숨김, hover 시 표시)
  &::before {
    content: '';
    position: absolute;
    width: 40px;
    height: 3px;
    background: #909090;
    border-radius: 2px;
    opacity: 0;
    transition: all 0.2s ease;
  }

  // 상하 보조선 (기본 숨김, hover 시 표시)
  &::after {
    content: '';
    position: absolute;
    width: 20px;
    height: 1px;
    background: transparent;
    border-radius: 1px;
    transition: all 0.2s ease;
    opacity: 0;
    box-shadow:
      0 -3px 0 0 rgba(102, 102, 102, 0.5),
      0 3px 0 0 rgba(102, 102, 102, 0.5);
    pointer-events: none;
  }

  // hover 상태 - 표시기 표시
  &:hover {
    &::before {
      opacity: 0.8;
      transform: scaleY(1.2);
    }

    &::after {
      opacity: 1;
      box-shadow:
        0 -3px 0 0 rgba(102, 102, 102, 0.8),
        0 3px 0 0 rgba(102, 102, 102, 0.8);
    }
  }

  // active/dragging 상태 - 하이라이트 표시기 표시
  &:active {
    &::before {
      opacity: 1;
      transform: scaleY(1.2);
      background: #13987f80;
    }

    &::after {
      opacity: 1;
      box-shadow:
        0 -3px 0 0 #13987f80,
        0 3px 0 0 #13987f80;
    }
  }
}
</style>
