<template>
  <div class="chat-role-selector">
    <!-- 현재 선택된 역할 -->
    <div class="current-role" @click="showRoleList = !showRoleList">
      <n-avatar :src="currentRole?.avatar" :size="40" round />
      <div class="role-info">
        <div class="role-name">{{ currentRole?.name || '역할 선택' }}</div>
        <div class="role-desc">{{ currentRole?.description || '클릭하여 역할 선택' }}</div>
      </div>
      <Icon icon="mdi:chevron-down" class="expand-icon" :class="{ expanded: showRoleList }" :size="20" />
    </div>

    <!-- 역할 목록 -->
    <transition name="slide-fade">
      <div v-if="showRoleList" class="role-list-container">
        <n-scrollbar style="max-height: 400px">
          <div class="role-list">
            <!-- 관리 버튼 -->
            <div class="role-list-header">
              <span class="header-title">역할 선택</span>
              <n-button text @click="handleOpenManagement">
                <template #icon>
                  <Icon icon="mdi:cog" />
                </template>
                역할 관리
              </n-button>
            </div>

            <!-- 역할 항목 -->
            <div
              v-for="role in roleList"
              :key="role.id"
              class="role-item"
              :class="{ active: currentRole?.id === role.id }"
              @click="handleSelectRole(role)">
              <n-avatar :src="role.avatar" :size="36" round />
              <div class="role-item-info">
                <div class="role-item-name">{{ role.name }}</div>
                <div class="role-item-desc">{{ role.description }}</div>
              </div>
              <Icon v-if="currentRole?.id === role.id" icon="mdi:check" class="check-icon" :size="20" />
            </div>

            <!-- 빈 상태 -->
            <div v-if="roleList.length === 0" class="empty-state">
              <Icon icon="mdi:account-circle" :size="48" class="empty-icon" />
              <div class="empty-text">역할 없음</div>
              <n-button size="small" type="primary" @click="handleOpenManagement">첫 번째 역할 생성</n-button>
            </div>
          </div>
        </n-scrollbar>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { chatRolePage } from '@/utils/ImRequestUtils'

const props = defineProps<{
  modelValue?: any
}>()

const emit = defineEmits<{
  'update:modelValue': [role: any]
  'open-management': []
}>()

const showRoleList = ref(false)
const roleList = ref<any[]>([])
const currentRole = ref<any>(props.modelValue)

// 역할 목록 로드
const loadRoleList = async () => {
  try {
    const data = await chatRolePage({ pageNo: 1, pageSize: 100 })
    roleList.value = (data.list || []).filter((item: any) => item.status === 0) // 사용 가능한 역할만 표시

    // 선택된 역할이 없으면 기본적으로 첫 번째 역할 선택
    if (!currentRole.value && roleList.value.length > 0) {
      handleSelectRole(roleList.value[0])
    }
  } catch (error) {
    console.error('역할 목록 로드 실패:', error)
  }
}

// 역할 선택
const handleSelectRole = (role: any) => {
  currentRole.value = role
  emit('update:modelValue', role)
  showRoleList.value = false
}

// 역할 관리 열기
const handleOpenManagement = () => {
  emit('open-management')
  showRoleList.value = false
}

// 역할 목록 새로고침
const refresh = () => {
  loadRoleList()
}

// 외부 값 변경 감지
watch(
  () => props.modelValue,
  (val) => {
    currentRole.value = val
  }
)

// 외부 클릭 시 목록 닫기
onMounted(() => {
  loadRoleList()

  const handleClickOutside = (e: MouseEvent) => {
    const target = e.target as HTMLElement
    if (!target.closest('.chat-role-selector')) {
      showRoleList.value = false
    }
  }

  document.addEventListener('click', handleClickOutside)

  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside)
  })
})

defineExpose({
  refresh
})
</script>

<style scoped lang="scss">
.chat-role-selector {
  position: relative;
  width: 100%;
}

.current-role {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--bg-color);
  border: 1px solid var(--line-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;

  &:hover {
    background: var(--hover-color);
    border-color: var(--primary-color);
  }

  .role-info {
    flex: 1;
    min-width: 0;

    .role-name {
      font-size: 14px;
      font-weight: 500;
      color: var(--text-color);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .role-desc {
      font-size: 12px;
      color: #909090;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      margin-top: 2px;
    }
  }

  .expand-icon {
    color: #909090;
    transition: transform 0.3s;

    &.expanded {
      transform: rotate(180deg);
    }
  }
}

.role-list-container {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  background: var(--bg-color);
  border: 1px solid var(--line-color);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  overflow: hidden;
}

.role-list {
  .role-list-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var(--line-color);

    .header-title {
      font-size: 14px;
      font-weight: 500;
      color: var(--text-color);
    }
  }

  .role-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    cursor: pointer;
    transition: all 0.3s;
    position: relative;

    &:hover {
      background: var(--hover-color);
    }

    &.active {
      background: var(--primary-color-hover);

      .role-item-name {
        color: var(--primary-color);
      }
    }

    .role-item-info {
      flex: 1;
      min-width: 0;

      .role-item-name {
        font-size: 14px;
        font-weight: 500;
        color: var(--text-color);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .role-item-desc {
        font-size: 12px;
        color: #909090;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        margin-top: 2px;
      }
    }

    .check-icon {
      color: var(--primary-color);
    }
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;

    .empty-icon {
      color: #909090;
      margin-bottom: 12px;
    }

    .empty-text {
      font-size: 14px;
      color: #909090;
      margin-bottom: 16px;
    }
  }
}

// 애니메이션
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.3s ease;
}

.slide-fade-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
