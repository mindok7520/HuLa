<template>
  <!-- 철회된 메시지 -->
  <main class="w-full flex-center">
    <template v-if="isGroup">
      <n-flex align="center" :size="6" v-if="fromUserUid === userUid">
        <p class="text-(12px #909090) select-none cursor-default">{{ message.body.content }}</p>
        <p v-if="canReEdit" class="text-(12px #13987f) select-none cursor-pointer" @click="handleReEdit(message.id)">
          다시 편집
        </p>
      </n-flex>
      <span v-else class="text-12px color-#909090 select-none" v-html="recallText"></span>
    </template>
    <template v-else>
      <n-flex align="center" :size="6">
        <p class="text-(12px #909090) select-none cursor-default">
          {{ message.body.content }}
        </p>
        <p v-if="canReEdit" class="text-(12px #13987f) select-none cursor-pointer" @click="handleReEdit(message.id)">
          다시 편집
        </p>
      </n-flex>
    </template>
  </main>
</template>

<script setup lang="ts">
import { MittEnum, MsgEnum } from '@/enums'
import { useMitt } from '@/hooks/useMitt.ts'
import type { MessageBody, MsgType } from '@/services/types'
import { useChatStore } from '@/stores/chat.ts'
import { useUserStore } from '@/stores/user.ts'

const props = defineProps<{
  message: MsgType
  fromUserUid: string
  isGroup?: boolean
  body: MessageBody
}>()

const chatStore = useChatStore()
const userStore = useUserStore()

const userUid = computed(() => userStore.userInfo!.uid)

const recallText = computed(() => {
  // body가 문자열이거나 객체일 수 있는 상황 처리
  if (typeof props.body === 'string') {
    return props.body
  } else if (props.body && typeof props.body === 'object' && 'content' in props.body) {
    return props.body.content
  }
  return '메시지를 철회했습니다'
})

// recalledMessages에 직접 접근하여 반응형 의존성 수집이 정상 작동하도록 보장
const canReEdit = computed(() => {
  const msgId = props.message.id
  // recalledMessages 객체에 직접 접근하여 삭제 작업 추적 보장
  const recalledMsg = chatStore.recalledMessages[msgId]
  const message = chatStore.getMessage(msgId)
  if (!recalledMsg || !message) return false

  // 텍스트 유형의 철회된 메시지만 다시 편집 가능
  if (recalledMsg.originalType !== MsgEnum.TEXT) return false

  // 현재 사용자의 메시지인지 여부만 판단하면 됨
  return message.fromUser.uid === userUid.value
})

const handleReEdit = (msgId: string) => {
  const recalledMsg = chatStore.getRecalledMessage(msgId)
  if (recalledMsg) {
    useMitt.emit(MittEnum.RE_EDIT, recalledMsg.content)
  }
}
</script>
