<template>
  <main class="multi-msg" @click.stop="openMultiMsgWindow">
    <p class="text-(14px [--text-color]) select-none pb-12px truncate">{{ chatRecordTitle }}</p>

    <div class="max-h-90px overflow-hidden mx-6px select-none">
      <p v-for="content in processedContentList" class="text-(12px [--chat-text-color]) leading-22px truncate">
        {{ content }}
      </p>
    </div>

    <p class="w-full h-1px bg-#e3e3e3 dark:bg-#80808050 my-6px select-none"></p>

    <p class="text-(10px [--chat-text-color]) ml-4px select-none">전달된 메시지 {{ msgIds.length }}개 보기</p>
  </main>
</template>

<script setup lang="ts">
import { MSG_REPLY_TEXT_MAP } from '@/common/message'
import { EventEnum, MsgEnum, RoomTypeEnum } from '@/enums'
import { useWindow } from '@/hooks/useWindow'
import { useChatStore } from '@/stores/chat'
import { useGlobalStore } from '@/stores/global'
import { useGroupStore } from '@/stores/group'
import { useUserStore } from '@/stores/user'
import type { MsgId } from '@/typings/global'

const { contentList, msgIds, msgId } = defineProps<{
  contentList: string[]
  msgIds: MsgId[]
  msgId?: string
}>()

const { createWebviewWindow, sendWindowPayload } = useWindow()
const globalStore = useGlobalStore()
const userStore = useUserStore()
const chatStore = useChatStore()
const groupStore = useGroupStore()

// 채팅 기록 제목 계산
const chatRecordTitle = computed(() => {
  if (globalStore.currentSession?.type === RoomTypeEnum.GROUP) {
    return '그룹 채팅 기록'
  } else {
    // 일대일 채팅 시 친구 이름과 내 이름 조합 표시
    const friendName = globalStore.currentSession?.name || ''
    const myName = userStore.userInfo?.name || ''
    return `${friendName}님과 ${myName}님의 채팅 기록`
  }
})

// 메시지 유형에 따른 표시 내용 처리
const processedContentList = computed(() => {
  // msgIds가 없으면 기존 contentList 반환
  if (!msgIds || msgIds.length === 0) {
    return contentList
  }

  // msgIds를 통해 전체 메시지 정보 가져오기 시도
  return msgIds.map((msgId, index) => {
    // 현재 채팅 메시지에서 해당 메시지 찾기 시도
    const message = chatStore.currentMessageMap?.[msgId.msgId]

    if (message) {
      const userInfo = groupStore.getUserInfo(message.fromUser.uid)
      const userName = userInfo?.name || ''
      const msgType = message.message.type

      // 메시지 표시 내용 가져오기
      let content = ''

      // 표시하지 않을 메시지 유형 제외
      if (msgType === MsgEnum.UNKNOWN || msgType === MsgEnum.RECALL || msgType === MsgEnum.BOT) {
        content = message.message.body.content || ''
      } else if (MSG_REPLY_TEXT_MAP[msgType]) {
        // 특수 유형 메시지의 경우 해당 텍스트 힌트 표시
        content = MSG_REPLY_TEXT_MAP[msgType]
      } else {
        // 텍스트 메시지 또는 기타 메시지
        content = message.message.body.content || ''
      }

      return userName + ': ' + content
    } else {
      // 메시지 상세 정보를 찾을 수 없는 경우 원본 contentList 사용
      return contentList[index] || ''
    }
  })
})

const openMultiMsgWindow = async () => {
  const label = msgId ? `${EventEnum.MULTI_MSG}${msgId}` : EventEnum.MULTI_MSG
  try {
    // 창 생성
    await createWebviewWindow('채팅 기록', label, 600, 600, undefined, true, 600, 400, undefined, undefined, {
      key: label
    })

    // 창에 메시지 데이터 전송
    await sendWindowPayload(label, msgIds)
  } catch (e) {
    console.error('채팅 기록 창 생성 실패:', e)
    window.$message?.error('채팅 기록을 여는 데 실패했습니다.')
  }
}
</script>

<style scoped lang="scss">
.multi-msg {
  cursor: default;
  @apply: w-230px flex flex-col h-fit bg-[--group-notice-bg]
  border-(1px solid #e3e3e3) dark:border-(1px solid #404040)
  hover:bg-#fefefe99 dark:hover:bg-#60606040 rounded-8px p-8px box-border
  custom-shadow transition-colors duration-200;
}
</style>
