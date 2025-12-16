<template>
  <div class="h-full flex flex-col bg-gray-100">
    <!-- 페이지 전체 내용 -->
    <div class="flex flex-col flex-1 items-center px-15px">
      <div class="flex w-full flex-1 flex-col rounded-15px bg-white pt-40% items-center gap-20px">
        <div class="flex flex-col items-center gap-15px">
          <img class="w-100px h-100px" :src="qrCodeIcon" alt="" />
          <div class="text-20px font-bold text-#343434">
            로그인
            <span class="text-#6B9C89">{{ props.deviceType }}</span>
            &nbsp;의 HULA
          </div>
        </div>

        <div class="w-80% h-1px bg-gray-100"></div>

        <div class="flex flex-col w-80% gap-20px mt-10px">
          <div class="flex justify-between w-full">
            <span>로그인 IP</span>
            <span>{{ props.ip }}</span>
          </div>
          <div class="flex justify-between">
            <span>로그인 위치</span>
            <span>{{ props.locPlace }}</span>
          </div>
          <div class="flex justify-between">
            <span>로그인 시간</span>
            <span>{{ nowFormatted }}</span>
          </div>
        </div>

        <div class="w-80% h-1px bg-gray-100 mt-10px"></div>

        <!-- 로그인 버튼, 카운트다운 포함 -->
        <n-button
          :disabled="countdown <= 0"
          @click="handleConfirmLogin"
          class="px-50px bg-#6B9C89 text-white absolute bottom-20%">
          {{ countdown > 0 ? `로그인 (${countdown}s)` : 'QR 코드 만료됨' }}
        </n-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs'
import router from '@/router'
import { confirmQRCodeAPI } from '@/utils/ImRequestUtils'

const now = ref(dayjs()) // 현재 시간 객체

const nowFormatted = computed(() => now.value.format('YYYY-MM-DD HH:mm:ss'))

// 카운트다운
const countdown = ref(0)
let timer: number | null = null

const props = defineProps({
  ip: String,
  expireTime: String,
  deviceType: String,
  locPlace: String,
  qrId: String
})

const qrCodeIcon = ref('/logo.png')

const handleConfirmLogin = async () => {
  try {
    await confirmQRCodeAPI({ qrId: props.qrId as string })

    router.push('/mobile/message')
  } catch (error) {
    console.error('로그인 확인 오류:', error)
  }
}

onMounted(() => {
  // console.log('로그인 확인 페이지 props 속성:', props)

  // 남은 초 계산
  if (props.expireTime) {
    const expire = dayjs(Number(props.expireTime)) // dayjs 객체로 변환
    const diff = expire.diff(dayjs(), 'second') // 남은 초
    countdown.value = diff > 0 ? diff : 0
  }

  // 타이머 시작
  timer = window.setInterval(() => {
    if (countdown.value > 0) {
      countdown.value--
    } else {
      if (timer) clearInterval(timer)
    }
  }, 1000)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
</script>

<style lang="scss" scoped></style>
