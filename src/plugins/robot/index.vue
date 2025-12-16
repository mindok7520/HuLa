<template>
  <div class="size-full rounded-8px bg-[--chat-right-bg]">
    <n-flex class="size-full" :size="0">
      <!-- 왼쪽 사이드바 -->
      <Left />
      <!-- 오른쪽 메인 -->
      <Right />
    </n-flex>

    <!-- 역할 관리 팝업 -->
    <ChatRoleManagement v-model="showRoleManagement" @refresh="handleRoleManagementRefresh" />

    <!-- 모델 관리 팝업 -->
    <ModelManagement v-model="showModelManagement" @refresh="handleModelManagementRefresh" />
  </div>
</template>
<script setup lang="ts">
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useMitt } from '@/hooks/useMitt'
import Left from './layout/Left.vue'
import Right from './layout/Right.vue'
import ChatRoleManagement from './components/ChatRoleManagement.vue'
import ModelManagement from './components/ModelManagement.vue'
import { getUseMonaco } from 'markstream-vue'
import { initMarkdownRenderer } from '@/plugins/robot/utils/markdown'

const showRoleManagement = ref(false)
const showModelManagement = ref(false)
/** Markdown 렌더러 초기화 */
initMarkdownRenderer()

// 역할 관리 열기 이벤트 감지
useMitt.on('open-role-management', () => {
  console.log('역할 관리 열기')
  showRoleManagement.value = true
})

// 모델 관리 열기 이벤트 감지
useMitt.on('open-model-management', () => {
  console.log('모델 관리 열기')
  showModelManagement.value = true
})

// 역할 관리 새로고침 후 콜백
const handleRoleManagementRefresh = () => {
  console.log('역할 관리 새로고침')
  // 다른 컴포넌트에 역할 목록 새로고침 알림
  useMitt.emit('refresh-role-list')
}

// 모델 관리 새로고침 후 콜백
const handleModelManagementRefresh = () => {
  console.log('모델 관리 새로고침')
  // 다른 컴포넌트에 모델 목록 새로고침 알림
  useMitt.emit('refresh-model-list')
}

onMounted(async () => {
  await getCurrentWebviewWindow().show()
  await getUseMonaco()
})
</script>
