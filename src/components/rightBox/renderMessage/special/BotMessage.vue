<template>
  <!-- 로봇 메시지일 때 -->
  <main class="w-full flex-center">
    <div
      class="chat-message-max-width dark:bg-[#fbb99020] bg-[#fbb99030] dark:border-(1px solid #fbb99020) border-(1px solid #fbb99040) flex-center chat-bot-message-gap px-12px py-4px rounded-8px">
      <n-avatar class="select-none" round :size="22" :src="getAvatarSrc(fromUserUid)" />
      <div
        v-for="(part, index) in parseMessage(body.content)"
        :key="index"
        class="text-(12px #fbb990) leading-tight select-none cursor-default">
        <p v-if="part.type === 'text'">{{ part.text }}</p>
        <p v-else-if="part.type === 'bracket'" class="text-#13987f truncate max-w-20">
          {{ part.text }}
        </p>
        <p v-else-if="part.type === 'number'" class="text-#fbb160">{{ part.text }}</p>
      </div>
      <img class="size-18px" src="/emoji/party-popper.webp" alt="" />
    </div>
  </main>
</template>

<script setup lang="ts">
import { useUserStore } from '@/stores/user.ts'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { useGroupStore } from '@/stores/group'

interface Props {
  body: any
  fromUserUid: string
}

defineProps<Props>()

const userStore = useUserStore()
const groupStore = useGroupStore()

const userUid = computed(() => userStore.userInfo!.uid)

// 로봇 메시지 내용 처리, []로 감싸진 내용 강조
const parseMessage = (content: string) => {
  if (!content) return []

  // 안전한 텍스트 파싱, HTML 주입 위험 없음
  return content
    .split(/(\[.*?\]|\d+)/)
    .map((part) => {
      if (part.match(/^\[.*\]$/)) {
        return { type: 'bracket', text: part.slice(1, -1) }
      } else if (part.match(/^\d+$/)) {
        return { type: 'number', text: part }
      }
      return { type: 'text', text: part }
    })
    .filter((part) => part.text)
}

// 사용자 프로필 사진 가져오기
const getAvatarSrc = (uid: string) => {
  const avatar = uid === userUid.value ? userStore.userInfo!.avatar : groupStore.getUserInfo(uid)?.avatar
  return AvatarUtils.getAvatarUrl(avatar as string)
}
</script>
