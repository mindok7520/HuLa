```
<template>
  <MobileLayout :topSafeAreaClass="computedTopAreaClass">
    <div class="h-full flex flex-col">
      <!-- 페이지 전체 내용 -->
      <div class="flex flex-col flex-1">
        <RouterView v-slot="{ Component }">
          <div class="page-view">
            <component :is="Component" :key="route.fullPath" />
          </div>
        </RouterView>
      </div>
    </div>
  </MobileLayout>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import { MittEnum } from '@/enums'
import { useMitt } from '@/hooks/useMitt'
import router from '@/router'
import { useGlobalStore } from '@/stores/global'
import { useUserStore } from '@/stores/user'
import { getGroupDetail, scanQRCodeAPI } from '@/utils/ImRequestUtils'

interface ScanData {
  type: string // 필수
  [key: string]: any // 다른 임의 필드 허용
}

const handleScanLogin = async (data: ScanData) => {
  if (!Object.hasOwn(data, 'qrId')) {
    window.$message.warning('로그인 QR 코드에 qrId가 없습니다')
    throw new Error('로그인 QR 코드에 qrId가 없습니다:', data as any)
  }

  const { qrId } = data

  const result = await scanQRCodeAPI({ qrId: qrId })

  router.push({
    name: 'mobileConfirmQRLogin',
    params: {
      ip: result.ip,
      expireTime: result.expireTime,
      deviceType: result.deviceType,
      locPlace: Object.hasOwn(result, 'locPlace') ? (result.locPlace ? result.locPlace : '서울') : '서울',
      qrId
    }
  })
}

const globalStore = useGlobalStore()
const userStore = useUserStore()

const handleScanAddFriend = async (data: ScanData) => {
  console.log('QR코드 스캔 친구 추가 시도')
  if (!Object.hasOwn(data, 'uid')) {
    window.$message.warning('로그인 QR 코드에 uid가 없습니다')
    throw new Error('로그인 QR 코드에 uid가 없습니다:', data as any)
  }

  const uidStr = data.uid as string
  const uid = uidStr.split('&')[0]

  // uid가 본인인지 확인

  const selfUid = userStore.userInfo?.uid as string

  if (selfUid === uid) {
    window.$message.warning('본인을 친구로 추가할 수 없습니다~', { duration: 4000 })
    throw new Error('사용자가 자신의 QR 코드를 스캔하여 친구 추가를 시도했으나 거부됨:', data as any)
  }

  globalStore.addFriendModalInfo.uid = uid

  setTimeout(() => {
    router.push({ name: 'mobileConfirmAddFriend' })
  }, 100)
}

/**
 * QR코드 스캔으로 그룹 입장
 */
const handleScanEnterGroup = async (data: ScanData) => {
  console.log('QR코드 스캔 그룹 가입 시도', data, Object.hasOwn(data, 'roomId'))
  if (!Object.hasOwn(data, 'roomId')) {
    window.$message.warning('그룹 가입 QR 코드에 roomId가 없습니다')
    throw new Error('그룹 가입 QR 코드에 roomId가 없습니다:', data as any)
  }

  const roomId = data.roomId as string

  // 스캔된 것일 수 있음
  const groupDetail = await getGroupDetail(roomId)

  globalStore.addGroupModalInfo.account = groupDetail.account
  globalStore.addGroupModalInfo.name = groupDetail.groupName
  globalStore.addGroupModalInfo.avatar = groupDetail.avatar

  setTimeout(() => {
    router.push({ name: 'mobileConfirmAddGroup' })
  }, 100)
}

/**
 * 이벤트 스캔 모니터링
 */
useMitt.on(MittEnum.QR_SCAN_EVENT, async (data: ScanData) => {
  if (!Object.hasOwn(data, 'type')) {
    window.$message.warning('올바른 QR 코드를 인식할 수 없습니다')
    throw new Error('QR 코드에 type 필드가 누락되었습니다:', data as any)
  }

  switch (data.type) {
    case 'login':
      try {
        await handleScanLogin(data)
      } catch (error) {
        console.log('QR코드 스캔으로 토큰 획득 시도 실패:', error)
      }
      break
    case 'addFriend':
      try {
        await handleScanAddFriend(data)
      } catch (error) {
        console.log('QR코드 스캔 친구 추가 실패:', error)
      }
      break
    case 'scanEnterGroup':
      try {
        await handleScanEnterGroup(data)
      } catch (error) {
        console.log('QR코드 스캔 그룹 가입 실패:', error)
      }
      break
    default:
      window.$message.warning('올바른 QR 코드를 인식할 수 없습니다')
      throw new Error('QR 코드에 type 필드가 누락되었습니다:', data as any)
  }
})

const computedTopAreaClass = computed(() => {
  return route.name !== 'mobileSimpleBio' ? 'bg-white' : ''
})

const route = useRoute()
</script>

<style lang="scss" scoped>
// .page-view {
//   // 진입 애니메이션
//   animation: fade-slide-in 0.3s ease;
// }

// @keyframes fade-slide-in {
//   from {
//     transform: translateX(20px);
//     opacity: 0;
//   }
//   to {
//     transform: translateX(0);
//     opacity: 1;
//   }
// }
</style>
