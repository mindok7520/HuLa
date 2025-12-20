<template>
  <MobileLayout class="bg-gray-100 px-20px" :safeAreaTop="true" :safeAreaBottom="true">
    <HeaderBar
      :isOfficial="false"
      :hidden-right="true"
      :enable-default-background="false"
      :enable-shadow="false"
      room-name="로그인 확인" />

    <div
      class="flex flex-col rounded-15px bg-white pt-30px py-20px items-center justify-between gap-20px mt-40px h-70%">
      <div class="flex flex-col items-center gap-20px">
        <div class="flex items-center">
          <div class="text-26px">로그인</div>
        </div>

        <van-checkbox-group v-model="checkedValues" checked-color="#487D68" class="flex flex-col gap-14px text-14px">
          <van-checkbox name="syncRecentMessages">최근 메시지 동기화</van-checkbox>
          <van-checkbox name="autoLogin">이 기기에서 자동 로그인</van-checkbox>
        </van-checkbox-group>
      </div>
      <div class="flex w-45% gap-30px justify-center items-center flex-col">
        <van-button @click="handleConfirmLogin" color="#487D68" class="w-full" type="primary">로그인 확인</van-button>
        <div @click="handleCancelLogin" class="w-full text-center text-gray-600">로그인 취소</div>
      </div>
    </div>
  </MobileLayout>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useSettingStore } from '@/stores/setting'

const router = useRouter()
const settingStore = useSettingStore()

// 선택된 체크박스 관리
const checkedValues = ref(['syncRecentMessages', ''])

const shouldAutoLogin = computed(() => {
  return checkedValues.value.includes('autoLogin')
})

const handleConfirmLogin = async () => {
  try {
    // 자동 로그인 상태 설정
    settingStore.setAutoLogin(shouldAutoLogin.value)
    // 메인 페이지로 이동
    router.push('/mobile/home')
  } catch (error) {
    console.error('로그인 확인 실패:', error)
  }
}

const handleCancelLogin = () => {
  // 로그인 취소 시 자동 로그인 설정 안 함
  settingStore.setAutoLogin(false)
  router.back()
}
</script>

<style lang="scss" scoped></style>
