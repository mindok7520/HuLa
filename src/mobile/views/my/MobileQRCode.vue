<template>
  <div class="scanner-page">
    <HeaderBar
      class="scanner-header"
      :isOfficial="false"
      :hidden-right="true"
      :enable-default-background="false"
      :enable-shadow="false"
      room-name="" />

    <div class="scanner">
      <div
        class="w-60 h-60 mt-30% items-center justify-center border-op-50 overflow-hidden flex-col rounded-15px flex border-solid border-white border-3"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { listen } from '@tauri-apps/api/event'
import { cancel, Format, scan } from '@tauri-apps/plugin-barcode-scanner'
import { MittEnum } from '@/enums'
import { useMitt } from '@/hooks/useMitt'
import router from '@/router'

const result = ref<string | null>(null)
const isActive = ref(true)

const startScan = async () => {
  try {
    const scanTask = scan({
      windowed: true,
      formats: [Format.QRCode, Format.EAN13]
    })

    const cancelTask = new Promise((resolve) => {
      const interval = setInterval(() => {
        if (!isActive.value) {
          clearInterval(interval)
          resolve(null)
        }
      }, 300)
    })

    const res = (await Promise.race([scanTask, cancelTask])) as any

    // 비어 있거나 취소됨
    if (!res) {
      result.value = '스캔 취소됨'
      return
    }

    console.log('스캔 결과:', res)

    if (res && typeof res === 'object' && 'content' in res && typeof res.content === 'string') {
      try {
        const jsonData = JSON.parse(res.content)
        console.log('스캔 JSON:', jsonData)
        useMitt.emit(MittEnum.QR_SCAN_EVENT, jsonData)
      } catch (error) {
        console.log('스캔 결과가 JSON이 아님, 일반 텍스트로 처리:', error)
        useMitt.emit(MittEnum.QR_SCAN_EVENT, { raw: res.content })
      }

      if (window.history.length > 1) {
        window.history.back()
      } else {
        window.close()
      }
      result.value = res.content
    } else if (typeof res === 'string') {
      // 일부 플랫폼은 문자열 내용을 직접 반환할 수 있음
      useMitt.emit(MittEnum.QR_SCAN_EVENT, { raw: res })
      result.value = res
      if (window.history.length > 1) window.history.back()
      else window.close()
    } else {
      result.value = '스캔 실패 또는 취소됨'
    }
  } catch (err: any) {
    console.error('스캔 예외 발생:', err)

    if (err && typeof err === 'object' && 'message' in err && /permission/i.test(err.message)) {
      alert('카메라 권한이 없습니다. 시스템 설정에서 권한을 켜주세요.')
      router.back() // 사용자가 확인 클릭 후 여기 실행
      result.value = '권한 없음'
    } else {
      alert('스캔 중 오류 발생')
      router.back() // 기타 오류도 이전 페이지로 복귀
      result.value = '스캔 중 오류 발생'
    }
  }
}

let unlistenAndroidBack: (() => void) | null = null
let originalAppBg = ''

onMounted(async () => {
  // 카메라 미리보기 표시: 루트 컨테이너 배경을 투명하게 설정하여 가림 방지
  const appContainer = document.querySelector('.appContainer') as HTMLElement | null
  if (appContainer) {
    originalAppBg = appContainer.style.backgroundColor || ''
    appContainer.style.backgroundColor = 'transparent'
  }

  isActive.value = true
  startScan()

  // Android 기기에서만 뒤로 가기 키 수신 대기, iOS/Safari 환경 오류 방지
  const isAndroid = /Android/i.test(navigator.userAgent)
  if (isAndroid) {
    try {
      unlistenAndroidBack = await listen('tauri://android-back', () => {
        isActive.value = false
        cancel().catch((e) => {
          console.warn('cancel() 호출 실패:', e)
        })
      })
    } catch (e) {
      console.warn('Android 뒤로 가기 키 수신 대기 실패:', e)
    }
  }
})

onUnmounted(() => {
  isActive.value = false
  if (unlistenAndroidBack) {
    unlistenAndroidBack()
    unlistenAndroidBack = null
  }
  // 앱 루트 컨테이너 배경색 복원
  const appContainer = document.querySelector('.appContainer') as HTMLElement | null
  if (appContainer) {
    appContainer.style.backgroundColor = originalAppBg
  }
  cancel().catch((e) => {
    console.warn('cancel() 호출 실패:', e)
  })
})
</script>

<style scoped>
.scanner-page {
  position: relative;
  width: 100%;
  height: 100%;
}

.scanner-header {
  position: relative;
  z-index: 10; /* 헤더가 스캔 레이어 위에 오도록 보장 */
}

.scanner {
  position: fixed;
  inset: 0;
  background: transparent; /* 투명 유지, 카메라 미리보기 투과 */
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  text-align: center;
  pointer-events: none; /* 클릭 가로채지 않음, 뒤로 가기 버튼 가림 방지 */
}

.scanner > div {
  z-index: 1;
}
</style>
