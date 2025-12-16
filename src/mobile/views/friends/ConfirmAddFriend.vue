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
          room-name="친구 추가" />
      </template>

      <template #container>
        <div class="flex flex-col gap-1 overflow-auto h-full">
          <!-- 콘텐츠 영역 -->
          <div class="w-full h-full box-border flex flex-col">
            <n-flex vertical justify="center" :size="20" class="p-[55px_20px] m-20px rounded-15px bg-white">
              <n-flex align="center" justify="center" :size="20">
                <n-avatar round size="large" :src="avatarSrc" />

                <n-flex vertical :size="10">
                  <p class="text-[--text-color]">{{ userInfo.name }}</p>
                  <p class="text-(12px [--text-color])">계정: {{ userInfo.account }}</p>
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
                placeholder="몇 마디 말을 남겨보세요" />

              <n-button class="mt-30px" color="#13987f" @click="addFriend">친구 추가</n-button>
            </n-flex>
          </div>
        </div>
      </template>
    </AutoFixHeightPage>
  </div>
</template>

<script setup lang="ts">
import { useCommon } from '@/hooks/useCommon.ts'
import { useGlobalStore } from '@/stores/global.ts'
import { useGroupStore } from '@/stores/group'
import { useUserStore } from '@/stores/user.ts'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { sendAddFriendRequest } from '@/utils/ImRequestUtils'
import router from '@/router'

const globalStore = useGlobalStore()
const userStore = useUserStore()
const groupStore = useGroupStore()
const { countGraphemes } = useCommon()
const requestMsgAutosize = { minRows: 3, maxRows: 3 }
const userInfo = ref(groupStore.getUserInfo(globalStore.addFriendModalInfo.uid!)!)
const avatarSrc = computed(() => AvatarUtils.getAvatarUrl(userInfo.value!.avatar as string))
const requestMsg = ref()

watch(
  () => globalStore.addFriendModalInfo.uid,
  (newUid) => {
    userInfo.value = groupStore.getUserInfo(newUid!)!
  }
)

const addFriend = async () => {
  await sendAddFriendRequest({
    msg: requestMsg.value,
    targetUid: globalStore.addFriendModalInfo.uid as string
  })
  window.$message.success('친구 신청을 보냈습니다')
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
