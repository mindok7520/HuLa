<template>
  <div class="h-full w-full bg-[--center-bg-color] select-none cursor-default">
    <!-- 창 헤더 -->
    <ActionBar
      class="absolute right-0 w-full z-999"
      :shrink="false"
      :min-w="false"
      :max-w="false"
      :isDrag="false"
      :current-label="WebviewWindow.getCurrent().label" />

    <!-- 제목 -->
    <p
      class="absolute-x-center h-fit pt-6px text-(12px [--text-color]) select-none cursor-default"
      data-tauri-drag-region>
      {{ windowTitle }}
    </p>

    <!-- 내용 영역 -->
    <div class="bg-[--bg-edit] pt-24px size-full box-border flex flex-col">
      <n-transfer
        class="h-full text-[--text-color]"
        source-filterable
        target-filterable
        v-model:value="selectedValue"
        :options="filteredOptions"
        :render-source-list="renderSourceList()"
        :render-target-label="renderLabel"
        :disabled-options="disabledOptions" />

      <n-flex align="center" justify="end" class="p-16px">
        <n-button color="#13987f" @click="handleInvite">{{ t('home.chat_header.modal.confirm') }}</n-button>
        <n-button secondary @click="handleClose">{{ t('home.chat_header.modal.cancel') }}</n-button>
      </n-flex>
    </div>
  </div>
</template>
<script setup lang="ts">
import { getCurrentWebviewWindow, WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useMitt } from '@/hooks/useMitt'
import { useWindow } from '@/hooks/useWindow'
import { getDisabledOptions, getFilteredOptions, renderLabel, renderSourceList } from '@/layout/center/model.tsx'
import { useGroupStore } from '@/stores/group'
import { inviteGroupMember } from '@/utils/ImRequestUtils'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const { getWindowPayload } = useWindow()
const groupStore = useGroupStore()
const windowTitle = ref('')
const selectedValue = ref([])
// 부모 창에서 전달된 roomId
const roomId = ref<string>('')
// model.tsx의 getDisabledOptions 사용
const disabledOptions = computed(() => getDisabledOptions())

// model.tsx의 getFilteredOptions 사용
const filteredOptions = computed(() => getFilteredOptions())

// 그룹 멤버 데이터 초기화
const initGroupMembers = async () => {
  if (roomId.value) {
    await groupStore.getGroupUserList(roomId.value)
  }
}

const handleInvite = async () => {
  if (selectedValue.value.length < 1) return

  try {
    // 그룹 멤버 초대 API 호출
    await inviteGroupMember({
      roomId: roomId.value,
      uidList: selectedValue.value
    })

    window.$message.success('초대가 완료되었습니다')
    setTimeout(() => {
      handleClose()
    }, 1000)
  } catch (error) {
    console.error('초대 실패:', error)
    window.$message.error('초대에 실패했습니다. 다시 시도해주세요.')
  }
}

const handleClose = () => {
  useMitt.emit('handleCloseWin')
}

onMounted(async () => {
  await getCurrentWebviewWindow().show()

  // 창 제목 가져오기
  windowTitle.value = await getCurrentWebviewWindow().title()

  // 부모 창에서 전달된 페이로드 가져오기
  const payload = await getWindowPayload<{ roomId: string; type: number }>('modal-invite')
  if (payload?.roomId) {
    roomId.value = payload.roomId
  }

  // 그룹 멤버 데이터 초기화
  await initGroupMembers()
})
</script>

<style scoped lang="scss">
@use '@/layout/center/style.scss';
</style>
