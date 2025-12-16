<template>
  <div class="flex flex-1 flex-col">
    <img src="@/assets/mobile/chat-home/background.webp" class="w-100% absolute top-0 -z-1" alt="hula" />
    <AutoFixHeightPage :show-footer="false">
      <template #header>
        <HeaderBar
          :isOfficial="false"
          :hidden-right="true"
          :enable-default-background="false"
          :enable-shadow="false"
          room-name="그룹 채팅 가입" />
      </template>

      <template #container>
        <div class="flex flex-col gap-1 overflow-auto h-full">
          <!-- 콘텐츠 영역 -->
          <div class="w-full h-full box-border flex flex-col">
            <n-flex vertical justify="center" :size="20" class="p-[55px_20px] bg-white m-20px rounded-15px">
              <n-flex align="center" justify="center" :size="20">
                <n-avatar round size="large" :src="userInfo.avatar" />

                <n-flex vertical :size="10">
                  <p class="text-[--text-color]">{{ userInfo.name }}</p>
                  <p class="text-(12px [--text-color])">그룹 번호: {{ userInfo.account }}</p>
                </n-flex>
              </n-flex>

              <n-input
                v-model:value="requestMsg"
                :allow-input="(value: string) => !value.startsWith(' ') && !value.endsWith(' ')"
                :autosize="requestMsgAutosize"
                :maxlength="60"
                :count-graphemes="countGraphemes"
                show-count
                spellCheck="false"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                type="textarea"
                placeholder="인증 메시지 입력" />

              <n-button class="mt-120px" color="#13987f" @click="addFriend">가입 신청</n-button>
            </n-flex>
          </div>
        </div>
      </template>
    </AutoFixHeightPage>
  </div>
</template>

<script setup lang="ts">
import { useCommon } from '@/hooks/useCommon.ts'
import router from '@/router'
import { useGlobalStore } from '@/stores/global.ts'
import { useUserStore } from '@/stores/user.ts'
import { applyGroup } from '@/utils/ImRequestUtils'

const globalStore = useGlobalStore()
const userStore = useUserStore()
const { countGraphemes } = useCommon()
const requestMsgAutosize = { minRows: 3, maxRows: 3 }
const userInfo = ref(globalStore.addGroupModalInfo)
const requestMsg = ref()

watch(
  () => globalStore.addGroupModalInfo,
  (newUid) => {
    userInfo.value = { ...newUid }
  }
)

const addFriend = async () => {
  await applyGroup({
    msg: requestMsg.value,
    account: String(globalStore.addGroupModalInfo.account),
    type: 2
  })
  window.$message.success('그룹 채팅 신청을 보냈습니다')
  setTimeout(() => {
    router.push('/mobile/message')
  }, 2000)
}

onMounted(async () => {
  console.log(userInfo.value)
  requestMsg.value = `저는 ${userStore.userInfo!.name}입니다`
})
</script>

<style scoped lang="scss"></style>
